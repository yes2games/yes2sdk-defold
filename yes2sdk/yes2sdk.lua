--- Yes2SDK — High-level Lua API wrapper
-- @module yes2sdk_api

-- Overlapping calls to the same async function each get their own callback. Exceptions:
-- iap_purchase, iap_consume_purchase, iap_subscribe and ads_show_* reject a second call while one is open;
-- initialize and start_game are once per session.

-- Fail an async call of the warn stub (extension not loaded): the callback gets
-- NOT_INITIALIZED on the next frame, never synchronously. `context` names the SDK
-- call as "<module>.<method>". Last resort: if no timer can be created
-- (timer.delay raises, or returns timer.INVALID_TIMER_HANDLE), the callback runs
-- synchronously with a nil self rather than never being delivered.
local function not_loaded_async(callback, context)
  if not callback then return end
  local err = json.encode({
    code = "NOT_INITIALIZED",
    message = "Yes2SDK extension not loaded",
    context = context,
  })
  local ok, handle = pcall(timer.delay, 0, false, function(tself) callback(tself, false, err) end)
  if not ok or handle == timer.INVALID_TIMER_HANDLE then callback(nil, false, err) end
end

-- Guard: if the native extension isn't loaded (Project > Build instead of Bundle),
-- create a stub that logs a warning and no-ops all SDK calls.
local sdk = yes2sdk
if not sdk then
  local warned = false
  local function warn()
    if not warned then
      warned = true
      print("[Yes2SDK] Extension not loaded. Use Project > Bundle > HTML5 Application (not Project > Build). Native extensions require bundling.")
    end
  end
  sdk = setmetatable({}, {
    __index = function(_, key)
      return function() warn() end
    end
  })
  -- Async calls that must not leave the caller waiting: warn, then fail the
  -- callback next frame with NOT_INITIALIZED.
  local function stub_fail(callback, context)
    warn()
    not_loaded_async(callback, context)
  end
  -- Override functions that return values with sensible defaults
  function sdk.get_platform() warn() return "editor" end
  function sdk.session_get_locale() warn() return "en" end
  function sdk.session_get_device_info() warn() return '{"type":"unknown","isMobile":false,"isDesktop":false,"isTablet":false,"isTV":false}' end
  function sdk.auth_is_authenticated() warn() return false end
  function sdk.player_get_name() warn() return "Player" end
  function sdk.player_get_id() warn() return "" end
  function sdk.data_get_int(key, def) warn() return def or 0 end
  function sdk.data_get_float(key, def) warn() return def or 0.0 end
  function sdk.data_get_string(key, def) warn() return def or "" end
  function sdk.data_has_key() warn() return false end
  function sdk.game_get_settings() warn() return "{}" end
  function sdk.friends_is_supported() warn() return false end
  function sdk.banners_is_supported() warn() return false end
  function sdk.score_is_supported() warn() return false end
  function sdk.leaderboard_is_supported() warn() return false end
  function sdk.stats_is_supported() warn() return false end
  function sdk.config_is_supported() warn() return false end
  function sdk.review_is_supported() warn() return false end
  function sdk.iap_is_supported() warn() return false end
  function sdk.context_is_supported() warn() return false end
  function sdk.context_share(options_json, callback) stub_fail(callback, "context.shareAsync") end
  -- Notifications: unsupported, and the async calls fail instead of going silent.
  function sdk.notifications_is_supported() warn() return false end
  function sdk.notifications_schedule(options, callback) stub_fail(callback, "notifications.scheduleAsync") end
  function sdk.notifications_cancel(id, callback) stub_fail(callback, "notifications.cancelAsync") end
  function sdk.notifications_cancel_all(callback) stub_fail(callback, "notifications.cancelAllAsync") end
  -- IAP subscriptions: unsupported, and every async call fails.
  function sdk.iap_is_subscription_supported() warn() return false end
  function sdk.iap_get_subscriptions(callback) stub_fail(callback, "iap.getSubscriptionsAsync") end
  function sdk.iap_subscribe(product_id, callback) stub_fail(callback, "iap.subscribeAsync") end
  function sdk.iap_cancel_subscription(product_id, callback) stub_fail(callback, "iap.cancelSubscriptionAsync") end
  function sdk.iap_claim_retention_offer(product_id, callback) stub_fail(callback, "iap.claimRetentionOfferAsync") end
  function sdk.iap_get_subscription_status(product_id, callback) stub_fail(callback, "iap.getSubscriptionStatusAsync") end
  -- Confirmed writes: they cannot reach a platform, so the callback fails.
  function sdk.data_set_string_async(key, value, callback) stub_fail(callback, "data.setStringAsync") end
  function sdk.data_flush(callback) stub_fail(callback, "data.flushAsync") end
  function sdk.player_flush_data(callback) stub_fail(callback, "player.flushDataAsync") end
  function sdk.ads_is_rewarded_ad_available() warn() return false end
  function sdk.ads_is_interstitial_supported() warn() return false end
  function sdk.ads_is_rewarded_supported() warn() return false end
  function sdk.auth_is_supported() warn() return false end
  function sdk.player_is_data_supported() warn() return false end
  -- Bot avatars: unsupported, and the async call fails.
  function sdk.player_is_bot_avatar_supported() warn() return false end
  function sdk.player_get_bot_avatar(username, size, callback) stub_fail(callback, "player.getBotAvatarAsync") end
  function sdk.session_is_audio_enabled() warn() return true end
  function sdk.session_get_entry_point_data() warn() return "{}" end
  -- Registration prompt: no extension, no prompt.
  function sdk.auth_show_registration_prompt() warn() return '{"error":{"code":"FEATURE_NOT_SUPPORTED","message":"Registration prompt needs the native extension (HTML5 bundle)","context":"auth.showRegistrationPrompt"}}' end
  function sdk.auth_registration_prompt_login() warn() return false end
  function sdk.auth_registration_prompt_close() warn() return false end

  -- Referrals: unsupported, and async calls fail.
  function sdk.referrals_is_supported() warn() return false end
  function sdk.referrals_share(options_json, callback) stub_fail(callback, "referrals.shareAsync") end
  function sdk.referrals_list(callback) stub_fail(callback, "referrals.listAsync") end

  -- ── Editor mock (desktop builds only) ──
  --
  -- Without a mock, ad callbacks never fire in the editor (only the
  -- watchdog's no_fill, then after_ad, after 30 s) and IAP callbacks never fire at all, so integrations
  -- could only be tested in an HTML5 bundle. The mock simulates the full
  -- callback flows on timers, mirroring the Unity SDK's Play Mode mocks:
  -- 3s interstitial / 5s rewarded, sample IAP catalog, session purchases,
  -- and selectable failure modes.
  --
  -- Configure in game.project (all optional):
  --   [yes2sdk]
  --   mock = 0                        <- disable the mock entirely
  --   mock_rewarded_result = viewed   <- or: dismissed (no-reward path)
  --   mock_ad_result = normal         <- or: nofill (ads fail, no inventory)
  --   mock_purchase_result = success  <- or: fail
  --   mock_referral_result = shared   <- reports {"canceled":false}; or: canceled ({"canceled":true})
  --   mock_subscribe_result = subscribed  <- or: cancelled, fail
  --   mock_entry_point_data = {}      <- JSON object string for session_get_entry_point_data()
  --
  -- HTML5 keeps the plain warn stub: a missing extension there is a bundling
  -- mistake the developer must see, not something to paper over.
  local function mock_config(key, default)
    if sys.get_config_string then
      return sys.get_config_string("yes2sdk." .. key, default)
    end
    return sys.get_config("yes2sdk." .. key, default)
  end

  local is_html5 = sys.get_sys_info().system_name == "HTML5"
  if not is_html5 and mock_config("mock", "1") ~= "0" then
    print("[Yes2SDK] Editor mock active: init, ads, and IAP are simulated. Set [yes2sdk] mock = 0 in game.project to disable.")

    -- Fire a callback on the next frame. The timer is created inside the
    -- calling script's context, so the callback receives the correct self.
    local function next_frame(fn)
      timer.delay(0, false, function(tself) fn(tself) end)
    end

    -- Core: fire the init/start callbacks so games gated on them can run.
    function sdk.initialize(callback)
      print("[Yes2SDK] Mock: initialize() succeeding")
      if callback then next_frame(function(tself) callback(tself, true, nil) end) end
    end
    function sdk.start_game(callback)
      print("[Yes2SDK] Mock: start_game() succeeding")
      if callback then next_frame(function(tself) callback(tself, true, nil) end) end
    end
    function sdk.set_loading_progress(progress) end
    -- Exit requests never happen in the editor, so registering is a quiet no-op.
    function sdk.on_exit_requested(callback) end

    -- Entry point data: mock_entry_point_data in game.project is a JSON object string.
    function sdk.session_get_entry_point_data()
      return mock_config("mock_entry_point_data", "{}")
    end

    -- Registration prompt: always opens (draw your own prompt UI); login prints,
    -- close fires on_close on the next frame and frees the handle.
    local mock_prompts = {}
    local mock_prompt_next = 0
    function sdk.auth_show_registration_prompt(options_json, on_close)
      mock_prompt_next = mock_prompt_next + 1
      mock_prompts[mock_prompt_next] = on_close
      print("[Yes2SDK] Mock: registration prompt shown (handle " .. mock_prompt_next .. ")")
      return '{"handle":' .. mock_prompt_next .. '}'
    end
    function sdk.auth_registration_prompt_login(handle)
      if not mock_prompts[handle] then return false end
      print("[Yes2SDK] Mock: registration prompt login (the platform login flow does not run in the editor)")
      return true
    end
    function sdk.auth_registration_prompt_close(handle)
      local on_close = mock_prompts[handle]
      if not on_close then return false end
      mock_prompts[handle] = nil
      print("[Yes2SDK] Mock: registration prompt closed (handle " .. tostring(handle) .. ")")
      next_frame(function(tself) on_close(tself, true, nil) end)
      return true
    end

    -- Ads: delayed flows so pause/resume wiring is exercised like a real ad.
    -- Durations match the Unity SDK's mock ad popup.
    local INTERSTITIAL_SECONDS = 3
    local REWARDED_SECONDS = 5

    function sdk.ads_show_interstitial(placement, before_ad, after_ad, no_fill)
      if mock_config("mock_ad_result", "normal") == "nofill" then
        print("[Yes2SDK] Mock: interstitial no-fill (placement: " .. tostring(placement) .. ")")
        if no_fill then next_frame(function(tself) no_fill(tself, true) end) end
        return
      end
      print("[Yes2SDK] Mock: interstitial ad playing " .. INTERSTITIAL_SECONDS .. "s (placement: " .. tostring(placement) .. "). Pause in before_ad, resume in after_ad.")
      if before_ad then next_frame(function(tself) before_ad(tself, true) end) end
      timer.delay(INTERSTITIAL_SECONDS, false, function(tself)
        print("[Yes2SDK] Mock: interstitial completed (after_ad)")
        if after_ad then after_ad(tself, true) end
      end)
    end

    function sdk.ads_show_rewarded(placement, before_ad, after_ad, ad_dismissed, ad_viewed, no_fill)
      if mock_config("mock_ad_result", "normal") == "nofill" then
        print("[Yes2SDK] Mock: rewarded no-fill (placement: " .. tostring(placement) .. ")")
        if no_fill then next_frame(function(tself) no_fill(tself, true) end) end
        return
      end
      local dismissed = mock_config("mock_rewarded_result", "viewed") == "dismissed"
      print("[Yes2SDK] Mock: rewarded ad playing " .. REWARDED_SECONDS .. "s (placement: " .. tostring(placement) .. ", result: " .. (dismissed and "dismissed" or "viewed") .. ")")
      if before_ad then next_frame(function(tself) before_ad(tself, true) end) end
      timer.delay(REWARDED_SECONDS, false, function(tself)
        -- Same sequence the HTML5 bridge delivers; the wrapper's completion
        -- latch settles on the first completion callback.
        if dismissed then
          print("[Yes2SDK] Mock: rewarded dismissed (no reward)")
          if ad_dismissed then ad_dismissed(tself, true) end
        else
          print("[Yes2SDK] Mock: rewarded viewed (grant the reward)")
          if ad_viewed then ad_viewed(tself, true) end
        end
        if after_ad then after_ad(tself, true) end
      end)
    end

    function sdk.ads_is_rewarded_ad_available() return true end
    function sdk.ads_is_interstitial_supported() return true end
    function sdk.ads_is_rewarded_supported() return true end

    -- IAP: sample catalog matching the Unity mock. Any product id can be
    -- purchased (not just catalog entries) so games can test with their
    -- real ids. Purchases last for the current session only.
    local MOCK_PRODUCTS = {
      { id = "yes2.mock.coins.small", json = '{"productId":"yes2.mock.coins.small","title":"Small Coin Pack","description":"Mock consumable product.","imageUri":"","price":"$0.99","priceCurrencyCode":"USD","priceAmount":99}' },
      { id = "yes2.mock.coins.large", json = '{"productId":"yes2.mock.coins.large","title":"Large Coin Pack","description":"Mock consumable product.","imageUri":"","price":"$4.99","priceCurrencyCode":"USD","priceAmount":499}' },
      { id = "yes2.mock.noads", json = '{"productId":"yes2.mock.noads","title":"Remove Ads","description":"Mock non-consumable product.","imageUri":"","price":"$2.99","priceCurrencyCode":"USD","priceAmount":299}' },
    }
    local mock_purchases = {}
    local mock_payment_counter = 0

    local function json_escape(value)
      local out = tostring(value):gsub("\\", "\\\\"):gsub('"', '\\"')
      return out
    end

    local function mock_purchase_json(product_id, developer_payload)
      mock_payment_counter = mock_payment_counter + 1
      local token = "mock-token-" .. tostring(os.time()) .. "-" .. tostring(mock_payment_counter)
      local json = '{"purchaseToken":"' .. token
        .. '","productId":"' .. json_escape(product_id)
        .. '","paymentId":"mock-payment-' .. tostring(mock_payment_counter)
        .. '","purchaseTime":"' .. os.date("!%Y-%m-%dT%H:%M:%SZ") .. '","isSandbox":true'
      if developer_payload and developer_payload ~= "" then
        json = json .. ',"developerPayload":"' .. json_escape(developer_payload) .. '"'
      end
      return token, json .. "}"
    end

    function sdk.iap_is_supported() return true end

    function sdk.iap_get_catalog(callback)
      local parts = {}
      for i, product in ipairs(MOCK_PRODUCTS) do parts[i] = product.json end
      local catalog = "[" .. table.concat(parts, ",") .. "]"
      if callback then next_frame(function(tself) callback(tself, true, catalog) end) end
    end

    function sdk.iap_get_product(product_id, callback)
      local found = "null"
      for _, product in ipairs(MOCK_PRODUCTS) do
        if product.id == product_id then
          found = product.json
          break
        end
      end
      if callback then next_frame(function(tself) callback(tself, true, found) end) end
    end

    function sdk.iap_purchase(product_id, developer_payload, callback)
      if mock_config("mock_purchase_result", "success") == "fail" then
        print("[Yes2SDK] Mock: iap_purchase('" .. tostring(product_id) .. "') failing (mock_purchase_result = fail)")
        -- Same error shape the HTML5 bridge delivers (see M.parse_error).
        local err = json.encode({
          code = "IAP_PURCHASE_FAILED",
          message = "Simulated purchase failure (mock)",
          context = "iap.purchaseAsync",
        })
        if callback then next_frame(function(tself) callback(tself, false, err) end) end
        return
      end
      local token, purchase = mock_purchase_json(tostring(product_id), developer_payload)
      table.insert(mock_purchases, { token = token, json = purchase })
      print("[Yes2SDK] Mock: iap_purchase('" .. tostring(product_id) .. "') succeeding (token: " .. token .. ")")
      if callback then next_frame(function(tself) callback(tself, true, purchase) end) end
    end

    function sdk.iap_get_purchases(callback)
      local parts = {}
      for i, purchase in ipairs(mock_purchases) do parts[i] = purchase.json end
      local purchases = "[" .. table.concat(parts, ",") .. "]"
      if callback then next_frame(function(tself) callback(tself, true, purchases) end) end
    end

    -- Confirmed writes: nothing is stored in the editor, the calls just confirm.
    function sdk.data_set_string_async(key, value, callback)
      if callback then next_frame(function(tself) callback(tself, true, nil) end) end
    end
    function sdk.data_flush(callback)
      if callback then next_frame(function(tself) callback(tself, true, nil) end) end
    end
    function sdk.player_flush_data(callback)
      if callback then next_frame(function(tself) callback(tself, true, nil) end) end
    end

    function sdk.iap_consume_purchase(purchase_token, callback)
      for i, purchase in ipairs(mock_purchases) do
        if purchase.token == purchase_token then
          table.remove(mock_purchases, i)
          break
        end
      end
      print("[Yes2SDK] Mock: iap_consume_purchase succeeded")
      if callback then next_frame(function(tself) callback(tself, true, nil) end) end
    end

    -- Referrals: sharing succeeds (or reports canceled), the list is empty.
    function sdk.referrals_is_supported() return true end

    function sdk.referrals_share(options_json, callback)
      local canceled = mock_config("mock_referral_result", "shared") == "canceled"
      print("[Yes2SDK] Mock: referrals_share " .. (canceled and "canceled (mock_referral_result = canceled)" or "succeeding"))
      local result = canceled and '{"canceled":true}' or '{"canceled":false}'
      if callback then next_frame(function(tself) callback(tself, true, result) end) end
    end

    function sdk.referrals_list(callback)
      if callback then
        next_frame(function(tself) callback(tself, true, '{"referrals":{},"signedRequest":"mock"}') end)
      end
    end

    -- Bot avatars: supported, and the URL names the bot. It is a placeholder,
    -- not a loadable image, so the game's fallback art path gets exercised.
    function sdk.player_is_bot_avatar_supported() return true end
    function sdk.player_get_bot_avatar(username, size, callback)
      local name = tostring(username):gsub("[^%w%-%._~]", function(c)
        return string.format("%%%02X", string.byte(c))
      end)
      local url = "mock://bot-avatar/" .. tostring(size or "medium") .. "/" .. name
      print("[Yes2SDK] Mock: player_get_bot_avatar succeeded (" .. url .. ")")
      if callback then next_frame(function(tself) callback(tself, true, url) end) end
    end

    -- Notifications: schedule echoes the notification with a computed time.
    local mock_notification_count = 0
    function sdk.notifications_is_supported() return true end
    function sdk.notifications_schedule(options_json, callback)
      local ok, options = pcall(json.decode, options_json or "{}")
      if not ok or type(options) ~= "table" then options = {} end
      mock_notification_count = mock_notification_count + 1
      local delay_ms = 0
      if options.delaySeconds then
        delay_ms = options.delaySeconds * 1000
      elseif options.scheduledInDays then
        delay_ms = options.scheduledInDays * 86400 * 1000
      end
      local result = json.encode({
        id = options.id or ("mock-notification-" .. mock_notification_count),
        title = options.title or "",
        body = options.body or "",
        scheduledAt = os.time() * 1000 + delay_ms,
      })
      print("[Yes2SDK] Mock: notifications_schedule succeeded")
      if callback then next_frame(function(tself) callback(tself, true, result) end) end
    end
    function sdk.notifications_cancel(id, callback)
      print("[Yes2SDK] Mock: notifications_cancel succeeded")
      if callback then next_frame(function(tself) callback(tself, true, nil) end) end
    end
    function sdk.notifications_cancel_all(callback)
      print("[Yes2SDK] Mock: notifications_cancel_all succeeded")
      if callback then next_frame(function(tself) callback(tself, true, nil) end) end
    end

    -- Context: image share succeeds on the next frame and prints the share.
    function sdk.context_is_supported() return true end

    function sdk.context_share(options_json, callback)
      print("[Yes2SDK] Mock: context_share succeeded (options: " .. tostring(options_json) .. ")")
      if callback then next_frame(function(tself) callback(tself, true, nil) end) end
    end

    -- IAP subscriptions: one sample offer, and any product id can be subscribed
    -- to. Active state lasts for the current session only.
    local MOCK_SUBSCRIPTION_IDS = { "yes2.mock.premium.monthly" }
    local mock_subscription_active = { ["yes2.mock.premium.monthly"] = false }

    local function mock_subscription(product_id)
      return {
        productId = product_id,
        title = "Premium (monthly)",
        description = "Mock subscription product.",
        price = "4.99 USD",
        priceAmount = 499,
        priceCurrencyCode = "USD",
        billingPeriod = "monthly",
        isActive = mock_subscription_active[product_id] == true,
        trialEligible = false,
        introOffer = json.null,
        retentionOffer = { priceAmount = 249, durationPeriods = 1 },
        isSandbox = true,
      }
    end

    local function mock_set_subscription(product_id, active)
      if mock_subscription_active[product_id] == nil then
        table.insert(MOCK_SUBSCRIPTION_IDS, product_id)
      end
      mock_subscription_active[product_id] = active
    end

    function sdk.iap_is_subscription_supported() return true end

    function sdk.iap_get_subscriptions(callback)
      local list = {}
      for i, id in ipairs(MOCK_SUBSCRIPTION_IDS) do list[i] = mock_subscription(id) end
      local text = #list > 0 and json.encode(list) or "[]"
      if callback then next_frame(function(tself) callback(tself, true, text) end) end
    end

    function sdk.iap_subscribe(product_id, callback)
      product_id = tostring(product_id)
      local mode = mock_config("mock_subscribe_result", "subscribed")
      local success, payload
      if mode == "fail" then
        print("[Yes2SDK] Mock: iap_subscribe('" .. product_id .. "') failing (mock_subscribe_result = fail)")
        success = false
        payload = json.encode({
          code = "IAP_PURCHASE_FAILED",
          message = "Simulated subscription failure (mock)",
          context = "iap.subscribeAsync",
        })
      elseif mode == "cancelled" then
        print("[Yes2SDK] Mock: iap_subscribe('" .. product_id .. "') closed by the player (mock_subscribe_result = cancelled)")
        success, payload = true, '{"status":"cancelled"}'
      else
        mock_set_subscription(product_id, true)
        print("[Yes2SDK] Mock: iap_subscribe('" .. product_id .. "') subscribed")
        success = true
        payload = json.encode({ status = "subscribed", subscription = mock_subscription(product_id) })
      end
      if callback then next_frame(function(tself) callback(tself, success, payload) end) end
    end

    function sdk.iap_cancel_subscription(product_id, callback)
      product_id = tostring(product_id)
      mock_set_subscription(product_id, false)
      print("[Yes2SDK] Mock: iap_cancel_subscription('" .. product_id .. "') cancelled")
      if callback then next_frame(function(tself) callback(tself, true, "true") end) end
    end

    function sdk.iap_claim_retention_offer(product_id, callback)
      product_id = tostring(product_id)
      mock_set_subscription(product_id, true)
      print("[Yes2SDK] Mock: iap_claim_retention_offer('" .. product_id .. "') claimed")
      local text = json.encode(mock_subscription(product_id))
      if callback then next_frame(function(tself) callback(tself, true, text) end) end
    end

    function sdk.iap_get_subscription_status(product_id, callback)
      product_id = tostring(product_id)
      local active = mock_subscription_active[product_id] == true
      local status = { isActive = active, productId = product_id, willRenew = active }
      if active then
        -- 30 days from now, in milliseconds.
        status.expiresAt = (os.time() + 30 * 24 * 60 * 60) * 1000
      end
      local text = json.encode(status)
      if callback then next_frame(function(tself) callback(tself, true, text) end) end
    end
  end
end

-- True from any ads_show_* call until its request is released (after_ad, no_fill
-- or the watchdog; a failed native call releases as its next-frame no_fill is
-- delivered). Used to reject concurrent ad calls and exposed via M.ads_is_ad_showing().
local _ad_in_flight = false

-- The request that currently owns the latch, or nil. Each ads_show_* call creates
-- a fresh request table; every release path checks it, so a stale callback or
-- watchdog can never settle a newer request.
local _active_request = nil

-- A request no_fill released that still awaits its after_ad, or nil. A retry
-- started inside no_fill delivers that after_ad first (see _settle_awaiting_request).
local _awaiting_request = nil

-- Request ids, for log lines.
local _ad_request_count = 0

-- Watchdog for an ad the platform never completes. A request gets
-- _AD_START_TIMEOUT seconds to start (before_ad); once started it gets
-- _AD_PLAYING_TIMEOUT seconds to finish (after_ad), so a long real ad is not cut
-- short. Time is counted per frame with each frame capped at _AD_MAX_FRAME_DT,
-- so a tab hidden for minutes cannot release the ad on its first frame back.
local _AD_START_TIMEOUT = 30
local _AD_PLAYING_TIMEOUT = 180
local _AD_MAX_FRAME_DT = 0.5

local M = {}

-- ── Errors ──

local function _error_field(value, key)
  local ok, field = pcall(function() return value[key] end)
  if ok and type(field) == "string" then return field end
  return nil
end

--- Parse the error string a failed callback receives.
-- Failures arrive as '{"code":"...","message":"...","context":"..."}'. Returns a
-- table { code = string, message = string, context = string }. A plain string
-- that is not that JSON (an older or third-party message) becomes
-- { code = "UNKNOWN_ERROR", message = err, context = "" }; nil gives an empty
-- message; missing fields get these defaults. Never raises.
-- @param err The error value passed to the callback.
function M.parse_error(err)
  local result = { code = "UNKNOWN_ERROR", message = "", context = "" }
  local value = err
  if type(err) == "string" then
    local ok, decoded = pcall(json.decode, err)
    if ok and type(decoded) == "table" and (_error_field(decoded, "code")
        or _error_field(decoded, "message") or _error_field(decoded, "context")) then
      value = decoded
    else
      result.message = err
      return result
    end
  elseif err == nil then
    return result
  elseif type(err) ~= "table" then
    local ok, text = pcall(tostring, err)
    if ok and type(text) == "string" then result.message = text end
    return result
  end
  local code = _error_field(value, "code")
  if code and code ~= "" then result.code = code end
  result.message = _error_field(value, "message") or ""
  result.context = _error_field(value, "context") or ""
  return result
end

-- ── Option encoding ──

-- Build the error JSON string every failure carries (see M.parse_error).
local function invalid_param(message, context)
  return json.encode({
    code = "INVALID_PARAM",
    message = message,
    context = context or "",
  })
end

-- Turn an options argument into the JSON string the native layer takes.
-- table -> json.encode (an empty table gives nil); string -> as is (empty gives
-- nil); nil -> nil. Anything else, or a table json.encode cannot handle (a
-- function value, a cycle), returns nil, err_json (code INVALID_PARAM).
-- `context` is optional and lands in the error JSON, e.g. "session.start".
-- Only a top-level empty table becomes nil; a nested empty table is encoded
-- as is and may come out as [] rather than {} (empty tables carry no type).
local function encode_options(v, context)
  local kind = type(v)
  if kind == "nil" then return nil end
  if kind == "table" then
    if next(v) == nil then return nil end
    local ok, encoded = pcall(json.encode, v)
    if not ok then
      return nil, invalid_param("options could not be encoded as JSON: " .. tostring(encoded), context)
    end
    return encoded
  end
  if kind == "string" then
    if v == "" then return nil end
    return v
  end
  return nil, invalid_param("options must be a table or a JSON string, got " .. kind, context)
end

-- Deliver callback(self, false, err_json) on the next frame. Async APIs never
-- call back synchronously on a validation failure. The timer is created in the
-- calling script's context, so the callback receives the right self.
-- Last resort: if no timer can be created (timer.delay raises, or returns
-- timer.INVALID_TIMER_HANDLE), the callback runs synchronously with a nil self
-- rather than never being delivered.
local function fail_async(callback, err_json)
  if not callback then return end
  local ok, handle = pcall(timer.delay, 0, false, function(tself) callback(tself, false, err_json) end)
  if not ok or handle == timer.INVALID_TIMER_HANDLE then
    callback(nil, false, err_json)
  end
end

-- ── Core (mandatory) ──

function M.initialize(callback)
  sdk.initialize(callback)
end

function M.start_game(callback)
  sdk.start_game(callback)
end

function M.set_loading_progress(progress)
  sdk.set_loading_progress(progress)
end

function M.get_platform()
  return sdk.get_platform()
end

-- ── Lifecycle events ──
--
-- YouTube Playables certification REQUIRES the game to honor pause / resume
-- and audio mute state. Subscribe AFTER M.initialize() has called back —
-- the underlying Yes2SDK.on(...) is only available once init resolves.
--
-- Each callback is invoked once per platform event for the lifetime of the
-- session. Re-registering replaces the previous callback for that event.

--- Subscribe to platform pause events.
-- The game MUST stop its loop / audio / network calls when this fires.
-- Callback signature: function(self)
function M.on_pause(callback)
  sdk.on_pause(callback)
end

--- Subscribe to platform resume events.
-- The game may resume its loop. Resumption is not guaranteed.
-- Callback signature: function(self)
function M.on_resume(callback)
  sdk.on_resume(callback)
end

--- Subscribe to the platform asking the game to exit.
-- The player has NOT confirmed leaving yet. Save synchronously inside the handler
-- (data_set_string and friends): the SDK flushes player data right after it returns.
-- Async work started here is not awaited. Register after M.initialize has called back.
-- Callback signature: function(self)
function M.on_exit_requested(callback)
  sdk.on_exit_requested(callback)
end

--- Subscribe to platform audio mute/unmute changes.
-- The game MUST update its audio state to match the platform.
-- Callback signature: function(self, enabled) where enabled is a boolean.
function M.on_audio_enabled_change(callback)
  sdk.on_audio_enabled_change(callback)
end

--- Subscribe to the platform's account-selection dialog opening.
-- Currently only fires on Yandex. The game SHOULD pause while the dialog is open.
-- Callback signature: function(self)
function M.on_account_dialog_open(callback)
  sdk.on_account_dialog_open(callback)
end

--- Subscribe to the platform's account-selection dialog closing.
-- Currently only fires on Yandex. The game may resume once the dialog is dismissed.
-- Callback signature: function(self)
function M.on_account_dialog_close(callback)
  sdk.on_account_dialog_close(callback)
end

-- ── Ads ──

local function _new_ad_request(kind)
  _ad_request_count = _ad_request_count + 1
  return {
    id = _ad_request_count,
    kind = kind,            -- "interstitial" | "rewarded"
    started = false,        -- before_ad has fired
    outcome = nil,          -- "viewed" | "dismissed" | "no_fill" once known
    after_done = false,     -- after_ad has been delivered
    released = false,       -- the latch is free; set exactly once
    elapsed = 0,            -- seconds counted in the current phase
    deadline = _AD_START_TIMEOUT,
    timer = nil,            -- watchdog timer handle
    callbacks = {},         -- the game's callbacks for this request
    last_self = nil,        -- last self a platform callback passed
    awaiting_after = false, -- released by no_fill; the after_ad that follows is delivered
    after_timer = nil,      -- next-frame timer that synthesizes after_ad after no_fill
    before_dropped = false, -- a late before_ad was dropped (warn once)
  }
end

local function _release_ad(request)
  -- Release the given request exactly once. Returns true only for the request that
  -- currently owns the latch; every later caller (stale completion, fired watchdog,
  -- native-call failure) gets false and must no-op, so no_fill can't fire twice and a
  -- late real callback can't reopen a released (or already superseded) request.
  if request == nil or request.released or request ~= _active_request then
    return false
  end
  request.released = true
  if request.timer then
    timer.cancel(request.timer)
    request.timer = nil
  end
  _active_request = nil
  _ad_in_flight = false
  return true
end

local _traceback = debug and debug.traceback

local function _on_callback_error(err)
  if _traceback then return _traceback(tostring(err), 2) end
  return tostring(err)
end

local function _call_ad_callback(name, cb, ...)
  -- Every user ad callback runs behind a protected call: a callback that raises is
  -- logged with a traceback and never stops the next step (a throwing ad_dismissed
  -- still gets after_ad). Lua 5.1 xpcall passes no arguments, hence the closure.
  if not cb then return end
  local n = select("#", ...)
  local args = { ... }
  local ok, err = xpcall(function() return cb(unpack(args, 1, n)) end, _on_callback_error)
  if not ok then
    print("[Yes2SDK] " .. name .. " callback error: " .. tostring(err))
  end
end

local function _note_self(request, self)
  -- Remember the last self the platform passed for this request, so callbacks the
  -- wrapper synthesizes later get the same self the real ones did.
  if self ~= nil then request.last_self = self end
end

local function _synth_self(request, fallback)
  -- The self for a synthesized callback: the last one seen for this request, else
  -- the self of the timer that synthesizes it. Synthesized callbacks take (self, true).
  if request.last_self ~= nil then return request.last_self end
  return fallback
end

local function _next_frame(fn)
  -- Run fn(self) on the next frame. If no timer can be created, run it now so the
  -- game still gets its callback.
  local ok, handle = pcall(timer.delay, 0, false, fn)
  if ok then return handle end
  print("[Yes2SDK] could not create a timer (" .. tostring(handle) .. "), delivering the ad callback now.")
  fn(nil)
  return nil
end

local function _deliver_outcome(request, outcome, name, cb, ...)
  -- Outcomes (ad_viewed, ad_dismissed, no_fill) are delivered at most once per
  -- request: the first one wins and is recorded, every later one is dropped.
  if request.outcome ~= nil then
    print("[Yes2SDK] " .. name .. " dropped for ad " .. request.id .. ": its outcome was already " .. request.outcome .. ".")
    return false
  end
  request.outcome = outcome
  _call_ad_callback(name, cb, ...)
  return true
end

local function _deliver_after_ad(request, ...)
  -- after_ad is delivered at most once per request. A rewarded ad that reaches
  -- after_ad with no outcome gets ad_dismissed first (ad_viewed is never made up),
  -- so the game always sees exactly one outcome. Keyed on this request's own flags
  -- only, so it never touches a newer request started from inside a callback.
  if request.after_done then
    print("[Yes2SDK] after_ad dropped for ad " .. request.id .. ": it was already delivered.")
    return
  end
  request.after_done = true
  if _awaiting_request == request then _awaiting_request = nil end
  if request.after_timer then
    timer.cancel(request.after_timer)
    request.after_timer = nil
  end
  -- A synthesized ad_dismissed takes the same self as the after_ad that follows it.
  _note_self(request, (...))
  if request.kind == "rewarded" and request.outcome == nil then
    print("[Yes2SDK] rewarded ad " .. request.id .. " reached after_ad with no outcome, reporting ad_dismissed first.")
    _deliver_outcome(request, "dismissed", "ad_dismissed", request.callbacks.ad_dismissed, request.last_self, true)
  end
  _call_ad_callback("after_ad", request.callbacks.after_ad, ...)
end

local function _end_with_no_fill(request, ...)
  -- The request is already released (latch free, so the game may retry from inside
  -- no_fill). no_fill does not end it: the platform's own after_ad for this request
  -- usually follows in the same tick and is delivered once. If none has arrived by
  -- the next frame, after_ad is synthesized here.
  _note_self(request, (...))
  request.awaiting_after = true
  _awaiting_request = request
  _deliver_outcome(request, "no_fill", "no_fill", request.callbacks.no_fill, ...)
  if request.after_done or request.after_timer then return end
  request.after_timer = _next_frame(function(self)
    request.after_timer = nil
    if request.after_done then return end
    print("[Yes2SDK] no after_ad followed no_fill for ad " .. request.id .. ", delivering after_ad.")
    _deliver_after_ad(request, _synth_self(request, self), true)
  end)
end

local function _start_ad_watchdog(request)
  -- One repeating per-frame timer per request, cancelled on release.
  request.timer = timer.delay(0, true, function(self, handle, dt)
    if request.released then
      timer.cancel(handle)
      return
    end
    request.elapsed = request.elapsed + math.min(dt or 0, _AD_MAX_FRAME_DT)
    if request.elapsed < request.deadline then
      return
    end
    local phase = request.started and "playing" or "start"
    local seconds = request.deadline
    if not _release_ad(request) then
      return
    end
    local cb_self = _synth_self(request, self)
    request.last_self = cb_self
    if phase == "start" and request.outcome == nil then
      print("[Yes2SDK] ad watchdog fired in the start phase: no before_ad after " .. tostring(seconds) .. "s, releasing ad " .. request.id .. " and reporting no_fill.")
      _end_with_no_fill(request, cb_self, true)
    elseif phase == "start" then
      print("[Yes2SDK] ad watchdog fired in the start phase: no before_ad after " .. tostring(seconds) .. "s, releasing ad " .. request.id .. " and reporting after_ad, since its outcome is known.")
      _deliver_after_ad(request, cb_self, true)
    else
      print("[Yes2SDK] ad watchdog fired in the playing phase: no after_ad " .. tostring(seconds) .. "s after before_ad, releasing ad " .. request.id .. " and reporting after_ad.")
      _deliver_after_ad(request, cb_self, true)
    end
  end)
end

local function _wrap_after_ad(request)
  -- after_ad releases the request, then delivers. It is also delivered once to a
  -- request that no_fill already released (no_fill is followed by after_ad). Any
  -- other after_ad of a released request is stale and swallowed.
  return function(...)
    _note_self(request, (...))
    if _release_ad(request) then
      _deliver_after_ad(request, ...)
    elseif request.awaiting_after and not request.after_done then
      _deliver_after_ad(request, ...)
    end
  end
end

local function _wrap_no_fill(request)
  -- no_fill is an outcome and releases the request at once; after_ad follows it
  -- (see _end_with_no_fill). It is dropped when the request already has an outcome
  -- (the after_ad that follows settles the request) or was released.
  return function(...)
    _note_self(request, (...))
    if request.outcome ~= nil then
      _deliver_outcome(request, "no_fill", "no_fill", request.callbacks.no_fill, ...)
      return
    end
    if _release_ad(request) then
      _end_with_no_fill(request, ...)
    end
  end
end

local function _wrap_ad_event(request, kind)
  -- Wrap a non-terminal callback (before_ad, ad_viewed, ad_dismissed) so it delegates
  -- WITHOUT releasing the request. after_ad is the terminal event and follows all three,
  -- so releasing here makes that after_ad look stale and swallows it, leaving the game
  -- paused for the rest of the session. The native binding type-checks every callback
  -- slot as a function, so an omitted callback still gets one.
  return function(...)
    _note_self(request, (...))
    if kind == "before_ad" then
      if request.released then
        -- A late before_ad of a released request would pause the game with no
        -- after_ad left to resume it.
        if not request.before_dropped then
          request.before_dropped = true
          print("[Yes2SDK] before_ad dropped for ad " .. request.id .. ": the ad was already released.")
        end
        return
      end
      -- The ad is on screen: switch the watchdog to the playing phase.
      request.started = true
      request.elapsed = 0
      request.deadline = _AD_PLAYING_TIMEOUT
      _call_ad_callback("before_ad", request.callbacks.before_ad, ...)
    elseif kind == "ad_viewed" then
      _deliver_outcome(request, "viewed", "ad_viewed", request.callbacks.ad_viewed, ...)
    elseif kind == "ad_dismissed" then
      _deliver_outcome(request, "dismissed", "ad_dismissed", request.callbacks.ad_dismissed, ...)
    end
  end
end

local function _fail_native_call(request, name, err)
  -- The native call raised, so the platform will send nothing for this request.
  -- no_fill (then after_ad) arrives on the next frame with the timer's self. The
  -- latch is held until then, so a second ad called in the same frame is rejected
  -- as concurrent instead of starting under this request's pending after_ad.
  if request.released or request ~= _active_request then return end
  print("[Yes2SDK] " .. name .. " native call failed: " .. tostring(err) .. ", reporting no_fill.")
  _next_frame(function(self)
    if _release_ad(request) then
      _end_with_no_fill(request, _synth_self(request, self), true)
    end
  end)
end

local function _settle_awaiting_request()
  -- A new ad call while an earlier request still awaits the after_ad that follows
  -- its no_fill (a retry from inside no_fill): deliver that after_ad now, before
  -- the native call, so the game resumes from the first ad before the new ad's
  -- before_ad. Its next-frame timer is cancelled and its own late after_ad is
  -- swallowed, so it is delivered exactly once.
  local request = _awaiting_request
  _awaiting_request = nil
  if request == nil or request.after_done then return end
  print("[Yes2SDK] a new ad was requested while ad " .. request.id .. " awaited after_ad, delivering that after_ad first.")
  _deliver_after_ad(request, request.last_self, true)
end

local function _reject_concurrent(callback_name, no_fill)
  -- A rejected call gets no_fill only, never after_ad: its after_ad would resume the
  -- game while the ad already in flight is still on screen.
  print("[Yes2SDK] " .. callback_name .. " rejected: another ad is already in flight (AdAlreadyShowing). This call gets no_fill only. Wait for after_ad or no_fill before calling ads_show_* again.")
  _call_ad_callback("no_fill", no_fill)
end

function M.ads_show_interstitial(placement, before_ad, after_ad, no_fill)
  _settle_awaiting_request()
  if _ad_in_flight then
    _reject_concurrent("ads_show_interstitial", no_fill)
    return
  end
  local request = _new_ad_request("interstitial")
  request.callbacks = { before_ad = before_ad, after_ad = after_ad, no_fill = no_fill }
  _active_request = request
  _ad_in_flight = true
  _start_ad_watchdog(request)
  local ok, err = pcall(
    sdk.ads_show_interstitial,
    placement,
    _wrap_ad_event(request, "before_ad"),
    _wrap_after_ad(request),
    _wrap_no_fill(request)
  )
  if not ok then
    _fail_native_call(request, "ads_show_interstitial", err)
  end
end

function M.ads_show_rewarded(placement, before_ad, after_ad, ad_dismissed, ad_viewed, no_fill)
  _settle_awaiting_request()
  if _ad_in_flight then
    _reject_concurrent("ads_show_rewarded", no_fill)
    return
  end
  local request = _new_ad_request("rewarded")
  request.callbacks = {
    before_ad = before_ad, after_ad = after_ad, ad_dismissed = ad_dismissed,
    ad_viewed = ad_viewed, no_fill = no_fill,
  }
  _active_request = request
  _ad_in_flight = true
  _start_ad_watchdog(request)
  local ok, err = pcall(
    sdk.ads_show_rewarded,
    placement,
    _wrap_ad_event(request, "before_ad"),
    _wrap_after_ad(request),
    _wrap_ad_event(request, "ad_dismissed"),
    _wrap_ad_event(request, "ad_viewed"),
    _wrap_no_fill(request)
  )
  if not ok then
    _fail_native_call(request, "ads_show_rewarded", err)
  end
end

--- Returns true while ads_show_interstitial / ads_show_rewarded is in flight.
-- Use this to gate UI that triggers ads (e.g. disable a "Watch ad" button while one is already showing).
function M.ads_is_ad_showing()
  return _ad_in_flight
end

--- Best-effort check whether a rewarded ad is currently available.
-- Most platforms don't expose explicit readiness — returns true while the platform's ad module is loaded.
-- Treat as a hint; ads_show_rewarded() can still no-fill.
function M.ads_is_rewarded_ad_available()
  return sdk.ads_is_rewarded_ad_available()
end

--- Whether interstitial ads are supported on the current platform.
-- Use to gate features before calling ads_show_interstitial(). Returns a boolean.
function M.ads_is_interstitial_supported()
  return sdk.ads_is_interstitial_supported()
end

--- Whether rewarded ads are supported on the current platform.
-- Capability check (unlike ads_is_rewarded_ad_available, which is runtime availability).
-- Use to gate features before calling ads_show_rewarded(). Returns a boolean.
function M.ads_is_rewarded_supported()
  return sdk.ads_is_rewarded_supported()
end

-- ── Session ──

function M.session_gameplay_start()
  sdk.session_gameplay_start()
end

function M.session_gameplay_stop()
  sdk.session_gameplay_stop()
end

function M.session_get_locale()
  return sdk.session_get_locale()
end

--- Check whether platform audio is currently enabled.
-- Required by YouTube cert: read this at startup to set the initial mute
-- state, then subscribe to M.on_audio_enabled_change for updates.
-- Platforms without a native audio-state signal return true.
function M.session_is_audio_enabled()
  return sdk.session_is_audio_enabled()
end

--- Get device info synchronously as a JSON string.
-- Returns a JSON string of the form
-- '{"type":"...","isMobile":bool,"isDesktop":bool,"isTablet":bool,"isTV":bool}'.
-- Decode it with json.decode(...). Returns an unknown/all-false shape when the
-- platform does not expose device info.
function M.session_get_device_info()
  return sdk.session_get_device_info()
end

-- ── Analytics ──

function M.analytics_log_level_start(level)
  sdk.analytics_log_level_start(level)
end

--- Log a level-end event.
-- @param level Level identifier (string).
-- @param score Score achieved (integer).
-- @param success Whether the level was completed successfully (boolean).
-- @param duration_seconds Optional duration of the level in seconds. Pass nil/missing to omit.
function M.analytics_log_level_end(level, score, success, duration_seconds)
  -- duration_seconds: nil/missing → -1 sentinel = omit. Negative is also treated as omit.
  sdk.analytics_log_level_end(level, score, success, duration_seconds or -1)
end

function M.analytics_log_score(score, level)
  sdk.analytics_log_score(score, level)
end

function M.analytics_log_tutorial_start()
  sdk.analytics_log_tutorial_start()
end

function M.analytics_log_tutorial_end()
  sdk.analytics_log_tutorial_end()
end

function M.analytics_log_game_choice(decision, choice)
  sdk.analytics_log_game_choice(decision, choice)
end

--- Log a custom analytics event.
-- @param event_name Event name (string).
-- @param params_json Optional JSON string of event parameters (e.g. json.encode({ level = 3 })).
-- On Yandex builds with a Metrica counter configured, this fires reachGoal(event_name, params).
function M.analytics_log_event(event_name, params_json)
  sdk.analytics_log_event(event_name, params_json)
end

-- ── Player ──

--- Get the player's display name (synchronous).
-- Backed by Core's public getPlayer(); the underlying call is async, so the first
-- invocation (right after initialize) may return the default "Player" until the
-- identity is fetched — subsequent calls return the resolved name. For a guaranteed
-- fresh value, use player_get_unique_id / the async player accessors.
function M.player_get_name()
  return sdk.player_get_name()
end

--- Get the player's platform id (synchronous). Empty string when unavailable.
-- Same priming behavior as player_get_name: may be empty on the first call until
-- Core's getPlayer() resolves, then returns the resolved id. This is the platform
-- player id; for the permanent unique identifier use player_get_unique_id.
function M.player_get_id()
  return sdk.player_get_id()
end

function M.player_get_data(keys_json, callback)
  sdk.player_get_data(keys_json, callback)
end

function M.player_set_data(data_json, callback)
  sdk.player_set_data(data_json, callback)
end

--- Get the player's permanent unique identifier.
-- Callback signature: function(self, success, id) where id is a string
-- ("anonymous" on platforms that cannot identify the player).
function M.player_get_unique_id(callback)
  sdk.player_get_unique_id(callback)
end

--- Get the player's identity across the developer's other games on this platform.
-- Callback signature: function(self, success, ids_json) where ids_json is a JSON
-- array string of the form '[{"appId":"...","userId":"..."},...]' (empty array when unsupported).
function M.player_get_ids_per_game(callback)
  sdk.player_get_ids_per_game(callback)
end

--- Get the player's monetization / paying status.
-- Callback signature: function(self, success, status) where status is a string
-- ("unknown" on platforms that do not expose one).
function M.player_get_paying_status(callback)
  sdk.player_get_paying_status(callback)
end

--- Get the player's session / authorization mode.
-- Callback signature: function(self, success, mode) where mode is a string
-- ("lite", "authorized", or "unknown").
function M.player_get_mode(callback)
  sdk.player_get_mode(callback)
end

--- Get the player's profile photo URL at the requested size.
-- @param size Desired photo size string (e.g. "small", "medium", "large").
-- Callback signature: function(self, success, photo_json) where photo_json is a JSON
-- string of the URL, or the literal "null" when no photo is available.
function M.player_get_photo(size, callback)
  sdk.player_get_photo(size, callback)
end

--- Get a cryptographically signed snapshot of the player's identity for
-- server-side verification (e.g. validating a purchase or login on your backend).
-- @param payload Optional string echoed back inside the signature (nil/omitted to skip).
-- Callback signature: function(self, success, signed_json) where signed_json is a JSON
-- string of the form '{"playerId":"...","signature":"..."}'. Verify the signature on
-- your server, never trust it client-side.
function M.player_get_signed_info(payload, callback)
  sdk.player_get_signed_info(payload, callback)
end

local _BOT_AVATAR_CONTEXT = "player.getBotAvatarAsync"
local _BOT_AVATAR_SIZES = { small = true, medium = true, large = true }

--- Get a platform-generated avatar for a computer-controlled player (bot).
-- The username seeds the picture, so the same bot always gets the same avatar.
-- Gate it on player_is_bot_avatar_supported() and keep your own art as the
-- fallback: unsupported platforms fail with FEATURE_NOT_SUPPORTED.
-- @param username Bot name (non-empty string).
-- @param size Optional "small", "medium" (default) or "large". May be omitted:
--   player_get_bot_avatar(username, callback) works too.
-- Callback signature: function(self, success, url) where url is the avatar URL
-- string on success and the error JSON on failure. An empty username or an
-- unknown size fails with INVALID_PARAM on the next frame.
function M.player_get_bot_avatar(username, size, callback)
  if callback == nil and type(size) == "function" then
    size, callback = nil, size
  end
  if type(username) ~= "string" or username == "" then
    fail_async(callback, invalid_param("username must be a non-empty string", _BOT_AVATAR_CONTEXT))
    return
  end
  if size ~= nil and not _BOT_AVATAR_SIZES[size] then
    fail_async(callback, invalid_param('size must be "small", "medium" or "large"', _BOT_AVATAR_CONTEXT))
    return
  end
  sdk.player_get_bot_avatar(username, size or "medium", callback)
end

--- Whether the platform generates bot avatars (see player_get_bot_avatar).
-- Returns a boolean; false before initialization.
function M.player_is_bot_avatar_supported()
  return sdk.player_is_bot_avatar_supported()
end

--- Whether player data storage (player_get_data / player_set_data) is available.
-- Backed by local web storage on platforms without cloud save, so this is true
-- whenever the SDK is initialized. Returns a boolean.
function M.player_is_data_supported()
  return sdk.player_is_data_supported()
end

-- ── Auth ──

function M.auth_is_authenticated()
  return sdk.auth_is_authenticated()
end

function M.auth_sign_in(callback)
  sdk.auth_sign_in(callback)
end

--- Whether platform authentication (sign-in) is supported on the current platform.
-- Use to gate a login button before calling auth_sign_in(). Returns a boolean.
function M.auth_is_supported()
  return sdk.auth_is_supported()
end

-- ── Registration prompt ──

local _PROMPT_CONTEXT = "auth.showRegistrationPrompt"

--- Ask a guest to register, with your own prompt UI.
-- On platforms that support it, this opens the platform's minimal registration
-- overlay and returns a handle whose functions you wire to your own buttons:
-- handle.login() starts the platform login flow (the handle stays open) and
-- handle.close() closes the prompt (the handle is freed). Both return true when
-- the handle was still open, false otherwise.
--
-- options (table or JSON string, all optional):
--   theme    "light" or "dark"
--   message  text the player's messaging app is pre-filled with. It must not be
--            empty or whitespace only, be at most 140 characters (the
--            placeholder counts as written, an emoji counts as 2), contain
--            {{registrationCode}} exactly once and no other {{...}}
--            placeholder, and keep the code apart from neighbouring letters,
--            digits or underscores with a space or punctuation.
--   data     table, available from session_get_entry_point_data() after the
--            player registers
--   on_close function(self) called once when the prompt closes, by close() or
--            by the platform's own close button. It runs after the call returns,
--            never inside close() or this call, and never after an error return
--
-- Guests only: check auth_is_authenticated() first, a registered player gets an
-- INVALID_OPERATION error. Save the player's progress before showing it. For a
-- custom prompt the platform's own login reminders must be turned off for the
-- game; that is a per-game platform setting, not an SDK call.
--
-- Returns handle, or nil and an error JSON string (see M.parse_error): codes
-- FEATURE_NOT_SUPPORTED, INVALID_OPERATION, INVALID_PARAM (bad options or
-- message), NOT_INITIALIZED. Synchronous: nothing is called back on failure.
function M.auth_show_registration_prompt(options)
  local on_close
  local rest = options
  if type(options) == "table" then
    on_close = options.on_close
    if on_close ~= nil and type(on_close) ~= "function" then
      return nil, invalid_param("on_close must be a function, got " .. type(on_close), _PROMPT_CONTEXT)
    end
    rest = {}
    for k, v in pairs(options) do
      if k ~= "on_close" then rest[k] = v end
    end
  end
  local encoded, err = encode_options(rest, _PROMPT_CONTEXT)
  if err then return nil, err end

  local raw = sdk.auth_show_registration_prompt(encoded, function(self)
    if on_close then on_close(self) end
  end)
  local decoded
  if type(raw) == "string" then
    local ok, value = pcall(json.decode, raw)
    if ok and type(value) == "table" then decoded = value end
  end
  if decoded and type(decoded.handle) == "number" then
    local id = decoded.handle
    return {
      login = function() return sdk.auth_registration_prompt_login(id) == true end,
      close = function() return sdk.auth_registration_prompt_close(id) == true end,
    }
  end
  local e = decoded and decoded.error
  if type(e) == "table" then
    return nil, json.encode({
      code = _error_field(e, "code") or "UNKNOWN_ERROR",
      message = _error_field(e, "message") or "",
      context = _error_field(e, "context") or _PROMPT_CONTEXT,
    })
  end
  return nil, json.encode({
    code = "UNKNOWN_ERROR",
    message = "unexpected result: " .. tostring(raw),
    context = _PROMPT_CONTEXT,
  })
end

-- ── Data (key-value storage) ──

function M.data_get_int(key, default)
  return sdk.data_get_int(key, default)
end

function M.data_set_int(key, value)
  sdk.data_set_int(key, value)
end

function M.data_get_float(key, default)
  return sdk.data_get_float(key, default)
end

function M.data_set_float(key, value)
  sdk.data_set_float(key, value)
end

function M.data_get_string(key, default)
  return sdk.data_get_string(key, default)
end

function M.data_set_string(key, value)
  sdk.data_set_string(key, value)
end

function M.data_has_key(key)
  return sdk.data_has_key(key)
end

function M.data_delete_key(key)
  sdk.data_delete_key(key)
end

function M.data_delete_all()
  sdk.data_delete_all()
end

-- ── Game ──

function M.game_happy_time()
  sdk.game_happy_time()
end

function M.game_get_settings()
  return sdk.game_get_settings()
end

function M.game_copy_to_clipboard(text)
  sdk.game_copy_to_clipboard(text)
end

function M.game_invite_link(params_json, callback)
  sdk.game_invite_link(params_json, callback)
end

--- Get the authoritative server time.
-- The bridge delivers the time as a numeric string; this wrapper converts it
-- to a number before invoking the callback.
-- Callback signature: function(self, success, time) where time is a number on
-- success (or the original error string when success is false).
function M.game_get_server_time(callback)
  sdk.game_get_server_time(function(self, success, value)
    if success then
      callback(self, true, tonumber(value))
    else
      callback(self, false, value)
    end
  end)
end

-- ── Banners ──

function M.banners_show(id, size)
  sdk.banners_show(id, size)
end

function M.banners_hide(id)
  sdk.banners_hide(id)
end

function M.banners_hide_all()
  sdk.banners_hide_all()
end

--- Check whether banners are supported on the current platform.
function M.banners_is_supported()
  return sdk.banners_is_supported()
end

--- Get the current banner status.
-- Callback signature: function(self, success, status_json) where status_json is a JSON
-- string of the form '{"isShowing":true,"reason":"..."}' (reason optional).
function M.banners_get_status(callback)
  sdk.banners_get_status(callback)
end

-- ── Score ──

function M.score_add(score)
  sdk.score_add(score)
end

function M.score_submit(encrypted)
  sdk.score_submit(encrypted)
end

--- Check whether score submission is supported on the current platform.
function M.score_is_supported()
  return sdk.score_is_supported()
end

-- ── Friends ──

--- List the current player's friends with pagination.
-- Callback signature: function(self, success, page_json) where page_json is a JSON
-- string of the form '{"friends":[{"username":"...","id":"..."},...],"hasMore":true}'.
function M.friends_list_friends(page, size, callback)
  sdk.friends_list_friends(page, size, callback)
end

--- Check whether friends is supported on the current platform.
function M.friends_is_supported()
  return sdk.friends_is_supported()
end

-- ── Leaderboard ──

--- Get a leaderboard by name.
-- Callback signature: function(self, success, leaderboard_json) where leaderboard_json
-- is a JSON string of the form '{"name":"...","contextId":"...","entries":[...]}'.
function M.leaderboard_get(name, callback)
  sdk.leaderboard_get(name, callback)
end

--- Submit a score to a leaderboard.
-- @param metadata Optional metadata string. Pass nil/missing to omit.
-- Callback signature: function(self, success, entry_json) where entry_json is a JSON
-- string of the player's resulting LeaderboardEntry.
function M.leaderboard_set_score(name, score, metadata, callback)
  sdk.leaderboard_set_score(name, score, metadata, callback)
end

--- Get leaderboard entries with pagination.
-- Callback signature: function(self, success, entries_json) where entries_json is a JSON
-- array of LeaderboardEntry objects.
function M.leaderboard_get_entries(name, count, offset, callback)
  sdk.leaderboard_get_entries(name, count, offset, callback)
end

--- Get the current player's leaderboard entry.
-- Callback signature: function(self, success, entry_json) where entry_json is a JSON
-- string of the player's LeaderboardEntry, or the literal "null" when the player is not ranked.
function M.leaderboard_get_player_entry(name, callback)
  sdk.leaderboard_get_player_entry(name, callback)
end

--- Check whether leaderboards are supported on the current platform.
function M.leaderboard_is_supported()
  return sdk.leaderboard_is_supported()
end

-- ── Stats ──

--- Get stats by keys.
-- @param keys_json JSON array string of stat keys, e.g. '["kills","deaths"]'.
-- Callback signature: function(self, success, stats_json) where stats_json is a JSON
-- object mapping stat name to number.
function M.stats_get(keys_json, callback)
  sdk.stats_get(keys_json, callback)
end

--- Set stats.
-- @param stats_json JSON object string mapping stat name to number, e.g. '{"kills":10}'.
-- Callback signature: function(self, success, error) where error is nil on success.
function M.stats_set(stats_json, callback)
  sdk.stats_set(stats_json, callback)
end

--- Increment stats.
-- @param increments_json JSON object string mapping stat name to delta, e.g. '{"kills":1}'.
-- Callback signature: function(self, success, stats_json) where stats_json is a JSON
-- object of the updated stat values.
function M.stats_increment(increments_json, callback)
  sdk.stats_increment(increments_json, callback)
end

--- Check whether stats are supported on the current platform.
function M.stats_is_supported()
  return sdk.stats_is_supported()
end

-- ── Config (remote flags) ──

--- Fetch remote feature flags.
-- @param options_json JSON object string of options, e.g. '{"defaults":{...},"clientFeatures":{...}}'.
--   Pass "{}" (or any value) when no options are needed; invalid JSON falls back to no options.
-- Callback signature: function(self, success, flags_json) where flags_json is a JSON
-- object mapping flag name to string value.
function M.config_get_flags(options_json, callback)
  sdk.config_get_flags(options_json, callback)
end

--- Check whether remote configuration is supported on the current platform.
function M.config_is_supported()
  return sdk.config_is_supported()
end

-- ── Review (rating prompt) ──

--- Check whether the player can currently be shown the rating prompt.
-- Callback signature: function(self, success, eligibility_json) where eligibility_json
-- is a JSON object of the form '{"canReview":true,"reason":"..."}' (reason optional).
function M.review_can_review(callback)
  sdk.review_can_review(callback)
end

--- Request the in-game rating / feedback prompt.
-- Callback signature: function(self, success, result_json) where result_json is a JSON
-- object of the form '{"feedbackSent":true}'.
function M.review_request_review(callback)
  sdk.review_request_review(callback)
end

--- Check whether the rating prompt is supported on the current platform.
function M.review_is_supported()
  return sdk.review_is_supported()
end

-- ── IAP (in-app purchases) ──

-- Lua 5.1 names a C function "?" in its argument errors when it was called
-- through pcall. Put the public function name back so the message stays useful.
local function _name_native_error(err, name)
  if type(err) == "string" then
    return (err:gsub("to '%?'", "to '" .. name .. "'", 1))
  end
  return err
end

-- True between an iap_purchase / iap_consume_purchase call and its callback.
-- One checkout at a time: a second purchase while one is open could put two
-- payment prompts in front of the player, so re-entry is rejected (logged, no
-- callback) until the open call reports back.
-- If a purchase never settles the flag stays set (further purchases are blocked
-- for the session, the safe failure); a reload recovers.
local _iap_purchase_in_flight = false
local _iap_consume_in_flight = false

--- Get the full catalog of products available for purchase.
-- Callback signature: function(self, success, catalog_json) where catalog_json is a JSON
-- array string of products: '[{"productId":"...","title":"...","description":"...",
-- "imageUri":"...","price":"$4.99","priceCurrencyCode":"USD","priceAmount":499},...]'.
function M.iap_get_catalog(callback)
  sdk.iap_get_catalog(callback)
