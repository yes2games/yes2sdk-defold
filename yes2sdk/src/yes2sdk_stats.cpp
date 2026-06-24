#include "yes2sdk_stats.h"
#include "luautils.h"
#if defined(DM_PLATFORM_HTML5)
lua_Listener onStatsGetListener;
lua_Listener onStatsSetListener;
lua_Listener onStatsIncrementListener;

void Yes2SDKStats::OnGet(const int success, const char* result) {
    lua_State* L = onStatsGetListener.m_L;
    if (!L) return;
    int top = lua_gettop(L);
    lua_pushlistener(L, onStatsGetListener);
    lua_pushboolean(L, success);
    if (result) { lua_pushstring(L, result); } else { lua_pushnil(L); }
    int ret = lua_pcall(L, 3, 0, 0);
    if (ret != 0) { lua_pop(L, 1); }
    assert(top == lua_gettop(L));
}
void Yes2SDKStats::OnSet(const int success, const char* error) {
    lua_State* L = onStatsSetListener.m_L;
    if (!L) return;
    int top = lua_gettop(L);
    lua_pushlistener(L, onStatsSetListener);
    lua_pushboolean(L, success);
    if (error) { lua_pushstring(L, error); } else { lua_pushnil(L); }
    int ret = lua_pcall(L, 3, 0, 0);
    if (ret != 0) { lua_pop(L, 1); }
    assert(top == lua_gettop(L));
}
void Yes2SDKStats::OnIncrement(const int success, const char* result) {
    lua_State* L = onStatsIncrementListener.m_L;
    if (!L) return;
    int top = lua_gettop(L);
    lua_pushlistener(L, onStatsIncrementListener);
    lua_pushboolean(L, success);
    if (result) { lua_pushstring(L, result); } else { lua_pushnil(L); }
    int ret = lua_pcall(L, 3, 0, 0);
    if (ret != 0) { lua_pop(L, 1); }
    assert(top == lua_gettop(L));
}
int Yes2SDKStats::Get(lua_State* L) {
    const char* keysJson = luaL_checkstring(L, 1);
    luaL_checklistener(L, 2, onStatsGetListener);
    Yes2SDK_stats_get(keysJson, Yes2SDKStats::OnGet);
    return 0;
}
int Yes2SDKStats::Set(lua_State* L) {
    const char* statsJson = luaL_checkstring(L, 1);
    luaL_checklistener(L, 2, onStatsSetListener);
    Yes2SDK_stats_set(statsJson, Yes2SDKStats::OnSet);
    return 0;
}
int Yes2SDKStats::Increment(lua_State* L) {
    const char* incrementsJson = luaL_checkstring(L, 1);
    luaL_checklistener(L, 2, onStatsIncrementListener);
    Yes2SDK_stats_increment(incrementsJson, Yes2SDKStats::OnIncrement);
    return 0;
}
int Yes2SDKStats::IsSupported(lua_State* L) {
    lua_pushboolean(L, Yes2SDK_stats_isSupported());
    return 1;
}
#endif
