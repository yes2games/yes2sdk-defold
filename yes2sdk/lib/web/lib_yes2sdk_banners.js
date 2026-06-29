var Yes2SDKBannersLib = {

    $Yes2SDKBannersCallbacks: {
        _getStatusPtr: null,

        allocateString: function (str) {
            return stringToUTF8OnStack(str);
        }
    },

    Yes2SDK_banners_show: function (idPtr, sizePtr) {
        try {
            if (window.Yes2SDK && window.Yes2SDK.banners) {
                window.Yes2SDK.banners.showBannerAsync(UTF8ToString(idPtr), UTF8ToString(sizePtr));
            }
        } catch (e) {}
    },

    Yes2SDK_banners_hide: function (idPtr) {
        try {
            if (window.Yes2SDK && window.Yes2SDK.banners) {
                window.Yes2SDK.banners.hideBanner(UTF8ToString(idPtr));
            }
        } catch (e) {}
    },

    Yes2SDK_banners_hideAll: function () {
        try {
            if (window.Yes2SDK && window.Yes2SDK.banners) {
                window.Yes2SDK.banners.hideAllBanners();
            }
        } catch (e) {}
    },

    Yes2SDK_banners_isSupported: function () {
        try {
            if (window.Yes2SDK && window.Yes2SDK.banners && typeof window.Yes2SDK.banners.isSupported === 'function') {
                return window.Yes2SDK.banners.isSupported() ? 1 : 0;
            }
        } catch (e) {}
        return 0;
    },

    Yes2SDK_banners_getStatus: function (callback) {
        Yes2SDKBannersCallbacks._getStatusPtr = callback;
        if (window.Yes2SDK && window.Yes2SDK.banners) {
            try {
                window.Yes2SDK.banners.getBannerStatusAsync()
                    .then(function (status) {
                        {{{ makeDynCall("vii", "Yes2SDKBannersCallbacks._getStatusPtr") }}}(1, Yes2SDKBannersCallbacks.allocateString(JSON.stringify(status || {})));
                    })
                    .catch(function (err) {
                        var msg = typeof err === 'object' ? JSON.stringify(err) : String(err);
                        {{{ makeDynCall("vii", "Yes2SDKBannersCallbacks._getStatusPtr") }}}(0, Yes2SDKBannersCallbacks.allocateString(msg));
                    });
            } catch (e) {
                // Synchronous throw (e.g. method missing on this platform) never reaches .catch — route it here so the Lua callback still fires.
                {{{ makeDynCall("vii", "Yes2SDKBannersCallbacks._getStatusPtr") }}}(0, Yes2SDKBannersCallbacks.allocateString(typeof e === 'object' ? JSON.stringify(e) : String(e)));
            }
        } else {
            {{{ makeDynCall("vii", "Yes2SDKBannersCallbacks._getStatusPtr") }}}(0, Yes2SDKBannersCallbacks.allocateString("SDK not initialized"));
        }
    }
}

autoAddDeps(Yes2SDKBannersLib, '$Yes2SDKBannersCallbacks');
addToLibrary(Yes2SDKBannersLib);
