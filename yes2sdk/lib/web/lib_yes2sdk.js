var Yes2SDKLib = {

    $Yes2SDKUtils: {
        allocateString: function (str) {
            return stringToUTF8OnStack(str);
        }
    },

    Yes2SDK_initializeAsync: function (callback) {
        if (window.Yes2SDK && window.Yes2SDK.initializeAsync) {
            window.Yes2SDK.initializeAsync()
                .then(function () {
                    {{{ makeDynCall("vii", "callback") }}}(1, 0);
                })
                .catch(function (error) {
                    var msg = typeof error === 'object' ? JSON.stringify(error) : String(error);
                    {{{ makeDynCall("vii", "callback") }}}(0, Yes2SDKUtils.allocateString(msg));
                });
        } else {
            {{{ makeDynCall("vii", "callback") }}}(0, Yes2SDKUtils.allocateString("Yes2SDK not loaded"));
        }
    },

    Yes2SDK_startGameAsync: function (callback) {
        if (window.Yes2SDK && window.Yes2SDK.startGameAsync) {
            window.Yes2SDK.startGameAsync()
                .then(function () {
                    {{{ makeDynCall("vii", "callback") }}}(1, 0);
                })
                .catch(function (error) {
                    var msg = typeof error === 'object' ? JSON.stringify(error) : String(error);
                    {{{ makeDynCall("vii", "callback") }}}(0, Yes2SDKUtils.allocateString(msg));
                });
        } else {
            {{{ makeDynCall("vii", "callback") }}}(0, Yes2SDKUtils.allocateString("Yes2SDK not loaded"));
        }
    },

    Yes2SDK_setLoadingProgress: function (progress) {
        if (window.Yes2SDK) {
            window.Yes2SDK.setLoadingProgress(progress);
        }
    },

    Yes2SDK_getPlatform: function () {
        var platform = (window.Yes2SDK && window.Yes2SDK.getPlatform) ? window.Yes2SDK.getPlatform() : "unknown";
        return Yes2SDKUtils.allocateString(platform || "unknown");
    }
}

autoAddDeps(Yes2SDKLib, '$Yes2SDKUtils');
addToLibrary(Yes2SDKLib);
