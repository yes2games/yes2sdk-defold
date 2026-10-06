var Yes2SDKStatsLib = {

    // Each async call carries the request id minted in C++ and completes through
    // $Yes2SDKBridge (defined in lib_yes2sdk.js), so overlapping calls never share
    // a callback slot. Strings are read before the call returns: the pointers are
    // only valid until then.

    // Invalid JSON fails the request without calling Core, and before the SDK is
    // looked up, as before, with an INVALID_PARAM error. An empty string means the
    // default for that call.
    $Yes2SDKStatsParse: function (ptr, fallback, requestId, callback, context) {
        try {
            return { value: JSON.parse(UTF8ToString(ptr) || fallback) };
        } catch (e) {
            Yes2SDKBridge.complete(callback, requestId, 0,
                Yes2SDKBridge.errorJson('Invalid JSON: ' + String(e), 'INVALID_PARAM', context));
            return null;
        }
    },

    Yes2SDK_stats_get: function (keysJsonPtr, requestId, callback) {
        var parsed = Yes2SDKStatsParse(keysJsonPtr, '[]', requestId, callback, 'stats.getStatsAsync');
        if (!parsed) return;
        Yes2SDKBridge.run(callback, requestId, 'stats.getStatsAsync', function () {
            return [parsed.value];
        }, function (result) {
            return JSON.stringify(result || {});
        });
    },

    Yes2SDK_stats_set: function (statsJsonPtr, requestId, callback) {
        var parsed = Yes2SDKStatsParse(statsJsonPtr, '{}', requestId, callback, 'stats.setStatsAsync');
        if (!parsed) return;
        // setStatsAsync resolves void: report success with no payload.
        Yes2SDKBridge.run(callback, requestId, 'stats.setStatsAsync', function () {
            return [parsed.value];
        }, function () {
            return null;
        });
    },

    Yes2SDK_stats_increment: function (incrementsJsonPtr, requestId, callback) {
        var parsed = Yes2SDKStatsParse(incrementsJsonPtr, '{}', requestId, callback, 'stats.incrementStatsAsync');
        if (!parsed) return;
        Yes2SDKBridge.run(callback, requestId, 'stats.incrementStatsAsync', function () {
            return [parsed.value];
        }, function (result) {
            return JSON.stringify(result || {});
        });
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

autoAddDeps(Yes2SDKStatsLib, '$Yes2SDKBridge');
autoAddDeps(Yes2SDKStatsLib, '$Yes2SDKStatsParse');
addToLibrary(Yes2SDKStatsLib);
