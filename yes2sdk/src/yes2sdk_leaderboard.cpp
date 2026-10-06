#include "yes2sdk_leaderboard.h"
#include "yes2sdk_requests.h"
#if defined(DM_PLATFORM_HTML5)
// Every async call registers its own request (callback + script instance) and passes
// the id through the JS bridge, so overlapping calls each complete their own callback.
// Register comes after the argument checks so a bad argument cannot leak a request.
int Yes2SDKLeaderboard::Get(lua_State* L) {
    const char* name = luaL_checkstring(L, 1);
    int id = Yes2SDKRequests::Register(L, 2, "leaderboard_get");
    Yes2SDK_leaderboard_get(name, id, Yes2SDKRequests::Complete);
    return 0;
}
int Yes2SDKLeaderboard::SetScore(lua_State* L) {
    const char* name = luaL_checkstring(L, 1);
    double score = luaL_checknumber(L, 2);
    // metadata is optional: accept a string or nil/none.
    const char* metadata = luaL_optstring(L, 3, "");
    int id = Yes2SDKRequests::Register(L, 4, "leaderboard_set_score");
    Yes2SDK_leaderboard_setScore(name, score, metadata, id, Yes2SDKRequests::Complete);
    return 0;
}
int Yes2SDKLeaderboard::GetEntries(lua_State* L) {
    const char* name = luaL_checkstring(L, 1);
    int count = luaL_checkinteger(L, 2);
    int offset = luaL_checkinteger(L, 3);
    int id = Yes2SDKRequests::Register(L, 4, "leaderboard_get_entries");
    Yes2SDK_leaderboard_getEntries(name, count, offset, id, Yes2SDKRequests::Complete);
    return 0;
}
int Yes2SDKLeaderboard::GetPlayerEntry(lua_State* L) {
    const char* name = luaL_checkstring(L, 1);
    int id = Yes2SDKRequests::Register(L, 2, "leaderboard_get_player_entry");
    Yes2SDK_leaderboard_getPlayerEntry(name, id, Yes2SDKRequests::Complete);
    return 0;
}
int Yes2SDKLeaderboard::IsSupported(lua_State* L) {
    lua_pushboolean(L, Yes2SDK_leaderboard_isSupported());
    return 1;
}
#endif
