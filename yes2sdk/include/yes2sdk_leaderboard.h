#pragma once
#include <dmsdk/sdk.h>
#if defined(DM_PLATFORM_HTML5)
class Yes2SDKLeaderboard {
public:
    typedef void (*OnResultCallback)(const int success, const char* result);
    static int Get(lua_State* L);
    static int SetScore(lua_State* L);
    static int GetEntries(lua_State* L);
    static int GetPlayerEntry(lua_State* L);
    static int IsSupported(lua_State* L);
private:
    static void OnGet(const int success, const char* result);
    static void OnSetScore(const int success, const char* result);
    static void OnGetEntries(const int success, const char* result);
    static void OnGetPlayerEntry(const int success, const char* result);
};
extern "C" {
    void Yes2SDK_leaderboard_get(const char* name, Yes2SDKLeaderboard::OnResultCallback callback);
    void Yes2SDK_leaderboard_setScore(const char* name, double score, const char* metadata, Yes2SDKLeaderboard::OnResultCallback callback);
    void Yes2SDK_leaderboard_getEntries(const char* name, int count, int offset, Yes2SDKLeaderboard::OnResultCallback callback);
    void Yes2SDK_leaderboard_getPlayerEntry(const char* name, Yes2SDKLeaderboard::OnResultCallback callback);
    int Yes2SDK_leaderboard_isSupported();
}
#endif
