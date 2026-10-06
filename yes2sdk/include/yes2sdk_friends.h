#pragma once
#include <dmsdk/sdk.h>
#include "yes2sdk_requests.h"
#if defined(DM_PLATFORM_HTML5)
class Yes2SDKFriends {
public:
    static int ListFriends(lua_State* L);
    static int IsSupported(lua_State* L);
};
extern "C" {
    void Yes2SDK_friends_listFriends(int page, int size, int requestId, Yes2SDKRequests::OnCompleteCallback callback);
    int Yes2SDK_friends_isSupported();
}
#endif
