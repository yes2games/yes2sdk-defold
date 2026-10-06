-- Rewarded ads end with exactly one outcome (ad_viewed, ad_dismissed or
-- no_fill), then after_ad at most once. A throwing user callback is logged
-- and never blocks the next step.

local h = require("harness")

local T = {}

-- Callback slots of ads_show_rewarded, counting functions only.
local BEFORE, AFTER, DISMISSED, VIEWED, NO_FILL = 1, 2, 3, 4, 5

local function recorder()
  local events = {}
  local args = {}
  local function cb(name, throws)
    return function(...)
      events[#events + 1] = name
      args[#args + 1] = { name = name, n = select("#", ...), ... }
      if throws then error(name .. " exploded") end
    end
  end
  return events, cb, args
end

local function show_rewarded(sdk, cb, overrides)
  overrides = overrides or {}
  sdk.ads_show_rewarded("reward",
    overrides.before or cb("before"),
    overrides.after or cb("after"),
    overrides.dismissed or cb("dismissed"),
    overrides.viewed or cb("viewed"),
    overrides.no_fill or cb("no_fill"))
end

local function count_prints(needle)
  local n = 0
  for _, line in ipairs(h.prints()) do
    if line:find(needle, 1, true) then n = n + 1 end
  end
  return n
end

function T.after_ad_alone_delivers_dismissed_then_after()
  local fake = h.fake_native()
  local sdk = h.load_wrapper{ native = fake }
  local events, cb, args = recorder()
  show_rewarded(sdk, cb)
  fake:fire("ads_show_rewarded", BEFORE)
  fake:fire("ads_show_rewarded", AFTER)
  h.deep_eq(events, { "before", "dismissed", "after" })
  h.falsy(sdk.ads_is_ad_showing())
  h.eq(args[2].n, 2, "synthesized ad_dismissed takes (self, true)")
  h.eq(args[2][1], h.state.script, "synthesized ad_dismissed gets the last self seen")
  h.eq(args[2][2], true)
  h.eq(count_prints("ad_dismissed"), 1, "one warning for the synthesized ad_dismissed")
end

function T.viewed_twice_delivers_one_viewed()
  local fake = h.fake_native()
  local sdk = h.load_wrapper{ native = fake }
  local events, cb = recorder()
  show_rewarded(sdk, cb)
  fake:fire("ads_show_rewarded", BEFORE)
  fake:fire("ads_show_rewarded", VIEWED)
  fake:fire("ads_show_rewarded", VIEWED)
  fake:fire("ads_show_rewarded", AFTER)
  h.deep_eq(events, { "before", "viewed", "after" })
  h.eq(count_prints("dropped"), 1, "one warning line for the dropped duplicate")
end

function T.viewed_then_dismissed_delivers_viewed_only()
  local fake = h.fake_native()
  local sdk = h.load_wrapper{ native = fake }
  local events, cb = recorder()
  show_rewarded(sdk, cb)
  fake:fire("ads_show_rewarded", BEFORE)
  fake:fire("ads_show_rewarded", VIEWED)
  fake:fire("ads_show_rewarded", DISMISSED)
  fake:fire("ads_show_rewarded", AFTER)
  h.deep_eq(events, { "before", "viewed", "after" })
end

function T.dismissed_then_viewed_delivers_dismissed_only()
  local fake = h.fake_native()
  local sdk = h.load_wrapper{ native = fake }
  local events, cb = recorder()
  show_rewarded(sdk, cb)
  fake:fire("ads_show_rewarded", DISMISSED)
  fake:fire("ads_show_rewarded", VIEWED)
  fake:fire("ads_show_rewarded", AFTER)
  h.deep_eq(events, { "dismissed", "after" })
end

function T.viewed_after_after_ad_is_dropped()
  local fake = h.fake_native()
  local sdk = h.load_wrapper{ native = fake }
  local events, cb = recorder()
  show_rewarded(sdk, cb)
  fake:fire("ads_show_rewarded", AFTER)
  fake:fire("ads_show_rewarded", VIEWED)
  h.deep_eq(events, { "dismissed", "after" }, "ad_viewed must never follow a delivered outcome")
end

function T.throwing_dismissed_still_gets_after_ad()
  local fake = h.fake_native()
  local sdk = h.load_wrapper{ native = fake }
  local events, cb = recorder()
  show_rewarded(sdk, cb, { dismissed = cb("dismissed", true) })
  fake:fire("ads_show_rewarded", DISMISSED)
  fake:fire("ads_show_rewarded", AFTER)
  h.deep_eq(events, { "dismissed", "after" })
  h.truthy(h.printed("[Yes2SDK] ad_dismissed callback error:"), "the error was not logged")
  h.falsy(sdk.ads_is_ad_showing())
end

function T.throwing_synthesized_dismissed_still_gets_after_ad()
  local fake = h.fake_native()
  local sdk = h.load_wrapper{ native = fake }
  local events, cb = recorder()
  show_rewarded(sdk, cb, { dismissed = cb("dismissed", true) })
  fake:fire("ads_show_rewarded", AFTER)
  h.deep_eq(events, { "dismissed", "after" })
  h.truthy(h.printed("[Yes2SDK] ad_dismissed callback error:"))
end

function T.throwing_viewed_and_after_are_logged_not_raised()
  local fake = h.fake_native()
  local sdk = h.load_wrapper{ native = fake }
  local events, cb = recorder()
  show_rewarded(sdk, cb, { viewed = cb("viewed", true), after = cb("after", true) })
  fake:fire("ads_show_rewarded", VIEWED)
  fake:fire("ads_show_rewarded", AFTER)
  h.deep_eq(events, { "viewed", "after" })
  h.truthy(h.printed("[Yes2SDK] ad_viewed callback error:"))
  h.truthy(h.printed("[Yes2SDK] after_ad callback error:"))
  h.falsy(sdk.ads_is_ad_showing())
end

function T.duplicate_after_ad_delivers_one()
  local fake = h.fake_native()
  local sdk = h.load_wrapper{ native = fake }
  local events, cb = recorder()
  show_rewarded(sdk, cb)
  fake:fire("ads_show_rewarded", VIEWED)
  fake:fire("ads_show_rewarded", AFTER)
  fake:fire("ads_show_rewarded", AFTER)
  h.deep_eq(events, { "viewed", "after" })
end

function T.interstitial_after_ad_has_no_outcome()
  local fake = h.fake_native()
  local sdk = h.load_wrapper{ native = fake }
  local events, cb = recorder()
  sdk.ads_show_interstitial("menu", cb("before"), cb("after"), cb("no_fill"))
  fake:fire("ads_show_interstitial", 1)
  fake:fire("ads_show_interstitial", 2)
  fake:fire("ads_show_interstitial", 2)
  h.deep_eq(events, { "before", "after" })
  h.falsy(h.printed("dropped"), "an interstitial logged a dropped outcome")
end

function T.interstitial_no_fill_is_unchanged()
  local fake = h.fake_native()
  local sdk = h.load_wrapper{ native = fake }
  local events, cb = recorder()
  sdk.ads_show_interstitial("menu", cb("before"), cb("after"), cb("no_fill"))
  fake:fire("ads_show_interstitial", 3)
  h.deep_eq(events, { "no_fill" })
  h.falsy(sdk.ads_is_ad_showing())
end

function T.rewarded_no_fill_is_the_one_outcome()
  local fake = h.fake_native()
  local sdk = h.load_wrapper{ native = fake }
  local events, cb = recorder()
  show_rewarded(sdk, cb)
  fake:fire("ads_show_rewarded", NO_FILL)
  fake:fire("ads_show_rewarded", NO_FILL)
  fake:fire("ads_show_rewarded", DISMISSED)
  h.deep_eq(events, { "no_fill" })
  h.falsy(sdk.ads_is_ad_showing())
end

function T.watchdog_playing_phase_throwing_dismissed_still_gets_after_ad()
  local fake = h.fake_native()
  local sdk = h.load_wrapper{ native = fake }
  local events, cb, args = recorder()
  show_rewarded(sdk, cb, { dismissed = cb("dismissed", true) })
  fake:fire("ads_show_rewarded", BEFORE)
  h.advance(181)
  h.deep_eq(events, { "before", "dismissed", "after" })
  h.truthy(h.printed("[Yes2SDK] ad_dismissed callback error:"))
  h.eq(#h.take_errors(), 0, "the error escaped into the timer")
  h.falsy(sdk.ads_is_ad_showing())
  h.eq(args[2].n, 2, "watchdog ad_dismissed takes (self, true)")
  h.eq(args[2][1], h.state.script, "watchdog ad_dismissed gets the last self seen")
  h.eq(args[2][2], true)
  h.eq(args[3].n, 2, "watchdog after_ad takes (self, true)")
  h.eq(args[3][2], true)
end

function T.watchdog_start_phase_no_fill_takes_self_true()
  local fake = h.fake_native()
  local sdk = h.load_wrapper{ native = fake }
  local events, cb, args = recorder()
  show_rewarded(sdk, cb)
  h.advance(31)
  h.deep_eq(events, { "no_fill", "after" })
  h.eq(args[1].n, 2)
  h.eq(args[1][2], true)
  h.falsy(args[1][1] == nil, "watchdog no_fill got no self")
end

function T.new_ad_started_inside_watchdog_dismissed_is_not_settled()
  local fake = h.fake_native()
  local sdk = h.load_wrapper{ native = fake }
  local events, cb = recorder()
  local second, cb2 = recorder()
  local dismissed = function()
    events[#events + 1] = "dismissed"
    show_rewarded(sdk, cb2)
  end
  show_rewarded(sdk, cb, { dismissed = dismissed })
  fake:fire("ads_show_rewarded", BEFORE)
  h.advance(181)
  h.deep_eq(events, { "before", "dismissed", "after" })
  h.eq(#fake:calls_to("ads_show_rewarded"), 2, "the new ad was rejected")
  h.truthy(sdk.ads_is_ad_showing(), "the old after_ad settled the new ad")
  h.deep_eq(second, {})
  fake:fire("ads_show_rewarded", VIEWED)
  fake:fire("ads_show_rewarded", AFTER)
  h.deep_eq(second, { "viewed", "after" })
  h.falsy(sdk.ads_is_ad_showing())
end

function T.editor_mock_viewed_yields_one_outcome()
  local sdk = h.load_wrapper{ system_name = "Darwin" }
  local events, cb = recorder()
  show_rewarded(sdk, cb)
  h.advance(6)
  h.deep_eq(events, { "before", "viewed", "after" })
  h.falsy(sdk.ads_is_ad_showing())
end

function T.editor_mock_dismissed_yields_one_outcome()
  local sdk = h.load_wrapper{ system_name = "Darwin", config = { ["yes2sdk.mock_rewarded_result"] = "dismissed" } }
  local events, cb = recorder()
  show_rewarded(sdk, cb)
  h.advance(6)
  h.deep_eq(events, { "before", "dismissed", "after" })
  h.falsy(sdk.ads_is_ad_showing())
end

function T.editor_mock_throwing_dismissed_still_gets_after_ad()
  local sdk = h.load_wrapper{ system_name = "Darwin", config = { ["yes2sdk.mock_rewarded_result"] = "dismissed" } }
  local events, cb = recorder()
  show_rewarded(sdk, cb, { dismissed = cb("dismissed", true) })
  h.advance(6)
  h.deep_eq(events, { "before", "dismissed", "after" })
  h.eq(#h.take_errors(), 0, "the error escaped into the mock timer")
  h.falsy(sdk.ads_is_ad_showing())
end

return T
