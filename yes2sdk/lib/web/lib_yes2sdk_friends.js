var Yes2SDKFriendsLib = {

    $Yes2SDKFriendsCallbacks: {
        _listFriendsPtr: null,

        allocateString: function (str) {
            return stringToUTF8OnStack(str);
        }
    },

    Yes2SDK_friends_listFriends: function (page, size, callback) {
        Yes2SDKFriendsCallbacks._listFriendsPtr = callback;

        if (window.Yes2SDK && window.Yes2SDK.friends) {
            window.Yes2SDK.friends.listFriendsAsync(page, size)
                .then(function (result) {
                    var json = JSON.stringify(result);
                    {{{ makeDynCall("vii", "Yes2SDKFriendsCallbacks._listFriendsPtr") }}}(1, Yes2SDKFriendsCallbacks.allocateString(json));
                })
                .catch(function (err) {
                    var msg = typeof err === 'object' ? JSON.stringify(err) : String(err);
                    {{{ makeDynCall("vii", "Yes2SDKFriendsCallbacks._listFriendsPtr") }}}(0, Yes2SDKFriendsCallbacks.allocateString(msg));
                });
        } else {
            {{{ makeDynCall("vii", "callback") }}}(0, Yes2SDKFriendsCallbacks.allocateString("SDK not initialized"));
        }
    },

    Yes2SDK_friends_isSupported: function () {
        try {
            if (window.Yes2SDK && window.Yes2SDK.friends && typeof window.Yes2SDK.friends.isSupported === 'function') {
                return window.Yes2SDK.friends.isSupported() ? 1 : 0;
            }
        } catch (e) {}
        return 0;
    }
}

autoAddDeps(Yes2SDKFriendsLib, '$Yes2SDKFriendsCallbacks');
addToLibrary(Yes2SDKFriendsLib);
