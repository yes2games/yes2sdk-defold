#pragma once
#include <dmsdk/sdk.h>
#if defined(DM_PLATFORM_HTML5)
class Yes2SDKAnalytics {
public:
    static int LogLevelStart(lua_State* L);
    static int LogLevelEnd(lua_State* L);
    static int LogScore(lua_State* L);
    static int LogTutorialStart(lua_State* L);
    static int LogTutorialEnd(lua_State* L);
    static int LogGameChoice(lua_State* L);
};
extern "C" {
    void Yes2SDK_analytics_logLevelStart(const char* level);
    void Yes2SDK_analytics_logLevelEnd(const char* level, int score, int success);
    void Yes2SDK_analytics_logScore(int score, const char* level);
    void Yes2SDK_analytics_logTutorialStart();
    void Yes2SDK_analytics_logTutorialEnd();
    void Yes2SDK_analytics_logGameChoice(const char* decision, const char* choice);
}
#endif
