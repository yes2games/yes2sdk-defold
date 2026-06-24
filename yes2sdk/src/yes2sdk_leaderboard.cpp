#include "yes2sdk_leaderboard.h"
#include "luautils.h"
#if defined(DM_PLATFORM_HTML5)
lua_Listener onLeaderboardGetListener;
lua_Listener onLeaderboardSetScoreListener;
lua_Listener onLeaderboardGetEntriesListener;
lua_Listener onLeaderboardGetPlayerEntryListener;

void Yes2SDKLeaderboard::OnGet(const int success, const char* result) {
    lua_State* L = onLeaderboardGetListener.m_L;
    if (!L) return;
    int top = lua_gettop(L);
    lua_pushlistener(L, onLeaderboardGetListener);
    lua_pushboolean(L, success);
    if (result) { lua_pushstring(L, result); } else { lua_pushnil(L); }
    int ret = lua_pcall(L, 3, 0, 0);
    if (ret != 0) { lua_pop(L, 1); }
    assert(top == lua_gettop(L));
}
void Yes2SDKLeaderboard::OnSetScore(const int success, const char* result) {
    lua_State* L = onLeaderboardSetScoreListener.m_L;
    if (!L) return;
    int top = lua_gettop(L);
    lua_pushlistener(L, onLeaderboardSetScoreListener);
    lua_pushboolean(L, success);
    if (result) { lua_pushstring(L, result); } else { lua_pushnil(L); }
    int ret = lua_pcall(L, 3, 0, 0);
    if (ret != 0) { lua_pop(L, 1); }
    assert(top == lua_gettop(L));
}
void Yes2SDKLeaderboard::OnGetEntries(const int success, const char* result) {
    lua_State* L = onLeaderboardGetEntriesListener.m_L;
    if (!L) return;
    int top = lua_gettop(L);
    lua_pushlistener(L, onLeaderboardGetEntriesListener);
    lua_pushboolean(L, success);
    if (result) { lua_pushstring(L, result); } else { lua_pushnil(L); }
    int ret = lua_pcall(L, 3, 0, 0);
    if (ret != 0) { lua_pop(L, 1); }
    assert(top == lua_gettop(L));
}
void Yes2SDKLeaderboard::OnGetPlayerEntry(const int success, const char* result) {
    lua_State* L = onLeaderboardGetPlayerEntryListener.m_L;
    if (!L) return;
    int top = lua_gettop(L);
    lua_pushlistener(L, onLeaderboardGetPlayerEntryListener);
    lua_pushboolean(L, success);
    if (result) { lua_pushstring(L, result); } else { lua_pushnil(L); }
    int ret = lua_pcall(L, 3, 0, 0);
    if (ret != 0) { lua_pop(L, 1); }
    assert(top == lua_gettop(L));
}
int Yes2SDKLeaderboard::Get(lua_State* L) {
    const char* name = luaL_checkstring(L, 1);
    luaL_checklistener(L, 2, onLeaderboardGetListener);
    Yes2SDK_leaderboard_get(name, Yes2SDKLeaderboard::OnGet);
    return 0;
}
int Yes2SDKLeaderboard::SetScore(lua_State* L) {
    const char* name = luaL_checkstring(L, 1);
    double score = luaL_checknumber(L, 2);
    // metadata is optional — accept a string or nil/none.
    const char* metadata = luaL_optstring(L, 3, "");
    luaL_checklistener(L, 4, onLeaderboardSetScoreListener);
    Yes2SDK_leaderboard_setScore(name, score, metadata, Yes2SDKLeaderboard::OnSetScore);
    return 0;
}
int Yes2SDKLeaderboard::GetEntries(lua_State* L) {
    const char* name = luaL_checkstring(L, 1);
    int count = luaL_checkinteger(L, 2);
    int offset = luaL_checkinteger(L, 3);
    luaL_checklistener(L, 4, onLeaderboardGetEntriesListener);
    Yes2SDK_leaderboard_getEntries(name, count, offset, Yes2SDKLeaderboard::OnGetEntries);
    return 0;
}
int Yes2SDKLeaderboard::GetPlayerEntry(lua_State* L) {
    const char* name = luaL_checkstring(L, 1);
    luaL_checklistener(L, 2, onLeaderboardGetPlayerEntryListener);
    Yes2SDK_leaderboard_getPlayerEntry(name, Yes2SDKLeaderboard::OnGetPlayerEntry);
    return 0;
}
int Yes2SDKLeaderboard::IsSupported(lua_State* L) {
    lua_pushboolean(L, Yes2SDK_leaderboard_isSupported());
    return 1;
}
#endif