end

--- Get a single product by id.
-- @param product_id Product identifier (string).
-- Callback signature: function(self, success, product_json) where product_json is a JSON
-- object (same shape as a catalog entry), or the literal "null" when the product is unknown.
function M.iap_get_product(product_id, callback)
  sdk.iap_get_product(product_id, callback)
end

--- Initiate a purchase of the given product.
-- @param product_id Product identifier (string).
-- @param developer_payload Positional optional string passed through for your own
--   verification — pass nil to skip (you must still pass the callback after it).
-- Callback signature: function(self, success, purchase_json) where purchase_json is a JSON
-- object of the form '{"purchaseToken":"...","productId":"...","paymentId":"...",
-- "purchaseTime":"...","developerPayload":"...","signedRequest":"..."}'. Verify server-side.
-- Rejected (no-op) if a purchase is already in flight; wait for the callback first.
function M.iap_purchase(product_id, developer_payload, callback)
  if _iap_purchase_in_flight then
    print("[Yes2SDK] iap_purchase rejected — a purchase is already in flight. Wait for its callback before calling iap_purchase again.")
    return
  end
  _iap_purchase_in_flight = true
  local ok, err = pcall(sdk.iap_purchase, product_id, developer_payload, function(self, success, purchase_json)
    _iap_purchase_in_flight = false
    if callback then callback(self, success, purchase_json) end
  end)
  if not ok then
    -- The native raised (a wrong argument type) before it kept the callback, so
    -- nothing will clear the flag: clear it here and re-raise the error.
    _iap_purchase_in_flight = false
    error(_name_native_error(err, "iap_purchase"), 0)
  end
