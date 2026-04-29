#pragma once
#include <dmsdk/sdk.h>
#if defined(DM_PLATFORM_HTML5)
class Yes2SDKFriends {
public:
    typedef void (*OnListFriendsCallback)(const int success, const char* result);
    static int ListFriends(lua_State* L);
    static int IsSupported(lua_State* L);
private:
    static void OnListFriends(const int success, const char* result);
};
extern "C" {
    void Yes2SDK_friends_listFriends(int page, int size, Yes2SDKFriends::OnListFriendsCallback callback);
    int Yes2SDK_friends_isSupported();
}
#endif
