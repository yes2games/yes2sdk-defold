#pragma once
#include <dmsdk/sdk.h>
#include "yes2sdk_requests.h"
#if defined(DM_PLATFORM_HTML5)
class Yes2SDKAuth {
public:
    static int IsAuthenticated(lua_State* L);
    static int SignIn(lua_State* L);
    static int IsSupported(lua_State* L);
    static int ShowRegistrationPrompt(lua_State* L);
    static int RegistrationPromptLogin(lua_State* L);
    static int RegistrationPromptClose(lua_State* L);
};
extern "C" {
    int Yes2SDK_auth_isAuthenticated();
    void Yes2SDK_auth_signIn(int requestId, Yes2SDKRequests::OnCompleteCallback callback);
    int Yes2SDK_auth_isSupported();
    // Returns '{"handle":n}' or '{"error":{...}}' (stack string, valid until the caller returns).
    const char* Yes2SDK_auth_showRegistrationPrompt(const char* optionsJson, int requestId, Yes2SDKRequests::OnCompleteCallback callback);
    int Yes2SDK_auth_registrationPromptLogin(int handle);
    int Yes2SDK_auth_registrationPromptClose(int handle);
}
#endif
