var Yes2SDKFriendsLib = {

    Yes2SDK_friends_listFriends: function (page, size, requestId, callback) {
        Yes2SDKBridge.run(callback, requestId, 'friends.listFriendsAsync', function () {
            return [page, size];
        });
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

autoAddDeps(Yes2SDKFriendsLib, '$Yes2SDKBridge');
addToLibrary(Yes2SDKFriendsLib);