end

--- Get the player's outstanding (unconsumed) purchases.
-- Callback signature: function(self, success, purchases_json) where purchases_json is a JSON
-- array string of purchase objects (same shape as iap_purchase delivers).
function M.iap_get_purchases(callback)
  sdk.iap_get_purchases(callback)
end

--- Consume a purchase so a consumable product can be bought again.
-- @param purchase_token The purchaseToken from the purchase to consume (string).
-- Callback signature: function(self, success, error) where error is nil on success.
-- Rejected (no-op) if a consume is already in flight; wait for the callback first.
function M.iap_consume_purchase(purchase_token, callback)
  if _iap_consume_in_flight then
    print("[Yes2SDK] iap_consume_purchase rejected — a consume is already in flight. Wait for its callback before calling iap_consume_purchase again.")
    return
  end
  _iap_consume_in_flight = true
  local ok, call_err = pcall(sdk.iap_consume_purchase, purchase_token, function(self, success, err)
    _iap_consume_in_flight = false
    if callback then callback(self, success, err) end
  end)
  if not ok then
    -- Same as iap_purchase: release the guard, then re-raise the native error.
    _iap_consume_in_flight = false
    error(_name_native_error(call_err, "iap_consume_purchase"), 0)
  end
end

--- Check whether in-app purchases are supported on the current platform.
function M.iap_is_supported()
  return sdk.iap_is_supported()
