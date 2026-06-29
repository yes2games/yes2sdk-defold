var Yes2SDKConfigLib = {

    $Yes2SDKConfigCallbacks: {
        _getFlagsPtr: null,

        allocateString: function (str) {
            return stringToUTF8OnStack(str);
        }
    },

    Yes2SDK_config_getFlags: function (optionsJsonPtr, callback) {
        Yes2SDKConfigCallbacks._getFlagsPtr = callback;
        var options;
        try { options = JSON.parse(UTF8ToString(optionsJsonPtr) || "{}"); }
        catch (e) {
            // Invalid options JSON falls back to no options rather than failing the call.
            options = {};
        }

        if (window.Yes2SDK && window.Yes2SDK.config) {
            try {
                window.Yes2SDK.config.getFlagsAsync(options)
                    .then(function (result) {
                        var json = JSON.stringify(result || {});
                        {{{ makeDynCall("vii", "Yes2SDKConfigCallbacks._getFlagsPtr") }}}(1, Yes2SDKConfigCallbacks.allocateString(json));
                    })
                    .catch(function (err) {
                        var msg = typeof err === 'object' ? JSON.stringify(err) : String(err);
                        {{{ makeDynCall("vii", "Yes2SDKConfigCallbacks._getFlagsPtr") }}}(0, Yes2SDKConfigCallbacks.allocateString(msg));
                    });
            } catch (e) {
                // Synchronous throw (e.g. method missing on this platform) never reaches .catch — route it here so the Lua callback still fires.
                {{{ makeDynCall("vii", "Yes2SDKConfigCallbacks._getFlagsPtr") }}}(0, Yes2SDKConfigCallbacks.allocateString(typeof e === 'object' ? JSON.stringify(e) : String(e)));
            }
        } else {
            {{{ makeDynCall("vii", "Yes2SDKConfigCallbacks._getFlagsPtr") }}}(0, Yes2SDKConfigCallbacks.allocateString("SDK not initialized"));
        }
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

autoAddDeps(Yes2SDKConfigLib, '$Yes2SDKConfigCallbacks');
addToLibrary(Yes2SDKConfigLib);
