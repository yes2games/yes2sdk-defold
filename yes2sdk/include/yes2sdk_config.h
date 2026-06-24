#pragma once
#include <dmsdk/sdk.h>
#if defined(DM_PLATFORM_HTML5)
class Yes2SDKConfig {
public:
    typedef void (*OnResultCallback)(const int success, const char* result);
    static int GetFlags(lua_State* L);
    static int IsSupported(lua_State* L);
private:
    static void OnGetFlags(const int success, const char* result);
};
extern "C" {
    void Yes2SDK_config_getFlags(const char* optionsJson, Yes2SDKConfig::OnResultCallback callback);
    int Yes2SDK_config_isSupported();
}
#endif
