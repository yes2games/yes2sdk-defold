#include "yes2sdk_context.h"
#include "yes2sdk_requests.h"
#if defined(DM_PLATFORM_HTML5)
// Share a message with an optional image. Options arrive as a JSON string
// (empty for none); Register comes after the argument checks so a bad argument
// cannot leak a request.
int Yes2SDKContext::Share(lua_State* L) {
    const char* optionsJson = luaL_optstring(L, 1, "");
    int id = Yes2SDKRequests::Register(L, 2, "context_share");
    Yes2SDK_context_share(optionsJson, id, Yes2SDKRequests::Complete);
    return 0;
}
int Yes2SDKContext::IsSupported(lua_State* L) {
    lua_pushboolean(L, Yes2SDK_context_isSupported());
    return 1;
}
#endif
