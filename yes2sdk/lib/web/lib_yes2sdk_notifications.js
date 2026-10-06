var Yes2SDKNotificationsLib = {

    // Each async call carries the request id minted in C++ and completes through
    // $Yes2SDKBridge (defined in lib_yes2sdk.js). Strings are read before the call
    // returns: the pointers are only valid until then. Option validation stays in
    // the SDK, so a bad value arrives as an INVALID_PARAM failure.

    Yes2SDK_notifications_schedule: function (optionsJsonPtr, requestId, callback) {
        var optionsJson = UTF8ToString(optionsJsonPtr);
        Yes2SDKBridge.run(callback, requestId, 'notifications.scheduleAsync', function () {
            var options;
            try {
                options = JSON.parse(optionsJson);
            } catch (e) {
                throw { code: 'INVALID_PARAM', message: 'notification options are not valid JSON' };
            }
            return [options];
        }, function (result) {
            return JSON.stringify(result || {});
        });
    },

    Yes2SDK_notifications_cancel: function (idPtr, requestId, callback) {
        var id = UTF8ToString(idPtr);
        // cancelAsync resolves void: report success with no payload.
        Yes2SDKBridge.run(callback, requestId, 'notifications.cancelAsync', function () {
            return [id];
        }, function () {
            return null;
        });
    },

    Yes2SDK_notifications_cancelAll: function (requestId, callback) {
        Yes2SDKBridge.run(callback, requestId, 'notifications.cancelAllAsync', null, function () {
            return null;
        });
    },

    Yes2SDK_notifications_isSupported: function () {
        try {
            if (window.Yes2SDK && window.Yes2SDK.notifications && typeof window.Yes2SDK.notifications.isSupported === 'function') {
                return window.Yes2SDK.notifications.isSupported() ? 1 : 0;
            }
        } catch (e) {}
        return 0;
    }
}

autoAddDeps(Yes2SDKNotificationsLib, '$Yes2SDKBridge');
addToLibrary(Yes2SDKNotificationsLib);
