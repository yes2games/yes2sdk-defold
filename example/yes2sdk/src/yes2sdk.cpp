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
#include "luautils.h"
#include <dmsdk/sdk.h>

#define EXTENSION_NAME Yes2SDK
#define LIB_NAME "Yes2SDK"
#define MODULE_NAME "yes2sdk"
#define VERSION "1.0.0"

#if defined(DM_PLATFORM_HTML5)

lua_Listener onInitializeListener;
lua_Listener onStartGameListener;

void Yes2SDK::OnInitialize(const int success, const char *error)
{
    lua_State *L = onInitializeListener.m_L;
    int top = lua_gettop(L);

    lua_pushlistener(L, onInitializeListener);
    lua_pushboolean(L, success);
    lua_pushstring(L, error);

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
    int top = lua_gettop(L);

    lua_pushlistener(L, onStartGameListener);
    lua_pushboolean(L, success);
    lua_pushstring(L, error);

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

static const luaL_reg Module_methods[] = {
    // Core
    {"initialize", Yes2SDK::InitializeAsync},
    {"start_game", Yes2SDK::StartGameAsync},
    {"set_loading_progress", Yes2SDK::SetLoadingProgress},
    {"get_platform", Yes2SDK::GetPlatform},

    // Ads
    {"ads_show_interstitial", Yes2SDKAds::ShowInterstitial},
    {"ads_show_rewarded", Yes2SDKAds::ShowRewarded},

    // Session / Gameplay
    {"session_gameplay_start", Yes2SDKSession::GameplayStart},
    {"session_gameplay_stop", Yes2SDKSession::GameplayStop},
    {"session_get_locale", Yes2SDKSession::GetLocale},

    // Analytics
    {"analytics_log_level_start", Yes2SDKAnalytics::LogLevelStart},
    {"analytics_log_level_end", Yes2SDKAnalytics::LogLevelEnd},
    {"analytics_log_score", Yes2SDKAnalytics::LogScore},
    {"analytics_log_tutorial_start", Yes2SDKAnalytics::LogTutorialStart},
    {"analytics_log_tutorial_end", Yes2SDKAnalytics::LogTutorialEnd},
    {"analytics_log_game_choice", Yes2SDKAnalytics::LogGameChoice},

    // Player
    {"player_get_name", Yes2SDKPlayer::GetName},
    {"player_get_id", Yes2SDKPlayer::GetId},
    {"player_get_data", Yes2SDKPlayer::GetData},
    {"player_set_data", Yes2SDKPlayer::SetData},

    // Auth
    {"auth_is_authenticated", Yes2SDKAuth::IsAuthenticated},
    {"auth_sign_in", Yes2SDKAuth::SignIn},

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

    // Banners
    {"banners_show", Yes2SDKBanners::Show},
    {"banners_hide", Yes2SDKBanners::Hide},
    {"banners_hide_all", Yes2SDKBanners::HideAll},

    // Score
    {"score_add", Yes2SDKScore::AddScore},
    {"score_submit", Yes2SDKScore::SubmitScore},

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
