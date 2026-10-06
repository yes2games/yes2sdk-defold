-- auth_show_registration_prompt: option encoding without on_close, on_close
-- extraction, error return, handle methods, editor mock and warn stub.

local h = require("harness")

local T = {}

local function wrapper(returns)
  local fake = h.fake_native{ returns = returns or {
    auth_show_registration_prompt = '{"handle":4}',
    auth_registration_prompt_login = true,
    auth_registration_prompt_close = true,
  } }
  return h.load_wrapper{ native = fake }, fake
end

function T.table_is_encoded_without_on_close()
  local sdk, fake = wrapper()
  local handle, err = sdk.auth_show_registration_prompt({
    theme = "dark",
    message = "Join me {{registrationCode}}",
    data = { level = 2 },
    on_close = function() end,
  })
  h.truthy(handle, "expected a handle")
  h.eq(err, nil)
  local call = fake:last("auth_show_registration_prompt")
  local sent = h.env.json.decode(call.args[1])
  h.deep_eq(sent, { theme = "dark", message = "Join me {{registrationCode}}", data = { level = 2 } })
  h.eq(type(call.args[2]), "function", "a close callback is always registered")
end

function T.on_close_is_called_with_self_when_the_router_completes()
  local sdk, fake = wrapper()
  local got = {}
  sdk.auth_show_registration_prompt({ on_close = function(self) got[#got + 1] = self end })
  local call = fake:last("auth_show_registration_prompt")
  h.eq(call.args[1], nil, "only on_close: nothing to encode")
  fake:fire("auth_show_registration_prompt", 1, true, nil)
  h.eq(#got, 1)
  h.eq(got[1], h.state.script)
end

function T.no_options_still_registers_a_callback()
  local sdk, fake = wrapper()
  local handle = sdk.auth_show_registration_prompt()
  h.truthy(handle)
  local call = fake:last("auth_show_registration_prompt")
  h.eq(call.args[1], nil)
  fake:fire("auth_show_registration_prompt", 1, true, nil) -- no on_close: must not raise
end

function T.json_string_options_pass_through()
  local sdk, fake = wrapper()
  sdk.auth_show_registration_prompt('{"theme":"light"}')
  h.eq(fake:last("auth_show_registration_prompt").args[1], '{"theme":"light"}')
end

function T.bad_options_are_invalid_param_and_native_is_not_called()
  local sdk, fake = wrapper()
  local handle, err = sdk.auth_show_registration_prompt(42)
  h.eq(handle, nil)
  h.eq(sdk.parse_error(err).code, "INVALID_PARAM")
  handle, err = sdk.auth_show_registration_prompt({ on_close = "nope" })
  h.eq(handle, nil)
  h.eq(sdk.parse_error(err).code, "INVALID_PARAM")
  h.eq(#fake:calls_to("auth_show_registration_prompt"), 0)
end

function T.caller_table_is_not_mutated()
  local sdk = wrapper()
  local cb = function() end
  local opts = { theme = "dark", on_close = cb }
  sdk.auth_show_registration_prompt(opts)
  h.eq(opts.on_close, cb)
  h.eq(opts.theme, "dark")
end

function T.error_result_returns_nil_and_the_error_json()
  local sdk = wrapper{
    auth_show_registration_prompt = '{"error":{"code":"INVALID_OPERATION","message":"registered","context":"auth.showRegistrationPrompt"}}',
  }
  local handle, err = sdk.auth_show_registration_prompt({ theme = "dark" })
  h.eq(handle, nil)
  h.deep_eq(sdk.parse_error(err), { code = "INVALID_OPERATION", message = "registered", context = "auth.showRegistrationPrompt" })
end

function T.garbage_result_is_an_error()
  local sdk = wrapper{ auth_show_registration_prompt = "{oops" }
  local handle, err = sdk.auth_show_registration_prompt()
  h.eq(handle, nil)
  h.eq(sdk.parse_error(err).code, "UNKNOWN_ERROR")
  sdk = wrapper{ auth_show_registration_prompt = nil }
  handle, err = sdk.auth_show_registration_prompt()
  h.eq(handle, nil)
  h.eq(type(err), "string")
end

function T.handle_methods_call_the_native_with_the_handle_id()
  local sdk, fake = wrapper()
  local handle = sdk.auth_show_registration_prompt()
  h.eq(handle.login(), true)
  h.eq(fake:last("auth_registration_prompt_login").args[1], 4)
  h.eq(handle.close(), true)
  h.eq(fake:last("auth_registration_prompt_close").args[1], 4)
  -- colon syntax works too
  h.eq(handle:close(), true)
  h.eq(fake:last("auth_registration_prompt_close").args[1], 4)
end

function T.handle_methods_return_false_when_native_says_no()
  local sdk = wrapper{
    auth_show_registration_prompt = '{"handle":1}',
    auth_registration_prompt_login = false,
    auth_registration_prompt_close = false,
  }
  local handle = sdk.auth_show_registration_prompt()
  h.eq(handle.login(), false)
  h.eq(handle.close(), false)
end

function T.editor_mock_returns_a_handle_close_fires_on_close_next_frame()
  local sdk = h.load_wrapper{ system_name = "Darwin" }
  local closed = 0
  local handle, err = sdk.auth_show_registration_prompt({ theme = "light", on_close = function(self)
    closed = closed + 1
    h.eq(self, h.state.script)
  end })
  h.truthy(handle, "mock must return a handle")
  h.eq(err, nil)
  h.eq(handle.login(), true)
  h.truthy(h.printed("registration prompt login"))
  h.eq(handle.close(), true)
  h.eq(closed, 0, "on_close must not fire synchronously in the mock")
  h.step()
  h.eq(closed, 1)
  h.eq(handle.close(), false, "second close is false")
  h.eq(handle.login(), false, "closed handle is gone")
  h.step()
  h.eq(closed, 1)
end

function T.warn_stub_is_feature_not_supported()
  local sdk = h.load_wrapper{ system_name = "HTML5" }
  local handle, err = sdk.auth_show_registration_prompt({ theme = "dark" })
  h.eq(handle, nil)
  h.eq(sdk.parse_error(err).code, "FEATURE_NOT_SUPPORTED")
  h.truthy(h.printed("Extension not loaded"))
end

return T
