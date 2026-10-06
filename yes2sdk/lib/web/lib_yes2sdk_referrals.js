var Yes2SDKReferralsLib = {

    // Each async call carries the request id minted in C++ and completes through
    // $Yes2SDKBridge (defined in lib_yes2sdk.js). The options string is read before
    // the call returns: the pointer is only valid until then.

    Yes2SDK_referrals_share: function (optionsPtr, requestId, callback) {
        var optionsJson = UTF8ToString(optionsPtr);
        Yes2SDKBridge.run(callback, requestId, 'referrals.shareAsync', function () {
            return [JSON.parse(optionsJson)];
        }, function (result) {
            return JSON.stringify(result || { canceled: false });
        });
    },

    // The result ({ referrals, signedRequest }) passes through unchanged.
    Yes2SDK_referrals_list: function (requestId, callback) {
        Yes2SDKBridge.run(callback, requestId, 'referrals.listAsync');
    },

    Yes2SDK_referrals_isSupported: function () {
        try {
            if (window.Yes2SDK && window.Yes2SDK.referrals && typeof window.Yes2SDK.referrals.isSupported === 'function') {
                return window.Yes2SDK.referrals.isSupported() ? 1 : 0;
            }
        } catch (e) {}
        return 0;
    }
}

autoAddDeps(Yes2SDKReferralsLib, '$Yes2SDKBridge');
addToLibrary(Yes2SDKReferralsLib);
