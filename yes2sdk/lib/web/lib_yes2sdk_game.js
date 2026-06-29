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

    Yes2SDK_game_inviteLink: function (paramsJsonPtr, callback) {
        if (window.Yes2SDK && window.Yes2SDK.game) {
            var params;
            try { params = JSON.parse(UTF8ToString(paramsJsonPtr) || "{}"); }
            catch (e) {
                {{{ makeDynCall("vii", "callback") }}}(0, Yes2SDKGameUtils.allocateString("Invalid JSON: " + String(e)));
                return;
            }
            try {
                window.Yes2SDK.game.inviteLinkAsync(params)
                    .then(function (url) {
                        {{{ makeDynCall("vii", "callback") }}}(1, Yes2SDKGameUtils.allocateString(url || ""));
                    })
                    .catch(function (err) {
                        {{{ makeDynCall("vii", "callback") }}}(0, Yes2SDKGameUtils.allocateString(String(err)));
                    });
            } catch (e) {
                // Synchronous throw (e.g. method missing on this platform) never reaches .catch — route it here so the Lua callback still fires.
                {{{ makeDynCall("vii", "callback") }}}(0, Yes2SDKGameUtils.allocateString(typeof e === 'object' ? JSON.stringify(e) : String(e)));
            }
        } else {
            {{{ makeDynCall("vii", "callback") }}}(0, Yes2SDKGameUtils.allocateString("SDK not initialized"));
        }
    },

    Yes2SDK_game_getServerTime: function (callback) {
        if (window.Yes2SDK && window.Yes2SDK.game) {
            try {
                window.Yes2SDK.game.getServerTimeAsync()
                    .then(function (time) {
                        // Delivered as a numeric string; the Lua wrapper tonumber()s it.
                        {{{ makeDynCall("vii", "callback") }}}(1, Yes2SDKGameUtils.allocateString(String(time == null ? 0 : time)));
                    })
                    .catch(function (err) {
                        {{{ makeDynCall("vii", "callback") }}}(0, Yes2SDKGameUtils.allocateString(typeof err === 'object' ? JSON.stringify(err) : String(err)));
                    });
            } catch (e) {
                // Synchronous throw (e.g. method missing on this platform) never reaches .catch — route it here so the Lua callback still fires.
                {{{ makeDynCall("vii", "callback") }}}(0, Yes2SDKGameUtils.allocateString(typeof e === 'object' ? JSON.stringify(e) : String(e)));
            }
        } else {
            {{{ makeDynCall("vii", "callback") }}}(0, Yes2SDKGameUtils.allocateString("SDK not initialized"));
        }
    }
}

autoAddDeps(Yes2SDKGameLib, '$Yes2SDKGameUtils');
addToLibrary(Yes2SDKGameLib);
