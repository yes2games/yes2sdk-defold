#pragma once
#include <dmsdk/sdk.h>
#include "yes2sdk_requests.h"
#if defined(DM_PLATFORM_HTML5)
class Yes2SDKBanners {
public:
    static int Show(lua_State* L);
    static int Hide(lua_State* L);
    static int HideAll(lua_State* L);
    static int IsSupported(lua_State* L);
    static int GetStatus(lua_State* L);
};
extern "C" {
    void Yes2SDK_banners_show(const char* id, const char* size);
    void Yes2SDK_banners_hide(const char* id);
    void Yes2SDK_banners_hideAll();
    int Yes2SDK_banners_isSupported();
    void Yes2SDK_banners_getStatus(int requestId, Yes2SDKRequests::OnCompleteCallback callback);
}
#endif
