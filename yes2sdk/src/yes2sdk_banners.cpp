#include "yes2sdk_banners.h"
#include "luautils.h"
#if defined(DM_PLATFORM_HTML5)
lua_Listener onBannersGetStatusListener;

void Yes2SDKBanners::OnGetStatus(const int success, const char* result) {
    lua_State* L = onBannersGetStatusListener.m_L;
    if (!L) return;
    int top = lua_gettop(L);
    lua_pushlistener(L, onBannersGetStatusListener);
    lua_pushboolean(L, success);
    if (result) { lua_pushstring(L, result); } else { lua_pushnil(L); }
    int ret = lua_pcall(L, 3, 0, 0);
    if (ret != 0) { lua_pop(L, 1); }
    assert(top == lua_gettop(L));
}
int Yes2SDKBanners::Show(lua_State* L) {
    int top = lua_gettop(L);
    const char* id = luaL_checkstring(L, 1);
    const char* size = luaL_optstring(L, 2, "728x90");
    Yes2SDK_banners_show(id, size);
    assert(top == lua_gettop(L));
    return 0;
}
int Yes2SDKBanners::Hide(lua_State* L) {
    int top = lua_gettop(L);
    const char* id = luaL_checkstring(L, 1);
    Yes2SDK_banners_hide(id);
    assert(top == lua_gettop(L));
    return 0;
}
int Yes2SDKBanners::HideAll(lua_State* L) {
    int top = lua_gettop(L);
    Yes2SDK_banners_hideAll();
    assert(top == lua_gettop(L));
    return 0;
}
int Yes2SDKBanners::IsSupported(lua_State* L) {
    lua_pushboolean(L, Yes2SDK_banners_isSupported());
    return 1;
}
int Yes2SDKBanners::GetStatus(lua_State* L) {
    luaL_checklistener(L, 1, onBannersGetStatusListener);
    Yes2SDK_banners_getStatus(Yes2SDKBanners::OnGetStatus);
    return 0;
}
#endif
