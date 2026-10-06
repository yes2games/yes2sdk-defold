-- encode_options / fail_async / invalid_param: the shared helpers behind every
-- API that accepts an options table or a JSON string. They are local to
-- yes2sdk.lua and reached in tests through h.load_internals.

local h = require("harness")

local T = {}

local function load()
  return h.load_internals({ native = h.fake_native() })
end

function T.table_is_encoded_as_json()
  local sdk, i = load()
  local out, err = i.encode_options({ level = 3 })
  assert(err == nil, "unexpected error")
  h.deep_eq(h.env.json.decode(out), { level = 3 })
end

function T.nested_table_is_encoded()
  local sdk, i = load()
  local out = i.encode_options({ a = { b = { 1, 2 } }, name = "x" })
  h.deep_eq(h.env.json.decode(out), { a = { b = { 1, 2 } }, name = "x" })
end

function T.empty_table_is_nil()
  local sdk, i = load()
  local out, err = i.encode_options({})
  assert(out == nil and err == nil, "empty table must give nil, nil")
end

function T.string_passes_through()
  local sdk, i = load()
  local out, err = i.encode_options('{"a":1}')
  assert(out == '{"a":1}' and err == nil)
end

function T.empty_string_is_nil()
  local sdk, i = load()
  local out, err = i.encode_options("")
  assert(out == nil and err == nil)
end

function T.nil_is_nil()
  local sdk, i = load()
  local out, err = i.encode_options(nil)
  assert(out == nil and err == nil)
  out, err = i.encode_options()
  assert(out == nil and err == nil)
end

local function assert_invalid(i, value, type_name)
  local out, err = i.encode_options(value)
  assert(out == nil, "value must be nil for " .. type_name)
  assert(type(err) == "string", "error json expected for " .. type_name)
  local parsed = h.env.json.decode(err)
  assert(parsed.code == "INVALID_PARAM", "code: " .. tostring(parsed.code))
  assert(parsed.message:find(type_name, 1, true), "message must name " .. type_name .. ": " .. parsed.message)
  assert(type(parsed.context) == "string")
end

function T.number_is_invalid_param()
  local sdk, i = load()
  assert_invalid(i, 42, "number")
end

function T.boolean_is_invalid_param()
  local sdk, i = load()
  assert_invalid(i, true, "boolean")
  assert_invalid(i, false, "boolean")
end

function T.function_is_invalid_param()
  local sdk, i = load()
  assert_invalid(i, function() end, "function")
end

function T.invalid_param_builds_the_error_json()
  local sdk, i = load()
  h.deep_eq(sdk.parse_error(i.invalid_param("bad", "ctx")),
    { code = "INVALID_PARAM", message = "bad", context = "ctx" })
  h.deep_eq(sdk.parse_error(i.invalid_param("bad")),
    { code = "INVALID_PARAM", message = "bad", context = "" })
end

function T.fail_async_fires_on_the_next_frame()
  local sdk, i = load()
  local calls = {}
  local payload = '{"code":"INVALID_PARAM","message":"m","context":""}'
  i.fail_async(function(self, success, err)
    calls[#calls + 1] = { self = self, success = success, err = err }
  end, payload)
  assert(#calls == 0, "must not call back synchronously")
  h.step()
  assert(#calls == 1, "expected one callback, got " .. #calls)
  assert(calls[1].success == false)
  assert(calls[1].err == payload)
  assert(calls[1].self == h.state.script, "callback must receive the timer's self")
  h.step()
  assert(#calls == 1, "must fire once")
end

function T.unencodable_table_is_invalid_param_not_a_raise()
  local sdk, i = load()
  local out, err = i.encode_options({ f = function() end }, "x.y")
  assert(out == nil and type(err) == "string")
  local parsed = h.env.json.decode(err)
  assert(parsed.code == "INVALID_PARAM" and parsed.context == "x.y")
  local cyc = {}
  cyc.self = cyc
  out, err = i.encode_options(cyc)
  assert(out == nil and h.env.json.decode(err).code == "INVALID_PARAM")
end

function T.context_is_carried_into_the_error()
  local sdk, i = load()
  local _, err = i.encode_options(42, "session.start")
  assert(h.env.json.decode(err).context == "session.start")
end

function T.fail_async_falls_back_when_timer_raises()
  local sdk, i = load()
  h.env.timer.delay = function() error("no script context") end
  local got
  i.fail_async(function(self, success, err) got = { self, success, err } end, "E")
  assert(got and got[2] == false and got[3] == "E", "callback must still be delivered")
end

function T.fail_async_falls_back_on_invalid_timer_handle()
  local sdk, i = load()
  h.env.timer.delay = function() return h.env.timer.INVALID_TIMER_HANDLE end
  local got
  i.fail_async(function(self, success, err) got = { self, success, err } end, "E")
  assert(got and got[2] == false and got[3] == "E")
end

function T.public_module_exposes_no_internals()
  local sdk = h.load_wrapper{ native = h.fake_native() }
  assert(sdk._internal == nil and sdk.encode_options == nil)
end

function T.fail_async_without_a_callback_is_a_noop()
  local sdk, i = load()
  i.fail_async(nil, "{}")
  h.step()
end

return T