end


-- ── Context (image share) ──

--- Share a message with an optional image through the platform's share flow.
-- @param options Table or JSON string: { intent = "SHARE" (default) | "INVITE" | "REQUEST" |
--   "CHALLENGE", image = string, text = string, data = table }. `image` is a URL on most
--   platforms; some require a base64 PNG or a "data:image/png;base64,..." URL, so prefer the
--   data URL. Pass nil for a plain share.
-- Callback signature: function(self, success, err) where err is nil on success.
-- Fields a platform does not use are ignored. Do not gate this call on context_is_supported(),
-- which can be false where sharing works: call it and handle the failure (see M.parse_error);
-- FEATURE_NOT_SUPPORTED means the platform has no share. The callback is optional.
function M.context_share(options, callback)
  if callback == nil then callback = function() end end
  local to_encode = options
  if type(options) == "table" then
    to_encode = {}
    for k, v in pairs(options) do to_encode[k] = v end
    if to_encode.intent == nil then to_encode.intent = "SHARE" end
  elseif options == nil then
    to_encode = { intent = "SHARE" }
  end
  local encoded, err = encode_options(to_encode, "context.shareAsync")
  if err then
    fail_async(callback, err)
    return
  end
  sdk.context_share(encoded or "", callback)
end

--- Hint only: can be false on platforms where sharing works. Do not gate context_share on it.
function M.context_is_supported()
  return sdk.context_is_supported()
