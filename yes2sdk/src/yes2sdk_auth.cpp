#include "yes2sdk_auth.h"
#include "yes2sdk_requests.h"
#if defined(DM_PLATFORM_HTML5)
#include <string.h>

int Yes2SDKAuth::IsAuthenticated(lua_State* L) {
    lua_pushboolean(L, Yes2SDK_auth_isAuthenticated());
    return 1;
}
int Yes2SDKAuth::SignIn(lua_State* L) {
    int id = Yes2SDKRequests::Register(L, 1, "auth_sign_in");
    Yes2SDK_auth_signIn(id, Yes2SDKRequests::Complete);
    return 0;
}
int Yes2SDKAuth::IsSupported(lua_State* L) {
    lua_pushboolean(L, Yes2SDK_auth_isSupported());
    return 1;
}

// auth_show_registration_prompt(options_json_or_nil, on_close_fn) -> result JSON string.
// on_close_fn is routed: it is called once when the prompt closes. When the result
// is not a handle the prompt never opened, so the request is cancelled here.
int Yes2SDKAuth::ShowRegistrationPrompt(lua_State* L) {
    int top = lua_gettop(L);
    const char* options = lua_isnoneornil(L, 1) ? 0 : luaL_checkstring(L, 1);
    int id = Yes2SDKRequests::Register(L, 2, "auth_show_registration_prompt");
    const char* result = Yes2SDK_auth_showRegistrationPrompt(options, id, Yes2SDKRequests::Complete);
    static const char HANDLE_PREFIX[] = "{\"handle\":";
    bool opened = result != 0 && strncmp(result, HANDLE_PREFIX, sizeof(HANDLE_PREFIX) - 1) == 0;
    // Push before cancelling: the result lives on the stack of this frame.
    if (result) {
        lua_pushstring(L, result);
    } else {
        lua_pushstring(L, "{\"error\":{\"code\":\"UNKNOWN_ERROR\",\"message\":\"no result\",\"context\":\"auth.showRegistrationPrompt\"}}");
    }
    if (!opened) {
        Yes2SDKRequests::Cancel(id);
    }
    assert(top + 1 == lua_gettop(L));
    return 1;
}
int Yes2SDKAuth::RegistrationPromptLogin(lua_State* L) {
    int handle = luaL_checkinteger(L, 1);
    lua_pushboolean(L, Yes2SDK_auth_registrationPromptLogin(handle));
    return 1;
}
int Yes2SDKAuth::RegistrationPromptClose(lua_State* L) {
    int handle = luaL_checkinteger(L, 1);
    lua_pushboolean(L, Yes2SDK_auth_registrationPromptClose(handle));
    return 1;
}
#endif
