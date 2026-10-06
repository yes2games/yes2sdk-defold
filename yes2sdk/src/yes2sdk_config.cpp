#include "yes2sdk_config.h"
#include "yes2sdk_requests.h"
#if defined(DM_PLATFORM_HTML5)
// The call registers its own request (callback + script instance) and passes the id
// through the JS bridge, so overlapping calls each complete their own callback.
int Yes2SDKConfig::GetFlags(lua_State* L) {
    const char* optionsJson = luaL_checkstring(L, 1);
    int id = Yes2SDKRequests::Register(L, 2, "config_get_flags");
    Yes2SDK_config_getFlags(optionsJson, id, Yes2SDKRequests::Complete);
    return 0;
}
int Yes2SDKConfig::IsSupported(lua_State* L) {
    lua_pushboolean(L, Yes2SDK_config_isSupported());
    return 1;
}
#endif
