var Yes2SDKAdsLib = {

    $Yes2SDKAdsCallbacks: {
        _beforeAdPtr: null,
        _afterAdPtr: null,
        _adDismissedPtr: null,
        _adViewedPtr: null,
        _noFillPtr: null,

        beforeAd: function () {
            {{{ makeDynCall("vi", "Yes2SDKAdsCallbacks._beforeAdPtr") }}}(1);
        },

        afterAd: function () {
            {{{ makeDynCall("vi", "Yes2SDKAdsCallbacks._afterAdPtr") }}}(1);
        },

        adDismissed: function () {
            {{{ makeDynCall("vi", "Yes2SDKAdsCallbacks._adDismissedPtr") }}}(1);
        },

        adViewed: function () {
            {{{ makeDynCall("vi", "Yes2SDKAdsCallbacks._adViewedPtr") }}}(1);
        },

        noFill: function () {
            {{{ makeDynCall("vi", "Yes2SDKAdsCallbacks._noFillPtr") }}}(1);
        }
    },

    Yes2SDK_ads_showInterstitial: function (placementPtr, beforeAd, afterAd, noFill) {
        Yes2SDKAdsCallbacks._beforeAdPtr = beforeAd;
        Yes2SDKAdsCallbacks._afterAdPtr = afterAd;
        Yes2SDKAdsCallbacks._noFillPtr = noFill;

        window.Yes2SDK.ads.showInterstitial(
            UTF8ToString(placementPtr),
            {
                beforeAd: Yes2SDKAdsCallbacks.beforeAd,
                afterAd: Yes2SDKAdsCallbacks.afterAd,
                noFill: Yes2SDKAdsCallbacks.noFill
            }
        );
    },

    Yes2SDK_ads_showRewarded: function (placementPtr, beforeAd, afterAd, adDismissed, adViewed, noFill) {
        Yes2SDKAdsCallbacks._beforeAdPtr = beforeAd;
        Yes2SDKAdsCallbacks._afterAdPtr = afterAd;
        Yes2SDKAdsCallbacks._adDismissedPtr = adDismissed;
        Yes2SDKAdsCallbacks._adViewedPtr = adViewed;
        Yes2SDKAdsCallbacks._noFillPtr = noFill;

        window.Yes2SDK.ads.showRewarded(
            UTF8ToString(placementPtr),
            {
                beforeAd: Yes2SDKAdsCallbacks.beforeAd,
                afterAd: Yes2SDKAdsCallbacks.afterAd,
                adDismissed: Yes2SDKAdsCallbacks.adDismissed,
                adViewed: Yes2SDKAdsCallbacks.adViewed,
                noFill: Yes2SDKAdsCallbacks.noFill
            }
        );
    }
}

autoAddDeps(Yes2SDKAdsLib, '$Yes2SDKAdsCallbacks');
addToLibrary(Yes2SDKAdsLib);
