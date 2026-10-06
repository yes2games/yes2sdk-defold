#include "yes2sdk_referrals.h"
#include "yes2sdk_requests.h"
#if defined(DM_PLATFORM_HTML5)
// Every async call registers its own request and passes the id through the JS bridge.
// Register comes after the argument checks so a bad argument cannot leak a request.
int Yes2SDKReferrals::Share(lua_State* L) {
    const char* optionsJson = luaL_checkstring(L, 1);
    int id = Yes2SDKRequests::Register(L, 2, "referrals_share");
    Yes2SDK_referrals_share(optionsJson, id, Yes2SDKRequests::Complete);
    return 0;
}
int Yes2SDKReferrals::List(lua_State* L) {
    int id = Yes2SDKRequests::Register(L, 1, "referrals_list");
    Yes2SDK_referrals_list(id, Yes2SDKRequests::Complete);
    return 0;
}
int Yes2SDKReferrals::IsSupported(lua_State* L) {
    lua_pushboolean(L, Yes2SDK_referrals_isSupported());
    return 1;
}
#endif
