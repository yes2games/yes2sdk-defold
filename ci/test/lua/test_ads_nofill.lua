-- no_fill is followed by after_ad. no_fill frees the ad latch at once, so a
-- game can retry from inside it, but it does not end the request: the after_ad
-- the platform sends next for the same request is delivered once, and if none
-- arrives by the next frame the wrapper delivers after_ad itself. The one
-- exception is a call rejected because another ad is in flight: it gets
-- no_fill only, since its after_ad would resume the game under the first ad.

local h = require("harness")

local T = {}

-- Callback slots, counting functions only.
local I_BEFORE, I_AFTER, I_NO_FILL = 1, 2, 3
local R_BEFORE, R_AFTER, R_DISMISSED, R_VIEWED, R_NO_FILL = 1, 2, 3, 4, 5

local function recorder()
  local events = {}
  local args = {}
  local function cb(name, fn)
    return function(...)
      events[#events + 1] = name
      args[#args + 1] = { name = name, n = select("#", ...), ... }
      if fn then fn(...) end
    end
  end
  return events, cb, args
end

local function show_interstitial(sdk, cb, overrides)
  overrides = overrides or {}
  sdk.ads_show_interstitial("menu",
    overrides.before or cb("before"),
    overrides.after or cb("after"),
    overrides.no_fill or cb("no_fill"))
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

local function has_dash(text)
  return text:find("\226\128\147", 1, true) ~= nil or text:find("\226\128\148", 1, true) ~= nil
end

function T.core_style_no_fill_then_after_ad_in_one_tick_delivers_one_each()
  local fake = h.fake_native()
  local sdk = h.load_wrapper{ native = fake }
  local events, cb = recorder()
  show_interstitial(sdk, cb)
  fake:fire("ads_show_interstitial", I_NO_FILL)
  fake:fire("ads_show_interstitial", I_AFTER)
  h.deep_eq(events, { "no_fill", "after" })
  h.advance(5)
  h.deep_eq(events, { "no_fill", "after" }, "after_ad was delivered twice")
  h.eq(h.pending_timers(), 0, "a timer was left running")
end

function T.core_style_rewarded_no_fill_then_after_ad_delivers_one_each()
  local fake = h.fake_native()
  local sdk = h.load_wrapper{ native = fake }
  local events, cb = recorder()
  show_rewarded(sdk, cb)
  fake:fire("ads_show_rewarded", R_NO_FILL)
  fake:fire("ads_show_rewarded", R_AFTER)
  h.advance(5)
  h.deep_eq(events, { "no_fill", "after" })
end

function T.no_fill_alone_gets_after_ad_on_the_next_frame()
  local fake = h.fake_native()
  local sdk = h.load_wrapper{ native = fake }
  local events, cb, args = recorder()
  show_interstitial(sdk, cb)
  local script = { name = "caller" }
  fake:callback("ads_show_interstitial", I_NO_FILL)(script, true)
  h.deep_eq(events, { "no_fill" })
  h.step()
  h.deep_eq(events, { "no_fill", "after" })
  h.eq(args[2].n, 2, "synthesized after_ad takes (self, true)")
  h.eq(args[2][1], script, "synthesized after_ad gets the last self seen for the request")
  h.eq(args[2][2], true)
  h.advance(200)
  h.deep_eq(events, { "no_fill", "after" })
  h.eq(h.pending_timers(), 0)
end

function T.ads_is_ad_showing_is_false_inside_no_fill()
  local fake = h.fake_native()
  local sdk = h.load_wrapper{ native = fake }
  local showing = "unset"
  local _, cb = recorder()
  show_interstitial(sdk, cb, { no_fill = function() showing = sdk.ads_is_ad_showing() end })
  fake:fire("ads_show_interstitial", I_NO_FILL)
  h.eq(showing, false)
end

function T.rejected_concurrent_call_gets_no_fill_only_and_the_first_ad_is_unaffected()
  local fake = h.fake_native()
  local sdk = h.load_wrapper{ native = fake }
  local first, cb1 = recorder()
  local second, cb2 = recorder()
  show_interstitial(sdk, cb1)
  show_rewarded(sdk, cb2)
  h.deep_eq(second, { "no_fill" })
  h.advance(5)
  h.deep_eq(second, { "no_fill" }, "a rejected call got after_ad while the first ad is on screen")
  h.deep_eq(first, {})
  h.truthy(sdk.ads_is_ad_showing())
  fake:fire("ads_show_interstitial", I_BEFORE)
  fake:fire("ads_show_interstitial", I_AFTER)
  h.deep_eq(first, { "before", "after" })
  h.deep_eq(second, { "no_fill" })
  for _, line in ipairs(h.prints()) do
    h.falsy(has_dash(line), "log line carries a dash: " .. line)
  end
end

function T.throwing_rejected_no_fill_is_logged_not_raised()
  local fake = h.fake_native()
  local sdk = h.load_wrapper{ native = fake }
  local _, cb1 = recorder()
  show_interstitial(sdk, cb1)
  local ok = pcall(sdk.ads_show_interstitial, "menu", nil, nil, function() error("boom") end)
  h.truthy(ok, "the rejected no_fill error escaped to the caller")
  h.truthy(h.printed("[Yes2SDK] no_fill callback error:"))
end

function T.native_failure_reports_no_fill_then_after_ad()
  local fake = h.fake_native{ overrides = { ads_show_rewarded = function() error("native boom") end } }
  local sdk = h.load_wrapper{ native = fake }
  local events, cb, args = recorder()
  show_rewarded(sdk, cb)
  h.falsy(sdk.ads_is_ad_showing(), "a failed native call kept the latch")
  h.advance(1)
  h.deep_eq(events, { "no_fill", "after" })
  h.eq(args[1].n, 2, "no_fill takes (self, true)")
  h.eq(args[1][1], h.state.script, "no_fill gets the timer's self, not nil")
  h.eq(args[1][2], true)
  h.eq(args[2][1], h.state.script, "after_ad gets the same self")
  h.eq(args[2][2], true)
  h.eq(h.pending_timers(), 0)
  h.advance(200)
  h.deep_eq(events, { "no_fill", "after" })
end

function T.watchdog_start_phase_reports_no_fill_then_after_ad()
  local fake = h.fake_native()
  local sdk = h.load_wrapper{ native = fake }
  local events, cb, args = recorder()
  show_rewarded(sdk, cb)
  h.advance(31)
  h.deep_eq(events, { "no_fill", "after" })
  h.eq(args[2].n, 2)
  h.eq(args[2][1], args[1][1], "no_fill and after_ad got different selves")
  h.eq(args[2][2], true)
  h.falsy(h.printed("reporting ad_dismissed"), "rewarded no_fill was not counted as the outcome")
  h.eq(h.pending_timers(), 0)
end

function T.rewarded_no_fill_counts_as_the_outcome()
  local fake = h.fake_native()
  local sdk = h.load_wrapper{ native = fake }
  local events, cb = recorder()
  show_rewarded(sdk, cb)
  fake:fire("ads_show_rewarded", R_NO_FILL)
  h.advance(1)
  h.deep_eq(events, { "no_fill", "after" }, "a dismissed was synthesized after no_fill")
end

function T.start_phase_expiry_with_an_outcome_delivers_after_ad()
  local fake = h.fake_native()
  local sdk = h.load_wrapper{ native = fake }
  local events, cb = recorder()
  show_rewarded(sdk, cb)
  fake:fire("ads_show_rewarded", R_VIEWED)
  h.advance(31)
  h.deep_eq(events, { "viewed", "after" })
  h.falsy(sdk.ads_is_ad_showing())
  h.advance(5)
  h.deep_eq(events, { "viewed", "after" })
end

function T.new_ad_started_inside_no_fill_is_not_settled_by_the_synthesized_after_ad()
  -- Also the bridge case: the bridge drops the first ad's real after_ad once a
  -- newer ad has started, so the first ad's after_ad must be the synthesized one.
  local fake = h.fake_native()
  local sdk = h.load_wrapper{ native = fake }
  local first, cb1 = recorder()
  local second, cb2 = recorder()
  show_interstitial(sdk, cb1, { no_fill = cb1("no_fill", function() show_rewarded(sdk, cb2) end) })
  fake:fire("ads_show_interstitial", I_NO_FILL)
  h.eq(#fake:calls_to("ads_show_rewarded"), 1, "the retry was rejected")
  h.truthy(sdk.ads_is_ad_showing())
  h.advance(1)
  h.deep_eq(first, { "no_fill", "after" })
  h.deep_eq(second, {}, "the old after_ad reached the retry")
  h.truthy(sdk.ads_is_ad_showing(), "the old after_ad settled the retry")
  fake:fire("ads_show_rewarded", R_BEFORE)
  fake:fire("ads_show_rewarded", R_VIEWED)
  fake:fire("ads_show_rewarded", R_AFTER)
  h.deep_eq(second, { "before", "viewed", "after" })
  h.deep_eq(first, { "no_fill", "after" })
  h.falsy(sdk.ads_is_ad_showing())
end

function T.new_ad_started_inside_no_fill_is_not_settled_by_the_real_after_ad()
  local fake = h.fake_native()
  local sdk = h.load_wrapper{ native = fake }
  local first, cb1 = recorder()
  local second, cb2 = recorder()
  show_interstitial(sdk, cb1, { no_fill = cb1("no_fill", function() show_interstitial(sdk, cb2) end) })
  local first_after = fake:callback("ads_show_interstitial", I_AFTER)
  fake:fire("ads_show_interstitial", I_NO_FILL)
  first_after(h.state.script)
  h.deep_eq(first, { "no_fill", "after" })
  h.deep_eq(second, {})
  h.truthy(sdk.ads_is_ad_showing(), "the old real after_ad settled the retry")
  h.advance(1)
  h.deep_eq(first, { "no_fill", "after" }, "after_ad was delivered twice to the first ad")
  h.deep_eq(second, {})
  h.truthy(sdk.ads_is_ad_showing())
end

function T.late_before_ad_of_a_released_request_is_swallowed()
  local fake = h.fake_native()
  local sdk = h.load_wrapper{ native = fake }
  local events, cb = recorder()
  show_interstitial(sdk, cb)
  local late_before = fake:callback("ads_show_interstitial", I_BEFORE)
  local late_after = fake:callback("ads_show_interstitial", I_AFTER)
  h.advance(31)
  h.deep_eq(events, { "no_fill", "after" })
  late_before(h.state.script)
  late_before(h.state.script)
  late_after(h.state.script)
  h.deep_eq(events, { "no_fill", "after" }, "a late callback reached the game")
  h.eq(count_prints("before_ad dropped"), 1, "one warning for the late before_ad")
end

function T.callback_errors_are_logged_with_a_traceback()
  local fake = h.fake_native()
  local sdk = h.load_wrapper{ native = fake }
  local events, cb = recorder()
  show_interstitial(sdk, cb, { no_fill = cb("no_fill", function() error("boom") end) })
  fake:fire("ads_show_interstitial", I_NO_FILL)
  h.advance(1)
  h.deep_eq(events, { "no_fill", "after" })
  h.truthy(h.printed("[Yes2SDK] no_fill callback error:"))
  h.truthy(h.printed("stack traceback"), "the callback error was logged without a traceback")
  h.eq(#h.take_errors(), 0)
end

function T.editor_mock_no_fill_is_followed_by_after_ad()
  local sdk = h.load_wrapper{ system_name = "Darwin", config = { ["yes2sdk.mock_ad_result"] = "nofill" } }
  local events, cb = recorder()
  show_rewarded(sdk, cb)
  h.advance(1)
  h.deep_eq(events, { "no_fill", "after" })
  h.falsy(sdk.ads_is_ad_showing())
end

-- A retry from inside no_fill gets the first ad's after_ad first, during the
-- ads_show_* call and before the native call, so the order is always
-- no_fill(A), after_ad(A), before_ad(B), ..., after_ad(B). Platforms that fire
-- before_ad as soon as the ad is requested would otherwise resume the game in
-- after_ad(A) while B is on screen.

local function shared_log()
  local log = {}
  local function tag(prefix, name, fn)
    return function(...)
      log[#log + 1] = prefix .. "." .. name
      if fn then return fn(...) end
    end
  end
  return log, tag
end

function T.retry_with_an_immediate_before_ad_gets_the_first_after_ad_first()
  local log, tag = shared_log()
  local calls_at_first_after = nil
  local fake
  fake = h.fake_native{ overrides = {
    -- This platform fires before_ad inside the request itself.
    ads_show_rewarded = function(_, before) before(h.state.script, true) end,
  } }
  local sdk = h.load_wrapper{ native = fake }
  local showing_in_first_after = "unset"
  sdk.ads_show_interstitial("menu", tag("A", "before"),
    tag("A", "after", function()
      calls_at_first_after = #fake:calls_to("ads_show_rewarded")
      showing_in_first_after = sdk.ads_is_ad_showing()
    end),
    tag("A", "no_fill", function()
      sdk.ads_show_rewarded("reward", tag("B", "before"), tag("B", "after"),
        tag("B", "dismissed"), tag("B", "viewed"), tag("B", "no_fill"))
    end))
  fake:fire("ads_show_interstitial", I_NO_FILL)
  h.deep_eq(log, { "A.no_fill", "A.after", "B.before" })
  h.eq(calls_at_first_after, 0, "after_ad(A) must come before the native call of the retry")
  h.eq(showing_in_first_after, false)
  h.truthy(sdk.ads_is_ad_showing(), "the retry is in flight")
  -- The bridge may still deliver A's real after_ad; it must be swallowed.
  fake:callback("ads_show_interstitial", I_AFTER)(h.state.script, true)
  h.advance(1)
  h.deep_eq(log, { "A.no_fill", "A.after", "B.before" }, "A's after_ad arrived twice or settled B")
  h.truthy(sdk.ads_is_ad_showing())
  fake:fire("ads_show_rewarded", R_VIEWED)
  fake:fire("ads_show_rewarded", R_AFTER)
  h.deep_eq(log, { "A.no_fill", "A.after", "B.before", "B.viewed", "B.after" })
  h.falsy(sdk.ads_is_ad_showing())
  h.eq(h.pending_timers(), 0, "a timer was left running")
end

function T.retry_from_no_fill_first_after_ad_uses_the_no_fill_self()
  local fake = h.fake_native()
  local sdk = h.load_wrapper{ native = fake }
  local first, cb1, args1 = recorder()
  local _, cb2 = recorder()
  show_interstitial(sdk, cb1, { no_fill = cb1("no_fill", function() show_interstitial(sdk, cb2) end) })
  local caller = { name = "caller" }
  fake:callback("ads_show_interstitial", I_NO_FILL)(caller, true)
  h.deep_eq(first, { "no_fill", "after" }, "after_ad(A) was not delivered during the retry")
  h.eq(args1[2][1], caller, "after_ad(A) must get the self no_fill got")
  h.eq(args1[2][2], true)
end

function T.retry_from_no_fill_deferred_variant_keeps_the_order()
  local log, tag = shared_log()
  local fake = h.fake_native()
  local sdk = h.load_wrapper{ native = fake }
  sdk.ads_show_interstitial("menu", tag("A", "before"), tag("A", "after"),
    tag("A", "no_fill", function()
      sdk.ads_show_rewarded("reward", tag("B", "before"), tag("B", "after"),
        tag("B", "dismissed"), tag("B", "viewed"), tag("B", "no_fill"))
    end))
  fake:fire("ads_show_interstitial", I_NO_FILL)
  h.deep_eq(log, { "A.no_fill", "A.after" })
  h.advance(1)
  fake:fire("ads_show_rewarded", R_BEFORE)
  fake:fire("ads_show_rewarded", R_DISMISSED)
  fake:fire("ads_show_rewarded", R_AFTER)
  h.deep_eq(log, { "A.no_fill", "A.after", "B.before", "B.dismissed", "B.after" })
  h.falsy(sdk.ads_is_ad_showing())
end

function T.ad_started_inside_the_first_after_ad_rejects_the_retry()
  -- after_ad(A) is delivered inside the retry call; if the game starts another ad
  -- from it, that ad owns the latch and the retry is rejected (no_fill only).
  local log, tag = shared_log()
  local fake = h.fake_native()
  local sdk = h.load_wrapper{ native = fake }
  sdk.ads_show_interstitial("menu", tag("A", "before"),
    tag("A", "after", function()
      sdk.ads_show_interstitial("menu", tag("C", "before"), tag("C", "after"), tag("C", "no_fill"))
    end),
    tag("A", "no_fill", function()
      sdk.ads_show_rewarded("reward", tag("B", "before"), tag("B", "after"),
        tag("B", "dismissed"), tag("B", "viewed"), tag("B", "no_fill"))
    end))
  fake:fire("ads_show_interstitial", I_NO_FILL)
  h.deep_eq(log, { "A.no_fill", "A.after", "B.no_fill" })
  h.eq(#fake:calls_to("ads_show_rewarded"), 0, "the rejected retry reached the platform")
  h.eq(#fake:calls_to("ads_show_interstitial"), 2)
  h.truthy(sdk.ads_is_ad_showing(), "C is in flight")
  h.advance(1)
  h.deep_eq(log, { "A.no_fill", "A.after", "B.no_fill" })
end

function T.editor_mock_retry_from_no_fill_gets_the_first_after_ad_first()
  local sdk = h.load_wrapper{ system_name = "Darwin", config = { ["yes2sdk.mock_ad_result"] = "nofill" } }
  local log, tag = shared_log()
  local retried = false
  sdk.ads_show_interstitial("menu", tag("A", "before"), tag("A", "after"),
    tag("A", "no_fill", function()
      if retried then return end
      retried = true
      sdk.ads_show_interstitial("menu", tag("B", "before"), tag("B", "after"), tag("B", "no_fill"))
    end))
  h.step()
  h.deep_eq(log, { "A.no_fill", "A.after" }, "after_ad(A) was not delivered during the retry")
  h.advance(1)
  h.deep_eq(log, { "A.no_fill", "A.after", "B.no_fill", "B.after" })
  h.falsy(sdk.ads_is_ad_showing())
end

function T.playing_phase_watchdog_gives_dismissed_and_after_ad_one_self()
  local fake = h.fake_native()
  local sdk = h.load_wrapper{ native = fake }
  local events, cb, args = recorder()
  show_rewarded(sdk, cb)
  fake:callback("ads_show_rewarded", R_BEFORE)(nil)
  h.advance(181)
  h.deep_eq(events, { "before", "dismissed", "after" })
  h.truthy(args[2][1] ~= nil, "synthesized ad_dismissed got a nil self")
  h.eq(args[2][1], args[3][1], "ad_dismissed and after_ad got different selfs")
  h.eq(args[2][2], true)
end

return T
