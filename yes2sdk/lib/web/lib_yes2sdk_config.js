var Yes2SDKConfigLib = {

    // Each async call carries the request id minted in C++ and completes through
    // $Yes2SDKBridge (defined in lib_yes2sdk.js), so overlapping calls never share
    // a callback slot. Strings are read before the call returns: the pointers are
    // only valid until then.

    Yes2SDK_config_getFlags: function (optionsJsonPtr, requestId, callback) {
        var options;
        try { options = JSON.parse(UTF8ToString(optionsJsonPtr) || '{}'); }
        catch (e) {
            // Invalid options JSON falls back to no options rather than failing the call.
            options = {};
        }
        Yes2SDKBridge.run(callback, requestId, 'config.getFlagsAsync', function () {
            return [options];
        }, function (result) {
            return JSON.stringify(result || {});
        });
    },

    Yes2SDK_config_isSupported: function () {
        try {
            if (window.Yes2SDK && window.Yes2SDK.config && typeof window.Yes2SDK.config.isSupported === 'function') {
                return window.Yes2SDK.config.isSupported() ? 1 : 0;
            }
        } catch (e) {}
        return 0;
    }
}

autoAddDeps(Yes2SDKConfigLib, '$Yes2SDKBridge');
addToLibrary(Yes2SDKConfigLib);
