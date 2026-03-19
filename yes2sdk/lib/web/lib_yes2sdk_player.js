var Yes2SDKPlayerLib = {

    $Yes2SDKPlayerCallbacks: {
        _getPlayerPtr: null,
        _getDataPtr: null,
        _setDataPtr: null,

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

    Yes2SDK_player_getData: function (keysJsonPtr, callback) {
        Yes2SDKPlayerCallbacks._getDataPtr = callback;
        var keys = JSON.parse(UTF8ToString(keysJsonPtr) || "[]");

        if (window.Yes2SDK && window.Yes2SDK.player) {
            window.Yes2SDK.player.getDataAsync(keys)
                .then(function (data) {
                    var json = JSON.stringify(data || {});
                    {{{ makeDynCall("vii", "Yes2SDKPlayerCallbacks._getDataPtr") }}}(1, Yes2SDKPlayerCallbacks.allocateString(json));
                })
                .catch(function (err) {
                    var msg = typeof err === 'object' ? JSON.stringify(err) : String(err);
                    {{{ makeDynCall("vii", "Yes2SDKPlayerCallbacks._getDataPtr") }}}(0, Yes2SDKPlayerCallbacks.allocateString(msg));
                });
        } else {
            {{{ makeDynCall("vii", "callback") }}}(0, Yes2SDKPlayerCallbacks.allocateString("SDK not initialized"));
        }
    },

    Yes2SDK_player_setData: function (dataJsonPtr, callback) {
        Yes2SDKPlayerCallbacks._setDataPtr = callback;
        var data = JSON.parse(UTF8ToString(dataJsonPtr) || "{}");

        if (window.Yes2SDK && window.Yes2SDK.player) {
            window.Yes2SDK.player.setDataAsync(data)
                .then(function () {
                    {{{ makeDynCall("vii", "Yes2SDKPlayerCallbacks._setDataPtr") }}}(1, 0);
                })
                .catch(function (err) {
                    var msg = typeof err === 'object' ? JSON.stringify(err) : String(err);
                    {{{ makeDynCall("vii", "Yes2SDKPlayerCallbacks._setDataPtr") }}}(0, Yes2SDKPlayerCallbacks.allocateString(msg));
                });
        } else {
            {{{ makeDynCall("vii", "callback") }}}(0, Yes2SDKPlayerCallbacks.allocateString("SDK not initialized"));
        }
    }
}

autoAddDeps(Yes2SDKPlayerLib, '$Yes2SDKPlayerCallbacks');
addToLibrary(Yes2SDKPlayerLib);
