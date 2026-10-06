#include "yes2sdk_stats.h"
#include "yes2sdk_requests.h"
#if defined(DM_PLATFORM_HTML5)
// Every async call registers its own request (callback + script instance) and passes
// the id through the JS bridge, so overlapping calls each complete their own callback.
// Register comes after the argument checks so a bad argument cannot leak a request.
int Yes2SDKStats::Get(lua_State* L) {
    const char* keysJson = luaL_checkstring(L, 1);
    int id = Yes2SDKRequests::Register(L, 2, "stats_get");
    Yes2SDK_stats_get(keysJson, id, Yes2SDKRequests::Complete);
    return 0;
}
int Yes2SDKStats::Set(lua_State* L) {
    const char* statsJson = luaL_checkstring(L, 1);
    int id = Yes2SDKRequests::Register(L, 2, "stats_set");
    Yes2SDK_stats_set(statsJson, id, Yes2SDKRequests::Complete);
    return 0;
}
int Yes2SDKStats::Increment(lua_State* L) {
    const char* incrementsJson = luaL_checkstring(L, 1);
    int id = Yes2SDKRequests::Register(L, 2, "stats_increment");
    Yes2SDK_stats_increment(incrementsJson, id, Yes2SDKRequests::Complete);
    return 0;
}
int Yes2SDKStats::IsSupported(lua_State* L) {
    lua_pushboolean(L, Yes2SDK_stats_isSupported());
    return 1;
}
#endif
