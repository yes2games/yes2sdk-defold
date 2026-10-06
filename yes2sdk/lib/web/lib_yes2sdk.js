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

        // Calls a (success, payload) callback that is not routed by request id
        // (initialize, start_game) with the same stack discipline as complete:
        // these also run from promise callbacks, outside any wasm frame.
        completeUnrouted: function (cb, success, payload) {
            var sp = stackSave();
            try {
                var ptr = (payload === null || payload === undefined) ? 0 : stringToUTF8OnStack(String(payload));
                {{{ makeDynCall("vii", "cb") }}}(success ? 1 : 0, ptr);
            } finally {
                stackRestore(sp);
            }
        },

        // The failure payload handed to Lua, and the one place that builds it:
        // {"code":"...","message":"...","context":"..."}, always all three keys,
        // all strings. code is the error's own code when it carries a non-empty
        // string one, else fallbackCode (else UNKNOWN_ERROR). message is the
        // error's string message, String(err) for a primitive, else a generic
        // text. context is the error's string context, else the bridge context.
        // Every other field (originalError included) is dropped. Never throws.
        errorJson: function (err, fallbackCode, context) {
            var code = (typeof fallbackCode === 'string' && fallbackCode !== '') ? fallbackCode : 'UNKNOWN_ERROR';
            var message = 'Unknown error';
            var where = typeof context === 'string' ? context : '';
            var read = function (key) {
                try {
                    var value = err[key];
                    return typeof value === 'string' ? value : null;
                } catch (e) {
                    return null;
                }
            };
            try {
                if (err !== null && (typeof err === 'object' || typeof err === 'function')) {
                    var ownCode = read('code');
                    var ownMessage = read('message');
                    var ownContext = read('context');
                    if (ownCode) code = ownCode;
                    if (ownMessage !== null) message = ownMessage;
                    if (ownContext !== null) where = ownContext;
                } else {
                    message = String(err);
                }
            } catch (e) {}
            try {
                return JSON.stringify({ code: code, message: message, context: where });
            } catch (e2) {}
            return '{"code":"UNKNOWN_ERROR","message":"Unknown error","context":""}';
        },

        // Calls window.Yes2SDK[module][method] for context "module.method" with the
        // module as `this`, and completes request `id` exactly once. Every failure
        // payload comes from errorJson:
        // - SDK or module missing: NOT_INITIALIZED.
        // - method missing: FEATURE_NOT_SUPPORTED.
        // - getArgs throws, sync throw or rejection: the error's own code, else
        //   UNKNOWN_ERROR.
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
            var fail = function (err, fallbackCode) {
                finish(false, Yes2SDKBridge.errorJson(err, fallbackCode || 'UNKNOWN_ERROR', context));
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
                        fail(context + ' is not supported by this SDK version', 'FEATURE_NOT_SUPPORTED');
                        return;
                    }
                    var args = getArgs ? getArgs() : [];
                    result = mod[methodName].apply(mod, args);
                }
            } catch (e) {
                fail(e);
                return;
            }
            if (!mod) {
                fail('SDK not initialized', 'NOT_INITIALIZED');
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
        _onExitRequestedPtr: null,
        _onAudioEnabledChangePtr: null,
        _onAccountDialogOpenPtr: null,
        _onAccountDialogClosePtr: null,
        _pauseWired: false,
        _resumeWired: false,
        _exitRequestedWired: false,
        _audioWired: false,
        _accountDialogOpenWired: false,
        _accountDialogCloseWired: false,

        // Minimum injected Core runtime this wrapper build is compatible with.
        // Distinct from the wrapper's own version (yes2sdk.cpp VERSION): this is the
        // oldest Yes2SDK runtime this build supports.
        REQUIRED_CORE_VERSION: '2.10.0',

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

    Yes2SDK_initializeAsync__deps: ['$Yes2SDKBridge'],
    Yes2SDK_initializeAsync: function (callback) {
        // Failures carry the errorJson payload. They usually arrive from a promise
        // callback, so completeUnrouted gives the payload's stack bytes back.
        var fail = function (err, fallbackCode) {
            Yes2SDKBridge.completeUnrouted(callback, false,
                Yes2SDKBridge.errorJson(err, fallbackCode, 'initializeAsync'));
        };
        var sdk = window.Yes2SDK;
        if (!sdk || typeof sdk.initializeAsync !== 'function') {
            fail('Yes2SDK not loaded', 'NOT_INITIALIZED');
            return;
        }
        Yes2SDKUtils.checkCoreVersion();
        var result;
        try {
            result = sdk.initializeAsync();
        } catch (e) {
            fail(e, 'UNKNOWN_ERROR');
            return;
        }
        Promise.resolve(result).then(function () {
            Yes2SDKBridge.completeUnrouted(callback, true, null);
        }, function (error) {
            fail(error, 'UNKNOWN_ERROR');
        });
    },

    Yes2SDK_startGameAsync__deps: ['$Yes2SDKBridge'],
    Yes2SDK_startGameAsync: function (callback) {
        // Failures carry the errorJson payload. They usually arrive from a promise
        // callback, so completeUnrouted gives the payload's stack bytes back.
        var fail = function (err, fallbackCode) {
            Yes2SDKBridge.completeUnrouted(callback, false,
                Yes2SDKBridge.errorJson(err, fallbackCode, 'startGameAsync'));
        };
        var sdk = window.Yes2SDK;
        if (!sdk || typeof sdk.startGameAsync !== 'function') {
            fail('Yes2SDK not loaded', 'NOT_INITIALIZED');
            return;
        }
        var result;
        try {
            result = sdk.startGameAsync();
        } catch (e) {
            fail(e, 'UNKNOWN_ERROR');
            return;
        }
        Promise.resolve(result).then(function () {
            Yes2SDKBridge.completeUnrouted(callback, true, null);
        }, function (error) {
            fail(error, 'UNKNOWN_ERROR');
        });
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

    // Exit request: the player has not confirmed leaving yet. The handler runs
    // synchronously end to end (no timer, no router) so the game's saves finish
    // before the SDK flushes player data.
    Yes2SDK_onExitRequested: function (callback) {
        Yes2SDKUtils._onExitRequestedPtr = callback;
        if (Yes2SDKUtils._exitRequestedWired) return;
        if (window.Yes2SDK && typeof window.Yes2SDK.on === 'function') {
            window.Yes2SDK.on("exitRequested", function () {
                if (Yes2SDKUtils._onExitRequestedPtr) {
                    {{{ makeDynCall("v", "Yes2SDKUtils._onExitRequestedPtr") }}}();
                }
            });
            Yes2SDKUtils._exitRequestedWired = true;
        } else {
            console.warn("[Yes2SDK] on_exit_requested registered before Yes2SDK.on is available, call M.on_exit_requested after M.initialize completes.");
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
