#pragma once
#include <dmsdk/sdk.h>
#if defined(DM_PLATFORM_HTML5)
class Yes2SDKAuth {
public:
    typedef void (*OnSignInCallback)(const int success, const char* error);
    static int IsAuthenticated(lua_State* L);
    static int SignIn(lua_State* L);
private:
    static void OnSignIn(const int success, const char* error);
};
extern "C" {
    int Yes2SDK_auth_isAuthenticated();
    void Yes2SDK_auth_signIn(Yes2SDKAuth::OnSignInCallback callback);
}
#endif