end

-- ── Notifications ──

-- Public snake_case option names to the camelCase names the SDK takes. Keys not
-- listed here (id, title, body, priority, data, anything newer) pass through
-- unchanged.
local _NOTIFICATION_KEYS = {
  delay_seconds = "delaySeconds",
  scheduled_in_days = "scheduledInDays",
  cta_text = "ctaText",
  image_asset_id = "imageAssetId",
  image_data_url = "imageDataUrl",
  icon_url = "iconUrl",
}

--- Schedule a notification for later.
-- @param options Table (or a JSON string, passed through as is with the SDK's
--   own camelCase names): { id, title (required, a string; may be empty to
--   send no title where the platform allows it), body, delay_seconds or
--   scheduled_in_days (integer 0 to 7, not both), cta_text, priority
--   ("low"|"medium"|"high"|"critical"), image_asset_id or image_data_url,
--   icon_url, data }. The SDK validates the values and reports INVALID_PARAM.
-- Scheduling again with the same id replaces the earlier notification.
-- Callback signature: function(self, success, result_json) where result_json is
-- '{"id":"...","title":"...","body":"...","scheduledAt":<ms since epoch>}'.
function M.notifications_schedule(options, callback)
  if type(options) == "table" then
    local mapped = {}
    for key, value in pairs(options) do
      mapped[_NOTIFICATION_KEYS[key] or key] = value
    end
    options = mapped
  end
  local encoded, err = encode_options(options, "notifications.scheduleAsync")
  if err then
    fail_async(callback, err)
    return
  end
  -- A missing or empty options value still goes to the SDK so it can report
  -- the missing title in one place. An empty title string is valid.
  sdk.notifications_schedule(encoded or "{}", callback)
