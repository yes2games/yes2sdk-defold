#pragma once

#include <dmsdk/sdk.h>

#if defined(DM_PLATFORM_HTML5)

class Yes2SDK
{
public:
    typedef void (*OnInitializeCallback)(const int success, const char* error);
    typedef void (*OnStartGameCallback)(const int success, const char* error);
    // Lifecycle event callbacks — fire whenever the platform signals pause /
    // resume / audio mute changes. Required for YouTube Playables certification
    // (integration #14, #21, #22). The same callback is invoked on every event.
    typedef void (*OnPauseCallback)();
    typedef void (*OnResumeCallback)();
    typedef void (*OnAudioEnabledChangeCallback)(const int enabled);
    // Yandex account-selection dialog open / close. No payload, mirroring
    // pause / resume — fire whenever the platform opens or closes the dialog.
    typedef void (*OnAccountDialogOpenCallback)();
    typedef void (*OnAccountDialogCloseCallback)();

    static int InitializeAsync(lua_State* L);
    static int StartGameAsync(lua_State* L);
    static int SetLoadingProgress(lua_State* L);
    static int GetPlatform(lua_State* L);
    static int OnPause(lua_State* L);
    static int OnResume(lua_State* L);
    static int OnAudioEnabledChange(lua_State* L);
    static int OnAccountDialogOpen(lua_State* L);
    static int OnAccountDialogClose(lua_State* L);

private:
    static void OnInitialize(const int success, const char* error);
    static void OnStartGame(const int success, const char* error);
    static void OnPauseFromJs();
    static void OnResumeFromJs();
    static void OnAudioEnabledChangeFromJs(const int enabled);
    static void OnAccountDialogOpenFromJs();
    static void OnAccountDialogCloseFromJs();
};

extern "C"
{
    void Yes2SDK_initializeAsync(Yes2SDK::OnInitializeCallback callback);
    void Yes2SDK_startGameAsync(Yes2SDK::OnStartGameCallback callback);
    void Yes2SDK_setLoadingProgress(int progress);
    const char* Yes2SDK_getPlatform();
    void Yes2SDK_onPause(Yes2SDK::OnPauseCallback callback);
    void Yes2SDK_onResume(Yes2SDK::OnResumeCallback callback);
    void Yes2SDK_onAudioEnabledChange(Yes2SDK::OnAudioEnabledChangeCallback callback);
    void Yes2SDK_onAccountDialogOpen(Yes2SDK::OnAccountDialogOpenCallback callback);
    void Yes2SDK_onAccountDialogClose(Yes2SDK::OnAccountDialogCloseCallback callback);
}

#endif
