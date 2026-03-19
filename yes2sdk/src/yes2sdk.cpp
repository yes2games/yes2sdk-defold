#include "yes2sdk.h"
#include "yes2sdk_ads.h"
#include "yes2sdk_session.h"
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
