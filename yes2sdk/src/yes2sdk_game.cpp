#include "yes2sdk_game.h"
#include "yes2sdk_requests.h"
#if defined(DM_PLATFORM_HTML5)

int Yes2SDKGame::HappyTime(lua_State* L) {
    Yes2SDK_game_happyTime();
    return 0;
}
int Yes2SDKGame::GetSettings(lua_State* L) {
    const char* json = Yes2SDK_game_getSettings();
    lua_pushstring(L, json ? json : "{}");
    return 1;
}
int Yes2SDKGame::CopyToClipboard(lua_State* L) {
    const char* text = luaL_checkstring(L, 1);
    Yes2SDK_game_copyToClipboard(text);
    return 0;
}
int Yes2SDKGame::InviteLink(lua_State* L) {
    const char* paramsJson = luaL_checkstring(L, 1);
    int id = Yes2SDKRequests::Register(L, 2, "game_invite_link");
    Yes2SDK_game_inviteLink(paramsJson, id, Yes2SDKRequests::Complete);
    return 0;
}
int Yes2SDKGame::GetServerTime(lua_State* L) {
    int id = Yes2SDKRequests::Register(L, 1, "game_get_server_time");
    Yes2SDK_game_getServerTime(id, Yes2SDKRequests::Complete);
    return 0;
}
#endif
