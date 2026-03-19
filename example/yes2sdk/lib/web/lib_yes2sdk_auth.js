var Yes2SDKAuthLib = {

    $Yes2SDKAuthCallbacks: {
        _signInPtr: null,

        allocateString: function (str) {
            return stringToUTF8OnStack(str);
        }
    },

    Yes2SDK_auth_isAuthenticated: function () {
        try {
            if (window.Yes2SDK && window.Yes2SDK.auth) {
                return window.Yes2SDK.auth.isAuthenticated() ? 1 : 0;
            }
        } catch (e) {}
        return 0;
    },

    Yes2SDK_auth_signIn: function (callback) {
        Yes2SDKAuthCallbacks._signInPtr = callback;

        if (window.Yes2SDK && window.Yes2SDK.auth) {
            window.Yes2SDK.auth.signInAsync()
                .then(function () {
                    {{{ makeDynCall("vii", "Yes2SDKAuthCallbacks._signInPtr") }}}(1, 0);
                })
                .catch(function (err) {
                    var msg = typeof err === 'object' ? JSON.stringify(err) : String(err);
                    {{{ makeDynCall("vii", "Yes2SDKAuthCallbacks._signInPtr") }}}(0, Yes2SDKAuthCallbacks.allocateString(msg));
                });
        } else {
            {{{ makeDynCall("vii", "callback") }}}(0, Yes2SDKAuthCallbacks.allocateString("SDK not initialized"));
        }
    }
}

autoAddDeps(Yes2SDKAuthLib, '$Yes2SDKAuthCallbacks');
addToLibrary(Yes2SDKAuthLib);
