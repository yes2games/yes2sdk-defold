#include "yes2sdk.h"
#include "yes2sdk_ads.h"
#include "yes2sdk_session.h"
#include "yes2sdk_analytics.h"
#include "yes2sdk_player.h"
#include "yes2sdk_auth.h"
#include "yes2sdk_data.h"
#include "yes2sdk_game.h"
#include "yes2sdk_banners.h"
#include "yes2sdk_score.h"
#include "yes2sdk_friends.h"
#include "yes2sdk_leaderboard.h"
#include "yes2sdk_stats.h"
#include "yes2sdk_config.h"
#include "yes2sdk_review.h"
#include "yes2sdk_iap.h"
#include "luautils.h"
#include <dmsdk/sdk.h>

#define EXTENSION_NAME Yes2SDK
#define LIB_NAME "Yes2SDK"
#define MODULE_NAME "yes2sdk"
#define VERSION "1.5.4"

#if defined(DM_PLATFORM_HTML5)

lua_Listener onInitializeListener;
lua_Listener onStartGameListener;
// Lifecycle listeners — registered once and reused on every event for the
// lifetime of the game session (YouTube cert reqs #14, #21, #22).
lua_Listener onPauseListener;
lua_Listener onResumeListener;
lua_Listener onAudioEnabledChangeListener;

void Yes2SDK::OnInitialize(const int success, const char *error)
{
    lua_State *L = onInitializeListener.m_L;
    if (!L) return;
    int top = lua_gettop(L);

    lua_pushlistener(L, onInitializeListener);
    lua_pushboolean(L, success);
    if (error) { lua_pushstring(L, error); } else { lua_pushnil(L); }

    int ret = lua_pcall(L, 3, 0, 0);
    if (ret != 0)
    {
        lua_pop(L, 1);
    }

    assert(top == lua_gettop(L));
}

void Yes2SDK::OnStartGame(const int success, const char *error)
{
    lua_State *L = onStartGameListener.m_L;
    if (!L) return;
    int top = lua_gettop(L);

    lua_pushlistener(L, onStartGameListener);
    lua_pushboolean(L, success);
    if (error) { lua_pushstring(L, error); } else { lua_pushnil(L); }

    int ret = lua_pcall(L, 3, 0, 0);
    if (ret != 0)
    {
        lua_pop(L, 1);
    }

    assert(top == lua_gettop(L));
}

int Yes2SDK::InitializeAsync(lua_State *L)
{
    int top = lua_gettop(L);
    luaL_checklistener(L, 1, onInitializeListener);
    Yes2SDK_initializeAsync(Yes2SDK::OnInitialize);
    assert(top == lua_gettop(L));
    return 0;
}

int Yes2SDK::StartGameAsync(lua_State *L)
{
    int top = lua_gettop(L);
    luaL_checklistener(L, 1, onStartGameListener);
    Yes2SDK_startGameAsync(Yes2SDK::OnStartGame);
    assert(top == lua_gettop(L));
    return 0;
}

int Yes2SDK::SetLoadingProgress(lua_State *L)
{
    int top = lua_gettop(L);
    int progress = luaL_checkinteger(L, 1);
    Yes2SDK_setLoadingProgress(progress);
    assert(top == lua_gettop(L));
    return 0;
}

int Yes2SDK::GetPlatform(lua_State *L)
{
    int top = lua_gettop(L);
    const char *platform = Yes2SDK_getPlatform();
    if (platform)
    {
        lua_pushstring(L, platform);
    }
    else
    {
        lua_pushnil(L);
    }
    assert(top + 1 == lua_gettop(L));
    return 1;
}

// ── Lifecycle event handlers (called from JS bridge on every event) ──

void Yes2SDK::OnPauseFromJs()
{
    lua_State *L = onPauseListener.m_L;
    if (!L) return;
    int top = lua_gettop(L);

    lua_pushlistener(L, onPauseListener);
    int ret = lua_pcall(L, 1, 0, 0);
    if (ret != 0)
    {
        lua_pop(L, 1);
    }

    assert(top == lua_gettop(L));
}

void Yes2SDK::OnResumeFromJs()
{
    lua_State *L = onResumeListener.m_L;
    if (!L) return;
    int top = lua_gettop(L);

    lua_pushlistener(L, onResumeListener);
    int ret = lua_pcall(L, 1, 0, 0);
    if (ret != 0)
    {
        lua_pop(L, 1);
    }

    assert(top == lua_gettop(L));
}

