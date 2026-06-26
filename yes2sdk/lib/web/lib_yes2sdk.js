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
        _audioWired: false,

        // Minimum injected Core runtime this wrapper build is compatible with.
        // Distinct from the wrapper's own version (yes2sdk.cpp VERSION) — this is the
        // Core floor, matching the dashboard's MIN_CORE_BY_ENGINE for Defold.
        REQUIRED_CORE_VERSION: '2.2.0',

        // Compare two semver strings on major.minor.patch (pre-release/build metadata
        // ignored). Returns 1 if a > b, -1 if a < b, 0 if equal.
        compareSemver: function (a, b) {
            var pa = String(a).split('.');
            var pb = String(b).split('.');
            for (var i = 0; i < 3; i++) {
                var na = parseInt(pa[i], 10) || 0;
                var nb = parseInt(pb[i], 10) || 0;
                if (na > nb) return 1;
                if (na < nb) return -1;
            }
            return 0;
        },

        // Warn (non-blocking) if the injected Core is older than this build requires.
        // Reads Core's OWN version field, which is Core-only: the CrazyGames wrapper
        // exposes a second window.Yes2SDK with no .version, and pre-2.2.0 Core has no
        // getter either — both read as null, meaning "can't verify", NOT a skew.
        checkCoreVersion: function () {
            try {
                var coreVer = (window.Yes2SDK && typeof window.Yes2SDK.version === 'string')
                    ? window.Yes2SDK.version : null;
                if (coreVer === null) return; // CG wrapper or pre-2.2.0 Core — cannot verify, skip
                if (Yes2SDKUtils.compareSemver(coreVer, Yes2SDKUtils.REQUIRED_CORE_VERSION) < 0) {
                    console.warn("[Yes2SDK] Injected Core v" + coreVer +
                        " is older than this build requires (v" + Yes2SDKUtils.REQUIRED_CORE_VERSION +
                        "). Some SDK calls may silently no-op. Update the injected Core runtime.");
                }
            } catch (error) {
                // A version probe must never break init.
                console.warn("[Yes2SDK] Core version check skipped:", error);
            }
        }
    },

    Yes2SDK_initializeAsync: function (callback) {
        if (window.Yes2SDK && window.Yes2SDK.initializeAsync) {
            Yes2SDKUtils.checkCoreVersion();
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
