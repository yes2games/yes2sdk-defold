#include "yes2sdk_notifications.h"
#include "yes2sdk_requests.h"
#if defined(DM_PLATFORM_HTML5)
// Same request router as the other async modules: Register comes after the
// argument checks so a bad argument cannot leak a request.
int Yes2SDKNotifications::Schedule(lua_State* L) {
    const char* optionsJson = luaL_checkstring(L, 1);
    int id = Yes2SDKRequests::Register(L, 2, "notifications_schedule");
    Yes2SDK_notifications_schedule(optionsJson, id, Yes2SDKRequests::Complete);
    return 0;
}
int Yes2SDKNotifications::Cancel(lua_State* L) {
    const char* notificationId = luaL_checkstring(L, 1);
    int id = Yes2SDKRequests::Register(L, 2, "notifications_cancel");
    Yes2SDK_notifications_cancel(notificationId, id, Yes2SDKRequests::Complete);
    return 0;
}
int Yes2SDKNotifications::CancelAll(lua_State* L) {
    int id = Yes2SDKRequests::Register(L, 1, "notifications_cancel_all");
    Yes2SDK_notifications_cancelAll(id, Yes2SDKRequests::Complete);
    return 0;
}
int Yes2SDKNotifications::IsSupported(lua_State* L) {
    lua_pushboolean(L, Yes2SDK_notifications_isSupported());
    return 1;
}
#endif
