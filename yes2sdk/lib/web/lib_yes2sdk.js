var Yes2SDKLib = {

    // Shared request bridge. Every async binding that takes (..., requestId, callback)
    // completes through it, so each response reaches the call that made it. Other
    // library files pull it in with __deps: ['$Yes2SDKBridge'].
    $Yes2SDKBridge__deps: ['$stackSave', '$stackRestore', '$stringToUTF8OnStack'],
    $Yes2SDKBridge: {
        // Calls the C++ OnCompleteCallback(int requestId, int success, const char* payload).
        // A null or undefined payload is passed as a null pointer (nil in Lua).
        // Completions usually run from a promise callback, outside any wasm frame, so
        // nothing else would give the payload's stack bytes back: save and restore the
        // stack pointer around the call, or every completion leaks strlen(payload) + 1.
        complete: function (cb, id, success, payload) {
            var sp = stackSave();
            try {
                var ptr = (payload === null || payload === undefined) ? 0 : stringToUTF8OnStack(String(payload));
                {{{ makeDynCall("viii", "cb") }}}(id, success ? 1 : 0, ptr);
            } finally {
                stackRestore(sp);
            }
        },

        // Failure payload handed to Lua. Never throws. The one place to change the
        // error format: objects are JSON encoded, anything else goes through String().
        errorString: function (err, context) {
            if (err !== null && typeof err === 'object') {
                try {
                    var json = JSON.stringify(err);
                    if (typeof json === 'string') return json;
                } catch (e) {}
            }
            try {
                return String(err);
            } catch (e2) {}
            return 'Unknown error in ' + context;
        },

        // Calls window.Yes2SDK[module][method] for context "module.method" with the
        // module as `this`, and completes request `id` exactly once:
        // - SDK or module missing: failure "SDK not initialized".
        // - method missing, getArgs throws, sync throw or rejection: failure errorString(err).
        // - resolution: success with mapResult(value); the default is
        //   JSON.stringify(value === undefined ? null : value). A mapResult returning
        //   null or undefined completes with a nil payload; a throwing one is a failure.
        // getArgs (optional) returns the argument array; it runs inside the try.
        run: function (cb, id, context, getArgs, mapResult) {
            var done = false;
            var finish = function (success, payload) {
                if (done) return;
                done = true;
                Yes2SDKBridge.complete(cb, id, success, payload);
            };
            var fail = function (err) {
                finish(false, Yes2SDKBridge.errorString(err, context));
            };
            var dot = context.indexOf('.');
            var moduleName = context.substring(0, dot);
            var methodName = context.substring(dot + 1);
            var mod;
            var result;
            // The module lookup is inside the try too: a throwing getter on the SDK
            // object must still complete the request.
            try {
                var sdk = window.Yes2SDK;
                mod = sdk ? sdk[moduleName] : undefined;
                if (mod) {
                    if (typeof mod[methodName] !== 'function') {
                        throw context + ' is not a function';
                    }
                    var args = getArgs ? getArgs() : [];
                    result = mod[methodName].apply(mod, args);
                }
            } catch (e) {
                fail(e);
                return;
            }
            if (!mod) {
                finish(false, 'SDK not initialized');
                return;
            }
            Promise.resolve(result).then(function (value) {
                var payload;
                try {
                    payload = mapResult ? mapResult(value) : JSON.stringify(value === undefined ? null : value);
                } catch (e) {
                    fail(e);
                    return;
                }
                finish(true, payload);
            }, fail);
        }
    },

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
        _onAccountDialogOpenPtr: null,
        _onAccountDialogClosePtr: null,
        _pauseWired: false,
        _resumeWired: false,
        _audioWired: false,
        _accountDialogOpenWired: false,
        _accountDialogCloseWired: false,

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
    },

    Yes2SDK_onAccountDialogOpen: function (callback) {
        Yes2SDKUtils._onAccountDialogOpenPtr = callback;
        if (Yes2SDKUtils._accountDialogOpenWired) return;
        if (window.Yes2SDK && typeof window.Yes2SDK.on === 'function') {
            window.Yes2SDK.on("accountDialogOpen", function () {
                if (Yes2SDKUtils._onAccountDialogOpenPtr) {
                    {{{ makeDynCall("v", "Yes2SDKUtils._onAccountDialogOpenPtr") }}}();
                }
            });
            Yes2SDKUtils._accountDialogOpenWired = true;
        } else {
            console.warn("[Yes2SDK] on_account_dialog_open registered before Yes2SDK.on is available — call M.on_account_dialog_open after M.initialize completes.");
        }
    },

    Yes2SDK_onAccountDialogClose: function (callback) {
        Yes2SDKUtils._onAccountDialogClosePtr = callback;
        if (Yes2SDKUtils._accountDialogCloseWired) return;
        if (window.Yes2SDK && typeof window.Yes2SDK.on === 'function') {
            window.Yes2SDK.on("accountDialogClose", function () {
                if (Yes2SDKUtils._onAccountDialogClosePtr) {
                    {{{ makeDynCall("v", "Yes2SDKUtils._onAccountDialogClosePtr") }}}();
                }
            });
            Yes2SDKUtils._accountDialogCloseWired = true;
        } else {
            console.warn("[Yes2SDK] on_account_dialog_close registered before Yes2SDK.on is available — call M.on_account_dialog_close after M.initialize completes.");
        }
    }
}

autoAddDeps(Yes2SDKLib, '$Yes2SDKUtils');
addToLibrary(Yes2SDKLib);
