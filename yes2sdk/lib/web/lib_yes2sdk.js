var Yes2SDKLib = {

    $Yes2SDKUtils: {
        allocateString: function (str) {
            return stringToUTF8OnStack(str);
        },
        // Persistent callback pointers for lifecycle events. Each is stored
        // here once when the Lua side calls the corresponding on_* function;
        // we then subscribe via Yes2SDK.on(...) and trampoline every event
        // through the saved pointer for the lifetime of the session.
        _onPausePtr: null,
        _onResumePtr: null,
        _onAudioEnabledChangePtr: null,
        _pauseWired: false,
        _resumeWired: false,
        _audioWired: false
    },

    Yes2SDK_initializeAsync: function (callback) {
        if (window.Yes2SDK && window.Yes2SDK.initializeAsync) {
            window.Yes2SDK.initializeAsync()
                .then(function () {
                    {{{ makeDynCall("vii", "callback") }}}(1, 0);
                })
                .catch(function (error) {
                    var msg = typeof error === 'object' ? JSON.stringify(error) : String(error);
                    {{{ makeDynCall("vii", "callback") }}}(0, Yes2SDKUtils.allocateString(msg));
                });
        } else {
            {{{ makeDynCall("vii", "callback") }}}(0, Yes2SDKUtils.allocateString("Yes2SDK not loaded"));
        }
    },

    Yes2SDK_startGameAsync: function (callback) {
        if (window.Yes2SDK && window.Yes2SDK.startGameAsync) {
            window.Yes2SDK.startGameAsync()
                .then(function () {
                    {{{ makeDynCall("vii", "callback") }}}(1, 0);
                })
                .catch(function (error) {
                    var msg = typeof error === 'object' ? JSON.stringify(error) : String(error);
                    {{{ makeDynCall("vii", "callback") }}}(0, Yes2SDKUtils.allocateString(msg));
                });
        } else {
            {{{ makeDynCall("vii", "callback") }}}(0, Yes2SDKUtils.allocateString("Yes2SDK not loaded"));
        }
    },

    Yes2SDK_setLoadingProgress: function (progress) {
        if (window.Yes2SDK) {
            window.Yes2SDK.setLoadingProgress(progress);
        }
    },

    Yes2SDK_getPlatform: function () {
        var platform = (window.Yes2SDK && window.Yes2SDK.getPlatform) ? window.Yes2SDK.getPlatform() : "unknown";
        return Yes2SDKUtils.allocateString(platform || "unknown");
    },

    Yes2SDK_onPause: function (callback) {
        Yes2SDKUtils._onPausePtr = callback;
        if (Yes2SDKUtils._pauseWired) return;
        if (window.Yes2SDK && typeof window.Yes2SDK.on === 'function') {
            window.Yes2SDK.on("pause", function () {
                if (Yes2SDKUtils._onPausePtr) {
                    {{{ makeDynCall("v", "Yes2SDKUtils._onPausePtr") }}}();
                }
            });
            Yes2SDKUtils._pauseWired = true;
        } else {
            console.warn("[Yes2SDK] on_pause registered before Yes2SDK.on is available — call M.on_pause after M.initialize completes.");
        }
    },

    Yes2SDK_onResume: function (callback) {
        Yes2SDKUtils._onResumePtr = callback;
        if (Yes2SDKUtils._resumeWired) return;
        if (window.Yes2SDK && typeof window.Yes2SDK.on === 'function') {
            window.Yes2SDK.on("resume", function () {
                if (Yes2SDKUtils._onResumePtr) {
                    {{{ makeDynCall("v", "Yes2SDKUtils._onResumePtr") }}}();
                }
            });
            Yes2SDKUtils._resumeWired = true;
        } else {
            console.warn("[Yes2SDK] on_resume registered before Yes2SDK.on is available — call M.on_resume after M.initialize completes.");
        }
    },

    Yes2SDK_onAudioEnabledChange: function (callback) {
        Yes2SDKUtils._onAudioEnabledChangePtr = callback;
        if (Yes2SDKUtils._audioWired) return;
        if (window.Yes2SDK && typeof window.Yes2SDK.on === 'function') {
            window.Yes2SDK.on("audioEnabledChange", function (data) {
                if (Yes2SDKUtils._onAudioEnabledChangePtr) {
                    var enabled = (data && data.enabled) ? 1 : 0;
                    {{{ makeDynCall("vi", "Yes2SDKUtils._onAudioEnabledChangePtr") }}}(enabled);
                }
            });
            Yes2SDKUtils._audioWired = true;
        } else {
            console.warn("[Yes2SDK] on_audio_enabled_change registered before Yes2SDK.on is available — call M.on_audio_enabled_change after M.initialize completes.");
        }
    }
}

autoAddDeps(Yes2SDKLib, '$Yes2SDKUtils');
addToLibrary(Yes2SDKLib);