void Yes2SDK::OnAudioEnabledChangeFromJs(const int enabled)
{
    lua_State *L = onAudioEnabledChangeListener.m_L;
    if (!L) return;
    int top = lua_gettop(L);

    lua_pushlistener(L, onAudioEnabledChangeListener);
    lua_pushboolean(L, enabled);
    int ret = lua_pcall(L, 2, 0, 0);
    if (ret != 0)
    {
        lua_pop(L, 1);
    }

    assert(top == lua_gettop(L));
}

int Yes2SDK::OnPause(lua_State *L)
{
    int top = lua_gettop(L);
    luaL_checklistener(L, 1, onPauseListener);
    Yes2SDK_onPause(Yes2SDK::OnPauseFromJs);
    assert(top == lua_gettop(L));
    return 0;
}

int Yes2SDK::OnResume(lua_State *L)
{
    int top = lua_gettop(L);
    luaL_checklistener(L, 1, onResumeListener);
    Yes2SDK_onResume(Yes2SDK::OnResumeFromJs);
    assert(top == lua_gettop(L));
    return 0;
}

int Yes2SDK::OnAudioEnabledChange(lua_State *L)
{
    int top = lua_gettop(L);
    luaL_checklistener(L, 1, onAudioEnabledChangeListener);
    Yes2SDK_onAudioEnabledChange(Yes2SDK::OnAudioEnabledChangeFromJs);
    assert(top == lua_gettop(L));
    return 0;
}

