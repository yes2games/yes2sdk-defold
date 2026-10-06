#include "yes2sdk_auth.h"
#include "yes2sdk_requests.h"
#if defined(DM_PLATFORM_HTML5)

int Yes2SDKAuth::IsAuthenticated(lua_State* L) {
    lua_pushboolean(L, Yes2SDK_auth_isAuthenticated());
    return 1;
}
int Yes2SDKAuth::SignIn(lua_State* L) {
    int id = Yes2SDKRequests::Register(L, 1, "auth_sign_in");
    Yes2SDK_auth_signIn(id, Yes2SDKRequests::Complete);
    return 0;
}
int Yes2SDKAuth::IsSupported(lua_State* L) {
    lua_pushboolean(L, Yes2SDK_auth_isSupported());
    return 1;
}
#endif
