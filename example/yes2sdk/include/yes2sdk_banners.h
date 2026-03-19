#pragma once
#include <dmsdk/sdk.h>
#if defined(DM_PLATFORM_HTML5)
class Yes2SDKBanners {
public:
    static int Show(lua_State* L);
    static int Hide(lua_State* L);
    static int HideAll(lua_State* L);
};
extern "C" {
    void Yes2SDK_banners_show(const char* id, const char* size);
    void Yes2SDK_banners_hide(const char* id);
    void Yes2SDK_banners_hideAll();
}
#endif
