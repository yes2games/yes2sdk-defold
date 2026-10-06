#pragma once

#include <dmsdk/sdk.h>

struct lua_Listener
{
    lua_Listener()
    {
        m_L = 0;
        m_Callback = LUA_NOREF;
        m_Self = LUA_NOREF;
    }

    lua_State* m_L;
    int        m_Callback;
    int        m_Self;
};

void luaL_checklistener(lua_State* L, int idx, struct lua_Listener& listener);
void lua_pushlistener(lua_State* L, struct lua_Listener& listener);

// Pops the error object at the top of the stack after a failed lua_pcall and logs it.
void lua_logpcallerror(lua_State* L, const char* where);
