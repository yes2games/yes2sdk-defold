#include "yes2sdk_game.h"
#include "luautils.h"
#if defined(DM_PLATFORM_HTML5)
lua_Listener onInviteLinkListener;

void Yes2SDKGame::OnInviteLink(const int success, const char* result) {
    lua_State* L = onInviteLinkListener.m_L;
    int top = lua_gettop(L);
    lua_pushlistener(L, onInviteLinkListener);
    lua_pushboolean(L, success);
    lua_pushstring(L, result);
    int ret = lua_pcall(L, 3, 0, 0);
    if (ret != 0) { lua_pop(L, 1); }
    assert(top == lua_gettop(L));
}
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
    luaL_checklistener(L, 2, onInviteLinkListener);
    Yes2SDK_game_inviteLink(paramsJson, Yes2SDKGame::OnInviteLink);
    return 0;
}
#endif
