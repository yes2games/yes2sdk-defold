-- Confirmed writes: data_set_string_async, data_flush, player_flush_data.
-- Native routing, editor mock and the extension-not-loaded warn stub.

local h = require("harness")

local T = {}

local function callback_of(call)
  for i = 1, call.n do
    if type(call.args[i]) == "function" then return call.args[i] end
  end
  error("native call has no callback")
end

function T.set_string_async_passes_key_value_and_own_callback()
  local fake = h.fake_native()
  local sdk = h.load_wrapper{ native = fake }
  local got = {}
  sdk.data_set_string_async("k1", "v1", function(self, s, e) got[#got + 1] = "first:" .. tostring(s) end)
  sdk.data_set_string_async("k2", "v2", function(self, s, e) got[#got + 1] = "second:" .. tostring(s) end)
  local calls = fake:calls_to("data_set_string_async")
  h.eq(#calls, 2)
  h.eq(calls[1].args[1], "k1")
  h.eq(calls[1].args[2], "v1")
  callback_of(calls[2])(h.state.script, true, nil)
  callback_of(calls[1])(h.state.script, false, "{}")
  h.deep_eq(got, { "second:true", "first:false" })
end

function T.flush_calls_route_per_call()
  local fake = h.fake_native()
  local sdk = h.load_wrapper{ native = fake }
  local got = {}
  sdk.data_flush(function(self, s) got[#got + 1] = "d" .. tostring(s) end)
  sdk.player_flush_data(function(self, s) got[#got + 1] = "p" .. tostring(s) end)
  h.eq(#fake:calls_to("data_flush"), 1)
  h.eq(#fake:calls_to("player_flush_data"), 1)
  callback_of(fake:last("player_flush_data"))(h.state.script, true, nil)
  callback_of(fake:last("data_flush"))(h.state.script, true, nil)
  h.deep_eq(got, { "ptrue", "dtrue" })
end

local function mock_sdk()
  return h.load_wrapper{ system_name = "Linux" }
end

function T.mock_succeeds_on_the_next_frame()
  local sdk = mock_sdk()
  local got = {}
  sdk.data_set_string_async("k", "v", function(self, s, e) got[#got + 1] = { "set", s, e } end)
  sdk.data_flush(function(self, s, e) got[#got + 1] = { "flush", s, e } end)
  sdk.player_flush_data(function(self, s, e) got[#got + 1] = { "pflush", s, e } end)
  h.eq(#got, 0, "no synchronous callback")
  h.advance(0.1)
  h.deep_eq(got, { { "set", true, nil }, { "flush", true, nil }, { "pflush", true, nil } })
end

function T.warn_stub_fails_next_frame_with_not_initialized()
  local sdk = h.load_wrapper{ system_name = "HTML5" }
  local got = {}
  sdk.data_set_string_async("k", "v", function(self, s, e) got[#got + 1] = { s, e } end)
  sdk.data_flush(function(self, s, e) got[#got + 1] = { s, e } end)
  sdk.player_flush_data(function(self, s, e) got[#got + 1] = { s, e } end)
  h.eq(#got, 0, "callback must not be synchronous")
  h.advance(0.1)
  h.eq(#got, 3)
  for i = 1, 3 do
    h.eq(got[i][1], false)
    h.eq(sdk.parse_error(got[i][2]).code, "NOT_INITIALIZED")
  end
end

return T
