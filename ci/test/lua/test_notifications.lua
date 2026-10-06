-- Notifications wrapper tests: snake_case to camelCase mapping, string
-- passthrough, argument rejection, the editor mock and the warn stub.

local h = require("harness")

local T = {}

local function load(opts)
  opts = opts or {}
  opts.native = opts.native or h.fake_native()
  local sdk, i = h.load_internals(opts)
  return sdk, i, opts.native
end

local function sent_options(fake)
  local call = fake:last("notifications_schedule")
  h.truthy(call, "notifications_schedule never reached the native")
  h.eq(type(call.args[1]), "string", "options must reach the native as a JSON string")
  return h.env.json.decode(call.args[1])
end

function T.snake_case_options_are_mapped_to_camel_case()
  local sdk, _, fake = load()
  sdk.notifications_schedule({
    id = "d1", title = "Hi", body = "Back", scheduled_in_days = 1,
    cta_text = "Play", priority = "high", image_asset_id = "img1",
    icon_url = "https://x/i.png", data = { day = 1 },
  }, function() end)
  h.deep_eq(sent_options(fake), {
    id = "d1", title = "Hi", body = "Back", scheduledInDays = 1,
    ctaText = "Play", priority = "high", imageAssetId = "img1",
    iconUrl = "https://x/i.png", data = { day = 1 },
  })
end

function T.delay_and_image_data_url_are_mapped()
  local sdk, _, fake = load()
  sdk.notifications_schedule({ title = "t", delay_seconds = 30, image_data_url = "data:image/png;base64,AA" }, function() end)
  h.deep_eq(sent_options(fake), { title = "t", delaySeconds = 30, imageDataUrl = "data:image/png;base64,AA" })
end

function T.day_and_delay_are_both_passed_so_core_rejects()
  local sdk, _, fake = load()
  sdk.notifications_schedule({ title = "t", delay_seconds = 5, scheduled_in_days = 2 }, function() end)
  h.deep_eq(sent_options(fake), { title = "t", delaySeconds = 5, scheduledInDays = 2 })
end

function T.unknown_keys_pass_through_unchanged()
  local sdk, _, fake = load()
  sdk.notifications_schedule({ title = "t", someNewOption = true, other_key = 1 }, function() end)
  h.deep_eq(sent_options(fake), { title = "t", someNewOption = true, other_key = 1 })
end

function T.json_string_passes_through_without_mapping()
  local sdk, _, fake = load()
  local raw = '{"title":"t","delay_seconds":5}'
  sdk.notifications_schedule(raw, function() end)
  h.eq(fake:last("notifications_schedule").args[1], raw)
end

function T.callback_is_the_native_callback()
  local sdk, _, fake = load()
  local got
  sdk.notifications_schedule({ title = "t" }, function(self, ok, res) got = { ok, res } end)
  fake:fire("notifications_schedule", 1, true, '{"id":"a"}')
  h.deep_eq(got, { true, '{"id":"a"}' })
end

function T.nil_or_empty_options_still_reach_core_for_validation()
  local sdk, _, fake = load()
  sdk.notifications_schedule(nil, function() end)
  h.eq(fake:last("notifications_schedule").args[1], "{}")
  sdk.notifications_schedule({}, function() end)
  h.eq(fake:last("notifications_schedule").args[1], "{}")
end

function T.non_table_non_string_options_fail_with_invalid_param()
  local sdk, _, fake = load()
  local got
  sdk.notifications_schedule(42, function(self, ok, err) got = { ok, err } end)
  h.eq(#fake:calls_to("notifications_schedule"), 0, "native must not be called")
  h.eq(got, nil, "callback must not run synchronously")
  h.step()
  h.step()
  h.truthy(got and got[1] == false, "callback must fire with success=false")
  h.eq(h.env.json.decode(got[2]).code, "INVALID_PARAM")
end

function T.cancel_and_cancel_all_reach_the_native()
  local sdk, _, fake = load()
  sdk.notifications_cancel("d1", function() end)
  h.eq(fake:last("notifications_cancel").args[1], "d1")
  sdk.notifications_cancel_all(function() end)
  h.eq(#fake:calls_to("notifications_cancel_all"), 1)
end

function T.cancel_with_a_non_string_id_fails_with_invalid_param()
  local sdk, _, fake = load()
  local got
  sdk.notifications_cancel(nil, function(self, ok, err) got = { ok, err } end)
  h.eq(#fake:calls_to("notifications_cancel"), 0)
  h.step()
  h.step()
  h.truthy(got and got[1] == false)
  h.eq(h.env.json.decode(got[2]).code, "INVALID_PARAM")
end

function T.is_supported_asks_the_native()
  local fake = h.fake_native{ returns = { notifications_is_supported = true } }
  local sdk = load({ native = fake })
  h.eq(sdk.notifications_is_supported(), true)
end

-- Warn stub (extension not loaded, HTML5): supported is false, async APIs fail.
function T.warn_stub_reports_unsupported_and_fails_async()
  local sdk = h.load_wrapper{ system_name = "HTML5" }
  h.eq(sdk.notifications_is_supported(), false)
  local got = {}
  sdk.notifications_schedule({ title = "t" }, function(self, ok, err) got.schedule = { ok, err } end)
  sdk.notifications_cancel("a", function(self, ok, err) got.cancel = { ok, err } end)
  sdk.notifications_cancel_all(function(self, ok, err) got.all = { ok, err } end)
  h.advance(1)
  for _, k in ipairs({ "schedule", "cancel", "all" }) do
    h.truthy(got[k] and got[k][1] == false, k .. " must fail")
    h.eq(h.env.json.decode(got[k][2]).code, "NOT_INITIALIZED")
  end
end

-- Editor mock (no extension, not HTML5).
function T.mock_schedule_echoes_with_a_scheduled_time()
  local sdk = h.load_wrapper{ system_name = "Darwin" }
  h.eq(sdk.notifications_is_supported(), true)
  local before = os.time() * 1000
  local got
  sdk.notifications_schedule({ id = "d2", title = "Hi", body = "Back", scheduled_in_days = 2 }, function(self, ok, res) got = { ok, res } end)
  h.advance(1)
  h.truthy(got and got[1] == true, "mock schedule must succeed")
  local r = h.env.json.decode(got[2])
  h.eq(r.id, "d2")
  h.eq(r.title, "Hi")
  h.eq(r.body, "Back")
  h.truthy(r.scheduledAt >= before + 2 * 86400 * 1000, "scheduledAt must be now plus two days")
  h.truthy(r.scheduledAt <= before + 2 * 86400 * 1000 + 5000)
end

function T.mock_schedule_uses_delay_seconds_and_generates_an_id()
  local sdk = h.load_wrapper{ system_name = "Darwin" }
  local before = os.time() * 1000
  local got
  sdk.notifications_schedule({ title = "t", delay_seconds = 60 }, function(self, ok, res) got = { ok, res } end)
  h.advance(1)
  local r = h.env.json.decode(got[2])
  h.truthy(type(r.id) == "string" and r.id ~= "", "an id must be generated")
  h.truthy(r.scheduledAt >= before + 60000 and r.scheduledAt <= before + 65000)
end

function T.mock_cancel_succeeds()
  local sdk = h.load_wrapper{ system_name = "Darwin" }
  local got = {}
  sdk.notifications_cancel("a", function(self, ok, res) got.c = { ok, res } end)
  sdk.notifications_cancel_all(function(self, ok, res) got.a = { ok, res } end)
  h.advance(1)
  h.truthy(got.c and got.c[1] == true)
  h.truthy(got.a and got.a[1] == true)
end

return T
