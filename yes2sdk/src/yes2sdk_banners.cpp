#include "yes2sdk_banners.h"
#include "yes2sdk_requests.h"
#if defined(DM_PLATFORM_HTML5)

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
    int id = Yes2SDKRequests::Register(L, 1, "banners_get_status");
    Yes2SDK_banners_getStatus(id, Yes2SDKRequests::Complete);
    return 0;
}
#endif
