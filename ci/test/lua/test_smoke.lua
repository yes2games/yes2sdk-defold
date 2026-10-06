-- Smoke tests for the harness itself: the wrapper loads on HTML5 against a
-- recording fake native, the editor mock path runs on a desktop system name,
-- the manual clock drives timers, and a broken fake is reported as a failure.

local h = require("harness")

local T = {}

function T.html5_get_platform_reaches_the_native()
  local fake = h.fake_native{ returns = { get_platform = "poki" } }
  local sdk = h.load_wrapper{ native = fake, system_name = "HTML5" }
  h.eq(sdk.get_platform(), "poki")
  h.eq(#fake:calls_to("get_platform"), 1)
end

function T.html5_interstitial_calls_the_native_and_settles_on_after_ad()
  local fake = h.fake_native()
  local sdk = h.load_wrapper{ native = fake }
  local events = {}
  sdk.ads_show_interstitial("menu",
    function(self) events[#events + 1] = "before" end,
    function(self) events[#events + 1] = "after" end,
    function(self) events[#events + 1] = "no_fill" end)

  local call = fake:last("ads_show_interstitial")
  h.truthy(call, "the native ads_show_interstitial was not called")
  h.eq(call.args[1], "menu")
  h.truthy(sdk.ads_is_ad_showing())

  fake:fire("ads_show_interstitial", 1)
  fake:fire("ads_show_interstitial", 2)
  h.deep_eq(events, { "before", "after" })
  h.falsy(sdk.ads_is_ad_showing())
end

function T.html5_watchdog_reports_no_fill_after_the_timeout()
  local fake = h.fake_native()
  local sdk = h.load_wrapper{ native = fake }
  local no_fill = 0
  sdk.ads_show_interstitial("menu", nil, nil, function() no_fill = no_fill + 1 end)
  h.advance(29)
  h.eq(no_fill, 0, "watchdog fired early")
  h.advance(1.5)
  h.eq(no_fill, 1, "watchdog did not fire")
  h.falsy(sdk.ads_is_ad_showing())
  h.truthy(h.printed("ad watchdog fired"))
end

function T.each_load_is_a_fresh_wrapper_instance()
  local sdk = h.load_wrapper{ native = h.fake_native() }
  sdk.ads_show_interstitial("menu")
  h.truthy(sdk.ads_is_ad_showing())
  local again = h.load_wrapper{ native = h.fake_native() }
  h.falsy(again.ads_is_ad_showing(), "ad latch leaked between loads")
end

function T.editor_mock_interstitial_runs_on_the_manual_clock()
  local sdk = h.load_wrapper{ system_name = "Darwin" }
  h.truthy(h.printed("Editor mock active"))
  local events = {}
  local seen_self
  sdk.ads_show_interstitial("menu",
    function(self) seen_self = self; events[#events + 1] = "before" end,
    function(self) events[#events + 1] = "after" end,
    function(self) events[#events + 1] = "no_fill" end)
  h.advance(0)
  h.deep_eq(events, { "before" })
  h.eq(seen_self, h.state.script, "timer callback self is not the script instance")
  h.advance(3)
  h.deep_eq(events, { "before", "after" })
end

function T.editor_mock_respects_game_project_config()
  local sdk = h.load_wrapper{ system_name = "Darwin", config = { ["yes2sdk.mock_ad_result"] = "nofill" } }
  local events = {}
  sdk.ads_show_interstitial("menu", nil,
    function() events[#events + 1] = "after" end,
    function() events[#events + 1] = "no_fill" end)
  h.advance(0)
  h.deep_eq(events, { "no_fill" })
end

function T.editor_mock_disabled_falls_back_to_the_warn_stub()
  local sdk = h.load_wrapper{ system_name = "Darwin", config = { ["yes2sdk.mock"] = "0" } }
  h.eq(sdk.get_platform(), "editor")
  h.truthy(h.printed("Extension not loaded"))
end

function T.repeating_zero_delay_timer_fires_every_frame_with_dt()
  h.load_wrapper{ native = h.fake_native() }
  local ticks, last = 0, nil
  h.env.timer.delay(0, true, function(self, handle, elapsed) ticks = ticks + 1; last = elapsed end)
  h.advance(1)
  h.eq(ticks, 60)
  h.truthy(math.abs(last - h.FRAME) < 1e-9, "elapsed is not the frame dt")
end

function T.json_stub_raises_on_bad_input_like_defold()
  h.load_wrapper{ native = h.fake_native() }
  h.deep_eq(h.env.json.decode('{"a":[1,2]}'), { a = { 1, 2 } })
  h.expect_failure(function() h.env.json.decode("{not json") end)
end

function T.a_broken_fake_is_reported_as_a_failure()
  -- The fake leaves out get_platform, as a broken build would.
  local fake = h.fake_native{ missing = { "get_platform" } }
  local sdk = h.load_wrapper{ native = fake }
  local err = h.expect_failure(function() sdk.get_platform() end)
  h.match(err, "not a registered native function")
  -- And an assertion that should not hold really fails.
  h.expect_failure(function() h.eq(sdk.ads_is_ad_showing(), true) end)
end

function T.timer_callback_errors_are_collected_not_swallowed()
  h.load_wrapper{ native = h.fake_native() }
  h.env.timer.delay(0, false, function() error("boom") end)
  h.advance(0)
  local errors = h.take_errors()
  h.eq(#errors, 1)
  h.match(errors[1], "boom")
end

return T
