-- Referrals wrapper: option encoding, reference validation, warn stub and editor mock.

local h = require("harness")

local T = {}

local function callback_of(call)
  for i = 1, call.n do
    if type(call.args[i]) == "function" then return call.args[i] end
  end
  error("native call has no callback")
end

function T.share_encodes_a_table_and_passes_the_callback_to_the_native()
  local fake = h.fake_native()
  local sdk = h.load_wrapper{ native = fake }
  sdk.referrals_share({ reference = "party_v1", data = { level = 3 }, title = "Join" }, function() end)
  local call = fake:last("referrals_share")
  h.truthy(call, "native referrals_share not called")
  h.deep_eq(h.env.json.decode(call.args[1]), { reference = "party_v1", data = { level = 3 }, title = "Join" })
  h.eq(type(call.args[2]), "function")
end

function T.share_maps_snake_case_jest_options_to_camel_case()
  local fake = h.fake_native()
  local sdk = h.load_wrapper{ native = fake }
  local templates = {
    { min_conversion_count = 1, variants = { { body = "A friend joined!", cta_text = "Play" } } },
    { min_conversion_count = 5, variants = {
      { title = "Five friends", body = "Party time", cta_text = "Go", image_reference = "img_5" },
      { body = "Alt", ctaText = "Open" },
    } },
  }
  local options = { reference = "r", data = { cta_text = "kept" }, onboarding_slug = "tutorial-game",
    notification_templates = templates }
  sdk.referrals_share(options, function() end)
  h.deep_eq(h.env.json.decode(fake:last("referrals_share").args[1]), {
    reference = "r",
    data = { cta_text = "kept" },
    onboardingSlug = "tutorial-game",
    notificationTemplates = {
      { minConversionCount = 1, variants = { { body = "A friend joined!", ctaText = "Play" } } },
      { minConversionCount = 5, variants = {
        { title = "Five friends", body = "Party time", ctaText = "Go", imageReference = "img_5" },
        { body = "Alt", ctaText = "Open" },
      } },
    },
  })
  -- The caller's tables are left as they were.
  h.eq(options.onboarding_slug, "tutorial-game")
  h.eq(options.onboardingSlug, nil)
  h.eq(templates[1].min_conversion_count, 1)
  h.eq(templates[1].variants[1].cta_text, "Play")
end

function T.share_passes_camel_case_and_malformed_jest_options_through()
  local fake = h.fake_native()
  local sdk = h.load_wrapper{ native = fake }
  sdk.referrals_share({ reference = "r", onboardingSlug = "s",
    notificationTemplates = { { minConversionCount = 0, variants = { { body = "b", ctaText = "c" } } } } }, function() end)
  h.deep_eq(h.env.json.decode(fake:last("referrals_share").args[1]), { reference = "r", onboardingSlug = "s",
    notificationTemplates = { { minConversionCount = 0, variants = { { body = "b", ctaText = "c" } } } } })
  -- The SDK validates the values, so odd shapes still reach it.
  sdk.referrals_share({ reference = "r", notification_templates = "nope", onboarding_slug = 5 }, function() end)
  h.deep_eq(h.env.json.decode(fake:last("referrals_share").args[1]),
    { reference = "r", notificationTemplates = "nope", onboardingSlug = 5 })
  sdk.referrals_share({ reference = "r", notification_templates = { 7, { variants = "x" } } }, function() end)
  h.deep_eq(h.env.json.decode(fake:last("referrals_share").args[1]),
    { reference = "r", notificationTemplates = { 7, { variants = "x" } } })
end

function T.share_accepts_a_json_string()
  local fake = h.fake_native()
  local sdk = h.load_wrapper{ native = fake }
  sdk.referrals_share('{"reference":"r1"}', function() end)
  h.eq(fake:last("referrals_share").args[1], '{"reference":"r1"}')
end

