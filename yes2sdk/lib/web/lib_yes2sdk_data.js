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
    }
}

autoAddDeps(Yes2SDKDataLib, '$Yes2SDKDataUtils');
addToLibrary(Yes2SDKDataLib);
