var Yes2SDKPlayerLib = {

    $Yes2SDKPlayerCallbacks: {
        _getPlayerPtr: null,
        _getDataPtr: null,
        _setDataPtr: null,
        _getUniqueIdPtr: null,
        _getIdsPerGamePtr: null,
        _getPayingStatusPtr: null,
        _getModePtr: null,
        _getPhotoPtr: null,
        _getSignedInfoPtr: null,

        allocateString: function (str) {
            return stringToUTF8OnStack(str);
        }
    },

    Yes2SDK_player_getName: function () {
        try {
            if (window.Yes2SDK && window.Yes2SDK.player && window.Yes2SDK.player._strategy) {
                var name = window.Yes2SDK.player._strategy.getName ? window.Yes2SDK.player._strategy.getName() : "Player";
                return Yes2SDKPlayerCallbacks.allocateString(name);
            }
        } catch (e) {}
        return Yes2SDKPlayerCallbacks.allocateString("Player");
    },

    Yes2SDK_player_getId: function () {
        try {
            if (window.Yes2SDK && window.Yes2SDK.player && window.Yes2SDK.player._strategy) {
                var id = window.Yes2SDK.player._strategy.getId ? window.Yes2SDK.player._strategy.getId() : "";
                return Yes2SDKPlayerCallbacks.allocateString(id);
            }
        } catch (e) {}
        return Yes2SDKPlayerCallbacks.allocateString("");
    },

    Yes2SDK_player_isDataSupported: function () {
        try {
            if (window.Yes2SDK && window.Yes2SDK.player && typeof window.Yes2SDK.player.isDataSupported === 'function') {
                return window.Yes2SDK.player.isDataSupported() ? 1 : 0;
            }
        } catch (e) {}
        return 0;
    },

    Yes2SDK_player_getData: function (keysJsonPtr, callback) {
        Yes2SDKPlayerCallbacks._getDataPtr = callback;
        var keys;
        try { keys = JSON.parse(UTF8ToString(keysJsonPtr) || "[]"); }
        catch (e) {
            {{{ makeDynCall("vii", "Yes2SDKPlayerCallbacks._getDataPtr") }}}(0, Yes2SDKPlayerCallbacks.allocateString("Invalid JSON: " + String(e)));
            return;
        }

        if (window.Yes2SDK && window.Yes2SDK.player) {
            try {
                window.Yes2SDK.player.getDataAsync(keys)
                    .then(function (data) {
                        var json = JSON.stringify(data || {});
                        {{{ makeDynCall("vii", "Yes2SDKPlayerCallbacks._getDataPtr") }}}(1, Yes2SDKPlayerCallbacks.allocateString(json));
                    })
                    .catch(function (err) {
                        var msg = typeof err === 'object' ? JSON.stringify(err) : String(err);
                        {{{ makeDynCall("vii", "Yes2SDKPlayerCallbacks._getDataPtr") }}}(0, Yes2SDKPlayerCallbacks.allocateString(msg));
                    });
            } catch (e) {
                // Synchronous throw (e.g. method missing on this platform) never reaches .catch — route it here so the Lua callback still fires.
                {{{ makeDynCall("vii", "Yes2SDKPlayerCallbacks._getDataPtr") }}}(0, Yes2SDKPlayerCallbacks.allocateString(typeof e === 'object' ? JSON.stringify(e) : String(e)));
            }
        } else {
            {{{ makeDynCall("vii", "Yes2SDKPlayerCallbacks._getDataPtr") }}}(0, Yes2SDKPlayerCallbacks.allocateString("SDK not initialized"));
        }
    },

    Yes2SDK_player_setData: function (dataJsonPtr, callback) {
        Yes2SDKPlayerCallbacks._setDataPtr = callback;
        var data;
        try { data = JSON.parse(UTF8ToString(dataJsonPtr) || "{}"); }
        catch (e) {
            {{{ makeDynCall("vii", "Yes2SDKPlayerCallbacks._setDataPtr") }}}(0, Yes2SDKPlayerCallbacks.allocateString("Invalid JSON: " + String(e)));
            return;
        }

        if (window.Yes2SDK && window.Yes2SDK.player) {
            try {
                window.Yes2SDK.player.setDataAsync(data)
                    .then(function () {
                        {{{ makeDynCall("vii", "Yes2SDKPlayerCallbacks._setDataPtr") }}}(1, 0);
                    })
                    .catch(function (err) {
                        var msg = typeof err === 'object' ? JSON.stringify(err) : String(err);
                        {{{ makeDynCall("vii", "Yes2SDKPlayerCallbacks._setDataPtr") }}}(0, Yes2SDKPlayerCallbacks.allocateString(msg));
                    });
            } catch (e) {
                // Synchronous throw (e.g. method missing on this platform) never reaches .catch — route it here so the Lua callback still fires.
                {{{ makeDynCall("vii", "Yes2SDKPlayerCallbacks._setDataPtr") }}}(0, Yes2SDKPlayerCallbacks.allocateString(typeof e === 'object' ? JSON.stringify(e) : String(e)));
            }
        } else {
            {{{ makeDynCall("vii", "Yes2SDKPlayerCallbacks._setDataPtr") }}}(0, Yes2SDKPlayerCallbacks.allocateString("SDK not initialized"));
        }
    },

    Yes2SDK_player_getUniqueId: function (callback) {
        Yes2SDKPlayerCallbacks._getUniqueIdPtr = callback;
        if (window.Yes2SDK && window.Yes2SDK.player) {
            try {
                window.Yes2SDK.player.getUniqueId()
                    .then(function (id) {
                        {{{ makeDynCall("vii", "Yes2SDKPlayerCallbacks._getUniqueIdPtr") }}}(1, Yes2SDKPlayerCallbacks.allocateString(String(id == null ? "" : id)));
                    })
                    .catch(function (err) {
                        var msg = typeof err === 'object' ? JSON.stringify(err) : String(err);
                        {{{ makeDynCall("vii", "Yes2SDKPlayerCallbacks._getUniqueIdPtr") }}}(0, Yes2SDKPlayerCallbacks.allocateString(msg));
                    });
            } catch (e) {
                // Synchronous throw (e.g. method missing on this platform) never reaches .catch — route it here so the Lua callback still fires.
                {{{ makeDynCall("vii", "Yes2SDKPlayerCallbacks._getUniqueIdPtr") }}}(0, Yes2SDKPlayerCallbacks.allocateString(typeof e === 'object' ? JSON.stringify(e) : String(e)));
            }
        } else {
            {{{ makeDynCall("vii", "Yes2SDKPlayerCallbacks._getUniqueIdPtr") }}}(0, Yes2SDKPlayerCallbacks.allocateString("SDK not initialized"));
        }
    },

    Yes2SDK_player_getIdsPerGame: function (callback) {
        Yes2SDKPlayerCallbacks._getIdsPerGamePtr = callback;
        if (window.Yes2SDK && window.Yes2SDK.player) {
            try {
                window.Yes2SDK.player.getIDsPerGame()
                    .then(function (ids) {
                        {{{ makeDynCall("vii", "Yes2SDKPlayerCallbacks._getIdsPerGamePtr") }}}(1, Yes2SDKPlayerCallbacks.allocateString(JSON.stringify(ids || [])));
                    })
                    .catch(function (err) {
                        var msg = typeof err === 'object' ? JSON.stringify(err) : String(err);
                        {{{ makeDynCall("vii", "Yes2SDKPlayerCallbacks._getIdsPerGamePtr") }}}(0, Yes2SDKPlayerCallbacks.allocateString(msg));
                    });
            } catch (e) {
                // Synchronous throw (e.g. method missing on this platform) never reaches .catch — route it here so the Lua callback still fires.
                {{{ makeDynCall("vii", "Yes2SDKPlayerCallbacks._getIdsPerGamePtr") }}}(0, Yes2SDKPlayerCallbacks.allocateString(typeof e === 'object' ? JSON.stringify(e) : String(e)));
            }
        } else {
            {{{ makeDynCall("vii", "Yes2SDKPlayerCallbacks._getIdsPerGamePtr") }}}(0, Yes2SDKPlayerCallbacks.allocateString("SDK not initialized"));
        }
    },

    Yes2SDK_player_getPayingStatus: function (callback) {
        Yes2SDKPlayerCallbacks._getPayingStatusPtr = callback;
        if (window.Yes2SDK && window.Yes2SDK.player) {
            try {
                window.Yes2SDK.player.getPayingStatus()
                    .then(function (status) {
                        {{{ makeDynCall("vii", "Yes2SDKPlayerCallbacks._getPayingStatusPtr") }}}(1, Yes2SDKPlayerCallbacks.allocateString(String(status == null ? "unknown" : status)));
                    })
                    .catch(function (err) {
                        var msg = typeof err === 'object' ? JSON.stringify(err) : String(err);
                        {{{ makeDynCall("vii", "Yes2SDKPlayerCallbacks._getPayingStatusPtr") }}}(0, Yes2SDKPlayerCallbacks.allocateString(msg));
                    });
            } catch (e) {
                // Synchronous throw (e.g. method missing on this platform) never reaches .catch — route it here so the Lua callback still fires.
                {{{ makeDynCall("vii", "Yes2SDKPlayerCallbacks._getPayingStatusPtr") }}}(0, Yes2SDKPlayerCallbacks.allocateString(typeof e === 'object' ? JSON.stringify(e) : String(e)));
            }
        } else {
            {{{ makeDynCall("vii", "Yes2SDKPlayerCallbacks._getPayingStatusPtr") }}}(0, Yes2SDKPlayerCallbacks.allocateString("SDK not initialized"));
        }
    },

    Yes2SDK_player_getMode: function (callback) {
        Yes2SDKPlayerCallbacks._getModePtr = callback;
        if (window.Yes2SDK && window.Yes2SDK.player) {
            try {
                window.Yes2SDK.player.getMode()
                    .then(function (mode) {
                        {{{ makeDynCall("vii", "Yes2SDKPlayerCallbacks._getModePtr") }}}(1, Yes2SDKPlayerCallbacks.allocateString(String(mode == null ? "unknown" : mode)));
                    })
                    .catch(function (err) {
                        var msg = typeof err === 'object' ? JSON.stringify(err) : String(err);
                        {{{ makeDynCall("vii", "Yes2SDKPlayerCallbacks._getModePtr") }}}(0, Yes2SDKPlayerCallbacks.allocateString(msg));
                    });
            } catch (e) {
                // Synchronous throw (e.g. method missing on this platform) never reaches .catch — route it here so the Lua callback still fires.
                {{{ makeDynCall("vii", "Yes2SDKPlayerCallbacks._getModePtr") }}}(0, Yes2SDKPlayerCallbacks.allocateString(typeof e === 'object' ? JSON.stringify(e) : String(e)));
            }
        } else {
            {{{ makeDynCall("vii", "Yes2SDKPlayerCallbacks._getModePtr") }}}(0, Yes2SDKPlayerCallbacks.allocateString("SDK not initialized"));
        }
    },

    Yes2SDK_player_getPhoto: function (sizePtr, callback) {
        Yes2SDKPlayerCallbacks._getPhotoPtr = callback;
        var size = UTF8ToString(sizePtr);
        if (window.Yes2SDK && window.Yes2SDK.player) {
            try {
                window.Yes2SDK.player.getPhoto(size || undefined)
                    .then(function (url) {
                        // url may be null when no photo is available — pass JSON "null".
                        {{{ makeDynCall("vii", "Yes2SDKPlayerCallbacks._getPhotoPtr") }}}(1, Yes2SDKPlayerCallbacks.allocateString(JSON.stringify(url === undefined ? null : url)));
                    })
                    .catch(function (err) {
                        var msg = typeof err === 'object' ? JSON.stringify(err) : String(err);
                        {{{ makeDynCall("vii", "Yes2SDKPlayerCallbacks._getPhotoPtr") }}}(0, Yes2SDKPlayerCallbacks.allocateString(msg));
                    });
            } catch (e) {
                // Synchronous throw (e.g. method missing on this platform) never reaches .catch — route it here so the Lua callback still fires.
                {{{ makeDynCall("vii", "Yes2SDKPlayerCallbacks._getPhotoPtr") }}}(0, Yes2SDKPlayerCallbacks.allocateString(typeof e === 'object' ? JSON.stringify(e) : String(e)));
            }
        } else {
            {{{ makeDynCall("vii", "Yes2SDKPlayerCallbacks._getPhotoPtr") }}}(0, Yes2SDKPlayerCallbacks.allocateString("SDK not initialized"));
        }
    },

    Yes2SDK_player_getSignedInfo: function (payloadPtr, callback) {
        Yes2SDKPlayerCallbacks._getSignedInfoPtr = callback;
        var payload = UTF8ToString(payloadPtr);
        if (window.Yes2SDK && window.Yes2SDK.player) {
            try {
                window.Yes2SDK.player.getSignedPlayerInfoAsync(payload || undefined)
                    .then(function (info) {
                        var json = JSON.stringify(info || {});
                        {{{ makeDynCall("vii", "Yes2SDKPlayerCallbacks._getSignedInfoPtr") }}}(1, Yes2SDKPlayerCallbacks.allocateString(json));
                    })
                    .catch(function (err) {
                        var msg = typeof err === 'object' ? JSON.stringify(err) : String(err);
                        {{{ makeDynCall("vii", "Yes2SDKPlayerCallbacks._getSignedInfoPtr") }}}(0, Yes2SDKPlayerCallbacks.allocateString(msg));
                    });
            } catch (e) {
                // Synchronous throw (e.g. method missing on this platform) never reaches .catch — route it here so the Lua callback still fires.
                {{{ makeDynCall("vii", "Yes2SDKPlayerCallbacks._getSignedInfoPtr") }}}(0, Yes2SDKPlayerCallbacks.allocateString(typeof e === 'object' ? JSON.stringify(e) : String(e)));
            }
        } else {
            {{{ makeDynCall("vii", "Yes2SDKPlayerCallbacks._getSignedInfoPtr") }}}(0, Yes2SDKPlayerCallbacks.allocateString("SDK not initialized"));
        }
    }
}

autoAddDeps(Yes2SDKPlayerLib, '$Yes2SDKPlayerCallbacks');
addToLibrary(Yes2SDKPlayerLib);
