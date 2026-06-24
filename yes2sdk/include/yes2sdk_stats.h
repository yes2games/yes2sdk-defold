#pragma once
#include <dmsdk/sdk.h>
#if defined(DM_PLATFORM_HTML5)
class Yes2SDKStats {
public:
    typedef void (*OnResultCallback)(const int success, const char* result);
    static int Get(lua_State* L);
    static int Set(lua_State* L);
    static int Increment(lua_State* L);
    static int IsSupported(lua_State* L);
private:
    static void OnGet(const int success, const char* result);
    static void OnSet(const int success, const char* error);
    static void OnIncrement(const int success, const char* result);
};
extern "C" {
    void Yes2SDK_stats_get(const char* keysJson, Yes2SDKStats::OnResultCallback callback);
    void Yes2SDK_stats_set(const char* statsJson, Yes2SDKStats::OnResultCallback callback);
    void Yes2SDK_stats_increment(const char* incrementsJson, Yes2SDKStats::OnResultCallback callback);
    int Yes2SDK_stats_isSupported();
}
#endif
