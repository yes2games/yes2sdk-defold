-- on_exit_requested: forwards to the native, and is a quiet no-op in the
-- editor mock and the missing-extension stub.

local h = require("harness")

local T = {}

function T.on_exit_requested_forwards_the_callback()
  local fake = h.fake_native()
  local sdk = h.load_wrapper{ native = fake }
  local cb = function(self) end
  sdk.on_exit_requested(cb)
  local call = fake:last("on_exit_requested")
  h.truthy(call, "the native on_exit_requested was not called")
  h.eq(call.args[1], cb)
end

function T.on_exit_requested_is_a_no_op_in_the_editor_mock()
  local sdk = h.load_wrapper{ system_name = "Darwin" }
  sdk.on_exit_requested(function(self) end)
  h.falsy(h.printed("Extension not loaded"))
end

function T.on_exit_requested_is_a_no_op_without_the_extension()
  local sdk = h.load_wrapper{ system_name = "HTML5" }
  sdk.on_exit_requested(function(self) end)
end

return T
