#include "yes2sdk_player.h"
#include "yes2sdk_requests.h"
#include "luautils.h"
#if defined(DM_PLATFORM_HTML5)
// Every async call registers its own request (callback + script instance) and passes
// the id through the JS bridge, so overlapping calls each complete their own callback.
// Register comes after the argument checks so a bad argument cannot leak a request.
int Yes2SDKPlayer::GetName(lua_State* L) {
    const char* name = Yes2SDK_player_getName();
    lua_pushstring(L, name ? name : "Player");
    return 1;
}
int Yes2SDKPlayer::GetId(lua_State* L) {
    const char* id = Yes2SDK_player_getId();
    lua_pushstring(L, id ? id : "");
    return 1;
}
int Yes2SDKPlayer::GetData(lua_State* L) {
    const char* keysJson = luaL_checkstring(L, 1);
    int id = Yes2SDKRequests::Register(L, 2, "player_get_data");
    Yes2SDK_player_getData(keysJson, id, Yes2SDKRequests::Complete);
    return 0;
}
int Yes2SDKPlayer::SetData(lua_State* L) {
    const char* dataJson = luaL_checkstring(L, 1);
    int id = Yes2SDKRequests::Register(L, 2, "player_set_data");
    Yes2SDK_player_setData(dataJson, id, Yes2SDKRequests::Complete);
    return 0;
}
int Yes2SDKPlayer::FlushData(lua_State* L) {
    int id = Yes2SDKRequests::Register(L, 1, "player_flush_data");
    Yes2SDK_player_flushData(id, Yes2SDKRequests::Complete);
    return 0;
}
int Yes2SDKPlayer::GetUniqueId(lua_State* L) {
    int id = Yes2SDKRequests::Register(L, 1, "player_get_unique_id");
    Yes2SDK_player_getUniqueId(id, Yes2SDKRequests::Complete);
    return 0;
}
int Yes2SDKPlayer::GetIdsPerGame(lua_State* L) {
    int id = Yes2SDKRequests::Register(L, 1, "player_get_ids_per_game");
    Yes2SDK_player_getIdsPerGame(id, Yes2SDKRequests::Complete);
    return 0;
}
int Yes2SDKPlayer::GetPayingStatus(lua_State* L) {
    int id = Yes2SDKRequests::Register(L, 1, "player_get_paying_status");
    Yes2SDK_player_getPayingStatus(id, Yes2SDKRequests::Complete);
    return 0;
}
int Yes2SDKPlayer::GetMode(lua_State* L) {
    int id = Yes2SDKRequests::Register(L, 1, "player_get_mode");
    Yes2SDK_player_getMode(id, Yes2SDKRequests::Complete);
    return 0;
}
int Yes2SDKPlayer::GetPhoto(lua_State* L) {
    const char* size = luaL_optstring(L, 1, "medium");
    int id = Yes2SDKRequests::Register(L, 2, "player_get_photo");
    Yes2SDK_player_getPhoto(size, id, Yes2SDKRequests::Complete);
    return 0;
}
int Yes2SDKPlayer::GetSignedInfo(lua_State* L) {
    // payload is optional: accept a string or nil/none.
    const char* payload = luaL_optstring(L, 1, "");
    int id = Yes2SDKRequests::Register(L, 2, "player_get_signed_info");
    Yes2SDK_player_getSignedInfo(payload, id, Yes2SDKRequests::Complete);
    return 0;
}
int Yes2SDKPlayer::IsDataSupported(lua_State* L) {
    lua_pushboolean(L, Yes2SDK_player_isDataSupported());
    return 1;
}
int Yes2SDKPlayer::GetBotAvatar(lua_State* L) {
    const char* username = luaL_checkstring(L, 1);
    const char* size = luaL_optstring(L, 2, "medium");
    int id = Yes2SDKRequests::Register(L, 3, "player_get_bot_avatar");
    Yes2SDK_player_getBotAvatar(username, size, id, Yes2SDKRequests::Complete);
    return 0;
}
int Yes2SDKPlayer::IsBotAvatarSupported(lua_State* L) {
    lua_pushboolean(L, Yes2SDK_player_isBotAvatarSupported());
    return 1;
}
#endif
