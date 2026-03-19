#pragma once
#include <dmsdk/sdk.h>
#if defined(DM_PLATFORM_HTML5)
class Yes2SDKScore {
public:
    static int AddScore(lua_State* L);
    static int SubmitScore(lua_State* L);
};
extern "C" {
    void Yes2SDK_score_addScore(int score);
    void Yes2SDK_score_submitScore(const char* encrypted);
}
#endif
