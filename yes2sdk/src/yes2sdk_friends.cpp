#include "yes2sdk_friends.h"
#include "luautils.h"
#if defined(DM_PLATFORM_HTML5)
lua_Listener onListFriendsListener;

void Yes2SDKFriends::OnListFriends(const int success, const char* result) {
    lua_State* L = onListFriendsListener.m_L;
    if (!L) return;
    int top = lua_gettop(L);
    lua_pushlistener(L, onListFriendsListener);
    lua_pushboolean(L, success);
    if (result) { lua_pushstring(L, result); } else { lua_pushnil(L); }
    int ret = lua_pcall(L, 3, 0, 0);
    if (ret != 0) { lua_pop(L, 1); }
    assert(top == lua_gettop(L));
}
int Yes2SDKFriends::ListFriends(lua_State* L) {
    int page = luaL_checkinteger(L, 1);
    int size = luaL_checkinteger(L, 2);
    luaL_checklistener(L, 3, onListFriendsListener);
    Yes2SDK_friends_listFriends(page, size, Yes2SDKFriends::OnListFriends);
    return 0;
}
int Yes2SDKFriends::IsSupported(lua_State* L) {
    lua_pushboolean(L, Yes2SDK_friends_isSupported());
    return 1;
}
#endif
