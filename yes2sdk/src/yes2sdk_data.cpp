#include "yes2sdk_data.h"
#if defined(DM_PLATFORM_HTML5)
int Yes2SDKData::GetInt(lua_State* L) {
    int top = lua_gettop(L);
    const char* key = luaL_checkstring(L, 1);
    int def = luaL_optinteger(L, 2, 0);
    lua_pushinteger(L, Yes2SDK_data_getInt(key, def));
    assert(top + 1 == lua_gettop(L));
    return 1;
}
int Yes2SDKData::SetInt(lua_State* L) {
    int top = lua_gettop(L);
    const char* key = luaL_checkstring(L, 1);
    int val = luaL_checkinteger(L, 2);
    Yes2SDK_data_setInt(key, val);
    assert(top == lua_gettop(L));
    return 0;
}
int Yes2SDKData::GetFloat(lua_State* L) {
    int top = lua_gettop(L);
    const char* key = luaL_checkstring(L, 1);
    float def = luaL_optnumber(L, 2, 0.0);
    lua_pushnumber(L, Yes2SDK_data_getFloat(key, def));
    assert(top + 1 == lua_gettop(L));
    return 1;
}
int Yes2SDKData::SetFloat(lua_State* L) {
    int top = lua_gettop(L);
    const char* key = luaL_checkstring(L, 1);
    float val = luaL_checknumber(L, 2);
    Yes2SDK_data_setFloat(key, val);
    assert(top == lua_gettop(L));
    return 0;
}
int Yes2SDKData::GetString(lua_State* L) {
    int top = lua_gettop(L);
    const char* key = luaL_checkstring(L, 1);
    const char* def = luaL_optstring(L, 2, "");
    const char* result = Yes2SDK_data_getString(key, def);
    lua_pushstring(L, result ? result : def);
    assert(top + 1 == lua_gettop(L));
    return 1;
}
int Yes2SDKData::SetString(lua_State* L) {
    int top = lua_gettop(L);
    const char* key = luaL_checkstring(L, 1);
    const char* val = luaL_checkstring(L, 2);
    Yes2SDK_data_setString(key, val);
    assert(top == lua_gettop(L));
    return 0;
}
int Yes2SDKData::HasKey(lua_State* L) {
    int top = lua_gettop(L);
    const char* key = luaL_checkstring(L, 1);
    lua_pushboolean(L, Yes2SDK_data_hasKey(key));
    assert(top + 1 == lua_gettop(L));
    return 1;
}
int Yes2SDKData::DeleteKey(lua_State* L) {
    int top = lua_gettop(L);
    const char* key = luaL_checkstring(L, 1);
    Yes2SDK_data_deleteKey(key);
    assert(top == lua_gettop(L));
    return 0;
}
int Yes2SDKData::DeleteAll(lua_State* L) {
    int top = lua_gettop(L);
    Yes2SDK_data_deleteAll();
    assert(top == lua_gettop(L));
    return 0;
}
#endif
