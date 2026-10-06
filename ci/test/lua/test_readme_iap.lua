-- Runs the README "In-app purchases" sample against the real yes2sdk.lua with a
-- fake native. iap_consume_purchase takes one call at a time, so the sample
-- must consume pending purchases one by one: every purchase granted once and
-- consumed once, also with several pending, a buy during the launch consumes,
-- and a consume that failed on the previous launch.
--
-- Lua 5.1 only: no goto, no //, no table.unpack, no bit ops.

local h = require("harness")

local T = {}

local function readme_sample()
  local file = assert(io.open(h.root .. "README.md", "r"), "cannot open README.md")
  local text = file:read("*a")
  file:close()
  local section = text:match("\n### In%-app purchases\n(.-)\n### ")
  assert(section, "README has no In-app purchases section")
  local code = section:match("```lua\n(.-)\n```")
  assert(code, "In-app purchases section has no lua sample")
  return code
end

local function purchase(token)
  return { purchaseToken = token, productId = "coins_100" }
end

-- Load the wrapper and run the sample once (one launch). `pending` is what
-- iap_get_purchases returns; `granted` is the saved grant set carried over from
-- the previous launch.
local function launch(pending, granted, consume_ok)
  local fake = h.fake_native{ returns = { iap_is_supported = true } }
  local sdk = h.load_wrapper{ native = fake }
  local world = {
    grants = {},
    saves = 0,
    save_data = { granted = granted or {} },
  }
  local env = setmetatable({
    yes2sdk = sdk,
    save_data = world.save_data,
    grant_product = function(id) world.grants[#world.grants + 1] = id end,
    save_progress = function() world.saves = world.saves + 1 end,
    show_purchase_failed = function() world.purchase_failed = true end,
  }, { __index = h.env })
  local chunk = assert(loadstring(readme_sample(), "=README iap sample"))
  setfenv(chunk, env)
  chunk()

  -- Answer the launch iap_get_purchases.
  fake:fire("iap_get_purchases", 1, true, h.env.json.encode(pending))
  world.fake = fake
  world.consume_ok = consume_ok ~= false

  -- Settle native consumes one at a time, as the platform would.
  function world.settle_consumes()
    local answered = world.answered or 0
    while #fake:calls_to("iap_consume_purchase") > answered do
      answered = answered + 1
      local call = fake:calls_to("iap_consume_purchase")[answered]
      for i = 1, call.n do
        if type(call.args[i]) == "function" then
          if world.consume_ok then
            call.args[i](h.state.script, true, nil)
          else
            call.args[i](h.state.script, false, '{"code":"IAP_CONSUME_FAILED","message":"x","context":"iap"}')
          end
          break
        end
      end
    end
    world.answered = answered
  end
  return world
end

local function consumed_tokens(fake)
  local out = {}
  for _, call in ipairs(fake:calls_to("iap_consume_purchase")) do
    out[#out + 1] = call.args[1]
  end
  return out
end

local function check_pending(n)
  local pending = {}
  local tokens = {}
  for i = 1, n do
    pending[i] = purchase("t" .. i)
    tokens[i] = "t" .. i
  end
  local world = launch(pending)
  h.eq(#world.fake:calls_to("iap_consume_purchase"), 1, "only one consume may be open at a time")
  world.settle_consumes()
  h.eq(#world.grants, n, "each pending purchase granted once")
  h.deep_eq(consumed_tokens(world.fake), tokens, "each pending purchase consumed once, in order")
  h.falsy(h.printed("rejected"), "no consume may be rejected by the guard")
end

function T.two_pending_purchases_are_each_granted_and_consumed_once()
  check_pending(2)
end

function T.three_pending_purchases_are_each_granted_and_consumed_once()
  check_pending(3)
end

function T.a_buy_during_launch_consumes_goes_through_the_same_queue()
  local world = launch({ purchase("t1"), purchase("t2") })
  -- The sample's iap_purchase call is open; complete it while t1's consume is open.
  world.fake:fire("iap_purchase", 1, true, h.env.json.encode(purchase("b1")))
  h.eq(#world.fake:calls_to("iap_consume_purchase"), 1, "the buy must wait for the open consume")
  world.settle_consumes()
  h.eq(#world.grants, 3)
  h.deep_eq(consumed_tokens(world.fake), { "t1", "t2", "b1" })
  h.falsy(h.printed("rejected"))
end

function T.a_purchase_whose_consume_failed_is_not_granted_again_next_launch()
  local first = launch({ purchase("t1"), purchase("t2") }, nil, false)
  first.settle_consumes()
  h.eq(#first.grants, 2)
  h.eq(#first.fake:calls_to("iap_consume_purchase"), 2, "a failed consume must not stop the queue")
  -- Next launch: both still pending, the saved grant set carries over.
  local second = launch({ purchase("t1"), purchase("t2") }, first.save_data.granted)
  second.settle_consumes()
  h.eq(#second.grants, 0, "already granted purchases must not be granted twice")
  h.deep_eq(consumed_tokens(second.fake), { "t1", "t2" }, "they are consumed this time")
end

return T
