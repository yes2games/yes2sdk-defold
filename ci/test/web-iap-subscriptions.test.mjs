// Subscription calls in yes2sdk/lib/web/lib_yes2sdk_iap.js, plus the purchase
// fields that already reach Lua because the whole Purchase is serialized.
//
// Every async call completes through the request router ("viii" dyncall:
// requestId, success, payload), so overlapping calls each complete with their
// own id and payload.

import assert from "node:assert/strict";
import { test } from "node:test";
import { loadWebLib } from "./helpers/web-lib.mjs";

const LIBS = ["yes2sdk/lib/web/lib_yes2sdk.js", "yes2sdk/lib/web/lib_yes2sdk_iap.js"];
const CB = 42;

const errorJson = (code, message, context) => JSON.stringify({ code, message, context });

function deferred() {
    let resolve;
    let reject;
    const promise = new Promise((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
}

function completions(web) {
    return web.dyncalls.map((call) => {
        assert.equal(call.sig, "viii", "completions go through the request router signature");
        assert.equal(call.ptr, CB);
        return call.args;
    });
}

const SUB = {
    productId: "premium",
    title: "Premium",
    description: "d",
    price: "4.99 USD",
    priceAmount: 499,
    priceCurrencyCode: "USD",
    billingPeriod: "monthly",
    isActive: true,
    trialEligible: false,
    introOffer: null,
    retentionOffer: null,
};

// [export, Core method, export args before (requestId, callback), expected Core args]
const CALLS = [
    ["Yes2SDK_iap_getSubscriptions", "getSubscriptionsAsync", [], []],
    ["Yes2SDK_iap_subscribe", "subscribeAsync", ["premium"], ["premium"]],
    ["Yes2SDK_iap_cancelSubscription", "cancelSubscriptionAsync", ["premium"], ["premium"]],
    ["Yes2SDK_iap_claimRetentionOffer", "claimRetentionOfferAsync", ["premium"], ["premium"]],
    ["Yes2SDK_iap_getSubscriptionStatus", "getSubscriptionStatusAsync", ["premium"], ["premium"]],
];

for (const [name, method, args, coreArgs] of CALLS) {
    test(`iap subscriptions: ${name} overlapping calls each complete with their own id`, async () => {
        const pending = [];
        const seen = [];
        const iap = {
            [method](...a) {
                seen.push({ self: this, args: a });
                const d = deferred();
                pending.push(d);
                return d.promise;
            },
        };
        const web = loadWebLib(LIBS, { yes2sdk: { iap } });
        web.exports[name](...args, 1, CB);
        web.exports[name](...args, 2, CB);
        assert.equal(pending.length, 2);
        assert.equal(seen[0].self, iap, "the module is this");
        assert.deepEqual(seen[0].args, coreArgs);
        pending[1].resolve(method === "cancelSubscriptionAsync" ? false : { n: 2 });
        await web.flush();
        pending[0].reject({ code: "PLATFORM_ERROR", message: "nope" });
        await web.flush();
        const done = completions(web);
        assert.equal(done.length, 2);
        assert.deepEqual(done[0].slice(0, 2), [2, 1]);
        assert.deepEqual(done[1], [1, 0, errorJson("PLATFORM_ERROR", "nope", `iap.${method}`)]);
        assert.deepEqual(web.problems, []);
    });

    test(`iap subscriptions: ${name} on an older SDK without the method is FEATURE_NOT_SUPPORTED`, async () => {
        const web = loadWebLib(LIBS, { yes2sdk: { iap: {} } });
        web.exports[name](...args, 7, CB);
        await web.flush();
        const done = completions(web);
        assert.equal(done.length, 1);
        assert.equal(done[0][0], 7);
        assert.equal(done[0][1], 0);
        const err = JSON.parse(done[0][2]);
        assert.equal(err.code, "FEATURE_NOT_SUPPORTED");
        assert.equal(err.context, `iap.${method}`);
    });

    test(`iap subscriptions: ${name} with no SDK is NOT_INITIALIZED`, async () => {
        const web = loadWebLib(LIBS, {});
        web.exports[name](...args, 8, CB);
        await web.flush();
        assert.deepEqual(completions(web), [[8, 0, errorJson("NOT_INITIALIZED", "SDK not initialized", `iap.${method}`)]]);
    });

    test(`iap subscriptions: ${name} depends on $Yes2SDKBridge`, () => {
        const web = loadWebLib(LIBS, { yes2sdk: {} });
        assert.ok(web.exports[`${name}__deps`].includes("$Yes2SDKBridge"));
    });
}

test("iap subscriptions: cancel reports the boolean as \"true\" or \"false\"", async () => {
    const results = [true, false, undefined, 1];
    const web = loadWebLib(LIBS, {
        yes2sdk: { iap: { cancelSubscriptionAsync: () => Promise.resolve(results.shift()) } },
    });
    for (const id of [1, 2, 3, 4]) web.exports.Yes2SDK_iap_cancelSubscription("p", id, CB);
    await web.flush();
    assert.deepEqual(completions(web), [
        [1, 1, "true"],
        [2, 1, "false"],
        [3, 1, "false"],
        [4, 1, "true"],
    ]);
});

test("iap subscriptions: payloads are the JSON of what Core resolved", async () => {
    const web = loadWebLib(LIBS, {
        yes2sdk: {
            iap: {
                getSubscriptionsAsync: () => Promise.resolve([SUB]),
                subscribeAsync: () => Promise.resolve({ status: "subscribed", subscription: SUB }),
                claimRetentionOfferAsync: () => Promise.resolve(SUB),
                getSubscriptionStatusAsync: () => Promise.resolve({ isActive: true, productId: "premium", willRenew: true }),
            },
        },
    });
    web.exports.Yes2SDK_iap_getSubscriptions(1, CB);
    web.exports.Yes2SDK_iap_subscribe("premium", 2, CB);
    web.exports.Yes2SDK_iap_claimRetentionOffer("premium", 3, CB);
    web.exports.Yes2SDK_iap_getSubscriptionStatus("premium", 4, CB);
    await web.flush();
    assert.deepEqual(completions(web), [
        [1, 1, JSON.stringify([SUB])],
        [2, 1, JSON.stringify({ status: "subscribed", subscription: SUB })],
        [3, 1, JSON.stringify(SUB)],
        [4, 1, JSON.stringify({ isActive: true, productId: "premium", willRenew: true })],
    ]);
});

test("iap subscriptions: a null subscription list reports an empty array, a cancelled checkout its status", async () => {
    const web = loadWebLib(LIBS, {
        yes2sdk: {
            iap: {
                getSubscriptionsAsync: () => Promise.resolve(null),
                subscribeAsync: () => Promise.resolve({ status: "cancelled" }),
            },
        },
    });
    web.exports.Yes2SDK_iap_getSubscriptions(1, CB);
    web.exports.Yes2SDK_iap_subscribe("premium", 2, CB);
    await web.flush();
    assert.deepEqual(completions(web), [
        [1, 1, "[]"],
        [2, 1, '{"status":"cancelled"}'],
    ]);
});

test("iap subscriptions: a cancelled checkout rejection keeps IAP_PURCHASE_CANCELLED", async () => {
    const web = loadWebLib(LIBS, {
        yes2sdk: { iap: { subscribeAsync: () => Promise.reject({ code: "IAP_PURCHASE_CANCELLED", message: "closed" }) } },
    });
    web.exports.Yes2SDK_iap_subscribe("premium", 9, CB);
    await web.flush();
    assert.deepEqual(completions(web), [[9, 0, errorJson("IAP_PURCHASE_CANCELLED", "closed", "iap.subscribeAsync")]]);
});

test("iap subscriptions: isSubscriptionSupported reads Core and never throws", () => {
    const cases = [
        [{ iap: { isSubscriptionSupported: () => true } }, 1],
        [{ iap: { isSubscriptionSupported: () => false } }, 0],
        [{ iap: {} }, 0],
        [{}, 0],
        [{ iap: { isSubscriptionSupported() { throw new Error("x"); } } }, 0],
    ];
    for (const [yes2sdk, expected] of cases) {
        const web = loadWebLib(LIBS, { yes2sdk });
        assert.equal(web.exports.Yes2SDK_iap_isSubscriptionSupported(), expected);
    }
    assert.equal(loadWebLib(LIBS, {}).exports.Yes2SDK_iap_isSubscriptionSupported(), 0);
});

test("iap purchases: isSandbox and signedRequest reach Lua unchanged", async () => {
    const purchase = {
        purchaseToken: "t1",
        productId: "coins",
        paymentId: "p1",
        purchaseTime: "2026-10-06T00:00:00Z",
        signedRequest: "sig.payload",
        isSandbox: true,
    };
    const web = loadWebLib(LIBS, {
        yes2sdk: {
            iap: {
                purchaseAsync: () => Promise.resolve(purchase),
                getPurchasesAsync: () => Promise.resolve([purchase]),
            },
        },
    });
    web.exports.Yes2SDK_iap_purchase("coins", "", 1, CB);
    web.exports.Yes2SDK_iap_getPurchases(2, CB);
    await web.flush();
    const [[, , one], [, , list]] = completions(web);
    assert.equal(JSON.parse(one).isSandbox, true);
    assert.equal(JSON.parse(one).signedRequest, "sig.payload");
    assert.deepEqual(JSON.parse(list), [purchase]);
});