end

--- Cancel one scheduled notification by id.
-- Callback signature: function(self, success, err_json_or_nil).
function M.notifications_cancel(id, callback)
  if type(id) ~= "string" or id == "" then
    fail_async(callback, invalid_param("id must be a non-empty string", "notifications.cancelAsync"))
    return
  end
  sdk.notifications_cancel(id, callback)
end

--- Cancel every scheduled notification.
-- Callback signature: function(self, success, err_json_or_nil).
function M.notifications_cancel_all(callback)
  sdk.notifications_cancel_all(callback)
end

--- Check whether scheduled notifications are supported on the current platform.
function M.notifications_is_supported()
  return sdk.notifications_is_supported()
end

-- ── Entry point data ──

--- Data the player arrived with, for example from a shared link or after
-- registering. Returns a table (empty when there is none or on platforms that
-- do not support it).
function M.session_get_entry_point_data()
  local text = sdk.session_get_entry_point_data()
  if type(text) ~= "string" then return {} end
  local ok, decoded = pcall(json.decode, text)
  if ok and type(decoded) == "table" then return decoded end
  return {}
end

-- ── Confirmed writes ──

--- Store a string and learn whether the platform confirmed it.
-- data_set_string is fire and forget. Use this (or data_flush) before something
-- that may end the session, for example before showing a login prompt.
-- Callback signature: function(self, success, err) where err is nil on success
-- and an error JSON string on failure (see parse_error). success is false when
-- the platform did not confirm the write.
function M.data_set_string_async(key, value, callback)
  sdk.data_set_string_async(key, value, callback)
