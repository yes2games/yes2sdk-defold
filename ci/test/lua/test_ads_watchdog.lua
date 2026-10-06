-- Two-phase ad watchdog: 30 s for the platform to start the ad (before_ad),
-- then 180 s for a started ad to finish (after_ad). Time is counted per frame
-- with each frame capped at 0.5 s, so a long hidden tab cannot fire it at once.

local h = require("harness")

local T = {}

local function recorder()
  local events = {}
  local function cb(name)
    return function() events[#events + 1] = name end
  end
  return events, cb
end

local function show_interstitial(sdk, cb)
  sdk.ads_show_interstitial("menu", cb("before"), cb("after"), cb("no_fill"))
end

local function show_rewarded(sdk, cb)
  sdk.ads_show_rewarded("reward", cb("before"), cb("after"), cb("dismissed"), cb("viewed"), cb("no_fill"))
end

local function count_prints(needle)
  local n = 0
  for _, line in ipairs(h.prints()) do
    if line:find(needle, 1, true) then n = n + 1 end
  end
  return n
end

function T.start_phase_releases_with_no_fill_after_30s()
  local fake = h.fake_native()
  local sdk = h.load_wrapper{ native = fake }
  local events, cb = recorder()
  show_interstitial(sdk, cb)
  h.advance(29.5)
  h.deep_eq(events, {}, "released before the start timeout")
  h.truthy(sdk.ads_is_ad_showing())
  h.advance(1.5)
  h.deep_eq(events, { "no_fill" })
  h.falsy(sdk.ads_is_ad_showing())
  h.eq(count_prints("ad watchdog fired"), 1, "exactly one watchdog log line")
  h.truthy(h.printed("start phase"), "log line does not name the start phase")
  h.truthy(h.printed("30s"), "log line does not name the seconds")
end

function T.started_60s_ad_is_not_released_and_its_after_ad_arrives()
  local fake = h.fake_native()
  local sdk = h.load_wrapper{ native = fake }
  local events, cb = recorder()
  show_interstitial(sdk, cb)
  h.advance(1)
  fake:fire("ads_show_interstitial", 1)
  h.advance(59)
  h.truthy(sdk.ads_is_ad_showing(), "a playing ad was released early")
  fake:fire("ads_show_interstitial", 2)
  h.deep_eq(events, { "before", "after" })
  h.falsy(sdk.ads_is_ad_showing())
  h.falsy(h.printed("ad watchdog fired"))
  h.eq(h.pending_timers(), 0, "watchdog timer left running after release")
end

function T.playing_phase_releases_rewarded_with_dismissed_then_after_ad()
  local fake = h.fake_native()
  local sdk = h.load_wrapper{ native = fake }
  local events, cb = recorder()
  show_rewarded(sdk, cb)
  h.advance(1)
  fake:fire("ads_show_rewarded", 1)
  h.advance(179.5)
  h.deep_eq(events, { "before" }, "released before the playing timeout")
  h.advance(1.5)
  h.deep_eq(events, { "before", "dismissed", "after" })
  h.falsy(sdk.ads_is_ad_showing())
  h.eq(count_prints("ad watchdog fired"), 1)
  h.truthy(h.printed("playing phase"), "log line does not name the playing phase")
  h.truthy(h.printed("180s"), "log line does not name the seconds")
end

function T.playing_phase_rewarded_with_outcome_gets_after_ad_only()
  local fake = h.fake_native()
  local sdk = h.load_wrapper{ native = fake }
  local events, cb = recorder()
  show_rewarded(sdk, cb)
  fake:fire("ads_show_rewarded", 1)
  fake:fire("ads_show_rewarded", 4)
  h.advance(181)
  h.deep_eq(events, { "before", "viewed", "after" })
  h.falsy(sdk.ads_is_ad_showing())
end

function T.playing_phase_releases_interstitial_with_after_ad_only()
  local fake = h.fake_native()
  local sdk = h.load_wrapper{ native = fake }
  local events, cb = recorder()
  show_interstitial(sdk, cb)
  h.advance(1)
  fake:fire("ads_show_interstitial", 1)
  h.advance(181)
  h.deep_eq(events, { "before", "after" })
  h.falsy(sdk.ads_is_ad_showing())
end

function T.a_long_frame_counts_half_a_second()
  local fake = h.fake_native()
  local sdk = h.load_wrapper{ native = fake }
  local events, cb = recorder()
  show_interstitial(sdk, cb)
  h.advance(0)
  for _ = 1, 59 do h.step(10) end
  -- 59 long frames plus one short frame count about 29.5 s, not 590 s.
  h.deep_eq(events, {}, "a long frame was counted in full")
  h.truthy(sdk.ads_is_ad_showing())
  h.step(10)
  h.deep_eq(events, { "no_fill" })
end

function T.the_next_ad_runs_after_a_release()
  local fake = h.fake_native()
  local sdk = h.load_wrapper{ native = fake }
  local events, cb = recorder()
  show_interstitial(sdk, cb)
  h.advance(31)
  h.deep_eq(events, { "no_fill" })
  h.falsy(sdk.ads_is_ad_showing())

  local second, cb2 = recorder()
  show_rewarded(sdk, cb2)
  h.truthy(sdk.ads_is_ad_showing())
  h.eq(#fake:calls_to("ads_show_rewarded"), 1, "the next ad was rejected")
  fake:fire("ads_show_rewarded", 1)
  fake:fire("ads_show_rewarded", 4)
  fake:fire("ads_show_rewarded", 2)
  h.deep_eq(second, { "before", "viewed", "after" })
  h.falsy(sdk.ads_is_ad_showing())
end

function T.a_released_watchdog_never_touches_a_newer_request()
  local fake = h.fake_native()
  local sdk = h.load_wrapper{ native = fake }
  local first, cb1 = recorder()
  show_interstitial(sdk, cb1)
  h.advance(10)
  fake:fire("ads_show_interstitial", 3)  -- real no_fill releases the first ad
  h.deep_eq(first, { "no_fill" })

  local second, cb2 = recorder()
  show_interstitial(sdk, cb2)
  h.advance(25)  -- past the first ad's original 30 s deadline
  h.deep_eq(second, {}, "the old watchdog settled the newer ad")
  h.truthy(sdk.ads_is_ad_showing())
  h.eq(h.pending_timers(), 1, "more than one watchdog timer is running")
  h.advance(6)
  h.deep_eq(second, { "no_fill" })
  h.deep_eq(first, { "no_fill" })
  h.eq(count_prints("ad watchdog fired"), 1)
end

function T.late_callbacks_of_a_released_ad_are_swallowed()
  local fake = h.fake_native()
  local sdk = h.load_wrapper{ native = fake }
  local events, cb = recorder()
  show_interstitial(sdk, cb)
  local late_after = fake:callback("ads_show_interstitial", 2)
  h.advance(31)
  h.deep_eq(events, { "no_fill" })
  late_after(h.state.script)
  h.deep_eq(events, { "no_fill" }, "a late after_ad reached the game")
end

function T.native_failure_still_reports_no_fill_and_stops_the_watchdog()
  local fake = h.fake_native{ overrides = { ads_show_interstitial = function() error("native boom") end } }
  local sdk = h.load_wrapper{ native = fake }
  local events, cb = recorder()
  show_interstitial(sdk, cb)
  h.deep_eq(events, { "no_fill" })
  h.falsy(sdk.ads_is_ad_showing())
  h.eq(h.pending_timers(), 0)
  h.advance(200)
  h.deep_eq(events, { "no_fill" })
end

function T.concurrent_call_is_still_rejected()
  local fake = h.fake_native()
  local sdk = h.load_wrapper{ native = fake }
  local first, cb1 = recorder()
  local second, cb2 = recorder()
  show_interstitial(sdk, cb1)
  show_rewarded(sdk, cb2)
  h.deep_eq(second, { "no_fill" })
  h.eq(#fake:calls_to("ads_show_rewarded"), 0)
  h.deep_eq(first, {})
end

function T.editor_mock_interstitial_completes_normally()
  local sdk = h.load_wrapper{ system_name = "Darwin" }
  local events, cb = recorder()
  show_interstitial(sdk, cb)
  h.advance(4)
  h.deep_eq(events, { "before", "after" })
  h.falsy(sdk.ads_is_ad_showing())
  h.eq(h.pending_timers(), 0)
  h.advance(200)
  h.deep_eq(events, { "before", "after" })
end

function T.editor_mock_rewarded_completes_normally()
  local sdk = h.load_wrapper{ system_name = "Darwin" }
  local events, cb = recorder()
  show_rewarded(sdk, cb)
  h.advance(6)
  h.deep_eq(events, { "before", "viewed", "after" })
  h.falsy(sdk.ads_is_ad_showing())
  h.advance(200)
  h.deep_eq(events, { "before", "viewed", "after" })
  h.falsy(h.printed("ad watchdog fired"))
end

return T
