var Yes2SDKAdsLib = {

    $Yes2SDKAdsCallbacks: {
        _beforeAdPtr: null,
        _afterAdPtr: null,
        _adDismissedPtr: null,
        _adViewedPtr: null,
        _noFillPtr: null,

        beforeAd: function () {
            if (Yes2SDKAdsCallbacks._beforeAdPtr) {
                {{{ makeDynCall("vii", "Yes2SDKAdsCallbacks._beforeAdPtr") }}}(1, 0);
            }
        },

        afterAd: function () {
            if (Yes2SDKAdsCallbacks._afterAdPtr) {
                {{{ makeDynCall("vii", "Yes2SDKAdsCallbacks._afterAdPtr") }}}(1, 0);
            }
        },

        adDismissed: function () {
            if (Yes2SDKAdsCallbacks._adDismissedPtr) {
                {{{ makeDynCall("vii", "Yes2SDKAdsCallbacks._adDismissedPtr") }}}(1, 0);
            }
        },

        adViewed: function () {
            if (Yes2SDKAdsCallbacks._adViewedPtr) {
                {{{ makeDynCall("vii", "Yes2SDKAdsCallbacks._adViewedPtr") }}}(1, 0);
            }
        },

        noFill: function () {
            if (Yes2SDKAdsCallbacks._noFillPtr) {
                {{{ makeDynCall("vii", "Yes2SDKAdsCallbacks._noFillPtr") }}}(1, 0);
            }
        }
    },

    Yes2SDK_ads_showInterstitial: function (placementPtr, beforeAd, afterAd, noFill) {
        Yes2SDKAdsCallbacks._beforeAdPtr = beforeAd;
        Yes2SDKAdsCallbacks._afterAdPtr = afterAd;
        Yes2SDKAdsCallbacks._adDismissedPtr = null;
        Yes2SDKAdsCallbacks._adViewedPtr = null;
        Yes2SDKAdsCallbacks._noFillPtr = noFill;

        if (window.Yes2SDK && window.Yes2SDK.ads) {
            window.Yes2SDK.ads.showInterstitial(
                UTF8ToString(placementPtr),
                {
                    beforeAd: Yes2SDKAdsCallbacks.beforeAd,
                    afterAd: Yes2SDKAdsCallbacks.afterAd,
                    noFill: Yes2SDKAdsCallbacks.noFill
                }
            );
        } else {
            Yes2SDKAdsCallbacks.noFill();
        }
    },

    Yes2SDK_ads_showRewarded: function (placementPtr, beforeAd, afterAd, adDismissed, adViewed, noFill) {
        Yes2SDKAdsCallbacks._beforeAdPtr = beforeAd;
        Yes2SDKAdsCallbacks._afterAdPtr = afterAd;
        Yes2SDKAdsCallbacks._adDismissedPtr = adDismissed;
        Yes2SDKAdsCallbacks._adViewedPtr = adViewed;
        Yes2SDKAdsCallbacks._noFillPtr = noFill;

        if (window.Yes2SDK && window.Yes2SDK.ads) {
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
        } else {
            Yes2SDKAdsCallbacks.noFill();
        }
    }
}

autoAddDeps(Yes2SDKAdsLib, '$Yes2SDKAdsCallbacks');
addToLibrary(Yes2SDKAdsLib);
