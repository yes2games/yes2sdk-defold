#include "yes2sdk_auth.h"
#include "luautils.h"
#if defined(DM_PLATFORM_HTML5)
lua_Listener onSignInListener;

void Yes2SDKAuth::OnSignIn(const int success, const char* error) {
    lua_State* L = onSignInListener.m_L;
    int top = lua_gettop(L);
    lua_pushlistener(L, onSignInListener);
    lua_pushboolean(L, success);
    lua_pushstring(L, error);
    int ret = lua_pcall(L, 3, 0, 0);
    if (ret != 0) { lua_pop(L, 1); }
    assert(top == lua_gettop(L));
}
int Yes2SDKAuth::IsAuthenticated(lua_State* L) {
    lua_pushboolean(L, Yes2SDK_auth_isAuthenticated());
    return 1;
}
int Yes2SDKAuth::SignIn(lua_State* L) {
    luaL_checklistener(L, 1, onSignInListener);
    Yes2SDK_auth_signIn(Yes2SDKAuth::OnSignIn);
    return 0;
}
#endif
