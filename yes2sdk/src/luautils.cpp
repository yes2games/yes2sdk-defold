#include <dmsdk/sdk.h>
#include "luautils.h"

void luaL_checklistener(lua_State *L, int idx, struct lua_Listener &listener) {
    int top = lua_gettop(L);
    luaL_checktype(L, idx, LUA_TFUNCTION);
    lua_pushvalue(L, idx);
    int cb = dmScript::Ref(L, LUA_REGISTRYINDEX);

    if (listener.m_Callback != LUA_NOREF) {
        dmScript::Unref(listener.m_L, LUA_REGISTRYINDEX, listener.m_Callback);
        dmScript::Unref(listener.m_L, LUA_REGISTRYINDEX, listener.m_Self);
    }

    listener.m_L = dmScript::GetMainThread(L);
    listener.m_Callback = cb;
    dmScript::GetInstance(L);
    listener.m_Self = dmScript::Ref(L, LUA_REGISTRYINDEX);
    assert(top == lua_gettop(L));
}

void lua_pushlistener(lua_State *L, struct lua_Listener &listener) {
    int top = lua_gettop(L);
    lua_rawgeti(L, LUA_REGISTRYINDEX, listener.m_Callback);
    lua_rawgeti(L, LUA_REGISTRYINDEX, listener.m_Self);
    lua_pushvalue(L, -1);
    dmScript::SetInstance(L);
    assert(top + 2 == lua_gettop(L));
}

void lua_unreflistener(lua_State *L, struct lua_Listener &listener) {
    if (listener.m_Callback != LUA_NOREF) {
        dmScript::Unref(L, LUA_REGISTRYINDEX, listener.m_Callback);
    }
    if (listener.m_Self != LUA_NOREF) {
        dmScript::Unref(L, LUA_REGISTRYINDEX, listener.m_Self);
    }
    listener.m_Callback = LUA_NOREF;
    listener.m_Self = LUA_NOREF;
    listener.m_L = 0;
}

void lua_logpcallerror(lua_State *L, const char *where) {
    const char *msg = lua_tostring(L, -1);
    if (!msg) { msg = "(non-string error)"; }
    dmLogError("[Yes2SDK] %s callback error: %s", where, msg);
    lua_pop(L, 1);
}
