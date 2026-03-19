#pragma once

#include <dmsdk/sdk.h>

#if defined(DM_PLATFORM_HTML5)

class Yes2SDKSession
{
public:
    static int GameplayStart(lua_State* L);
    static int GameplayStop(lua_State* L);
    static int GetLocale(lua_State* L);
};

extern "C"
{
    void Yes2SDK_session_gameplayStart();
    void Yes2SDK_session_gameplayStop();
    const char* Yes2SDK_session_getLocale();
}

#endif
