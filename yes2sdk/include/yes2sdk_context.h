#pragma once
#include <dmsdk/sdk.h>
#if defined(DM_PLATFORM_HTML5)
#include "yes2sdk_requests.h"
class Yes2SDKContext {
public:
    static int Share(lua_State* L);
    static int IsSupported(lua_State* L);
};
extern "C" {
    void Yes2SDK_context_share(const char* optionsJson, int requestId, Yes2SDKRequests::OnCompleteCallback callback);
    int Yes2SDK_context_isSupported();
}
#endif
