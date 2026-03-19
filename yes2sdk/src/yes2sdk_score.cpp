#include "yes2sdk_score.h"
#if defined(DM_PLATFORM_HTML5)
int Yes2SDKScore::AddScore(lua_State* L) {
    int score = luaL_checkinteger(L, 1);
    Yes2SDK_score_addScore(score);
    return 0;
}
int Yes2SDKScore::SubmitScore(lua_State* L) {
    const char* encrypted = luaL_checkstring(L, 1);
    Yes2SDK_score_submitScore(encrypted);
    return 0;
}
#endif
