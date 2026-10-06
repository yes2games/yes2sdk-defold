-- IAP wrapper tests. The native side routes each completion to the call that
-- made it (request router), so the Lua wrapper must hand every call's own
-- callback to the native and never share or replace one.

local h = require("harness")

local T = {}

local function callback_of(call)
  for i = 1, call.n do
    if type(call.args[i]) == "function" then return call.args[i] end
  end
  error("native call has no callback")
end

function T.overlapping_get_catalog_calls_each_get_their_own_callback()
  local fake = h.fake_native()
  local sdk = h.load_wrapper{ native = fake }
  local got = {}
  sdk.iap_get_catalog(function(self, success, json) got[#got + 1] = { "first", success, json } end)
  sdk.iap_get_catalog(function(self, success, json) got[#got + 1] = { "second", success, json } end)

  local calls = fake:calls_to("iap_get_catalog")
  h.eq(#calls, 2, "both calls must reach the native")
  local first, second = callback_of(calls[1]), callback_of(calls[2])
  h.truthy(first ~= second, "each call must pass its own callback")

  -- Complete in reverse order, as overlapping promises may.
  second(h.state.script, true, '[{"productId":"b"}]')
  first(h.state.script, false, "boom")
  h.deep_eq(got, {
    { "second", true, '[{"productId":"b"}]' },
    { "first", false, "boom" },
  })
end

function T.overlapping_get_product_and_get_purchases_keep_their_callbacks()
  local fake = h.fake_native()
  local sdk = h.load_wrapper{ native = fake }
  local got = {}
  sdk.iap_get_product("a", function(self, s, j) got[#got + 1] = "a:" .. j end)
  sdk.iap_get_product("b", function(self, s, j) got[#got + 1] = "b:" .. j end)
  sdk.iap_get_purchases(function(self, s, j) got[#got + 1] = "p1:" .. j end)
  sdk.iap_get_purchases(function(self, s, j) got[#got + 1] = "p2:" .. j end)
  local products = fake:calls_to("iap_get_product")
  local purchases = fake:calls_to("iap_get_purchases")
  callback_of(products[2])(h.state.script, true, "B")
  callback_of(products[1])(h.state.script, true, "null")
  callback_of(purchases[2])(h.state.script, true, "[2]")
  callback_of(purchases[1])(h.state.script, true, "[1]")
  h.deep_eq(got, { "b:B", "a:null", "p2:[2]", "p1:[1]" })
end

function T.purchase_single_flight_guard_is_kept()
  local fake = h.fake_native()
  local sdk = h.load_wrapper{ native = fake }
  local results = {}
  sdk.iap_purchase("coins", nil, function(self, s) results[#results + 1] = s end)
  sdk.iap_purchase("coins", nil, function(self, s) results[#results + 1] = "second" end)
  h.eq(#fake:calls_to("iap_purchase"), 1, "a re-entrant purchase must be rejected")
  h.truthy(h.printed("iap_purchase rejected"))
  fake:fire("iap_purchase", 1, true, "{}")
  h.deep_eq(results, { true })
  -- After the callback the guard is open again, also from inside a callback.
  sdk.iap_purchase("gems", nil, function(self, s)
    sdk.iap_purchase("more", nil, nil)
  end)
  fake:fire("iap_purchase", 1, true, "{}")
  h.eq(#fake:calls_to("iap_purchase"), 3, "a purchase started inside the callback must reach the native")
end

function T.consume_single_flight_guard_is_kept()
  local fake = h.fake_native()
  local sdk = h.load_wrapper{ native = fake }
  sdk.iap_consume_purchase("t1", function() end)
  sdk.iap_consume_purchase("t2", function() end)
  h.eq(#fake:calls_to("iap_consume_purchase"), 1)
  fake:fire("iap_consume_purchase", 1, true, nil)
  sdk.iap_consume_purchase("t3", function() end)
  h.eq(#fake:calls_to("iap_consume_purchase"), 2)
end

-- A native argument error (luaL_check*) raises before the native stores the
-- callback, so no callback will ever clear the in-flight flag. The wrapper must
-- clear it itself and still raise the error to the caller.
local function raising_native(name)
  local raise = true
  local overrides = {}
  overrides[name] = function()
    if raise then
      raise = false
      error("bad argument #1 to '" .. name .. "' (string expected, got nil)")
    end
  end
  return h.fake_native{ overrides = overrides }
end

function T.purchase_guard_is_released_when_the_native_call_raises()
  local fake = raising_native("iap_purchase")
  local sdk = h.load_wrapper{ native = fake }
  local ok, err = pcall(sdk.iap_purchase, nil, nil, function() end)
  h.falsy(ok, "the argument error must still raise")
  h.match(tostring(err), "bad argument", "the native error must propagate")
  sdk.iap_purchase("coins", nil, function() end)
  h.eq(#fake:calls_to("iap_purchase"), 2, "the next purchase must reach the native")
  h.falsy(h.printed("iap_purchase rejected"), "the next purchase must not be rejected")
end

function T.consume_guard_is_released_when_the_native_call_raises()
  local fake = raising_native("iap_consume_purchase")
  local sdk = h.load_wrapper{ native = fake }
  local ok, err = pcall(sdk.iap_consume_purchase, nil, function() end)
  h.falsy(ok, "the argument error must still raise")
  h.match(tostring(err), "bad argument", "the native error must propagate")
  sdk.iap_consume_purchase("t1", function() end)
  h.eq(#fake:calls_to("iap_consume_purchase"), 2, "the next consume must reach the native")
  h.falsy(h.printed("iap_consume_purchase rejected"), "the next consume must not be rejected")
end

return T