static const luaL_reg Module_methods[] = {
    // Core
    {"initialize", Yes2SDK::InitializeAsync},
    {"start_game", Yes2SDK::StartGameAsync},
    {"set_loading_progress", Yes2SDK::SetLoadingProgress},
    {"get_platform", Yes2SDK::GetPlatform},
    // Lifecycle events (YouTube cert reqs #14, #21, #22)
    {"on_pause", Yes2SDK::OnPause},
    {"on_resume", Yes2SDK::OnResume},
    {"on_audio_enabled_change", Yes2SDK::OnAudioEnabledChange},

    // Ads
    {"ads_show_interstitial", Yes2SDKAds::ShowInterstitial},
    {"ads_show_rewarded", Yes2SDKAds::ShowRewarded},
    {"ads_is_rewarded_ad_available", Yes2SDKAds::IsRewardedAdAvailable},
    {"ads_is_interstitial_supported", Yes2SDKAds::IsInterstitialSupported},
    {"ads_is_rewarded_supported", Yes2SDKAds::IsRewardedSupported},

    // Session / Gameplay
    {"session_gameplay_start", Yes2SDKSession::GameplayStart},
    {"session_gameplay_stop", Yes2SDKSession::GameplayStop},
    {"session_get_locale", Yes2SDKSession::GetLocale},
    {"session_is_audio_enabled", Yes2SDKSession::IsAudioEnabled},
    {"session_get_device_info", Yes2SDKSession::GetDeviceInfo},

    // Analytics
    {"analytics_log_level_start", Yes2SDKAnalytics::LogLevelStart},
    {"analytics_log_level_end", Yes2SDKAnalytics::LogLevelEnd},
    {"analytics_log_score", Yes2SDKAnalytics::LogScore},
    {"analytics_log_tutorial_start", Yes2SDKAnalytics::LogTutorialStart},
    {"analytics_log_tutorial_end", Yes2SDKAnalytics::LogTutorialEnd},
    {"analytics_log_game_choice", Yes2SDKAnalytics::LogGameChoice},
    {"analytics_log_event", Yes2SDKAnalytics::LogEvent},

    // Player
    {"player_get_name", Yes2SDKPlayer::GetName},
    {"player_get_id", Yes2SDKPlayer::GetId},
    {"player_get_data", Yes2SDKPlayer::GetData},
    {"player_set_data", Yes2SDKPlayer::SetData},
    {"player_get_unique_id", Yes2SDKPlayer::GetUniqueId},
    {"player_get_ids_per_game", Yes2SDKPlayer::GetIdsPerGame},
    {"player_get_paying_status", Yes2SDKPlayer::GetPayingStatus},
    {"player_get_mode", Yes2SDKPlayer::GetMode},
    {"player_get_photo", Yes2SDKPlayer::GetPhoto},
    {"player_get_signed_info", Yes2SDKPlayer::GetSignedInfo},
    {"player_is_data_supported", Yes2SDKPlayer::IsDataSupported},

    // Auth
    {"auth_is_authenticated", Yes2SDKAuth::IsAuthenticated},
    {"auth_sign_in", Yes2SDKAuth::SignIn},
    {"auth_is_supported", Yes2SDKAuth::IsSupported},

    // Data (key-value storage)
    {"data_get_int", Yes2SDKData::GetInt},
    {"data_set_int", Yes2SDKData::SetInt},
    {"data_get_float", Yes2SDKData::GetFloat},
    {"data_set_float", Yes2SDKData::SetFloat},
    {"data_get_string", Yes2SDKData::GetString},
    {"data_set_string", Yes2SDKData::SetString},
    {"data_has_key", Yes2SDKData::HasKey},
    {"data_delete_key", Yes2SDKData::DeleteKey},
    {"data_delete_all", Yes2SDKData::DeleteAll},

    // Game
    {"game_happy_time", Yes2SDKGame::HappyTime},
    {"game_get_settings", Yes2SDKGame::GetSettings},
    {"game_copy_to_clipboard", Yes2SDKGame::CopyToClipboard},
    {"game_invite_link", Yes2SDKGame::InviteLink},
    {"game_get_server_time", Yes2SDKGame::GetServerTime},

    // Banners
    {"banners_show", Yes2SDKBanners::Show},
    {"banners_hide", Yes2SDKBanners::Hide},
    {"banners_hide_all", Yes2SDKBanners::HideAll},
    {"banners_is_supported", Yes2SDKBanners::IsSupported},
    {"banners_get_status", Yes2SDKBanners::GetStatus},

    // Score
    {"score_add", Yes2SDKScore::AddScore},
    {"score_submit", Yes2SDKScore::SubmitScore},
    {"score_is_supported", Yes2SDKScore::IsSupported},

    // Friends
    {"friends_list_friends", Yes2SDKFriends::ListFriends},
    {"friends_is_supported", Yes2SDKFriends::IsSupported},

    // Leaderboard
    {"leaderboard_get", Yes2SDKLeaderboard::Get},
    {"leaderboard_set_score", Yes2SDKLeaderboard::SetScore},
    {"leaderboard_get_entries", Yes2SDKLeaderboard::GetEntries},
    {"leaderboard_get_player_entry", Yes2SDKLeaderboard::GetPlayerEntry},
    {"leaderboard_is_supported", Yes2SDKLeaderboard::IsSupported},

    // Stats
    {"stats_get", Yes2SDKStats::Get},
    {"stats_set", Yes2SDKStats::Set},
    {"stats_increment", Yes2SDKStats::Increment},
    {"stats_is_supported", Yes2SDKStats::IsSupported},

    // Config (remote flags)
    {"config_get_flags", Yes2SDKConfig::GetFlags},
    {"config_is_supported", Yes2SDKConfig::IsSupported},

    // Review (rating prompt)
    {"review_can_review", Yes2SDKReview::CanReview},
    {"review_request_review", Yes2SDKReview::RequestReview},
    {"review_is_supported", Yes2SDKReview::IsSupported},

    // IAP (in-app purchases)
    {"iap_get_catalog", Yes2SDKIap::GetCatalog},
    {"iap_get_product", Yes2SDKIap::GetProduct},
    {"iap_purchase", Yes2SDKIap::Purchase},
    {"iap_get_purchases", Yes2SDKIap::GetPurchases},
    {"iap_consume_purchase", Yes2SDKIap::ConsumePurchase},
    {"iap_is_supported", Yes2SDKIap::IsSupported},

    {0, 0}
};

static void LuaInit(lua_State *L)
{
    int top = lua_gettop(L);
    luaL_register(L, MODULE_NAME, Module_methods);
    lua_pop(L, 1);
    assert(top == lua_gettop(L));
}

dmExtension::Result InitializeYes2SDK(dmExtension::Params *params)
{
    LuaInit(params->m_L);
    return dmExtension::RESULT_OK;
}

dmExtension::Result FinalizeYes2SDK(dmExtension::Params *params)
{
    return dmExtension::RESULT_OK;
}

#else // unsupported platforms

dmExtension::Result InitializeYes2SDK(dmExtension::Params *params)
{
    return dmExtension::RESULT_OK;
}

dmExtension::Result FinalizeYes2SDK(dmExtension::Params *params)
{
    return dmExtension::RESULT_OK;
}

#endif

DM_DECLARE_EXTENSION(EXTENSION_NAME, LIB_NAME, 0, 0, InitializeYes2SDK, 0, 0, FinalizeYes2SDK)
