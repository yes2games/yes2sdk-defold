var Yes2SDKLeaderboardLib = {

    // Each async call carries the request id minted in C++ and completes through
    // $Yes2SDKBridge (defined in lib_yes2sdk.js), so overlapping calls never share
    // a callback slot. Strings are read before the call returns: the pointers are
    // only valid until then.

    Yes2SDK_leaderboard_get: function (namePtr, requestId, callback) {
        var name = UTF8ToString(namePtr);
        Yes2SDKBridge.run(callback, requestId, 'leaderboard.getLeaderboardAsync', function () {
            return [name];
        }, function (result) {
            return JSON.stringify(result || {});
        });
    },

    Yes2SDK_leaderboard_setScore: function (namePtr, score, metadataPtr, requestId, callback) {
        var name = UTF8ToString(namePtr);
        var metadata = UTF8ToString(metadataPtr);
        Yes2SDKBridge.run(callback, requestId, 'leaderboard.setScoreAsync', function () {
            return [name, score, metadata || undefined];
        }, function (result) {
            return JSON.stringify(result || {});
        });
    },

    Yes2SDK_leaderboard_getEntries: function (namePtr, count, offset, requestId, callback) {
        var name = UTF8ToString(namePtr);
        Yes2SDKBridge.run(callback, requestId, 'leaderboard.getEntriesAsync', function () {
            return [name, count, offset];
        }, function (result) {
            return JSON.stringify(result || []);
        });
    },

    Yes2SDK_leaderboard_getPlayerEntry: function (namePtr, requestId, callback) {
        var name = UTF8ToString(namePtr);
        // result may be null when the player is not ranked: the default mapping passes JSON "null".
        Yes2SDKBridge.run(callback, requestId, 'leaderboard.getPlayerEntryAsync', function () {
            return [name];
        });
    },

    Yes2SDK_leaderboard_isSupported: function () {
        try {
            if (window.Yes2SDK && window.Yes2SDK.leaderboard && typeof window.Yes2SDK.leaderboard.isSupported === 'function') {
                return window.Yes2SDK.leaderboard.isSupported() ? 1 : 0;
            }
        } catch (e) {}
        return 0;
    }
}

autoAddDeps(Yes2SDKLeaderboardLib, '$Yes2SDKBridge');
addToLibrary(Yes2SDKLeaderboardLib);
