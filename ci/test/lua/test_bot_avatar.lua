-- Bot avatar wrapper tests: argument checks, size default and shorthand, the
-- native call, the warn stub and the editor mock.

local h = require("harness")

local T = {}

local CONTEXT = "player.getBotAvatarAsync"

function T.reaches_the_native_with_the_username_size_and_callback()
  local fake = h.fake_native()
  local sdk = h.load_wrapper{ native = fake }
  local cb = function() end
  sdk.player_get_bot_avatar("RoboRita", "small", cb)
  local call = fake:last("player_get_bot_avatar")
  h.truthy(call, "native player_get_bot_avatar not called")
  h.eq(call.args[1], "RoboRita")
  h.eq(call.args[2], "small")
  h.eq(call.args[3], cb)
end

function T.size_defaults_to_medium_and_may_be_omitted()
  local fake = h.fake_native()
  local sdk = h.load_wrapper{ native = fake }
  local cb = function() end
  sdk.player_get_bot_avatar("a", nil, cb)
  h.eq(fake:last("player_get_bot_avatar").args[2], "medium")
  h.eq(fake:last("player_get_bot_avatar").args[3], cb)
  sdk.player_get_bot_avatar("b", cb)
  h.eq(fake:last("player_get_bot_avatar").args[1], "b")
  h.eq(fake:last("player_get_bot_avatar").args[2], "medium")
  h.eq(fake:last("player_get_bot_avatar").args[3], cb)
end

function T.callback_gets_the_url_from_the_native()
  local fake = h.fake_native()
  local sdk = h.load_wrapper{ native = fake }
  local got
  sdk.player_get_bot_avatar("a", "large", function(self, ok, url) got = { ok, url } end)
  fake:fire("player_get_bot_avatar", 1, true, "https://cdn.example/a.png")
  h.deep_eq(got, { true, "https://cdn.example/a.png" })
end

function T.bad_username_or_size_fails_with_invalid_param_next_frame()
  local fake = h.fake_native()
  local sdk = h.load_wrapper{ native = fake }
  local cases = {
    { nil, nil, "username" }, { "", nil, "username" }, { 42, "small", "username" },
    { "a", "huge", "size" }, { "a", "", "size" }, { "a", 1, "size" },
  }
  local got = {}
  for i, c in ipairs(cases) do
    sdk.player_get_bot_avatar(c[1], c[2], function(self, ok, err) got[i] = { ok, err } end)
  end
  h.eq(next(got), nil, "must not call back synchronously")
  h.eq(#fake:calls_to("player_get_bot_avatar"), 0, "native must not be reached")
  h.advance(0)
  for i, c in ipairs(cases) do
    h.truthy(got[i], "case " .. i .. ": callback must fire")
    h.falsy(got[i][1])
    local e = sdk.parse_error(got[i][2])
    h.eq(e.code, "INVALID_PARAM", "case " .. i)
    h.eq(e.context, CONTEXT, "case " .. i)
    h.match(e.message, c[3], "case " .. i)
  end
end

function T.is_supported_reaches_the_native()
  local fake = h.fake_native{ returns = { player_is_bot_avatar_supported = true } }
  local sdk = h.load_wrapper{ native = fake }
  h.eq(sdk.player_is_bot_avatar_supported(), true)
end

function T.warn_stub_is_unsupported_and_fails_with_not_initialized()
  local sdk = h.load_wrapper{ system_name = "HTML5" }
  h.eq(sdk.player_is_bot_avatar_supported(), false)
  local got
  sdk.player_get_bot_avatar("a", "small", function(self, ok, err) got = { ok, err } end)
  h.eq(got, nil, "must not call back synchronously")
  h.advance(0)
  h.falsy(got[1])
  h.deep_eq(sdk.parse_error(got[2]),
    { code = "NOT_INITIALIZED", message = "Yes2SDK extension not loaded", context = CONTEXT })
end

function T.mock_is_supported_and_returns_a_url_per_bot_and_size()
  local sdk = h.load_wrapper{ system_name = "Darwin" }
  h.eq(sdk.player_is_bot_avatar_supported(), true)
  local got = {}
  sdk.player_get_bot_avatar("Robo Rita", "small", function(self, ok, url) got[1] = { ok, url } end)
  sdk.player_get_bot_avatar("Robo Rita", function(self, ok, url) got[2] = { ok, url } end)
  h.eq(#got, 0, "must not call back synchronously")
  h.advance(0)
  h.deep_eq(got[1], { true, "mock://bot-avatar/small/Robo%20Rita" })
  h.deep_eq(got[2], { true, "mock://bot-avatar/medium/Robo%20Rita" })
end

function T.mock_still_validates_the_username()
  local sdk = h.load_wrapper{ system_name = "Darwin" }
  local got
  sdk.player_get_bot_avatar("", "small", function(self, ok, err) got = { ok, err } end)
  h.advance(0)
  h.falsy(got[1])
  h.eq(sdk.parse_error(got[2]).code, "INVALID_PARAM")
end

return T
