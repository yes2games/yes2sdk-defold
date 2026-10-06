#pragma once
#include <dmsdk/sdk.h>
#if defined(DM_PLATFORM_HTML5)
#include "yes2sdk_requests.h"
class Yes2SDKNotifications {
public:
    static int Schedule(lua_State* L);
    static int Cancel(lua_State* L);
    static int CancelAll(lua_State* L);
    static int IsSupported(lua_State* L);
};
extern "C" {
    void Yes2SDK_notifications_schedule(const char* optionsJson, int requestId, Yes2SDKRequests::OnCompleteCallback callback);
    void Yes2SDK_notifications_cancel(const char* id, int requestId, Yes2SDKRequests::OnCompleteCallback callback);
    void Yes2SDK_notifications_cancelAll(int requestId, Yes2SDKRequests::OnCompleteCallback callback);
    int Yes2SDK_notifications_isSupported();
}
#endif
