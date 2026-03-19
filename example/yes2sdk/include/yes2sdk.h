#pragma once

#include <dmsdk/sdk.h>

#if defined(DM_PLATFORM_HTML5)

class Yes2SDK
{
public:
    typedef void (*OnInitializeCallback)(const int success, const char* error);
    typedef void (*OnStartGameCallback)(const int success, const char* error);

    static int InitializeAsync(lua_State* L);
    static int StartGameAsync(lua_State* L);
    static int SetLoadingProgress(lua_State* L);
    static int GetPlatform(lua_State* L);

private:
    static void OnInitialize(const int success, const char* error);
    static void OnStartGame(const int success, const char* error);
};

extern "C"
{
    void Yes2SDK_initializeAsync(Yes2SDK::OnInitializeCallback callback);
    void Yes2SDK_startGameAsync(Yes2SDK::OnStartGameCallback callback);
    void Yes2SDK_setLoadingProgress(int progress);
    const char* Yes2SDK_getPlatform();
}

#endif
