#include "yes2sdk_session.h"
#include "luautils.h"

#if defined(DM_PLATFORM_HTML5)

int Yes2SDKSession::GameplayStart(lua_State *L)
{
    int top = lua_gettop(L);
    Yes2SDK_session_gameplayStart();
    assert(top == lua_gettop(L));
    return 0;
}

int Yes2SDKSession::GameplayStop(lua_State *L)
{
    int top = lua_gettop(L);
    Yes2SDK_session_gameplayStop();
    assert(top == lua_gettop(L));
    return 0;
}

int Yes2SDKSession::GetLocale(lua_State *L)
{
    int top = lua_gettop(L);
    const char *locale = Yes2SDK_session_getLocale();
    if (locale)
    {
        lua_pushstring(L, locale);
    }
    else
    {
        lua_pushstring(L, "en");
    }
    assert(top + 1 == lua_gettop(L));
    return 1;
}

#endif
