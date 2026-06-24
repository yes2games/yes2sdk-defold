#include "yes2sdk_player.h"
#include "luautils.h"
#if defined(DM_PLATFORM_HTML5)
lua_Listener onGetDataListener;
lua_Listener onSetDataListener;
lua_Listener onGetUniqueIdListener;
lua_Listener onGetIdsPerGameListener;
lua_Listener onGetPayingStatusListener;
lua_Listener onGetModeListener;
lua_Listener onGetPhotoListener;

void Yes2SDKPlayer::OnGetData(const int success, const char* data) {
    lua_State* L = onGetDataListener.m_L;
    if (!L) return;
    int top = lua_gettop(L);
    lua_pushlistener(L, onGetDataListener);
    lua_pushboolean(L, success);
    if (data) { lua_pushstring(L, data); } else { lua_pushnil(L); }
    int ret = lua_pcall(L, 3, 0, 0);
    if (ret != 0) { lua_pop(L, 1); }
    assert(top == lua_gettop(L));
}
void Yes2SDKPlayer::OnSetData(const int success, const char* error) {
    lua_State* L = onSetDataListener.m_L;
    if (!L) return;
    int top = lua_gettop(L);
    lua_pushlistener(L, onSetDataListener);
    lua_pushboolean(L, success);
    if (error) { lua_pushstring(L, error); } else { lua_pushnil(L); }
    int ret = lua_pcall(L, 3, 0, 0);
    if (ret != 0) { lua_pop(L, 1); }
    assert(top == lua_gettop(L));
}
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
    luaL_checklistener(L, 2, onGetDataListener);
    Yes2SDK_player_getData(keysJson, Yes2SDKPlayer::OnGetData);
    return 0;
}
int Yes2SDKPlayer::SetData(lua_State* L) {
    const char* dataJson = luaL_checkstring(L, 1);
    luaL_checklistener(L, 2, onSetDataListener);
    Yes2SDK_player_setData(dataJson, Yes2SDKPlayer::OnSetData);
    return 0;
}
void Yes2SDKPlayer::OnGetUniqueId(const int success, const char* result) {
    lua_State* L = onGetUniqueIdListener.m_L;
    if (!L) return;
    int top = lua_gettop(L);
    lua_pushlistener(L, onGetUniqueIdListener);
    lua_pushboolean(L, success);
    if (result) { lua_pushstring(L, result); } else { lua_pushnil(L); }
    int ret = lua_pcall(L, 3, 0, 0);
    if (ret != 0) { lua_pop(L, 1); }
    assert(top == lua_gettop(L));
}
void Yes2SDKPlayer::OnGetIdsPerGame(const int success, const char* result) {
    lua_State* L = onGetIdsPerGameListener.m_L;
    if (!L) return;
    int top = lua_gettop(L);
    lua_pushlistener(L, onGetIdsPerGameListener);
    lua_pushboolean(L, success);
    if (result) { lua_pushstring(L, result); } else { lua_pushnil(L); }
    int ret = lua_pcall(L, 3, 0, 0);
    if (ret != 0) { lua_pop(L, 1); }
    assert(top == lua_gettop(L));
}
void Yes2SDKPlayer::OnGetPayingStatus(const int success, const char* result) {
    lua_State* L = onGetPayingStatusListener.m_L;
    if (!L) return;
    int top = lua_gettop(L);
    lua_pushlistener(L, onGetPayingStatusListener);
    lua_pushboolean(L, success);
    if (result) { lua_pushstring(L, result); } else { lua_pushnil(L); }
    int ret = lua_pcall(L, 3, 0, 0);
    if (ret != 0) { lua_pop(L, 1); }
    assert(top == lua_gettop(L));
}
void Yes2SDKPlayer::OnGetMode(const int success, const char* result) {
    lua_State* L = onGetModeListener.m_L;
    if (!L) return;
    int top = lua_gettop(L);
    lua_pushlistener(L, onGetModeListener);
    lua_pushboolean(L, success);
    if (result) { lua_pushstring(L, result); } else { lua_pushnil(L); }
    int ret = lua_pcall(L, 3, 0, 0);
    if (ret != 0) { lua_pop(L, 1); }
    assert(top == lua_gettop(L));
}
void Yes2SDKPlayer::OnGetPhoto(const int success, const char* result) {
    lua_State* L = onGetPhotoListener.m_L;
    if (!L) return;
    int top = lua_gettop(L);
    lua_pushlistener(L, onGetPhotoListener);
    lua_pushboolean(L, success);
    if (result) { lua_pushstring(L, result); } else { lua_pushnil(L); }
    int ret = lua_pcall(L, 3, 0, 0);
    if (ret != 0) { lua_pop(L, 1); }
    assert(top == lua_gettop(L));
}
int Yes2SDKPlayer::GetUniqueId(lua_State* L) {
    luaL_checklistener(L, 1, onGetUniqueIdListener);
    Yes2SDK_player_getUniqueId(Yes2SDKPlayer::OnGetUniqueId);
    return 0;
}
int Yes2SDKPlayer::GetIdsPerGame(lua_State* L) {
    luaL_checklistener(L, 1, onGetIdsPerGameListener);
    Yes2SDK_player_getIdsPerGame(Yes2SDKPlayer::OnGetIdsPerGame);
    return 0;
}
int Yes2SDKPlayer::GetPayingStatus(lua_State* L) {
    luaL_checklistener(L, 1, onGetPayingStatusListener);
    Yes2SDK_player_getPayingStatus(Yes2SDKPlayer::OnGetPayingStatus);
    return 0;
}
int Yes2SDKPlayer::GetMode(lua_State* L) {
    luaL_checklistener(L, 1, onGetModeListener);
    Yes2SDK_player_getMode(Yes2SDKPlayer::OnGetMode);
    return 0;
}
int Yes2SDKPlayer::GetPhoto(lua_State* L) {
    const char* size = luaL_checkstring(L, 1);
    luaL_checklistener(L, 2, onGetPhotoListener);
    Yes2SDK_player_getPhoto(size, Yes2SDKPlayer::OnGetPhoto);
    return 0;
}
#endif
