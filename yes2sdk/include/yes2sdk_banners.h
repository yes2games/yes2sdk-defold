#pragma once
#include <dmsdk/sdk.h>
#if defined(DM_PLATFORM_HTML5)
class Yes2SDKBanners {
public:
    typedef void (*OnResultCallback)(const int success, const char* result);
    static int Show(lua_State* L);
    static int Hide(lua_State* L);
    static int HideAll(lua_State* L);
    static int IsSupported(lua_State* L);
    static int GetStatus(lua_State* L);
private:
    static void OnGetStatus(const int success, const char* result);
};
extern "C" {
    void Yes2SDK_banners_show(const char* id, const char* size);
    void Yes2SDK_banners_hide(const char* id);
    void Yes2SDK_banners_hideAll();
    int Yes2SDK_banners_isSupported();
    void Yes2SDK_banners_getStatus(Yes2SDKBanners::OnResultCallback callback);
}
#endif
