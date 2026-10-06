#include "yes2sdk_friends.h"
#include "yes2sdk_requests.h"
#if defined(DM_PLATFORM_HTML5)

int Yes2SDKFriends::ListFriends(lua_State* L) {
    int page = luaL_checkinteger(L, 1);
    int size = luaL_checkinteger(L, 2);
    int id = Yes2SDKRequests::Register(L, 3, "friends_list_friends");
    Yes2SDK_friends_listFriends(page, size, id, Yes2SDKRequests::Complete);
    return 0;
}
int Yes2SDKFriends::IsSupported(lua_State* L) {
    lua_pushboolean(L, Yes2SDK_friends_isSupported());
    return 1;
}
#endif
