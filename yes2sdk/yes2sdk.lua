--- Yes2SDK — High-level Lua API wrapper
-- @module yes2sdk_api
local M = {}

--- Initialize the SDK. Must be called first.
-- @param callback function(self, success, error)
function M.initialize(callback)
    yes2sdk.initialize(callback)
end

--- Signal that the game has finished loading and is ready to play.
-- @param callback function(self, success, error)
function M.start_game(callback)
    yes2sdk.start_game(callback)
end

--- Report loading progress (0-100).
-- @param progress number
function M.set_loading_progress(progress)
    yes2sdk.set_loading_progress(progress)
end

--- Get the current platform name.
-- @return string platform name (e.g. "poki", "crazygames", "debug")
function M.get_platform()
    return yes2sdk.get_platform()
end

--- Show an interstitial ad.
-- @param placement string placement identifier (e.g. "next-level", "game-over")
-- @param before_ad function() called when ad is about to show (pause game here)
-- @param after_ad function() called when ad closes (resume game here)
-- @param no_fill function() called when no ad is available
function M.ads_show_interstitial(placement, before_ad, after_ad, no_fill)
    yes2sdk.ads_show_interstitial(placement, before_ad, after_ad, no_fill)
end

--- Show a rewarded ad.
-- @param placement string placement identifier (e.g. "revive", "double-coins")
-- @param before_ad function() called when ad is about to show
-- @param after_ad function() called when ad closes
-- @param ad_dismissed function() called when user skips the ad
-- @param ad_viewed function() called when user watches the full ad (grant reward here)
-- @param no_fill function() called when no ad is available
function M.ads_show_rewarded(placement, before_ad, after_ad, ad_dismissed, ad_viewed, no_fill)
    yes2sdk.ads_show_rewarded(placement, before_ad, after_ad, ad_dismissed, ad_viewed, no_fill)
end

--- Notify the platform that gameplay has started.
-- Required by Poki and CrazyGames for compliance.
function M.session_gameplay_start()
    yes2sdk.session_gameplay_start()
end

--- Notify the platform that gameplay has stopped.
-- Call when the player is in a menu, loading screen, or between levels.
function M.session_gameplay_stop()
    yes2sdk.session_gameplay_stop()
end

--- Get the player's locale.
-- @return string locale code (e.g. "en", "ja", "ru")
function M.session_get_locale()
    return yes2sdk.session_get_locale()
end

return M
