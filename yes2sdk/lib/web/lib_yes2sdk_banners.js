var Yes2SDKBannersLib = {

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
    }
}

addToLibrary(Yes2SDKBannersLib);
