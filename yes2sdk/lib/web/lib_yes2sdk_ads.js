var Yes2SDKAdsLib = {

    $Yes2SDKAdsCallbacks: {
        _beforeAdPtr: null,
        _afterAdPtr: null,
        _adDismissedPtr: null,
        _adViewedPtr: null,
        _noFillPtr: null,

        // Ad surfaces steal focus, which the browser answers by suspending the
        // page's WebAudio AudioContext — leaving game audio dead after the ad
        // closes until the tab is blurred/refocused. Defold exposes no stable
        // audio-context global (unlike Unity's WEBAudio.audioContext), so instead
        // of guessing its handle we wrap the AudioContext constructor at startup to
        // track every instance, then resume any suspended ones on ad close.
        _audioContexts: [],
        _audioTrackerInstalled: false,

        installAudioContextTracker: function () {
            if (Yes2SDKAdsCallbacks._audioTrackerInstalled) return;
            Yes2SDKAdsCallbacks._audioTrackerInstalled = true;
            try {
                if (typeof window === 'undefined') return;
                ['AudioContext', 'webkitAudioContext'].forEach(function (name) {
                    var Original = window[name];
                    if (typeof Original !== 'function' || Original.__yes2Wrapped) return;
                    var Wrapped = function () {
                        var ctx = Reflect.construct(Original, arguments, Wrapped);
                        try { Yes2SDKAdsCallbacks._audioContexts.push(ctx); } catch (e) {}
                        return ctx;
                    };
                    Wrapped.prototype = Original.prototype;
                    Wrapped.__yes2Wrapped = true;
                    window[name] = Wrapped;
                });
            } catch (e) {
                // Tracking is best-effort — never break startup over it.
                console.warn("[Yes2SDK] AudioContext tracker install skipped:", e);
            }
        },

        resumeAudioContexts: function () {
            try {
                Yes2SDKAdsCallbacks._audioContexts.forEach(function (ctx) {
                    if (ctx && ctx.state === 'suspended' && typeof ctx.resume === 'function') {
                        // resume() is idempotent and a no-op when not suspended.
                        ctx.resume().catch(function () {});
                    }
                });
            } catch (e) { /* non-fatal */ }
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
            // Resume any AudioContext the ad surface suspended, before handing
            // control back to the game, so audio comes back with no user action.
            Yes2SDKAdsCallbacks.resumeAudioContexts();
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

    // Install the AudioContext tracker at module setup so it wraps the constructor
    // before Defold's audio device creates its context (created lazily on first
    // sound / user gesture, i.e. after this runs).
    $Yes2SDKAdsCallbacks__postset: 'Yes2SDKAdsCallbacks.installAudioContextTracker();',

    Yes2SDK_ads_showInterstitial: function (placementPtr, beforeAd, afterAd, noFill) {
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
                        beforeAd: Yes2SDKAdsCallbacks.beforeAd,
                        afterAd: Yes2SDKAdsCallbacks.afterAd,
                        noFill: Yes2SDKAdsCallbacks.noFill
                    }
                );
            } catch (e) {
                console.error("[Yes2SDK] showInterstitial threw:", e);
                Yes2SDKAdsCallbacks.noFill();
            }
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
            try {
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
            } catch (e) {
                console.error("[Yes2SDK] showRewarded threw:", e);
                Yes2SDKAdsCallbacks.noFill();
            }
        } else {
            Yes2SDKAdsCallbacks.noFill();
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
