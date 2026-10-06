var Yes2SDKDataLib = {

    $Yes2SDKDataUtils: {
        allocateString: function (str) {
            return stringToUTF8OnStack(str);
        }
    },

    Yes2SDK_data_getInt: function (keyPtr, defaultValue) {
        try {
            if (window.Yes2SDK && window.Yes2SDK.data) {
                return window.Yes2SDK.data.getInt(UTF8ToString(keyPtr), defaultValue);
            }
        } catch (e) {}
        return defaultValue;
    },

    Yes2SDK_data_setInt: function (keyPtr, value) {
        try {
            if (window.Yes2SDK && window.Yes2SDK.data) {
                window.Yes2SDK.data.setInt(UTF8ToString(keyPtr), value);
            }
        } catch (e) {}
    },

    Yes2SDK_data_getFloat: function (keyPtr, defaultValue) {
        try {
            if (window.Yes2SDK && window.Yes2SDK.data) {
                return window.Yes2SDK.data.getFloat(UTF8ToString(keyPtr), defaultValue);
            }
        } catch (e) {}
        return defaultValue;
    },

    Yes2SDK_data_setFloat: function (keyPtr, value) {
        try {
            if (window.Yes2SDK && window.Yes2SDK.data) {
                window.Yes2SDK.data.setFloat(UTF8ToString(keyPtr), value);
            }
        } catch (e) {}
    },

    Yes2SDK_data_getString: function (keyPtr, defaultPtr) {
        try {
            if (window.Yes2SDK && window.Yes2SDK.data) {
                var result = window.Yes2SDK.data.getString(UTF8ToString(keyPtr), UTF8ToString(defaultPtr));
                return Yes2SDKDataUtils.allocateString(result);
            }
        } catch (e) {}
        return Yes2SDKDataUtils.allocateString(UTF8ToString(defaultPtr));
    },

    Yes2SDK_data_setString: function (keyPtr, valuePtr) {
        try {
            if (window.Yes2SDK && window.Yes2SDK.data) {
                window.Yes2SDK.data.setString(UTF8ToString(keyPtr), UTF8ToString(valuePtr));
            }
        } catch (e) {}
    },

    Yes2SDK_data_hasKey: function (keyPtr) {
        try {
            if (window.Yes2SDK && window.Yes2SDK.data) {
                return window.Yes2SDK.data.hasKey(UTF8ToString(keyPtr)) ? 1 : 0;
            }
        } catch (e) {}
        return 0;
    },

    Yes2SDK_data_deleteKey: function (keyPtr) {
        try {
            if (window.Yes2SDK && window.Yes2SDK.data) {
                window.Yes2SDK.data.deleteKey(UTF8ToString(keyPtr));
            }
        } catch (e) {}
    },

    Yes2SDK_data_deleteAll: function () {
        try {
            if (window.Yes2SDK && window.Yes2SDK.data) {
                window.Yes2SDK.data.deleteAll();
            }
        } catch (e) {}
    },

    // Confirmed writes: each call carries the request id minted in C++ and completes
    // through $Yes2SDKBridge. The platform resolves true once the write is stored; a
    // resolved false means it did not confirm, which is reported as a failure.
    // Strings are read before the call returns: the pointers are only valid until then.

    Yes2SDK_data_setStringAsync: function (keyPtr, valuePtr, requestId, callback) {
        var key = UTF8ToString(keyPtr);
        var value = UTF8ToString(valuePtr);
        Yes2SDKBridge.run(callback, requestId, 'data.setStringAsync', function () {
            return [key, value];
        }, function (confirmed) {
            if (confirmed !== true) {
                throw { code: 'UNKNOWN_ERROR', message: 'The platform did not confirm the write', context: 'data.setStringAsync' };
            }
            return null;
        });
    },

    Yes2SDK_data_flush: function (requestId, callback) {
        Yes2SDKBridge.run(callback, requestId, 'data.flushAsync', null, function (confirmed) {
            if (confirmed !== true) {
                throw { code: 'UNKNOWN_ERROR', message: 'The platform did not confirm the flush', context: 'data.flushAsync' };
            }
            return null;
        });
    }
}

autoAddDeps(Yes2SDKDataLib, '$Yes2SDKDataUtils');
autoAddDeps(Yes2SDKDataLib, '$Yes2SDKBridge');
addToLibrary(Yes2SDKDataLib);
