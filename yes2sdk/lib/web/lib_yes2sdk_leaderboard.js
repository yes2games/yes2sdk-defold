var Yes2SDKLeaderboardLib = {

    $Yes2SDKLeaderboardCallbacks: {
        _getPtr: null,
        _setScorePtr: null,
        _getEntriesPtr: null,
        _getPlayerEntryPtr: null,

        allocateString: function (str) {
            return stringToUTF8OnStack(str);
        }
    },

    Yes2SDK_leaderboard_get: function (namePtr, callback) {
        Yes2SDKLeaderboardCallbacks._getPtr = callback;
        if (window.Yes2SDK && window.Yes2SDK.leaderboard) {
            try {
                window.Yes2SDK.leaderboard.getLeaderboardAsync(UTF8ToString(namePtr))
                    .then(function (result) {
                        var json = JSON.stringify(result || {});
                        {{{ makeDynCall("vii", "Yes2SDKLeaderboardCallbacks._getPtr") }}}(1, Yes2SDKLeaderboardCallbacks.allocateString(json));
                    })
                    .catch(function (err) {
                        var msg = typeof err === 'object' ? JSON.stringify(err) : String(err);
                        {{{ makeDynCall("vii", "Yes2SDKLeaderboardCallbacks._getPtr") }}}(0, Yes2SDKLeaderboardCallbacks.allocateString(msg));
                    });
            } catch (e) {
                // Synchronous throw (e.g. method missing on this platform) never reaches .catch — route it here so the Lua callback still fires.
                {{{ makeDynCall("vii", "Yes2SDKLeaderboardCallbacks._getPtr") }}}(0, Yes2SDKLeaderboardCallbacks.allocateString(typeof e === 'object' ? JSON.stringify(e) : String(e)));
            }
        } else {
            {{{ makeDynCall("vii", "Yes2SDKLeaderboardCallbacks._getPtr") }}}(0, Yes2SDKLeaderboardCallbacks.allocateString("SDK not initialized"));
        }
    },

    Yes2SDK_leaderboard_setScore: function (namePtr, score, metadataPtr, callback) {
        Yes2SDKLeaderboardCallbacks._setScorePtr = callback;
        var metadata = UTF8ToString(metadataPtr);
        if (window.Yes2SDK && window.Yes2SDK.leaderboard) {
            try {
                window.Yes2SDK.leaderboard.setScoreAsync(UTF8ToString(namePtr), score, metadata || undefined)
                    .then(function (result) {
                        var json = JSON.stringify(result || {});
                        {{{ makeDynCall("vii", "Yes2SDKLeaderboardCallbacks._setScorePtr") }}}(1, Yes2SDKLeaderboardCallbacks.allocateString(json));
                    })
                    .catch(function (err) {
                        var msg = typeof err === 'object' ? JSON.stringify(err) : String(err);
                        {{{ makeDynCall("vii", "Yes2SDKLeaderboardCallbacks._setScorePtr") }}}(0, Yes2SDKLeaderboardCallbacks.allocateString(msg));
                    });
            } catch (e) {
                {{{ makeDynCall("vii", "Yes2SDKLeaderboardCallbacks._setScorePtr") }}}(0, Yes2SDKLeaderboardCallbacks.allocateString(typeof e === 'object' ? JSON.stringify(e) : String(e)));
            }
        } else {
            {{{ makeDynCall("vii", "Yes2SDKLeaderboardCallbacks._setScorePtr") }}}(0, Yes2SDKLeaderboardCallbacks.allocateString("SDK not initialized"));
        }
    },

    Yes2SDK_leaderboard_getEntries: function (namePtr, count, offset, callback) {
        Yes2SDKLeaderboardCallbacks._getEntriesPtr = callback;
        if (window.Yes2SDK && window.Yes2SDK.leaderboard) {
            try {
                window.Yes2SDK.leaderboard.getEntriesAsync(UTF8ToString(namePtr), count, offset)
                    .then(function (result) {
                        var json = JSON.stringify(result || []);
                        {{{ makeDynCall("vii", "Yes2SDKLeaderboardCallbacks._getEntriesPtr") }}}(1, Yes2SDKLeaderboardCallbacks.allocateString(json));
                    })
                    .catch(function (err) {
                        var msg = typeof err === 'object' ? JSON.stringify(err) : String(err);
                        {{{ makeDynCall("vii", "Yes2SDKLeaderboardCallbacks._getEntriesPtr") }}}(0, Yes2SDKLeaderboardCallbacks.allocateString(msg));
                    });
            } catch (e) {
                {{{ makeDynCall("vii", "Yes2SDKLeaderboardCallbacks._getEntriesPtr") }}}(0, Yes2SDKLeaderboardCallbacks.allocateString(typeof e === 'object' ? JSON.stringify(e) : String(e)));
            }
        } else {
            {{{ makeDynCall("vii", "Yes2SDKLeaderboardCallbacks._getEntriesPtr") }}}(0, Yes2SDKLeaderboardCallbacks.allocateString("SDK not initialized"));
        }
    },

    Yes2SDK_leaderboard_getPlayerEntry: function (namePtr, callback) {
        Yes2SDKLeaderboardCallbacks._getPlayerEntryPtr = callback;
        if (window.Yes2SDK && window.Yes2SDK.leaderboard) {
            try {
                window.Yes2SDK.leaderboard.getPlayerEntryAsync(UTF8ToString(namePtr))
                    .then(function (result) {
                        // result may be null when the player is not ranked — pass JSON "null".
                        var json = JSON.stringify(result === undefined ? null : result);
                        {{{ makeDynCall("vii", "Yes2SDKLeaderboardCallbacks._getPlayerEntryPtr") }}}(1, Yes2SDKLeaderboardCallbacks.allocateString(json));
                    })
                    .catch(function (err) {
                        var msg = typeof err === 'object' ? JSON.stringify(err) : String(err);
                        {{{ makeDynCall("vii", "Yes2SDKLeaderboardCallbacks._getPlayerEntryPtr") }}}(0, Yes2SDKLeaderboardCallbacks.allocateString(msg));
                    });
            } catch (e) {
                {{{ makeDynCall("vii", "Yes2SDKLeaderboardCallbacks._getPlayerEntryPtr") }}}(0, Yes2SDKLeaderboardCallbacks.allocateString(typeof e === 'object' ? JSON.stringify(e) : String(e)));
            }
        } else {
            {{{ makeDynCall("vii", "Yes2SDKLeaderboardCallbacks._getPlayerEntryPtr") }}}(0, Yes2SDKLeaderboardCallbacks.allocateString("SDK not initialized"));
        }
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

autoAddDeps(Yes2SDKLeaderboardLib, '$Yes2SDKLeaderboardCallbacks');
addToLibrary(Yes2SDKLeaderboardLib);
