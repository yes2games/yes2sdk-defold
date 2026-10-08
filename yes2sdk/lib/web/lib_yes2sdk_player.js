var Yes2SDKPlayerLib = {

    $Yes2SDKPlayerCallbacks: {
        // Synchronous getName/getId serve from this cache. Core's player identity
        // API is async (getPlayer() returns a Promise), so we prime the cache from
        // the public getPlayer() on first access and return the resolved values on
        // subsequent calls. Until it resolves, the sync getters return safe defaults.
        _cachedName: null,
        _cachedId: null,
        _identityFetching: false,

        // Only the synchronous getName/getId returns use this: the bytes are freed when
        // the C caller returns. Async completions go through $Yes2SDKBridge.
        allocateString: function (str) {
            return stringToUTF8OnStack(str);
        },

        // Fire-and-forget prime of the identity cache via Core's public getPlayer().
        // Never reaches into Core internals; guarded so at most one fetch is in flight.
        primeIdentity: function () {
            if (Yes2SDKPlayerCallbacks._identityFetching) return;
            if (!(window.Yes2SDK && window.Yes2SDK.player && typeof window.Yes2SDK.player.getPlayer === 'function')) return;
            Yes2SDKPlayerCallbacks._identityFetching = true;
            try {
                window.Yes2SDK.player.getPlayer()
                    .then(function (player) {
                        if (player) {
                            if (player.name != null) Yes2SDKPlayerCallbacks._cachedName = String(player.name);
                            if (player.id != null) Yes2SDKPlayerCallbacks._cachedId = String(player.id);
                        }
                        Yes2SDKPlayerCallbacks._identityFetching = false;
                    })
                    .catch(function () {
                        Yes2SDKPlayerCallbacks._identityFetching = false;
                    });
            } catch (e) {
                Yes2SDKPlayerCallbacks._identityFetching = false;
            }
        }
    },

    Yes2SDK_player_getName: function () {
        try {
            if (Yes2SDKPlayerCallbacks._cachedName != null) {
                return Yes2SDKPlayerCallbacks.allocateString(Yes2SDKPlayerCallbacks._cachedName);
            }
            // Not cached yet — kick off the async prime for the next call.
            Yes2SDKPlayerCallbacks.primeIdentity();
        } catch (e) {}
        return Yes2SDKPlayerCallbacks.allocateString("Player");
    },

    Yes2SDK_player_getId: function () {
        try {
            if (Yes2SDKPlayerCallbacks._cachedId != null) {
                return Yes2SDKPlayerCallbacks.allocateString(Yes2SDKPlayerCallbacks._cachedId);
            }
            // Not cached yet — kick off the async prime for the next call.
            Yes2SDKPlayerCallbacks.primeIdentity();
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

    Yes2SDK_player_isBotAvatarSupported: function () {
        try {
            if (window.Yes2SDK && window.Yes2SDK.player && typeof window.Yes2SDK.player.isBotAvatarSupported === 'function') {
                return window.Yes2SDK.player.isBotAvatarSupported() ? 1 : 0;
            }
        } catch (e) {}
        return 0;
    },

    // Each async call carries the request id minted in C++ and completes through
    // $Yes2SDKBridge (defined in lib_yes2sdk.js), so overlapping calls never share
    // a callback slot. Strings are read before the call returns: the pointers are
    // only valid until then.

    Yes2SDK_player_getData: function (keysJsonPtr, requestId, callback) {
        var keys;
        try { keys = JSON.parse(UTF8ToString(keysJsonPtr) || "[]"); }
        catch (e) {
            // Invalid input fails without calling Core, even when the SDK is missing.
            Yes2SDKBridge.complete(callback, requestId, false,
                Yes2SDKBridge.errorJson("Invalid JSON: " + String(e), 'INVALID_PARAM', 'player.getDataAsync'));
            return;
        }
        Yes2SDKBridge.run(callback, requestId, 'player.getDataAsync', function () {
            return [keys];
        }, function (data) {
            return JSON.stringify(data || {});
        });
    },

    Yes2SDK_player_setData: function (dataJsonPtr, requestId, callback) {
        var data;
        try { data = JSON.parse(UTF8ToString(dataJsonPtr) || "{}"); }
        catch (e) {
            Yes2SDKBridge.complete(callback, requestId, false,
                Yes2SDKBridge.errorJson("Invalid JSON: " + String(e), 'INVALID_PARAM', 'player.setDataAsync'));
            return;
        }
        // Success carries no payload (nil in Lua).
        Yes2SDKBridge.run(callback, requestId, 'player.setDataAsync', function () {
            return [data];
        }, function () {
            return null;
        });
    },

    Yes2SDK_player_flushData: function (requestId, callback) {
        // flushDataAsync resolves void: success with no payload.
        Yes2SDKBridge.run(callback, requestId, 'player.flushDataAsync', null, function () {
            return null;
        });
    },

    Yes2SDK_player_getUniqueId: function (requestId, callback) {
        Yes2SDKBridge.run(callback, requestId, 'player.getUniqueId', null, function (id) {
            return String(id == null ? "" : id);
        });
    },

    Yes2SDK_player_getIdsPerGame: function (requestId, callback) {
        Yes2SDKBridge.run(callback, requestId, 'player.getIDsPerGame', null, function (ids) {
            return JSON.stringify(ids || []);
        });
    },

    Yes2SDK_player_getPayingStatus: function (requestId, callback) {
        Yes2SDKBridge.run(callback, requestId, 'player.getPayingStatus', null, function (status) {
            return String(status == null ? "unknown" : status);
        });
    },

    Yes2SDK_player_getMode: function (requestId, callback) {
        Yes2SDKBridge.run(callback, requestId, 'player.getMode', null, function (mode) {
            return String(mode == null ? "unknown" : mode);
        });
    },

    Yes2SDK_player_getPhoto: function (sizePtr, requestId, callback) {
        var size = UTF8ToString(sizePtr);
        // url may be null when no photo is available: the default mapping passes JSON "null".
        Yes2SDKBridge.run(callback, requestId, 'player.getPhoto', function () {
            return [size || undefined];
        });
    },

    // Resolves with the avatar URL as a plain string. Username and size checks
    // stay in the SDK, so a bad value arrives as an INVALID_PARAM failure.
    Yes2SDK_player_getBotAvatar: function (usernamePtr, sizePtr, requestId, callback) {
        var username = UTF8ToString(usernamePtr);
        var size = UTF8ToString(sizePtr);
        Yes2SDKBridge.run(callback, requestId, 'player.getBotAvatarAsync', function () {
            return [username, size || undefined];
        }, function (url) {
            return String(url == null ? "" : url);
        });
    },

    Yes2SDK_player_getSignedInfo: function (payloadPtr, requestId, callback) {
        var payload = UTF8ToString(payloadPtr);
        Yes2SDKBridge.run(callback, requestId, 'player.getSignedPlayerInfoAsync', function () {
            return [payload || undefined];
        }, function (info) {
            return JSON.stringify(info || {});
        });
    }
}

autoAddDeps(Yes2SDKPlayerLib, '$Yes2SDKPlayerCallbacks');
autoAddDeps(Yes2SDKPlayerLib, '$Yes2SDKBridge');
addToLibrary(Yes2SDKPlayerLib);
