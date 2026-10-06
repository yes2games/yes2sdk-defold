var Yes2SDKContextLib = {

    // Image sharing. Completes through $Yes2SDKBridge with the request id minted
    // in C++. The options string is read before the call returns: the pointer is
    // only valid until then.

    Yes2SDK_context_share: function (optionsPtr, requestId, callback) {
        var options;
        try {
            var text = UTF8ToString(optionsPtr);
            options = text ? JSON.parse(text) : {};
            if (options === null || typeof options !== 'object' || Array.isArray(options)) {
                throw new Error('options must be a JSON object');
            }
        } catch (e) {
            // Invalid input fails without calling the SDK, even when it is missing.
            Yes2SDKBridge.complete(callback, requestId, false,
                Yes2SDKBridge.errorJson("Invalid options: " + String(e), 'INVALID_PARAM', 'context.shareAsync'));
            return;
        }
        if (!options.intent) options.intent = 'SHARE';
        // shareAsync resolves void: report success with no payload.
        Yes2SDKBridge.run(callback, requestId, 'context.shareAsync', function () {
            return [options];
        }, function () {
            return null;
        });
    },

    Yes2SDK_context_isSupported: function () {
        try {
            if (window.Yes2SDK && window.Yes2SDK.context && typeof window.Yes2SDK.context.isSupported === 'function') {
                return window.Yes2SDK.context.isSupported() ? 1 : 0;
            }
        } catch (e) {}
        return 0;
    }
}

autoAddDeps(Yes2SDKContextLib, '$Yes2SDKBridge');
addToLibrary(Yes2SDKContextLib);
