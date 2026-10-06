var Yes2SDKBannersLib = {

    Yes2SDK_banners_show: function (idPtr, sizePtr) {
        try {
            var banners = window.Yes2SDK && window.Yes2SDK.banners;
            if (!banners || typeof banners.showBanner !== 'function') {
                console.warn('[Yes2SDK] banners_show failed: banner API is unavailable');
                return;
            }
            var result = banners.showBanner(UTF8ToString(idPtr), UTF8ToString(sizePtr));
            if (result && typeof result.catch === 'function') {
                result.catch(function (e) {
                    console.warn('[Yes2SDK] banners_show failed:', e);
                });
            }
        } catch (e) {
            console.warn('[Yes2SDK] banners_show failed:', e);
        }
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

    Yes2SDK_banners_getStatus: function (requestId, callback) {
        Yes2SDKBridge.run(callback, requestId, 'banners.getBannerStatusAsync', null, function (status) {
            return JSON.stringify(status || {});
        });
    }
}

autoAddDeps(Yes2SDKBannersLib, '$Yes2SDKBridge');
addToLibrary(Yes2SDKBannersLib);
