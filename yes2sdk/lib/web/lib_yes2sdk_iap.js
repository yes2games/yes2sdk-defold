var Yes2SDKIapLib = {

    $Yes2SDKIapCallbacks: {
        _getCatalogPtr: null,
        _getProductPtr: null,
        _purchasePtr: null,
        _getPurchasesPtr: null,
        _consumePtr: null,

        allocateString: function (str) {
            return stringToUTF8OnStack(str);
        }
    },

    Yes2SDK_iap_getCatalog: function (callback) {
        Yes2SDKIapCallbacks._getCatalogPtr = callback;
        if (window.Yes2SDK && window.Yes2SDK.iap) {
            try {
                window.Yes2SDK.iap.getCatalogAsync()
                    .then(function (result) {
                        var json = JSON.stringify(result || []);
                        {{{ makeDynCall("vii", "Yes2SDKIapCallbacks._getCatalogPtr") }}}(1, Yes2SDKIapCallbacks.allocateString(json));
                    })
                    .catch(function (err) {
                        var msg = typeof err === 'object' ? JSON.stringify(err) : String(err);
                        {{{ makeDynCall("vii", "Yes2SDKIapCallbacks._getCatalogPtr") }}}(0, Yes2SDKIapCallbacks.allocateString(msg));
                    });
            } catch (e) {
                // Synchronous throw (e.g. method missing on this platform) never reaches .catch — route it here so the Lua callback still fires.
                {{{ makeDynCall("vii", "Yes2SDKIapCallbacks._getCatalogPtr") }}}(0, Yes2SDKIapCallbacks.allocateString(typeof e === 'object' ? JSON.stringify(e) : String(e)));
            }
        } else {
            {{{ makeDynCall("vii", "Yes2SDKIapCallbacks._getCatalogPtr") }}}(0, Yes2SDKIapCallbacks.allocateString("SDK not initialized"));
        }
    },

    Yes2SDK_iap_getProduct: function (productIdPtr, callback) {
        Yes2SDKIapCallbacks._getProductPtr = callback;
        if (window.Yes2SDK && window.Yes2SDK.iap) {
            try {
                window.Yes2SDK.iap.getProductAsync(UTF8ToString(productIdPtr))
                    .then(function (result) {
                        // result may be null when the product is unknown — pass JSON "null".
                        var json = JSON.stringify(result === undefined ? null : result);
                        {{{ makeDynCall("vii", "Yes2SDKIapCallbacks._getProductPtr") }}}(1, Yes2SDKIapCallbacks.allocateString(json));
                    })
                    .catch(function (err) {
                        var msg = typeof err === 'object' ? JSON.stringify(err) : String(err);
                        {{{ makeDynCall("vii", "Yes2SDKIapCallbacks._getProductPtr") }}}(0, Yes2SDKIapCallbacks.allocateString(msg));
                    });
            } catch (e) {
                {{{ makeDynCall("vii", "Yes2SDKIapCallbacks._getProductPtr") }}}(0, Yes2SDKIapCallbacks.allocateString(typeof e === 'object' ? JSON.stringify(e) : String(e)));
            }
        } else {
            {{{ makeDynCall("vii", "Yes2SDKIapCallbacks._getProductPtr") }}}(0, Yes2SDKIapCallbacks.allocateString("SDK not initialized"));
        }
    },

    Yes2SDK_iap_purchase: function (productIdPtr, developerPayloadPtr, callback) {
        Yes2SDKIapCallbacks._purchasePtr = callback;
        var developerPayload = UTF8ToString(developerPayloadPtr);
        if (window.Yes2SDK && window.Yes2SDK.iap) {
            try {
                window.Yes2SDK.iap.purchaseAsync({
                    productId: UTF8ToString(productIdPtr),
                    developerPayload: developerPayload || undefined
                })
                    .then(function (result) {
                        var json = JSON.stringify(result || {});
                        {{{ makeDynCall("vii", "Yes2SDKIapCallbacks._purchasePtr") }}}(1, Yes2SDKIapCallbacks.allocateString(json));
                    })
                    .catch(function (err) {
                        var msg = typeof err === 'object' ? JSON.stringify(err) : String(err);
                        {{{ makeDynCall("vii", "Yes2SDKIapCallbacks._purchasePtr") }}}(0, Yes2SDKIapCallbacks.allocateString(msg));
                    });
            } catch (e) {
                {{{ makeDynCall("vii", "Yes2SDKIapCallbacks._purchasePtr") }}}(0, Yes2SDKIapCallbacks.allocateString(typeof e === 'object' ? JSON.stringify(e) : String(e)));
            }
        } else {
            {{{ makeDynCall("vii", "Yes2SDKIapCallbacks._purchasePtr") }}}(0, Yes2SDKIapCallbacks.allocateString("SDK not initialized"));
        }
    },

    Yes2SDK_iap_getPurchases: function (callback) {
        Yes2SDKIapCallbacks._getPurchasesPtr = callback;
        if (window.Yes2SDK && window.Yes2SDK.iap) {
            try {
                window.Yes2SDK.iap.getPurchasesAsync()
                    .then(function (result) {
                        var json = JSON.stringify(result || []);
                        {{{ makeDynCall("vii", "Yes2SDKIapCallbacks._getPurchasesPtr") }}}(1, Yes2SDKIapCallbacks.allocateString(json));
                    })
                    .catch(function (err) {
                        var msg = typeof err === 'object' ? JSON.stringify(err) : String(err);
                        {{{ makeDynCall("vii", "Yes2SDKIapCallbacks._getPurchasesPtr") }}}(0, Yes2SDKIapCallbacks.allocateString(msg));
                    });
            } catch (e) {
                {{{ makeDynCall("vii", "Yes2SDKIapCallbacks._getPurchasesPtr") }}}(0, Yes2SDKIapCallbacks.allocateString(typeof e === 'object' ? JSON.stringify(e) : String(e)));
            }
        } else {
            {{{ makeDynCall("vii", "Yes2SDKIapCallbacks._getPurchasesPtr") }}}(0, Yes2SDKIapCallbacks.allocateString("SDK not initialized"));
        }
    },

    Yes2SDK_iap_consumePurchase: function (purchaseTokenPtr, callback) {
        Yes2SDKIapCallbacks._consumePtr = callback;
        if (window.Yes2SDK && window.Yes2SDK.iap) {
            try {
                window.Yes2SDK.iap.consumePurchaseAsync(UTF8ToString(purchaseTokenPtr))
                    .then(function () {
                        // consumePurchaseAsync resolves void — report success with no result.
                        {{{ makeDynCall("vii", "Yes2SDKIapCallbacks._consumePtr") }}}(1, 0);
                    })
                    .catch(function (err) {
                        var msg = typeof err === 'object' ? JSON.stringify(err) : String(err);
                        {{{ makeDynCall("vii", "Yes2SDKIapCallbacks._consumePtr") }}}(0, Yes2SDKIapCallbacks.allocateString(msg));
                    });
            } catch (e) {
                {{{ makeDynCall("vii", "Yes2SDKIapCallbacks._consumePtr") }}}(0, Yes2SDKIapCallbacks.allocateString(typeof e === 'object' ? JSON.stringify(e) : String(e)));
            }
        } else {
            {{{ makeDynCall("vii", "Yes2SDKIapCallbacks._consumePtr") }}}(0, Yes2SDKIapCallbacks.allocateString("SDK not initialized"));
        }
    },

    Yes2SDK_iap_isSupported: function () {
        try {
            if (window.Yes2SDK && window.Yes2SDK.iap && typeof window.Yes2SDK.iap.isSupported === 'function') {
                return window.Yes2SDK.iap.isSupported() ? 1 : 0;
            }
        } catch (e) {}
        return 0;
    }
}

autoAddDeps(Yes2SDKIapLib, '$Yes2SDKIapCallbacks');
addToLibrary(Yes2SDKIapLib);
