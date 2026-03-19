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
private:
    static void OnGetData(const int success, const char* data);
    static void OnSetData(const int success, const char* error);
};
extern "C" {
    const char* Yes2SDK_player_getName();
    const char* Yes2SDK_player_getId();
    void Yes2SDK_player_getData(const char* keysJson, Yes2SDKPlayer::OnDataCallback callback);
    void Yes2SDK_player_setData(const char* dataJson, Yes2SDKPlayer::OnDataCallback callback);
}
#endif
