var Yes2SDKAdsLib = {

    $Yes2SDKAdsCallbacks: {
        _beforeAdPtr: null,
        _afterAdPtr: null,
        _adDismissedPtr: null,
        _adViewedPtr: null,
        _noFillPtr: null,
        _activeId: 0,

        // Wraps one handler so it only runs while ad `myId` is still the newest request.
        _guard: function (myId, event) {
            return function () {
                if (myId !== Yes2SDKAdsCallbacks._activeId) {
                    console.warn("[Yes2SDK] ignoring " + event + " from an ad that is no longer current");
                    return;
                }
                Yes2SDKAdsCallbacks[event]();
            };
        },

        beforeAd: function () {
            if (Yes2SDKAdsCallbacks._beforeAdPtr) {
                try {
                    {{{ makeDynCall("vii", "Yes2SDKAdsCallbacks._beforeAdPtr") }}}(1, 0);
                } catch (e) {
                    console.error("[Yes2SDK] beforeAd callback error:", e);
                }
            }
        },

        afterAd: function () {
            if (Yes2SDKAdsCallbacks._afterAdPtr) {
                try {
                    {{{ makeDynCall("vii", "Yes2SDKAdsCallbacks._afterAdPtr") }}}(1, 0);
                } catch (e) {
                    console.error("[Yes2SDK] afterAd callback error:", e);
                }
            }
        },

        adDismissed: function () {
            if (Yes2SDKAdsCallbacks._adDismissedPtr) {
                try {
                    {{{ makeDynCall("vii", "Yes2SDKAdsCallbacks._adDismissedPtr") }}}(1, 0);
                } catch (e) {
                    console.error("[Yes2SDK] adDismissed callback error:", e);
                }
            }
        },

        adViewed: function () {
            if (Yes2SDKAdsCallbacks._adViewedPtr) {
                try {
                    {{{ makeDynCall("vii", "Yes2SDKAdsCallbacks._adViewedPtr") }}}(1, 0);
                } catch (e) {
                    console.error("[Yes2SDK] adViewed callback error:", e);
                }
            }
        },

        noFill: function () {
            if (Yes2SDKAdsCallbacks._noFillPtr) {
                try {
                    {{{ makeDynCall("vii", "Yes2SDKAdsCallbacks._noFillPtr") }}}(1, 0);
                } catch (e) {
                    console.error("[Yes2SDK] noFill callback error:", e);
                }
            }
        }
    },

    Yes2SDK_ads_showInterstitial: function (placementPtr, beforeAd, afterAd, noFill) {
        var myId = ++Yes2SDKAdsCallbacks._activeId;
        Yes2SDKAdsCallbacks._beforeAdPtr = beforeAd;
        Yes2SDKAdsCallbacks._afterAdPtr = afterAd;
        Yes2SDKAdsCallbacks._adDismissedPtr = null;
        Yes2SDKAdsCallbacks._adViewedPtr = null;
        Yes2SDKAdsCallbacks._noFillPtr = noFill;

        if (window.Yes2SDK && window.Yes2SDK.ads) {
            try {
                window.Yes2SDK.ads.showInterstitial(
                    UTF8ToString(placementPtr),
                    {
                        beforeAd: Yes2SDKAdsCallbacks._guard(myId, "beforeAd"),
                        afterAd: Yes2SDKAdsCallbacks._guard(myId, "afterAd"),
                        noFill: Yes2SDKAdsCallbacks._guard(myId, "noFill")
                    }
                );
            } catch (e) {
                console.error("[Yes2SDK] showInterstitial threw:", e);
                Yes2SDKAdsCallbacks._guard(myId, "noFill")();
            }
        } else {
            Yes2SDKAdsCallbacks._guard(myId, "noFill")();
        }
    },

    Yes2SDK_ads_showRewarded: function (placementPtr, beforeAd, afterAd, adDismissed, adViewed, noFill) {
        var myId = ++Yes2SDKAdsCallbacks._activeId;
        Yes2SDKAdsCallbacks._beforeAdPtr = beforeAd;
        Yes2SDKAdsCallbacks._afterAdPtr = afterAd;
        Yes2SDKAdsCallbacks._adDismissedPtr = adDismissed;
        Yes2SDKAdsCallbacks._adViewedPtr = adViewed;
        Yes2SDKAdsCallbacks._noFillPtr = noFill;

        if (window.Yes2SDK && window.Yes2SDK.ads) {
            try {
                window.Yes2SDK.ads.showRewarded(
                    UTF8ToString(placementPtr),
                    {
                        beforeAd: Yes2SDKAdsCallbacks._guard(myId, "beforeAd"),
                        afterAd: Yes2SDKAdsCallbacks._guard(myId, "afterAd"),
                        adDismissed: Yes2SDKAdsCallbacks._guard(myId, "adDismissed"),
                        adViewed: Yes2SDKAdsCallbacks._guard(myId, "adViewed"),
                        noFill: Yes2SDKAdsCallbacks._guard(myId, "noFill")
                    }
                );
            } catch (e) {
                console.error("[Yes2SDK] showRewarded threw:", e);
                Yes2SDKAdsCallbacks._guard(myId, "noFill")();
            }
        } else {
            Yes2SDKAdsCallbacks._guard(myId, "noFill")();
        }
    },

    Yes2SDK_ads_isRewardedAdAvailable: function () {
        try {
            if (window.Yes2SDK && window.Yes2SDK.ads && typeof window.Yes2SDK.ads.isRewardedAdAvailable === 'function') {
                return window.Yes2SDK.ads.isRewardedAdAvailable() ? 1 : 0;
            }
        } catch (e) {}
        return 0;
    },

    Yes2SDK_ads_isInterstitialSupported: function () {
        try {
            if (window.Yes2SDK && window.Yes2SDK.ads && typeof window.Yes2SDK.ads.isInterstitialSupported === 'function') {
                return window.Yes2SDK.ads.isInterstitialSupported() ? 1 : 0;
            }
        } catch (e) {}
        return 0;
    },

    Yes2SDK_ads_isRewardedSupported: function () {
        try {
            if (window.Yes2SDK && window.Yes2SDK.ads && typeof window.Yes2SDK.ads.isRewardedSupported === 'function') {
                return window.Yes2SDK.ads.isRewardedSupported() ? 1 : 0;
            }
        } catch (e) {}
        return 0;
    }
}

autoAddDeps(Yes2SDKAdsLib, '$Yes2SDKAdsCallbacks');
addToLibrary(Yes2SDKAdsLib);
