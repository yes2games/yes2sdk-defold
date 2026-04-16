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
end

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

-- ── Ads ──

function M.ads_show_interstitial(placement, before_ad, after_ad, no_fill)
  sdk.ads_show_interstitial(placement, before_ad, after_ad, no_fill)
end

function M.ads_show_rewarded(placement, before_ad, after_ad, ad_dismissed, ad_viewed, no_fill)
  sdk.ads_show_rewarded(placement, before_ad, after_ad, ad_dismissed, ad_viewed, no_fill)
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

-- ── Analytics ──

function M.analytics_log_level_start(level)
  sdk.analytics_log_level_start(level)
end

function M.analytics_log_level_end(level, score, success)
  sdk.analytics_log_level_end(level, score, success)
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

-- ── Score ──

function M.score_add(score)
  sdk.score_add(score)
end

function M.score_submit(encrypted)
  sdk.score_submit(encrypted)
end

return M
