#include "yes2sdk_player.h"
#include "luautils.h"
#if defined(DM_PLATFORM_HTML5)
lua_Listener onGetDataListener;
lua_Listener onSetDataListener;

void Yes2SDKPlayer::OnGetData(const int success, const char* data) {
    lua_State* L = onGetDataListener.m_L;
    int top = lua_gettop(L);
    lua_pushlistener(L, onGetDataListener);
    lua_pushboolean(L, success);
    lua_pushstring(L, data);
    int ret = lua_pcall(L, 3, 0, 0);
    if (ret != 0) { lua_pop(L, 1); }
    assert(top == lua_gettop(L));
}
void Yes2SDKPlayer::OnSetData(const int success, const char* error) {
    lua_State* L = onSetDataListener.m_L;
    int top = lua_gettop(L);
    lua_pushlistener(L, onSetDataListener);
    lua_pushboolean(L, success);
    lua_pushstring(L, error);
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
#endif
