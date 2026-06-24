#include "yes2sdk_config.h"
#include "luautils.h"
#if defined(DM_PLATFORM_HTML5)
lua_Listener onConfigGetFlagsListener;

void Yes2SDKConfig::OnGetFlags(const int success, const char* result) {
    lua_State* L = onConfigGetFlagsListener.m_L;
    if (!L) return;
    int top = lua_gettop(L);
    lua_pushlistener(L, onConfigGetFlagsListener);
    lua_pushboolean(L, success);
    if (result) { lua_pushstring(L, result); } else { lua_pushnil(L); }
    int ret = lua_pcall(L, 3, 0, 0);
    if (ret != 0) { lua_pop(L, 1); }
    assert(top == lua_gettop(L));
}
int Yes2SDKConfig::GetFlags(lua_State* L) {
    const char* optionsJson = luaL_checkstring(L, 1);
    luaL_checklistener(L, 2, onConfigGetFlagsListener);
    Yes2SDK_config_getFlags(optionsJson, Yes2SDKConfig::OnGetFlags);
    return 0;
}
int Yes2SDKConfig::IsSupported(lua_State* L) {
    lua_pushboolean(L, Yes2SDK_config_isSupported());
    return 1;
}
#endif
