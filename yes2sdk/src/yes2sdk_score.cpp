#include "yes2sdk_score.h"
#if defined(DM_PLATFORM_HTML5)
int Yes2SDKScore::AddScore(lua_State* L) {
    int top = lua_gettop(L);
    int score = luaL_checkinteger(L, 1);
    Yes2SDK_score_addScore(score);
    assert(top == lua_gettop(L));
    return 0;
}
int Yes2SDKScore::SubmitScore(lua_State* L) {
    int top = lua_gettop(L);
    const char* encrypted = luaL_checkstring(L, 1);
    Yes2SDK_score_submitScore(encrypted);
    assert(top == lua_gettop(L));
    return 0;
}
int Yes2SDKScore::IsSupported(lua_State* L) {
    lua_pushboolean(L, Yes2SDK_score_isSupported());
    return 1;
}
#endif
