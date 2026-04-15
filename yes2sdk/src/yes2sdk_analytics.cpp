#include "yes2sdk_analytics.h"
#if defined(DM_PLATFORM_HTML5)
int Yes2SDKAnalytics::LogLevelStart(lua_State* L) {
    int top = lua_gettop(L);
    const char* level = luaL_checkstring(L, 1);
    Yes2SDK_analytics_logLevelStart(level);
    assert(top == lua_gettop(L));
    return 0;
}
int Yes2SDKAnalytics::LogLevelEnd(lua_State* L) {
    int top = lua_gettop(L);
    const char* level = luaL_checkstring(L, 1);
    int score = luaL_optinteger(L, 2, 0);
    int success = lua_toboolean(L, 3);
    Yes2SDK_analytics_logLevelEnd(level, score, success);
    assert(top == lua_gettop(L));
    return 0;
}
int Yes2SDKAnalytics::LogScore(lua_State* L) {
    int top = lua_gettop(L);
    int score = luaL_checkinteger(L, 1);
    const char* level = luaL_optstring(L, 2, NULL);
    Yes2SDK_analytics_logScore(score, level);
    assert(top == lua_gettop(L));
    return 0;
}
int Yes2SDKAnalytics::LogTutorialStart(lua_State* L) {
    int top = lua_gettop(L);
    Yes2SDK_analytics_logTutorialStart();
    assert(top == lua_gettop(L));
    return 0;
}
int Yes2SDKAnalytics::LogTutorialEnd(lua_State* L) {
    int top = lua_gettop(L);
    Yes2SDK_analytics_logTutorialEnd();
    assert(top == lua_gettop(L));
    return 0;
}
int Yes2SDKAnalytics::LogGameChoice(lua_State* L) {
    int top = lua_gettop(L);
    const char* decision = luaL_checkstring(L, 1);
    const char* choice = luaL_checkstring(L, 2);
    Yes2SDK_analytics_logGameChoice(decision, choice);
    assert(top == lua_gettop(L));
    return 0;
}
#endif
