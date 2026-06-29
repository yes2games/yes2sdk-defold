var Yes2SDKReviewLib = {

    $Yes2SDKReviewCallbacks: {
        _canReviewPtr: null,
        _requestReviewPtr: null,

        allocateString: function (str) {
            return stringToUTF8OnStack(str);
        }
    },

    Yes2SDK_review_canReview: function (callback) {
        Yes2SDKReviewCallbacks._canReviewPtr = callback;
        if (window.Yes2SDK && window.Yes2SDK.review) {
            try {
                window.Yes2SDK.review.canReviewAsync()
                    .then(function (result) {
                        var json = JSON.stringify(result || {});
                        {{{ makeDynCall("vii", "Yes2SDKReviewCallbacks._canReviewPtr") }}}(1, Yes2SDKReviewCallbacks.allocateString(json));
                    })
                    .catch(function (err) {
                        var msg = typeof err === 'object' ? JSON.stringify(err) : String(err);
                        {{{ makeDynCall("vii", "Yes2SDKReviewCallbacks._canReviewPtr") }}}(0, Yes2SDKReviewCallbacks.allocateString(msg));
                    });
            } catch (e) {
                // Synchronous throw (e.g. method missing on this platform) never reaches .catch — route it here so the Lua callback still fires.
                {{{ makeDynCall("vii", "Yes2SDKReviewCallbacks._canReviewPtr") }}}(0, Yes2SDKReviewCallbacks.allocateString(typeof e === 'object' ? JSON.stringify(e) : String(e)));
            }
        } else {
            {{{ makeDynCall("vii", "Yes2SDKReviewCallbacks._canReviewPtr") }}}(0, Yes2SDKReviewCallbacks.allocateString("SDK not initialized"));
        }
    },

    Yes2SDK_review_requestReview: function (callback) {
        Yes2SDKReviewCallbacks._requestReviewPtr = callback;
        if (window.Yes2SDK && window.Yes2SDK.review) {
            try {
                window.Yes2SDK.review.requestReviewAsync()
                    .then(function (result) {
                        var json = JSON.stringify(result || {});
                        {{{ makeDynCall("vii", "Yes2SDKReviewCallbacks._requestReviewPtr") }}}(1, Yes2SDKReviewCallbacks.allocateString(json));
                    })
                    .catch(function (err) {
                        var msg = typeof err === 'object' ? JSON.stringify(err) : String(err);
                        {{{ makeDynCall("vii", "Yes2SDKReviewCallbacks._requestReviewPtr") }}}(0, Yes2SDKReviewCallbacks.allocateString(msg));
                    });
            } catch (e) {
                // Synchronous throw (e.g. method missing on this platform) never reaches .catch — route it here so the Lua callback still fires.
                {{{ makeDynCall("vii", "Yes2SDKReviewCallbacks._requestReviewPtr") }}}(0, Yes2SDKReviewCallbacks.allocateString(typeof e === 'object' ? JSON.stringify(e) : String(e)));
            }
        } else {
            {{{ makeDynCall("vii", "Yes2SDKReviewCallbacks._requestReviewPtr") }}}(0, Yes2SDKReviewCallbacks.allocateString("SDK not initialized"));
        }
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

autoAddDeps(Yes2SDKReviewLib, '$Yes2SDKReviewCallbacks');
addToLibrary(Yes2SDKReviewLib);
