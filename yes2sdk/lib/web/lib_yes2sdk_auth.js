var Yes2SDKAuthLib = {

    Yes2SDK_auth_isAuthenticated: function () {
        try {
            if (window.Yes2SDK && window.Yes2SDK.auth) {
                return window.Yes2SDK.auth.isAuthenticated() ? 1 : 0;
            }
        } catch (e) {}
        return 0;
    },

    Yes2SDK_auth_isSupported: function () {
        try {
            if (window.Yes2SDK && window.Yes2SDK.auth && typeof window.Yes2SDK.auth.isSupported === 'function') {
                return window.Yes2SDK.auth.isSupported() ? 1 : 0;
            }
        } catch (e) {}
        return 0;
    },

    Yes2SDK_auth_signIn: function (requestId, callback) {
        // signInAsync resolves with a user object we do not forward: success with no payload.
        Yes2SDKBridge.run(callback, requestId, 'auth.signInAsync', null, function () {
            return null;
        });
    },

    // Open registration prompts, keyed by a handle id handed to Lua.
    // Each entry: { prompt: {login, close}, closed: bool, finish: function }.
    $Yes2SDKAuthPrompts: { next: 1, open: {} },

    // Synchronous. Returns '{"handle":n}' or '{"error":{code,message,context}}'.
    // requestId carries the Lua on_close callback: it completes exactly once
    // (success, nil payload) when the prompt closes. On an error result the id is
    // never completed here; the C++ caller cancels it.
    Yes2SDK_auth_showRegistrationPrompt__deps: ['$Yes2SDKAuthPrompts', '$UTF8ToString', '$stringToUTF8OnStack'],
    Yes2SDK_auth_showRegistrationPrompt: function (optionsJson, requestId, callback) {
        var context = 'auth.showRegistrationPrompt';
        var errorResult = function (err, fallbackCode) {
            return '{"error":' + Yes2SDKBridge.errorJson(err, fallbackCode, context) + '}';
        };
        var out;
        try {
            var text = UTF8ToString(optionsJson);
            var opts = {};
            var parsed = null;
            var parseOk = true;
            if (text) {
                try {
                    parsed = JSON.parse(text);
                } catch (e) {
                    parseOk = false;
                }
                if (!parseOk || parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
                    out = errorResult('options must be a JSON object', 'INVALID_PARAM');
                    return stringToUTF8OnStack(out);
                }
                for (var key in parsed) {
                    if (Object.prototype.hasOwnProperty.call(parsed, key)) opts[key] = parsed[key];
                }
            }
            var sdk = window.Yes2SDK;
            var auth = sdk ? sdk.auth : undefined;
            if (!auth) {
                out = errorResult('SDK not initialized', 'NOT_INITIALIZED');
            } else if (typeof auth.showRegistrationPrompt !== 'function') {
                out = errorResult(context + ' is not supported by this SDK version', 'FEATURE_NOT_SUPPORTED');
            } else {
                var prompts = Yes2SDKAuthPrompts;
                var handle = prompts.next++;
                var entry = { prompt: null, closed: false, finish: null };
                // Completes the router id once and forgets the handle.
                entry.finish = function () {
                    if (entry.closed) return;
                    entry.closed = true;
                    delete prompts.open[handle];
                    Yes2SDKBridge.complete(callback, requestId, true, null);
                };
                opts.onClose = function () {
                    entry.finish();
                };
                var prompt;
                try {
                    prompt = auth.showRegistrationPrompt(opts);
                } catch (e) {
                    entry.closed = true;
                    out = errorResult(e, 'UNKNOWN_ERROR');
                }
                if (out === undefined) {
                    if (!prompt || typeof prompt.login !== 'function' || typeof prompt.close !== 'function') {
                        entry.closed = true;
                        out = errorResult(context + ' returned no prompt handle', 'UNKNOWN_ERROR');
                    } else {
                        entry.prompt = prompt;
                        // onClose may already have fired during the call: the handle is then closed.
                        if (!entry.closed) prompts.open[handle] = entry;
                        out = '{"handle":' + handle + '}';
                    }
                }
            }
        } catch (e2) {
            out = errorResult(e2, 'UNKNOWN_ERROR');
        }
        return stringToUTF8OnStack(out);
    },

    // Starts the platform login flow. The handle stays open. 1 if the handle is open.
    Yes2SDK_auth_registrationPromptLogin__deps: ['$Yes2SDKAuthPrompts'],
    Yes2SDK_auth_registrationPromptLogin: function (handle) {
        var entry = Yes2SDKAuthPrompts.open[handle];
        if (!entry) return 0;
        try {
            entry.prompt.login();
        } catch (e) {
            console.warn('[Yes2SDK] registration prompt login failed:', e);
            return 0;
        }
        return 1;
    },

    // Closes the prompt and frees the handle. on_close fires once: from the
    // platform's onClose, or here if the platform did not call it. 1 if the handle was open.
    Yes2SDK_auth_registrationPromptClose__deps: ['$Yes2SDKAuthPrompts'],
    Yes2SDK_auth_registrationPromptClose: function (handle) {
        var entry = Yes2SDKAuthPrompts.open[handle];
        if (!entry) return 0;
        delete Yes2SDKAuthPrompts.open[handle];
        try {
            entry.prompt.close();
        } catch (e) {
            console.warn('[Yes2SDK] registration prompt close failed:', e);
        }
        entry.finish();
        return 1;
    }
}

autoAddDeps(Yes2SDKAuthLib, '$Yes2SDKBridge');
addToLibrary(Yes2SDKAuthLib);
