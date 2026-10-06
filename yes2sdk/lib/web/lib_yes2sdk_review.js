var Yes2SDKReviewLib = {

    // Each async call carries the request id minted in C++ and completes through
    // $Yes2SDKBridge (defined in lib_yes2sdk.js), so overlapping calls never share
    // a callback slot. Strings are read before the call returns: the pointers are
    // only valid until then.

    Yes2SDK_review_canReview: function (requestId, callback) {
        Yes2SDKBridge.run(callback, requestId, 'review.canReviewAsync', null, function (result) {
            return JSON.stringify(result || {});
        });
    },

    Yes2SDK_review_requestReview: function (requestId, callback) {
        Yes2SDKBridge.run(callback, requestId, 'review.requestReviewAsync', null, function (result) {
            return JSON.stringify(result || {});
        });
    },

    Yes2SDK_review_isSupported: function () {
        try {
            if (window.Yes2SDK && window.Yes2SDK.review && typeof window.Yes2SDK.review.isSupported === 'function') {
                return window.Yes2SDK.review.isSupported() ? 1 : 0;
            }
        } catch (e) {}
        return 0;
    }
}

autoAddDeps(Yes2SDKReviewLib, '$Yes2SDKBridge');
addToLibrary(Yes2SDKReviewLib);