end

--- Write pending data to the platform and learn whether it was confirmed.
-- Callback signature: function(self, success, err), same as data_set_string_async.
function M.data_flush(callback)
  sdk.data_flush(callback)
end

--- Write pending player data (player_set_data) to the platform.
-- Callback signature: function(self, success, err) where err is nil on success.
function M.player_flush_data(callback)
  sdk.player_flush_data(callback)
end

-- ── Referrals ──

-- Public snake_case option names to the camelCase names the SDK takes, at each
-- level of the share options. Keys not listed here pass through unchanged, and
-- `data` is never renamed.
local _REFERRAL_KEYS = {
  onboarding_slug = "onboardingSlug",
  notification_templates = "notificationTemplates",
}
local _REFERRAL_TEMPLATE_KEYS = { min_conversion_count = "minConversionCount" }
local _REFERRAL_VARIANT_KEYS = { cta_text = "ctaText", image_reference = "imageReference" }

-- Copy `t` with its keys renamed through `names`. Non-table values come back as is.
local function rename_keys(t, names)
  if type(t) ~= "table" then return t end
  local out = {}
  for key, value in pairs(t) do
    out[names[key] or key] = value
  end
  return out
end

-- Rename the snake_case keys of a share options table, templates and variants
-- included, without touching the caller's tables. Values are left for the SDK
-- to validate.
local function map_referral_options(options)
  local mapped = rename_keys(options, _REFERRAL_KEYS)
  local templates = mapped.notificationTemplates
  if type(templates) == "table" then
    local out = {}
    for i, template in pairs(templates) do
      local t = rename_keys(template, _REFERRAL_TEMPLATE_KEYS)
      if type(t) == "table" and type(t.variants) == "table" then
        local variants = {}
        for j, variant in pairs(t.variants) do
          variants[j] = rename_keys(variant, _REFERRAL_VARIANT_KEYS)
        end
        t.variants = variants
      end
      out[i] = t
    end
    mapped.notificationTemplates = out
  end
  return mapped
