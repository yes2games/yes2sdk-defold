#pragma once
#include <dmsdk/sdk.h>
#include "yes2sdk_requests.h"
#if defined(DM_PLATFORM_HTML5)
class Yes2SDKPlayer {
public:
    static int GetName(lua_State* L);
    static int GetId(lua_State* L);
    static int GetData(lua_State* L);
    static int SetData(lua_State* L);
    static int FlushData(lua_State* L);
    static int GetUniqueId(lua_State* L);
    static int GetIdsPerGame(lua_State* L);
    static int GetPayingStatus(lua_State* L);
    static int GetMode(lua_State* L);
    static int GetPhoto(lua_State* L);
    static int GetSignedInfo(lua_State* L);
    static int IsDataSupported(lua_State* L);
};
extern "C" {
    const char* Yes2SDK_player_getName();
    const char* Yes2SDK_player_getId();
    void Yes2SDK_player_getData(const char* keysJson, int requestId, Yes2SDKRequests::OnCompleteCallback callback);
    void Yes2SDK_player_setData(const char* dataJson, int requestId, Yes2SDKRequests::OnCompleteCallback callback);
    void Yes2SDK_player_flushData(int requestId, Yes2SDKRequests::OnCompleteCallback callback);
    void Yes2SDK_player_getUniqueId(int requestId, Yes2SDKRequests::OnCompleteCallback callback);
    void Yes2SDK_player_getIdsPerGame(int requestId, Yes2SDKRequests::OnCompleteCallback callback);
    void Yes2SDK_player_getPayingStatus(int requestId, Yes2SDKRequests::OnCompleteCallback callback);
    void Yes2SDK_player_getMode(int requestId, Yes2SDKRequests::OnCompleteCallback callback);
    void Yes2SDK_player_getPhoto(const char* size, int requestId, Yes2SDKRequests::OnCompleteCallback callback);
    void Yes2SDK_player_getSignedInfo(const char* payload, int requestId, Yes2SDKRequests::OnCompleteCallback callback);
    int Yes2SDK_player_isDataSupported();
}
#endif
