var Yes2SDKGameLib = {

    $Yes2SDKGameUtils: {
        allocateString: function (str) {
            return stringToUTF8OnStack(str);
        }
    },

    Yes2SDK_game_happyTime: function () {
        try {
            if (window.Yes2SDK && window.Yes2SDK.game) {
                window.Yes2SDK.game.happyTime();
            }
        } catch (e) {}
    },

    Yes2SDK_game_getSettings: function () {
        try {
            if (window.Yes2SDK && window.Yes2SDK.game) {
                var settings = window.Yes2SDK.game.getSettings();
                return Yes2SDKGameUtils.allocateString(JSON.stringify(settings || {}));
            }
        } catch (e) {}
        return Yes2SDKGameUtils.allocateString("{}");
    },

    Yes2SDK_game_copyToClipboard: function (textPtr) {
        try {
            if (window.Yes2SDK && window.Yes2SDK.game) {
                window.Yes2SDK.game.copyToClipboard(UTF8ToString(textPtr));
            }
        } catch (e) {}
    },

    Yes2SDK_game_inviteLink: function (paramsJsonPtr, requestId, callback) {
        var paramsJson = UTF8ToString(paramsJsonPtr) || "{}";
        Yes2SDKBridge.run(callback, requestId, 'game.inviteLink', function () {
            // Invalid JSON fails here, before Core is called. The thrown code
            // becomes the error code of the failure payload.
            try { JSON.parse(paramsJson); }
            catch (e) { throw { code: 'INVALID_PARAM', message: "Invalid JSON: " + String(e) }; }
            return [paramsJson];
        }, function (url) {
            return url || "";
        });
    },

    Yes2SDK_game_getServerTime: function (requestId, callback) {
        // Delivered as a numeric string; the Lua wrapper tonumber()s it.
        Yes2SDKBridge.run(callback, requestId, 'game.getServerTimeAsync', null, function (time) {
            return String(time == null ? 0 : time);
        });
    }
}

autoAddDeps(Yes2SDKGameLib, '$Yes2SDKGameUtils');
autoAddDeps(Yes2SDKGameLib, '$Yes2SDKBridge');
addToLibrary(Yes2SDKGameLib);
