-- IAP subscriptions: wrapper routing, the iap_subscribe single-flight guard,
-- the cancel boolean conversion, the warn stub, and the editor mock flows.
--
-- Lua 5.1 only: no goto, no //, no table.unpack, no bit ops.

local h = require("harness")

local T = {}

local function decode(text)
  return h.env.json.decode(text)
end

local function callback_of(call)
  for i = 1, call.n do
    if type(call.args[i]) == "function" then return call.args[i] end
  end
  error("native call has no callback")
end

-- ---------------------------------------------------------------------------
-- HTML5 wrapper over the native module

function T.subscription_calls_reach_the_native_with_their_arguments()
  local fake = h.fake_native{ returns = { iap_is_subscription_supported = true } }
  local sdk = h.load_wrapper{ native = fake }
  local got = {}
  local function cb(name) return function(self, success, payload) got[#got + 1] = { name, success, payload } end end
  sdk.iap_get_subscriptions(cb("list"))
  sdk.iap_claim_retention_offer("sub.a", cb("claim"))
  sdk.iap_get_subscription_status("sub.b", cb("status"))
  h.eq(sdk.iap_is_subscription_supported(), true)
  h.eq(fake:last("iap_claim_retention_offer").args[1], "sub.a")
  h.eq(fake:last("iap_get_subscription_status").args[1], "sub.b")
  fake:fire("iap_get_subscription_status", 1, true, '{"isActive":true,"productId":"sub.b"}')
  fake:fire("iap_get_subscriptions", 1, true, "[]")
  fake:fire("iap_claim_retention_offer", 1, false, '{"code":"X","message":"m","context":"c"}')
  h.deep_eq(got, {
    { "status", true, '{"isActive":true,"productId":"sub.b"}' },
    { "list", true, "[]" },
    { "claim", false, '{"code":"X","message":"m","context":"c"}' },
  })
end

function T.overlapping_status_calls_each_get_their_own_callback()
  local fake = h.fake_native()
  local sdk = h.load_wrapper{ native = fake }
  local got = {}
  sdk.iap_get_subscription_status("a", function(self, s, j) got[#got + 1] = "a:" .. j end)
  sdk.iap_get_subscription_status("b", function(self, s, j) got[#got + 1] = "b:" .. j end)
  local calls = fake:calls_to("iap_get_subscription_status")
  h.eq(#calls, 2)
  callback_of(calls[2])(h.state.script, true, "B")
  callback_of(calls[1])(h.state.script, true, "A")
  h.deep_eq(got, { "b:B", "a:A" })
end

function T.cancel_converts_the_payload_to_a_boolean()
  local fake = h.fake_native()
  local sdk = h.load_wrapper{ native = fake }
  local got = {}
  local cb = function(self, success, value) got[#got + 1] = { self == h.state.script, success, value } end
  sdk.iap_cancel_subscription("p", cb)
  sdk.iap_cancel_subscription("p", cb)
  sdk.iap_cancel_subscription("p", cb)
  local calls = fake:calls_to("iap_cancel_subscription")
  h.eq(#calls, 3, "cancel is not single-flight")
  h.eq(calls[1].args[1], "p")
  local err = '{"code":"PLATFORM_ERROR","message":"m","context":"iap.cancelSubscriptionAsync"}'
  callback_of(calls[1])(h.state.script, true, "true")
  callback_of(calls[2])(h.state.script, true, "false")
  callback_of(calls[3])(h.state.script, false, err)
  h.deep_eq(got, { { true, true, true }, { true, true, false }, { true, false, err } })
end

function T.cancel_without_a_callback_is_fine()
  local fake = h.fake_native()
  local sdk = h.load_wrapper{ native = fake }
  sdk.iap_cancel_subscription("p", nil)
  fake:fire("iap_cancel_subscription", 1, true, "true")
end

function T.subscribe_single_flight_guard_fails_the_second_call_next_frame()
  local fake = h.fake_native()
  local sdk = h.load_wrapper{ native = fake }
  local first, second = {}, {}
  sdk.iap_subscribe("sub.a", function(self, s, j) first[#first + 1] = { s, j } end)
  sdk.iap_subscribe("sub.b", function(self, s, j) second[#second + 1] = { self == h.state.script, s, j } end)
  h.eq(#fake:calls_to("iap_subscribe"), 1, "a re-entrant subscribe must not reach the native")
  h.truthy(h.printed("iap_subscribe rejected"))
  h.eq(#second, 0, "the rejection is not delivered synchronously")
  h.advance(0)
  h.eq(#second, 1, "the rejected call gets exactly one callback")
  h.eq(second[1][1], true, "the callback receives the calling script as self")
  h.eq(second[1][2], false)
  local err = sdk.parse_error(second[1][3])
  h.eq(err.code, "INVALID_OPERATION")
  h.eq(err.context, "iap_subscribe")
  h.advance(1)
  h.eq(#second, 1, "no second delivery")

  fake:fire("iap_subscribe", 1, true, '{"status":"cancelled"}')
  h.deep_eq(first, { { true, '{"status":"cancelled"}' } })
  -- Open again, also from inside the callback.
  sdk.iap_subscribe("sub.c", function() sdk.iap_subscribe("sub.d", nil) end)
  fake:fire("iap_subscribe", 1, true, '{"status":"cancelled"}')
  h.eq(#fake:calls_to("iap_subscribe"), 3, "a subscribe started inside the callback must reach the native")
end

function T.subscribe_guard_is_independent_of_the_purchase_guard()
  local fake = h.fake_native()
  local sdk = h.load_wrapper{ native = fake }
  sdk.iap_purchase("coins", nil, function() end)
  sdk.iap_subscribe("sub.a", function() end)
  h.eq(#fake:calls_to("iap_subscribe"), 1)
end

function T.subscribe_guard_is_released_when_the_native_call_raises()
  local raise = true
  local fake = h.fake_native{ overrides = { iap_subscribe = function()
    if raise then
      raise = false
      error("bad argument #1 to '?' (string expected, got nil)")
    end
  end } }
  local sdk = h.load_wrapper{ native = fake }
  local ok, err = pcall(sdk.iap_subscribe, nil, function() end)
  h.falsy(ok, "the argument error must still raise")
  h.match(tostring(err), "bad argument #1 to 'iap_subscribe'")
  sdk.iap_subscribe("sub.a", function() end)
  h.eq(#fake:calls_to("iap_subscribe"), 2, "the next subscribe must reach the native")
  h.falsy(h.printed("iap_subscribe rejected"))
end

-- ---------------------------------------------------------------------------
-- Warn stub (extension not loaded on HTML5)

function T.warn_stub_reports_unsupported_and_fails_next_frame()
  local sdk = h.load_wrapper{ system_name = "HTML5" }
  h.eq(sdk.iap_is_subscription_supported(), false)
  local got = {}
  local function cb(name) return function(self, success, payload) got[#got + 1] = { name, success, payload } end end
  sdk.iap_get_subscriptions(cb("list"))
  sdk.iap_subscribe("p", cb("subscribe"))
  sdk.iap_cancel_subscription("p", cb("cancel"))
  sdk.iap_claim_retention_offer("p", cb("claim"))
  sdk.iap_get_subscription_status("p", cb("status"))
  h.eq(#got, 0, "no synchronous callbacks")
  h.advance(0)
  h.eq(#got, 5)
  for _, entry in ipairs(got) do
    h.eq(entry[2], false, entry[1])
    h.eq(sdk.parse_error(entry[3]).code, "NOT_INITIALIZED", entry[1])
  end
  -- The subscribe guard was released by its callback.
  sdk.iap_subscribe("p", cb("again"))
  h.falsy(h.printed("iap_subscribe rejected"))
end

-- ---------------------------------------------------------------------------
-- Editor mock

local function mock(config)
  return h.load_wrapper{ system_name = "Darwin", config = config }
end

local function collect(fn)
  local box = {}
  fn(function(self, success, payload) box[#box + 1] = { success, payload } end)
  h.advance(0)
  h.eq(#box, 1, "exactly one callback")
  return box[1][1], box[1][2]
end

function T.mock_purchases_are_sandboxed()
  local sdk = mock()
  local ok, purchase = collect(function(cb) sdk.iap_purchase("coins", nil, cb) end)
  h.eq(ok, true)
  h.eq(decode(purchase).isSandbox, true)
  local _, list = collect(function(cb) sdk.iap_get_purchases(cb) end)
  h.eq(decode(list)[1].isSandbox, true)
end

function T.mock_subscription_flow_subscribe_status_cancel()
  local sdk = mock()
  h.eq(sdk.iap_is_subscription_supported(), true)
  local id = "yes2.mock.premium.monthly"

  local ok, list = collect(function(cb) sdk.iap_get_subscriptions(cb) end)
  h.eq(ok, true)
  local offers = decode(list)
  h.eq(#offers, 1)
  h.eq(offers[1].productId, id)
  h.eq(offers[1].isActive, false)
  h.eq(offers[1].billingPeriod, "monthly")

  local _, status = collect(function(cb) sdk.iap_get_subscription_status(id, cb) end)
  h.eq(decode(status).isActive, false)
  h.eq(decode(status).productId, id)

  local sok, result = collect(function(cb) sdk.iap_subscribe(id, cb) end)
  h.eq(sok, true)
  local res = decode(result)
  h.eq(res.status, "subscribed")
  h.eq(res.subscription.productId, id)
  h.eq(res.subscription.isActive, true)
  h.eq(res.subscription.isSandbox, true)

  _, status = collect(function(cb) sdk.iap_get_subscription_status(id, cb) end)
  h.eq(decode(status).isActive, true)
  _, list = collect(function(cb) sdk.iap_get_subscriptions(cb) end)
  h.eq(decode(list)[1].isActive, true)

  local cok, cancelled = collect(function(cb) sdk.iap_cancel_subscription(id, cb) end)
  h.eq(cok, true)
  h.eq(cancelled, true, "cancel delivers a boolean")
  _, status = collect(function(cb) sdk.iap_get_subscription_status(id, cb) end)
  h.eq(decode(status).isActive, false)

  local rok, retained = collect(function(cb) sdk.iap_claim_retention_offer(id, cb) end)
  h.eq(rok, true)
  h.eq(decode(retained).isActive, true)
  _, status = collect(function(cb) sdk.iap_get_subscription_status(id, cb) end)
  h.eq(decode(status).isActive, true)
end

function T.mock_subscribe_any_product_id_is_listed()
  local sdk = mock()
  collect(function(cb) sdk.iap_subscribe("game.vip", cb) end)
  local _, list = collect(function(cb) sdk.iap_get_subscriptions(cb) end)
  local found
  for _, sub in ipairs(decode(list)) do
    if sub.productId == "game.vip" then found = sub end
  end
  h.truthy(found, "a subscribed custom id is listed")
  h.eq(found.isActive, true)
end

function T.mock_subscribe_cancelled()
  local sdk = mock{ ["yes2sdk.mock_subscribe_result"] = "cancelled" }
  local ok, result = collect(function(cb) sdk.iap_subscribe("yes2.mock.premium.monthly", cb) end)
  h.eq(ok, true)
  h.eq(decode(result).status, "cancelled")
  local _, status = collect(function(cb) sdk.iap_get_subscription_status("yes2.mock.premium.monthly", cb) end)
  h.eq(decode(status).isActive, false)
end

function T.mock_subscribe_fail()
  local sdk = mock{ ["yes2sdk.mock_subscribe_result"] = "fail" }
  local ok, err = collect(function(cb) sdk.iap_subscribe("yes2.mock.premium.monthly", cb) end)
  h.eq(ok, false)
  local parsed = sdk.parse_error(err)
  h.eq(parsed.code, "IAP_PURCHASE_FAILED")
  h.eq(parsed.context, "iap.subscribeAsync")
  -- Guard released: the next subscribe runs.
  collect(function(cb) sdk.iap_subscribe("yes2.mock.premium.monthly", cb) end)
  h.falsy(h.printed("iap_subscribe rejected"))
end

-- ---------------------------------------------------------------------------
-- README sample

local function readme_subscription_sample()
  local file = assert(io.open(h.root .. "README.md", "r"), "cannot open README.md")
  local text = file:read("*a")
  file:close()
  local section = text:match("\n#### Subscriptions\n(.-)\n### ")
  assert(section, "README has no Subscriptions section")
  local code = section:match("```lua\n(.-)\n```")
  assert(code, "Subscriptions section has no lua sample")
  return code
end

local function run_sample(active)
  local fake = h.fake_native{ returns = { iap_is_subscription_supported = true } }
  local sdk = h.load_wrapper{ native = fake }
  local world = { granted = 0, offered = 0, failed = 0 }
  local env = setmetatable({
    yes2sdk = sdk,
    grant_premium = function() world.granted = world.granted + 1 end,
    show_subscribe_button = function() world.offered = world.offered + 1 end,
    show_purchase_failed = function() world.failed = world.failed + 1 end,
  }, { __index = h.env })
  local chunk = assert(loadstring(readme_subscription_sample(), "=README subscription sample"))
  setfenv(chunk, env)
  chunk()
  fake:fire("iap_get_subscriptions", 1, true,
    h.env.json.encode({ { productId = "premium_monthly", isActive = active } }))
  world.fake = fake
  return world
end

function T.readme_sample_never_offers_a_held_subscription()
  local held = run_sample(true)
  h.eq(held.granted, 1)
  h.eq(held.offered, 0)
  local free = run_sample(false)
  h.eq(free.granted, 0)
  h.eq(free.offered, 1)
end

function T.readme_sample_treats_a_cancelled_checkout_as_no_error()
  local world = run_sample(false)
  world.fake:fire("iap_subscribe", 1, false,
    '{"code":"IAP_PURCHASE_CANCELLED","message":"closed","context":"iap.subscribeAsync"}')
  h.eq(world.failed, 0)
  h.eq(world.granted, 0)
end

function T.readme_sample_grants_on_subscribed()
  local world = run_sample(false)
  world.fake:fire("iap_subscribe", 1, true, '{"status":"subscribed","subscription":{"productId":"premium_monthly"}}')
  h.eq(world.granted, 1)
end

return T