function T.share_rejects_a_missing_reference_with_invalid_param_next_frame()
  local fake = h.fake_native()
  local sdk = h.load_wrapper{ native = fake }
  local cases = { { title = "x" }, { reference = "" }, { reference = 5 }, "{}", '{"reference":""}', "not json", nil, {} }
  local got = {}
  for i = 1, 8 do
    sdk.referrals_share(cases[i], function(self, success, err) got[#got + 1] = { success, err } end)
  end
  h.eq(#got, 0, "must not call back synchronously")
  h.eq(#fake:calls_to("referrals_share"), 0, "native must not be reached")
  h.advance(0)
  h.eq(#got, 8)
  for _, r in ipairs(got) do
    h.falsy(r[1])
    h.eq(sdk.parse_error(r[2]).code, "INVALID_PARAM")
    h.match(sdk.parse_error(r[2]).message, "reference")
  end
end

function T.share_rejects_a_non_table_options_value()
  local fake = h.fake_native()
  local sdk = h.load_wrapper{ native = fake }
  local err
  sdk.referrals_share(42, function(self, success, e) err = e end)
  h.advance(0)
  h.eq(sdk.parse_error(err).code, "INVALID_PARAM")
  h.eq(#fake:calls_to("referrals_share"), 0)
end

function T.overlapping_calls_keep_their_own_callbacks()
  local fake = h.fake_native()
  local sdk = h.load_wrapper{ native = fake }
  local got = {}
  sdk.referrals_share({ reference = "a" }, function(s, ok, j) got[#got + 1] = "a:" .. j end)
  sdk.referrals_share({ reference = "b" }, function(s, ok, j) got[#got + 1] = "b:" .. j end)
  sdk.referrals_list(function(s, ok, j) got[#got + 1] = "l1:" .. j end)
  sdk.referrals_list(function(s, ok, j) got[#got + 1] = "l2:" .. j end)
  local shares, lists = fake:calls_to("referrals_share"), fake:calls_to("referrals_list")
  h.eq(#shares, 2)
  h.eq(#lists, 2)
  callback_of(shares[2])(h.state.script, true, "B")
  callback_of(shares[1])(h.state.script, true, "A")
  callback_of(lists[2])(h.state.script, true, "L2")
  callback_of(lists[1])(h.state.script, true, "L1")
  h.deep_eq(got, { "b:B", "a:A", "l2:L2", "l1:L1" })
end

function T.is_supported_reaches_the_native()
  local fake = h.fake_native{ returns = { referrals_is_supported = true } }
  local sdk = h.load_wrapper{ native = fake }
  h.eq(sdk.referrals_is_supported(), true)
end

function T.warn_stub_is_unsupported_and_async_calls_fail_with_not_initialized()
  local sdk = h.load_wrapper{ system_name = "HTML5" }
  h.eq(sdk.referrals_is_supported(), false)
  local got = {}
  sdk.referrals_share({ reference = "r" }, function(self, ok, e) got[#got + 1] = { "share", ok, e } end)
  sdk.referrals_list(function(self, ok, e) got[#got + 1] = { "list", ok, e } end)
  h.eq(#got, 0, "must not call back synchronously")
  h.advance(0)
  h.eq(#got, 2)
  for _, r in ipairs(got) do
    h.falsy(r[2])
    h.eq(sdk.parse_error(r[3]).code, "NOT_INITIALIZED")
  end
end

function T.mock_share_succeeds_and_list_is_empty_and_signed()
  local sdk = h.load_wrapper{ system_name = "Darwin" }
  h.eq(sdk.referrals_is_supported(), true)
  local share, list
  sdk.referrals_share({ reference = "r" }, function(self, ok, j) share = { ok, j } end)
  sdk.referrals_list(function(self, ok, j) list = { ok, j } end)
  h.advance(0)
  h.eq(share[1], true)
  h.deep_eq(h.env.json.decode(share[2]), { canceled = false })
  h.eq(list[1], true)
  local decoded = h.env.json.decode(list[2])
  h.eq(decoded.signedRequest, "mock")
  h.eq(type(decoded.referrals), "table")
  h.eq(next(decoded.referrals), nil)
end

function T.mock_share_can_be_canceled_through_game_project()
  local sdk = h.load_wrapper{ system_name = "Darwin", config = { ["yes2sdk.mock_referral_result"] = "canceled" } }
  local share
  sdk.referrals_share({ reference = "r" }, function(self, ok, j) share = { ok, j } end)
  h.advance(0)
  h.eq(share[1], true)
  h.deep_eq(h.env.json.decode(share[2]), { canceled = true })
end

function T.mock_share_still_validates_the_reference()
  local sdk = h.load_wrapper{ system_name = "Darwin" }
  local got
  sdk.referrals_share({}, function(self, ok, e) got = { ok, e } end)
  h.advance(0)
  h.falsy(got[1])
  h.eq(sdk.parse_error(got[2]).code, "INVALID_PARAM")
end

return T
