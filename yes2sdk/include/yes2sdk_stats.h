#pragma once
#include <dmsdk/sdk.h>
#include "yes2sdk_requests.h"
#if defined(DM_PLATFORM_HTML5)
class Yes2SDKStats {
public:
    static int Get(lua_State* L);
    static int Set(lua_State* L);
    static int Increment(lua_State* L);
    static int IsSupported(lua_State* L);
};
extern "C" {
    void Yes2SDK_stats_get(const char* keysJson, int requestId, Yes2SDKRequests::OnCompleteCallback callback);
    void Yes2SDK_stats_set(const char* statsJson, int requestId, Yes2SDKRequests::OnCompleteCallback callback);
    void Yes2SDK_stats_increment(const char* incrementsJson, int requestId, Yes2SDKRequests::OnCompleteCallback callback);
    int Yes2SDK_stats_isSupported();
}
#endif
