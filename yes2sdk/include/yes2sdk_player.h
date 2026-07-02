#pragma once
#include <dmsdk/sdk.h>
#if defined(DM_PLATFORM_HTML5)
class Yes2SDKPlayer {
public:
    typedef void (*OnDataCallback)(const int success, const char* data);
    static int GetName(lua_State* L);
    static int GetId(lua_State* L);
    static int GetData(lua_State* L);
    static int SetData(lua_State* L);
    static int GetUniqueId(lua_State* L);
    static int GetIdsPerGame(lua_State* L);
    static int GetPayingStatus(lua_State* L);
    static int GetMode(lua_State* L);
    static int GetPhoto(lua_State* L);
    static int GetSignedInfo(lua_State* L);
    static int IsDataSupported(lua_State* L);
private:
    static void OnGetData(const int success, const char* data);
    static void OnSetData(const int success, const char* error);
    static void OnGetUniqueId(const int success, const char* result);
    static void OnGetIdsPerGame(const int success, const char* result);
    static void OnGetPayingStatus(const int success, const char* result);
    static void OnGetMode(const int success, const char* result);
    static void OnGetPhoto(const int success, const char* result);
    static void OnGetSignedInfo(const int success, const char* result);
};
extern "C" {
    const char* Yes2SDK_player_getName();
    const char* Yes2SDK_player_getId();
    void Yes2SDK_player_getData(const char* keysJson, Yes2SDKPlayer::OnDataCallback callback);
    void Yes2SDK_player_setData(const char* dataJson, Yes2SDKPlayer::OnDataCallback callback);
    void Yes2SDK_player_getUniqueId(Yes2SDKPlayer::OnDataCallback callback);
    void Yes2SDK_player_getIdsPerGame(Yes2SDKPlayer::OnDataCallback callback);
    void Yes2SDK_player_getPayingStatus(Yes2SDKPlayer::OnDataCallback callback);
    void Yes2SDK_player_getMode(Yes2SDKPlayer::OnDataCallback callback);
    void Yes2SDK_player_getPhoto(const char* size, Yes2SDKPlayer::OnDataCallback callback);
    void Yes2SDK_player_getSignedInfo(const char* payload, Yes2SDKPlayer::OnDataCallback callback);
    int Yes2SDK_player_isDataSupported();
}
#endif
