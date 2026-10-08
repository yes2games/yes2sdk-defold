-- test_not_loaded_stub.lua - every async function of the warn stub (extension
-- not loaded) fails the same way: NOT_INITIALIZED, one message, a context named
-- after the SDK call ("<module>.<method>"), next frame, never synchronous.

local h = require("harness")

local T = {}

local MESSAGE = "Yes2SDK extension not loaded"

-- name, context, call(sdk, callback)
local CASES = {
  { "data_set_string_async", "data.setStringAsync", function(s, cb) s.data_set_string_async("k", "v", cb) end },
  { "data_flush", "data.flushAsync", function(s, cb) s.data_flush(cb) end },
  { "player_flush_data", "player.flushDataAsync", function(s, cb) s.player_flush_data(cb) end },
  { "player_get_bot_avatar", "player.getBotAvatarAsync", function(s, cb) s.player_get_bot_avatar("bot", "small", cb) end },
  { "referrals_share", "referrals.shareAsync", function(s, cb) s.referrals_share({ reference = "r" }, cb) end },
  { "referrals_list", "referrals.listAsync", function(s, cb) s.referrals_list(cb) end },
  { "notifications_schedule", "notifications.scheduleAsync", function(s, cb) s.notifications_schedule({ title = "t" }, cb) end },
  { "notifications_cancel", "notifications.cancelAsync", function(s, cb) s.notifications_cancel("id", cb) end },
  { "notifications_cancel_all", "notifications.cancelAllAsync", function(s, cb) s.notifications_cancel_all(cb) end },
  { "iap_get_subscriptions", "iap.getSubscriptionsAsync", function(s, cb) s.iap_get_subscriptions(cb) end },
  { "iap_subscribe", "iap.subscribeAsync", function(s, cb) s.iap_subscribe("p", cb) end },
  { "iap_cancel_subscription", "iap.cancelSubscriptionAsync", function(s, cb) s.iap_cancel_subscription("p", cb) end },
  { "iap_claim_retention_offer", "iap.claimRetentionOfferAsync", function(s, cb) s.iap_claim_retention_offer("p", cb) end },
  { "iap_get_subscription_status", "iap.getSubscriptionStatusAsync", function(s, cb) s.iap_get_subscription_status("p", cb) end },
  { "context_share", "context.shareAsync", function(s, cb) s.context_share({ text = "x" }, cb) end },
}

function T.every_stub_async_call_fails_alike_next_frame()
  local sdk = h.load_wrapper{ system_name = "HTML5" }
  local got = {}
  for _, case in ipairs(CASES) do
    local name = case[1]
    case[3](sdk, function(self, success, err) got[name] = { success, err } end)
    h.eq(got[name], nil, name .. ": callback must not be synchronous")
  end
  h.advance(0.1)
  for _, case in ipairs(CASES) do
    local name, context = case[1], case[2]
    h.truthy(got[name], name .. ": callback must fire")
    h.eq(got[name][1], false, name)
    h.deep_eq(sdk.parse_error(got[name][2]),
      { code = "NOT_INITIALIZED", message = MESSAGE, context = context }, name)
  end
  h.truthy(h.printed("Extension not loaded"), "the stub must print the bundling warning")
end

function T.every_stub_async_call_falls_back_without_a_timer()
  local sdk = h.load_wrapper{ system_name = "HTML5" }
  h.env.timer.delay = function() return h.env.timer.INVALID_TIMER_HANDLE end
  for _, case in ipairs(CASES) do
    local got
    case[3](sdk, function(self, success, err) got = { success, err } end)
    h.truthy(got, case[1] .. ": callback must still be delivered")
    h.eq(sdk.parse_error(got[2]).code, "NOT_INITIALIZED", case[1])
  end
end

function T.every_stub_async_call_falls_back_when_timer_raises()
  local sdk = h.load_wrapper{ system_name = "HTML5" }
  h.env.timer.delay = function() error("no script context") end
  for _, case in ipairs(CASES) do
    local got
    case[3](sdk, function(self, success, err) got = { success, err } end)
    h.truthy(got, case[1] .. ": callback must still be delivered")
  end
end

return T
