var Yes2SDKAuthLib = {

    Yes2SDK_auth_isAuthenticated: function () {
        try {
            if (window.Yes2SDK && window.Yes2SDK.auth) {
                return window.Yes2SDK.auth.isAuthenticated() ? 1 : 0;
            }
        } catch (e) {}
        return 0;
    },

    Yes2SDK_auth_isSupported: function () {
        try {
            if (window.Yes2SDK && window.Yes2SDK.auth && typeof window.Yes2SDK.auth.isSupported === 'function') {
                return window.Yes2SDK.auth.isSupported() ? 1 : 0;
            }
        } catch (e) {}
        return 0;
    },

    Yes2SDK_auth_signIn: function (requestId, callback) {
        // signInAsync resolves with a user object we do not forward: success with no payload.
        Yes2SDKBridge.run(callback, requestId, 'auth.signInAsync', null, function () {
            return null;
        });
    }
}

autoAddDeps(Yes2SDKAuthLib, '$Yes2SDKBridge');
addToLibrary(Yes2SDKAuthLib);
