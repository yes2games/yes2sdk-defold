#include "yes2sdk_ads.h"
#include "luautils.h"

#if defined(DM_PLATFORM_HTML5)

lua_Listener onBeforeAdListener;
lua_Listener onAfterAdListener;
lua_Listener onAdDismissedListener;
lua_Listener onAdViewedListener;
lua_Listener onNoFillListener;

void Yes2SDKAds::OnBeforeAd(const int success)
{
    lua_State *L = onBeforeAdListener.m_L;
    int top = lua_gettop(L);
    lua_pushlistener(L, onBeforeAdListener);
    lua_pushboolean(L, success);
    int ret = lua_pcall(L, 2, 0, 0);
    if (ret != 0) { lua_pop(L, 1); }
    assert(top == lua_gettop(L));
}

void Yes2SDKAds::OnAfterAd(const int success)
{
    lua_State *L = onAfterAdListener.m_L;
    int top = lua_gettop(L);
    lua_pushlistener(L, onAfterAdListener);
    lua_pushboolean(L, success);
    int ret = lua_pcall(L, 2, 0, 0);
    if (ret != 0) { lua_pop(L, 1); }
    assert(top == lua_gettop(L));
}

void Yes2SDKAds::OnAdDismissed(const int success)
{
    lua_State *L = onAdDismissedListener.m_L;
    int top = lua_gettop(L);
    lua_pushlistener(L, onAdDismissedListener);
    lua_pushboolean(L, success);
    int ret = lua_pcall(L, 2, 0, 0);
    if (ret != 0) { lua_pop(L, 1); }
    assert(top == lua_gettop(L));
}

void Yes2SDKAds::OnAdViewed(const int success)
{
    lua_State *L = onAdViewedListener.m_L;
    int top = lua_gettop(L);
    lua_pushlistener(L, onAdViewedListener);
    lua_pushboolean(L, success);
    int ret = lua_pcall(L, 2, 0, 0);
    if (ret != 0) { lua_pop(L, 1); }
    assert(top == lua_gettop(L));
}

void Yes2SDKAds::OnNoFill(const int success)
{
    lua_State *L = onNoFillListener.m_L;
    int top = lua_gettop(L);
    lua_pushlistener(L, onNoFillListener);
    lua_pushboolean(L, success);
    int ret = lua_pcall(L, 2, 0, 0);
    if (ret != 0) { lua_pop(L, 1); }
    assert(top == lua_gettop(L));
}

int Yes2SDKAds::ShowInterstitial(lua_State *L)
{
    int top = lua_gettop(L);
    const char *placement = luaL_checkstring(L, 1);
    luaL_checklistener(L, 2, onBeforeAdListener);
    luaL_checklistener(L, 3, onAfterAdListener);
    luaL_checklistener(L, 4, onNoFillListener);

    Yes2SDK_ads_showInterstitial(placement,
        Yes2SDKAds::OnBeforeAd, Yes2SDKAds::OnAfterAd, Yes2SDKAds::OnNoFill);

    assert(top == lua_gettop(L));
    return 0;
}

int Yes2SDKAds::ShowRewarded(lua_State *L)
{
    int top = lua_gettop(L);
    const char *placement = luaL_checkstring(L, 1);
    luaL_checklistener(L, 2, onBeforeAdListener);
    luaL_checklistener(L, 3, onAfterAdListener);
    luaL_checklistener(L, 4, onAdDismissedListener);
    luaL_checklistener(L, 5, onAdViewedListener);
    luaL_checklistener(L, 6, onNoFillListener);

    Yes2SDK_ads_showRewarded(placement,
        Yes2SDKAds::OnBeforeAd, Yes2SDKAds::OnAfterAd,
        Yes2SDKAds::OnAdDismissed, Yes2SDKAds::OnAdViewed, Yes2SDKAds::OnNoFill);

    assert(top == lua_gettop(L));
    return 0;
}

#endif
