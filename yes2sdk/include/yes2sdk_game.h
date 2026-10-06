#pragma once
#include <dmsdk/sdk.h>
#include "yes2sdk_requests.h"
#if defined(DM_PLATFORM_HTML5)
class Yes2SDKGame {
public:
    static int HappyTime(lua_State* L);
    static int GetSettings(lua_State* L);
    static int CopyToClipboard(lua_State* L);
    static int InviteLink(lua_State* L);
    static int GetServerTime(lua_State* L);
};
extern "C" {
    void Yes2SDK_game_happyTime();
    const char* Yes2SDK_game_getSettings();
    void Yes2SDK_game_copyToClipboard(const char* text);
    void Yes2SDK_game_inviteLink(const char* paramsJson, int requestId, Yes2SDKRequests::OnCompleteCallback callback);
    void Yes2SDK_game_getServerTime(int requestId, Yes2SDKRequests::OnCompleteCallback callback);
}
#endif
