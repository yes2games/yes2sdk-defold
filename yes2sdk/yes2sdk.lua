--- Yes2SDK — High-level Lua API wrapper
-- @module yes2sdk_api

-- Async/callback APIs (player_get_*, leaderboard_*, stats_*, config_get_flags,
-- review_*, iap_*, banners_get_status, game_get_server_time, game_invite_link, auth_sign_in)
-- track ONE in-flight request per function. Calling the same function again before its
-- callback fires drops the earlier callback — only the latest one runs. Wait for the
-- callback (or gate on your own flag) before re-invoking the same call.

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
  function sdk.ads_is_rewarded_ad_available() warn() return false end
  function sdk.ads_is_interstitial_supported() warn() return false end
  function sdk.ads_is_rewarded_supported() warn() return false end
  function sdk.auth_is_supported() warn() return false end
  function sdk.player_is_data_supported() warn() return false end
  function sdk.session_is_audio_enabled() warn() return true end

  -- ── Editor mock (desktop builds only) ──
  --
  -- Without a mock, ad callbacks never fire in the editor (only the 30s
  -- watchdog no_fill) and IAP callbacks never fire at all, so integrations
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
        .. '","purchaseTime":"' .. os.date("!%Y-%m-%dT%H:%M:%SZ") .. '"'
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
        if callback then next_frame(function(tself) callback(tself, false, "Simulated purchase failure (mock)") end) end
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
  end
end

-- True between any ads_show_* call and its after_ad / no_fill / dismissed completion.
-- Used to reject concurrent ad calls and exposed via M.ads_is_ad_showing().
local _ad_in_flight = false

-- Identity of the in-flight ad request. Each ads_show_* call mints a fresh token;
-- every clear path (real completion, native-call failure, watchdog) is gated on it,
-- so a stale watchdog can't clobber a newer request and no_fill never double-fires.
local _active_request = nil

-- Handle of the active watchdog timer, cancelled the moment the ad settles.
local _ad_watchdog = nil

-- Seconds before a non-settling ad (platform accepted the show but never called back)
-- is force-cleared so the session can show ads again. Long enough not to kill a slow
-- but real ad, short enough to recover. Keep consistent with unity #65.
local _AD_TIMEOUT = 30

local M = {}

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

local function _clear_ad(request)
  -- Settle the given ad request exactly once. Returns true only for the request that
  -- currently owns the latch; every later caller (stale completion, fired watchdog,
  -- native-call failure) gets false and must no-op, so no_fill can't fire twice and a
  -- late real callback can't reopen a settled (or already superseded) request.
  if request == nil or request ~= _active_request then
    return false
  end
  if _ad_watchdog then
    timer.cancel(_ad_watchdog)
  end
  _ad_watchdog = nil
  _active_request = nil
  _ad_in_flight = false
  return true
end

local function _start_ad_watchdog(request, no_fill)
  -- Recover the latch if the platform accepts the show but never settles it.
  _ad_watchdog = timer.delay(_AD_TIMEOUT, false, function()
    _ad_watchdog = nil  -- timer auto-completed (repeat=false); don't cancel it in _clear_ad
    if _clear_ad(request) then
      print("[Yes2SDK] ad watchdog fired after " .. tostring(_AD_TIMEOUT) .. "s with no completion — clearing in-flight latch and reporting no_fill.")
      if no_fill then no_fill() end
    end
  end)
end

local function _wrap_ad_completion(request, cb)
  -- Wrap a completion callback so it settles the request before delegating. A stale
  -- callback (its request already settled by the watchdog or superseded) is swallowed.
  return function(...)
    if _clear_ad(request) then
      if cb then cb(...) end
    end
  end
end

local function _wrap_ad_outcome(cb)
  -- Wrap an outcome callback (ad_viewed / ad_dismissed) so it delegates WITHOUT
  -- settling the request. after_ad is the terminal event and follows both outcomes,
  -- so settling here makes that after_ad look stale and swallows it, leaving the game
  -- paused for the rest of the session. The native binding type-checks every callback
  -- slot as a function, so an omitted callback still gets one.
  return function(...)
    if cb then cb(...) end
  end
end

local function _reject_concurrent(callback_name)
  print("[Yes2SDK] " .. callback_name .. " rejected — another ad is already in flight (AdAlreadyShowing). Wait for after_ad/no_fill before calling Show* again.")
end

function M.ads_show_interstitial(placement, before_ad, after_ad, no_fill)
  if _ad_in_flight then
    _reject_concurrent("ads_show_interstitial")
    if no_fill then no_fill() end
    return
  end
  local request = {}
  _active_request = request
  _ad_in_flight = true
  _start_ad_watchdog(request, no_fill)
  local ok, err = pcall(
    sdk.ads_show_interstitial,
    placement,
    before_ad,
    _wrap_ad_completion(request, after_ad),
    _wrap_ad_completion(request, no_fill)
  )
  if not ok and _clear_ad(request) then
    print("[Yes2SDK] ads_show_interstitial native call failed: " .. tostring(err) .. " — reporting no_fill.")
    if no_fill then no_fill() end
  end
end

function M.ads_show_rewarded(placement, before_ad, after_ad, ad_dismissed, ad_viewed, no_fill)
  if _ad_in_flight then
    _reject_concurrent("ads_show_rewarded")
    if no_fill then no_fill() end
    return
  end
  local request = {}
  _active_request = request
  _ad_in_flight = true
  _start_ad_watchdog(request, no_fill)
  local ok, err = pcall(
    sdk.ads_show_rewarded,
    placement,
    before_ad,
    _wrap_ad_completion(request, after_ad),
    _wrap_ad_outcome(ad_dismissed),
    _wrap_ad_outcome(ad_viewed),
    _wrap_ad_completion(request, no_fill)
  )
  if not ok and _clear_ad(request) then
    print("[Yes2SDK] ads_show_rewarded native call failed: " .. tostring(err) .. " — reporting no_fill.")
    if no_fill then no_fill() end
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

-- True between an iap_purchase / iap_consume_purchase call and its callback.
-- A re-entrant call would overwrite the in-flight request's single listener slot,
-- silently dropping its callback — for a purchase that means the platform still
-- charges the player but the game never learns, so we reject re-entry instead.
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
  sdk.iap_purchase(product_id, developer_payload, function(self, success, purchase_json)
    _iap_purchase_in_flight = false
    if callback then callback(self, success, purchase_json) end
  end)
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
  sdk.iap_consume_purchase(purchase_token, function(self, success, err)
    _iap_consume_in_flight = false
    if callback then callback(self, success, err) end
  end)
end

--- Check whether in-app purchases are supported on the current platform.
function M.iap_is_supported()
  return sdk.iap_is_supported()
end

return M
