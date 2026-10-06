var Yes2SDKIapLib = {

    // Each async call carries the request id minted in C++ and completes through
    // $Yes2SDKBridge (defined in lib_yes2sdk.js), so overlapping calls never share
    // a callback slot. Strings are read before the call returns: the pointers are
    // only valid until then.

    Yes2SDK_iap_getCatalog: function (requestId, callback) {
        Yes2SDKBridge.run(callback, requestId, 'iap.getCatalogAsync', null, function (result) {
            return JSON.stringify(result || []);
        });
    },

    Yes2SDK_iap_getProduct: function (productIdPtr, requestId, callback) {
        var productId = UTF8ToString(productIdPtr);
        // A null result means the product is unknown: the default mapping passes JSON "null".
        Yes2SDKBridge.run(callback, requestId, 'iap.getProductAsync', function () {
            return [productId];
        });
    },

    Yes2SDK_iap_purchase: function (productIdPtr, developerPayloadPtr, requestId, callback) {
        var productId = UTF8ToString(productIdPtr);
        var developerPayload = UTF8ToString(developerPayloadPtr);
        Yes2SDKBridge.run(callback, requestId, 'iap.purchaseAsync', function () {
            return [{ productId: productId, developerPayload: developerPayload || undefined }];
        }, function (result) {
            return JSON.stringify(result || {});
        });
    },

    Yes2SDK_iap_getPurchases: function (requestId, callback) {
        Yes2SDKBridge.run(callback, requestId, 'iap.getPurchasesAsync', null, function (result) {
            return JSON.stringify(result || []);
        });
    },

    Yes2SDK_iap_consumePurchase: function (purchaseTokenPtr, requestId, callback) {
        var purchaseToken = UTF8ToString(purchaseTokenPtr);
        // consumePurchaseAsync resolves void: report success with no payload.
        Yes2SDKBridge.run(callback, requestId, 'iap.consumePurchaseAsync', function () {
            return [purchaseToken];
        }, function () {
            return null;
        });
    },

    Yes2SDK_iap_isSupported: function () {
        try {
            if (window.Yes2SDK && window.Yes2SDK.iap && typeof window.Yes2SDK.iap.isSupported === 'function') {
                return window.Yes2SDK.iap.isSupported() ? 1 : 0;
            }
        } catch (e) {}
        return 0;
    },

    // Subscriptions. Results are the JSON of what the SDK resolved; a runtime
    // without the method fails with FEATURE_NOT_SUPPORTED through run.

    Yes2SDK_iap_getSubscriptions: function (requestId, callback) {
        Yes2SDKBridge.run(callback, requestId, 'iap.getSubscriptionsAsync', null, function (result) {
            return JSON.stringify(result || []);
        });
    },

    Yes2SDK_iap_subscribe: function (productIdPtr, requestId, callback) {
        var productId = UTF8ToString(productIdPtr);
        Yes2SDKBridge.run(callback, requestId, 'iap.subscribeAsync', function () {
            return [productId];
        });
    },

    Yes2SDK_iap_cancelSubscription: function (productIdPtr, requestId, callback) {
        var productId = UTF8ToString(productIdPtr);
        // Resolves a boolean: pass "true" or "false", the Lua wrapper turns it back into one.
        Yes2SDKBridge.run(callback, requestId, 'iap.cancelSubscriptionAsync', function () {
            return [productId];
        }, function (result) {
            return result ? 'true' : 'false';
        });
    },

    Yes2SDK_iap_claimRetentionOffer: function (productIdPtr, requestId, callback) {
        var productId = UTF8ToString(productIdPtr);
        Yes2SDKBridge.run(callback, requestId, 'iap.claimRetentionOfferAsync', function () {
            return [productId];
        });
    },

    Yes2SDK_iap_getSubscriptionStatus: function (productIdPtr, requestId, callback) {
        var productId = UTF8ToString(productIdPtr);
        Yes2SDKBridge.run(callback, requestId, 'iap.getSubscriptionStatusAsync', function () {
            return [productId];
        });
    },

    Yes2SDK_iap_isSubscriptionSupported: function () {
        try {
            if (window.Yes2SDK && window.Yes2SDK.iap && typeof window.Yes2SDK.iap.isSubscriptionSupported === 'function') {
                return window.Yes2SDK.iap.isSubscriptionSupported() ? 1 : 0;
            }
        } catch (e) {}
        return 0;
    }
}

autoAddDeps(Yes2SDKIapLib, '$Yes2SDKBridge');
addToLibrary(Yes2SDKIapLib);
