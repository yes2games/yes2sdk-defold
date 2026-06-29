var Yes2SDKStatsLib = {

    $Yes2SDKStatsCallbacks: {
        _getPtr: null,
        _setPtr: null,
        _incrementPtr: null,

        allocateString: function (str) {
            return stringToUTF8OnStack(str);
        }
    },

    Yes2SDK_stats_get: function (keysJsonPtr, callback) {
        Yes2SDKStatsCallbacks._getPtr = callback;
        var keys;
        try { keys = JSON.parse(UTF8ToString(keysJsonPtr) || "[]"); }
        catch (e) {
            {{{ makeDynCall("vii", "Yes2SDKStatsCallbacks._getPtr") }}}(0, Yes2SDKStatsCallbacks.allocateString("Invalid JSON: " + String(e)));
            return;
        }

        if (window.Yes2SDK && window.Yes2SDK.stats) {
            try {
                window.Yes2SDK.stats.getStatsAsync(keys)
                    .then(function (result) {
                        var json = JSON.stringify(result || {});
                        {{{ makeDynCall("vii", "Yes2SDKStatsCallbacks._getPtr") }}}(1, Yes2SDKStatsCallbacks.allocateString(json));
                    })
                    .catch(function (err) {
                        var msg = typeof err === 'object' ? JSON.stringify(err) : String(err);
                        {{{ makeDynCall("vii", "Yes2SDKStatsCallbacks._getPtr") }}}(0, Yes2SDKStatsCallbacks.allocateString(msg));
                    });
            } catch (e) {
                // Synchronous throw (e.g. method missing on this platform) never reaches .catch — route it here so the Lua callback still fires.
                {{{ makeDynCall("vii", "Yes2SDKStatsCallbacks._getPtr") }}}(0, Yes2SDKStatsCallbacks.allocateString(typeof e === 'object' ? JSON.stringify(e) : String(e)));
            }
        } else {
            {{{ makeDynCall("vii", "Yes2SDKStatsCallbacks._getPtr") }}}(0, Yes2SDKStatsCallbacks.allocateString("SDK not initialized"));
        }
    },

    Yes2SDK_stats_set: function (statsJsonPtr, callback) {
        Yes2SDKStatsCallbacks._setPtr = callback;
        var stats;
        try { stats = JSON.parse(UTF8ToString(statsJsonPtr) || "{}"); }
        catch (e) {
            {{{ makeDynCall("vii", "Yes2SDKStatsCallbacks._setPtr") }}}(0, Yes2SDKStatsCallbacks.allocateString("Invalid JSON: " + String(e)));
            return;
        }

        if (window.Yes2SDK && window.Yes2SDK.stats) {
            try {
                window.Yes2SDK.stats.setStatsAsync(stats)
                    .then(function () {
                        {{{ makeDynCall("vii", "Yes2SDKStatsCallbacks._setPtr") }}}(1, 0);
                    })
                    .catch(function (err) {
                        var msg = typeof err === 'object' ? JSON.stringify(err) : String(err);
                        {{{ makeDynCall("vii", "Yes2SDKStatsCallbacks._setPtr") }}}(0, Yes2SDKStatsCallbacks.allocateString(msg));
                    });
            } catch (e) {
                // Synchronous throw (e.g. method missing on this platform) never reaches .catch — route it here so the Lua callback still fires.
                {{{ makeDynCall("vii", "Yes2SDKStatsCallbacks._setPtr") }}}(0, Yes2SDKStatsCallbacks.allocateString(typeof e === 'object' ? JSON.stringify(e) : String(e)));
            }
        } else {
            {{{ makeDynCall("vii", "Yes2SDKStatsCallbacks._setPtr") }}}(0, Yes2SDKStatsCallbacks.allocateString("SDK not initialized"));
        }
    },

    Yes2SDK_stats_increment: function (incrementsJsonPtr, callback) {
        Yes2SDKStatsCallbacks._incrementPtr = callback;
        var increments;
        try { increments = JSON.parse(UTF8ToString(incrementsJsonPtr) || "{}"); }
        catch (e) {
            {{{ makeDynCall("vii", "Yes2SDKStatsCallbacks._incrementPtr") }}}(0, Yes2SDKStatsCallbacks.allocateString("Invalid JSON: " + String(e)));
            return;
        }

        if (window.Yes2SDK && window.Yes2SDK.stats) {
            try {
                window.Yes2SDK.stats.incrementStatsAsync(increments)
                    .then(function (result) {
                        var json = JSON.stringify(result || {});
                        {{{ makeDynCall("vii", "Yes2SDKStatsCallbacks._incrementPtr") }}}(1, Yes2SDKStatsCallbacks.allocateString(json));
                    })
                    .catch(function (err) {
                        var msg = typeof err === 'object' ? JSON.stringify(err) : String(err);
                        {{{ makeDynCall("vii", "Yes2SDKStatsCallbacks._incrementPtr") }}}(0, Yes2SDKStatsCallbacks.allocateString(msg));
                    });
            } catch (e) {
                // Synchronous throw (e.g. method missing on this platform) never reaches .catch — route it here so the Lua callback still fires.
                {{{ makeDynCall("vii", "Yes2SDKStatsCallbacks._incrementPtr") }}}(0, Yes2SDKStatsCallbacks.allocateString(typeof e === 'object' ? JSON.stringify(e) : String(e)));
            }
        } else {
            {{{ makeDynCall("vii", "Yes2SDKStatsCallbacks._incrementPtr") }}}(0, Yes2SDKStatsCallbacks.allocateString("SDK not initialized"));
        }
    },

    Yes2SDK_stats_isSupported: function () {
        try {
            if (window.Yes2SDK && window.Yes2SDK.stats && typeof window.Yes2SDK.stats.isSupported === 'function') {
                return window.Yes2SDK.stats.isSupported() ? 1 : 0;
            }
        } catch (e) {}
        return 0;
    }
}

autoAddDeps(Yes2SDKStatsLib, '$Yes2SDKStatsCallbacks');
addToLibrary(Yes2SDKStatsLib);