end

-- Return the options as a JSON string with a non-empty string `reference`, or
-- nil, err_json (INVALID_PARAM).
local function referral_share_options(options, context)
  if type(options) == "table" then
    options = map_referral_options(options)
  end
  local encoded, err = encode_options(options, context)
  if err then return nil, err end
  if encoded == nil then
    return nil, invalid_param("options.reference is required", context)
  end
  local ok, decoded = pcall(json.decode, encoded)
  if not ok or type(decoded) ~= "table" then
    return nil, invalid_param("options must be a JSON object with a reference", context)
  end
  if type(decoded.reference) ~= "string" or decoded.reference == "" then
    return nil, invalid_param("options.reference must be a non-empty string", context)
  end
  return encoded
end

--- Open the platform's invite flow with a referral link.
-- @param options Table (or JSON string, passed through as is with the SDK's own
--   camelCase names): { reference = string (required, a stable campaign key),
--   data = table (delivered to the invited player), title, text, image (base64 data URL, at most 2 MB),
--   onboarding_slug = string (game that invited players go through first),
--   notification_templates = array of { min_conversion_count = integer >= 0,
--   variants = array (at least one) of { title, body, cta_text, image_reference } } }.
--   onboarding_slug and notification_templates are only used on platforms that
--   support them; the SDK validates them and reports INVALID_PARAM.
-- Callback signature: function(self, success, result_json) where result_json is '{"canceled":false}'
-- (or true when the player closed the flow). Check referrals_is_supported() first.
function M.referrals_share(options, callback)
  local encoded, err = referral_share_options(options, "referrals.shareAsync")
  if err then
    fail_async(callback, err)
    return
  end
  sdk.referrals_share(encoded, callback)
end

--- List the players who joined through the current player's referral links.
-- Callback signature: function(self, success, result_json) where result_json is
-- '{"referrals":{"<reference>":[{"playerId":"...","joinedAt":"..."}]},"signedRequest":"..."}'.
-- Verify signedRequest on your server before granting rewards.
function M.referrals_list(callback)
  sdk.referrals_list(callback)
end

--- Check whether referrals are supported on the current platform.
function M.referrals_is_supported()
  return sdk.referrals_is_supported()
end

-- ── IAP subscriptions ──

-- True between an iap_subscribe call and its callback. One checkout at a time,
-- like iap_purchase (and independent of it). A second call while one is open is
-- rejected: logged, and its callback fails on the next frame with INVALID_OPERATION.
local _iap_subscribe_in_flight = false

--- Get the subscription offers and the player's entitlement for each.
-- Callback signature: function(self, success, subscriptions_json) where subscriptions_json is
-- a JSON array of '{"productId":"...","title":"...","description":"...","price":"4.99 USD",
-- "priceAmount":499,"priceCurrencyCode":"USD","billingPeriod":"monthly","isActive":true,
-- "trialEligible":false,"introOffer":null,"retentionOffer":null}' (plus "isSandbox" and
-- "signedRequest" where the platform provides them). Grant the entitlement when isActive is true.
function M.iap_get_subscriptions(callback)
  sdk.iap_get_subscriptions(callback)
end

--- Start a subscription checkout. Never offer a subscription the player already holds.
-- @param product_id Subscription product id (string).
-- Callback signature: function(self, success, result_json) where result_json is
-- '{"status":"subscribed","subscription":{...}}' or '{"status":"cancelled"}'.
-- Rejected if a subscribe is already in flight: the callback fails on the next frame.
function M.iap_subscribe(product_id, callback)
  if _iap_subscribe_in_flight then
    print("[Yes2SDK] iap_subscribe rejected: a subscribe is already in flight. Wait for its callback before calling iap_subscribe again.")
    fail_async(callback, json.encode({
      code = "INVALID_OPERATION",
      message = "A subscribe is already in flight",
      context = "iap_subscribe",
    }))
    return
  end
  _iap_subscribe_in_flight = true
  local ok, err = pcall(sdk.iap_subscribe, product_id, function(self, success, result_json)
    _iap_subscribe_in_flight = false
    if callback then callback(self, success, result_json) end
  end)
  if not ok then
    -- Same as iap_purchase: release the guard, then re-raise the native error.
    _iap_subscribe_in_flight = false
    error(_name_native_error(err, "iap_subscribe"), 0)
  end
end

--- Cancel the player's subscription.
-- @param product_id Subscription product id (string).
-- Callback signature: function(self, success, result) where result is a boolean (true when
-- the subscription was cancelled) on success, and the error JSON on failure.
function M.iap_cancel_subscription(product_id, callback)
  sdk.iap_cancel_subscription(product_id, function(self, success, payload)
    if not callback then return end
    if success then
      callback(self, true, payload == "true")
    else
      callback(self, false, payload)
    end
  end)
end

--- Claim the retention offer of a subscription (offered when the player is about to cancel).
-- @param product_id Subscription product id (string).
-- Callback signature: function(self, success, subscription_json), same shape as one entry of
-- iap_get_subscriptions.
function M.iap_claim_retention_offer(product_id, callback)
  sdk.iap_claim_retention_offer(product_id, callback)
end

--- Get the status of one subscription.
-- @param product_id Subscription product id (string).
-- Callback signature: function(self, success, status_json) where status_json is
-- '{"isActive":true,"productId":"...","expiresAt":1767225600000,"willRenew":true}'
-- (expiresAt in Unix milliseconds; expiresAt and willRenew only when known).
function M.iap_get_subscription_status(product_id, callback)
  sdk.iap_get_subscription_status(product_id, callback)
end

--- Check whether subscriptions are supported on the current platform.
function M.iap_is_subscription_supported()
  return sdk.iap_is_subscription_supported()
end

return M
