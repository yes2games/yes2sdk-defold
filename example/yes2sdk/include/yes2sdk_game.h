#pragma once
#include <dmsdk/sdk.h>
#if defined(DM_PLATFORM_HTML5)
class Yes2SDKGame {
public:
    typedef void (*OnInviteLinkCallback)(const int success, const char* result);
    static int HappyTime(lua_State* L);
    static int GetSettings(lua_State* L);
    static int CopyToClipboard(lua_State* L);
    static int InviteLink(lua_State* L);
private:
    static void OnInviteLink(const int success, const char* result);
};
extern "C" {
    void Yes2SDK_game_happyTime();
    const char* Yes2SDK_game_getSettings();
    void Yes2SDK_game_copyToClipboard(const char* text);
    void Yes2SDK_game_inviteLink(const char* paramsJson, Yes2SDKGame::OnInviteLinkCallback callback);
}
#endif
