-- Context image share wrapper and editor mock.

local h = require("harness")

local T = {}

local function decode(s) return h.env.json.decode(s) end

function T.table_options_are_encoded_with_default_intent()
  local fake = h.fake_native()
  local sdk = h.load_wrapper{ native = fake }
  sdk.context_share({ text = "hi", image = "data:image/png;base64,AAAA" }, function() end)
  local call = fake:last("context_share")
  h.truthy(call, "native must be called")
  h.deep_eq(decode(call.args[1]), { text = "hi", image = "data:image/png;base64,AAAA", intent = "SHARE" })
end

function T.explicit_intent_is_kept_and_input_not_mutated()
  local fake = h.fake_native()
  local sdk = h.load_wrapper{ native = fake }
  local options = { intent = "CHALLENGE", data = { score = 5 } }
  sdk.context_share(options, function() end)
  h.deep_eq(decode(fake:last("context_share").args[1]), { intent = "CHALLENGE", data = { score = 5 } })
  h.eq(options.intent, "CHALLENGE")
  local plain = {}
  sdk.context_share(plain, function() end)
  h.eq(next(plain), nil, "caller table must not gain an intent")
end

function T.nil_options_share_with_default_intent()
  local fake = h.fake_native()
  local sdk = h.load_wrapper{ native = fake }
  sdk.context_share(nil, function() end)
  h.deep_eq(decode(fake:last("context_share").args[1]), { intent = "SHARE" })
end

function T.string_options_pass_through()
  local fake = h.fake_native()
  local sdk = h.load_wrapper{ native = fake }
  sdk.context_share('{"intent":"INVITE"}', function() end)
  h.eq(fake:last("context_share").args[1], '{"intent":"INVITE"}')
end

function T.bad_options_type_fails_next_frame_with_invalid_param()
  local fake = h.fake_native()
  local sdk = h.load_wrapper{ native = fake }
  local got
  sdk.context_share(42, function(self, success, err) got = { success, err } end)
  h.eq(got, nil, "must not call back synchronously")
  h.eq(#fake:calls_to("context_share"), 0, "native must not be reached")
  h.advance(0)
  h.truthy(got, "callback must fire")
  h.eq(got[1], false)
  h.eq(decode(got[2]).code, "INVALID_PARAM")
end

function T.nil_callback_is_wrapped_in_a_noop()
  local fake = h.fake_native()
  local sdk = h.load_wrapper{ native = fake }
  sdk.context_share({ text = "x" })
  local call = fake:last("context_share")
  h.truthy(call, "native must be called")
  h.eq(type(call.args[2]), "function", "native must receive a callback")
  call.args[2](nil, true, nil)
  sdk.context_share(42)
  h.advance(0)
end

function T.callback_is_the_natives_own()
  local fake = h.fake_native()
  local sdk = h.load_wrapper{ native = fake }
  local got = {}
  sdk.context_share({}, function(self, s, e) got[#got + 1] = s end)
  fake:fire("context_share", 1, true, nil)
  h.deep_eq(got, { true })
end

function T.editor_mock_succeeds_next_frame_and_prints()
  local sdk = h.load_wrapper{ system_name = "Darwin" }
  local got
  sdk.context_share({ text = "yo" }, function(self, s, e) got = { s, e } end)
  h.eq(got, nil)
  h.advance(0)
  h.truthy(got, "mock must call back")
  h.eq(got[1], true)
  h.eq(got[2], nil)
  h.truthy(h.printed("context_share"))
  h.eq(sdk.context_is_supported(), true)
end

function T.missing_extension_stub_fails_with_not_initialized()
  local sdk = h.load_wrapper{ system_name = "HTML5", native = false }
  h.eq(sdk.context_is_supported(), false)
  local got
  sdk.context_share({ text = "x" }, function(self, s, e) got = { s, e } end)
  h.advance(0)
  h.truthy(got, "stub must call back")
  h.eq(got[1], false)
  h.eq(decode(got[2]).code, "NOT_INITIALIZED")
end

return T
