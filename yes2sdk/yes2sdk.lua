--- Yes2SDK — High-level Lua API wrapper
-- @module yes2sdk_api

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
  function sdk.ads_is_rewarded_ad_available() warn() return false end
  function sdk.session_is_audio_enabled() warn() return true end
end

-- True between any ads_show_* call and its after_ad / no_fill / dismissed completion.
-- Used to reject concurrent ad calls and exposed via M.ads_is_ad_showing().
local _ad_in_flight = false

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

-- ── Ads ──

local function _wrap_ad_completion(cb)
  -- Wrap a completion callback so it clears the in-flight flag before delegating.
  return function(...)
    _ad_in_flight = false
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
  _ad_in_flight = true
  sdk.ads_show_interstitial(placement, before_ad, _wrap_ad_completion(after_ad), _wrap_ad_completion(no_fill))
end

function M.ads_show_rewarded(placement, before_ad, after_ad, ad_dismissed, ad_viewed, no_fill)
  if _ad_in_flight then
    _reject_concurrent("ads_show_rewarded")
    if no_fill then no_fill() end
    return
  end
  _ad_in_flight = true
  sdk.ads_show_rewarded(
    placement,
    before_ad,
    _wrap_ad_completion(after_ad),
    _wrap_ad_completion(ad_dismissed),
    ad_viewed,                              -- adViewed fires before afterAd; don't clear flag here
    _wrap_ad_completion(no_fill)
  )
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

-- ── Player ──

function M.player_get_name()
  return sdk.player_get_name()
end

function M.player_get_id()
  return sdk.player_get_id()
end

function M.player_get_data(keys_json, callback)
  sdk.player_get_data(keys_json, callback)
end

function M.player_set_data(data_json, callback)
  sdk.player_set_data(data_json, callback)
end

-- ── Auth ──

function M.auth_is_authenticated()
  return sdk.auth_is_authenticated()
end

function M.auth_sign_in(callback)
  sdk.auth_sign_in(callback)
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

return M
