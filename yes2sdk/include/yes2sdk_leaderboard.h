#pragma once
#include <dmsdk/sdk.h>
#include "yes2sdk_requests.h"
#if defined(DM_PLATFORM_HTML5)
class Yes2SDKLeaderboard {
public:
    static int Get(lua_State* L);
    static int SetScore(lua_State* L);
    static int GetEntries(lua_State* L);
    static int GetPlayerEntry(lua_State* L);
    static int IsSupported(lua_State* L);
};
extern "C" {
    void Yes2SDK_leaderboard_get(const char* name, int requestId, Yes2SDKRequests::OnCompleteCallback callback);
    void Yes2SDK_leaderboard_setScore(const char* name, double score, const char* metadata, int requestId, Yes2SDKRequests::OnCompleteCallback callback);
    void Yes2SDK_leaderboard_getEntries(const char* name, int count, int offset, int requestId, Yes2SDKRequests::OnCompleteCallback callback);
    void Yes2SDK_leaderboard_getPlayerEntry(const char* name, int requestId, Yes2SDKRequests::OnCompleteCallback callback);
    int Yes2SDK_leaderboard_isSupported();
}
#endif
