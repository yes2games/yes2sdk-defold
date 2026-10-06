// Behaviour of yes2sdk/lib/web/lib_yes2sdk_iap.js through the request router.
//
// Every IAP call carries a request id minted in C++ and completes through the
// shared $Yes2SDKBridge with a "viii" dyncall: (requestId, success, payload).
// Two overlapping calls must each complete with their OWN id and payload, and
// every path (resolve, reject, sync throw, SDK missing) must complete exactly
// once.

import assert from "node:assert/strict";
import { test } from "node:test";
import { loadWebLib } from "./helpers/web-lib.mjs";

const LIBS = ["yes2sdk/lib/web/lib_yes2sdk.js", "yes2sdk/lib/web/lib_yes2sdk_iap.js"];
const CB = 42;

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
        assert.equal(call.sig, "viii", "IAP completions go through the request router signature");
        assert.equal(call.ptr, CB);
        return call.args;
    });
}

test("iap: two overlapping getCatalog calls resolved in reverse order each complete with their own id", async () => {
    const pending = [];
    const web = loadWebLib(LIBS, {
        yes2sdk: {
            iap: {
                getCatalogAsync() {
                    const d = deferred();
                    pending.push(d);
                    return d.promise;
                },
            },
        },
    });
    web.exports.Yes2SDK_iap_getCatalog(1, CB);
    web.exports.Yes2SDK_iap_getCatalog(2, CB);
    assert.equal(pending.length, 2);
    assert.equal(web.dyncalls.length, 0);

    pending[1].resolve([{ productId: "second" }]);
    await web.flush();
    pending[0].resolve([{ productId: "first" }]);
    await web.flush();

    assert.deepEqual(completions(web), [
        [2, 1, JSON.stringify([{ productId: "second" }])],
        [1, 1, JSON.stringify([{ productId: "first" }])],
    ]);
    assert.deepEqual(web.problems, []);
});

test("iap: getCatalog calls the Core method with the module as this", async () => {
    const iap = {
        items: [{ productId: "coins" }],
        getCatalogAsync() {
            return Promise.resolve(this.items);
        },
    };
    const web = loadWebLib(LIBS, { yes2sdk: { iap } });
    web.exports.Yes2SDK_iap_getCatalog(5, CB);
    await web.flush();
    assert.deepEqual(completions(web), [[5, 1, JSON.stringify(iap.items)]]);
});

test("iap: getCatalog null result reports an empty array", async () => {
    const web = loadWebLib(LIBS, { yes2sdk: { iap: { getCatalogAsync: () => Promise.resolve(null) } } });
    web.exports.Yes2SDK_iap_getCatalog(3, CB);
    await web.flush();
    assert.deepEqual(completions(web), [[3, 1, "[]"]]);
});

test("iap: a rejection completes once with the id and today's error string", async () => {
    const web = loadWebLib(LIBS, {
        yes2sdk: { iap: { getCatalogAsync: () => Promise.reject({ code: "PLATFORM_ERROR", message: "nope" }) } },
    });
    web.exports.Yes2SDK_iap_getCatalog(11, CB);
    await web.flush();
    assert.deepEqual(completions(web), [[11, 0, JSON.stringify({ code: "PLATFORM_ERROR", message: "nope" })]]);
});

test("iap: a string rejection is passed through as String(err)", async () => {
    const web = loadWebLib(LIBS, { yes2sdk: { iap: { purchaseAsync: () => Promise.reject("cancelled") } } });
    web.exports.Yes2SDK_iap_purchase("coins", "", 12, CB);
    await web.flush();
    assert.deepEqual(completions(web), [[12, 0, "cancelled"]]);
});

test("iap: a sync throw completes once with the id", async () => {
    const web = loadWebLib(LIBS, {
        yes2sdk: {
            iap: {
                getPurchasesAsync() {
                    throw "not on this platform";
                },
            },
        },
    });
    web.exports.Yes2SDK_iap_getPurchases(13, CB);
    await web.flush();
    assert.deepEqual(completions(web), [[13, 0, "not on this platform"]]);
});

test("iap: a missing method completes once as a failure", async () => {
    const web = loadWebLib(LIBS, { yes2sdk: { iap: {} } });
    web.exports.Yes2SDK_iap_consumePurchase("tok", 14, CB);
    await web.flush();
    const done = completions(web);
    assert.equal(done.length, 1);
    assert.equal(done[0][0], 14);
    assert.equal(done[0][1], 0);
    assert.equal(typeof done[0][2], "string");
});

test("iap: SDK not loaded completes every call once with its id", async () => {
    for (const yes2sdk of [undefined, {}]) {
        const web = loadWebLib(LIBS, yes2sdk === undefined ? {} : { yes2sdk });
        web.exports.Yes2SDK_iap_getCatalog(21, CB);
        web.exports.Yes2SDK_iap_getProduct("coins", 22, CB);
        web.exports.Yes2SDK_iap_purchase("coins", "", 23, CB);
        web.exports.Yes2SDK_iap_getPurchases(24, CB);
        web.exports.Yes2SDK_iap_consumePurchase("tok", 25, CB);
        await web.flush();
        assert.deepEqual(completions(web), [
            [21, 0, "SDK not initialized"],
            [22, 0, "SDK not initialized"],
            [23, 0, "SDK not initialized"],
            [24, 0, "SDK not initialized"],
            [25, 0, "SDK not initialized"],
        ]);
        assert.deepEqual(web.problems, []);
    }
});

test("iap: getProduct passes the id and reports a null result as \"null\"", async () => {
    let seen;
    const web = loadWebLib(LIBS, {
        yes2sdk: {
            iap: {
                getProductAsync(id) {
                    seen = id;
                    return Promise.resolve(null);
                },
            },
        },
    });
    web.exports.Yes2SDK_iap_getProduct("gems", 31, CB);
    await web.flush();
    assert.equal(seen, "gems");
    assert.deepEqual(completions(web), [[31, 1, "null"]]);
});

test("iap: purchase passes options and reports the purchase", async () => {
    const seen = [];
    const web = loadWebLib(LIBS, {
        yes2sdk: {
            iap: {
                purchaseAsync(options) {
                    seen.push(options);
                    return Promise.resolve({ purchaseToken: "t1" });
                },
            },
        },
    });
    web.exports.Yes2SDK_iap_purchase("coins", "payload", 41, CB);
    web.exports.Yes2SDK_iap_purchase("gems", 0, 42, CB);
    await web.flush();
    assert.deepEqual(seen, [
        { productId: "coins", developerPayload: "payload" },
        { productId: "gems", developerPayload: undefined },
    ]);
    assert.deepEqual(completions(web), [
        [41, 1, JSON.stringify({ purchaseToken: "t1" })],
        [42, 1, JSON.stringify({ purchaseToken: "t1" })],
    ]);
});

test("iap: purchase null result reports an empty object, getPurchases null an empty array", async () => {
    const web = loadWebLib(LIBS, {
        yes2sdk: {
            iap: {
                purchaseAsync: () => Promise.resolve(undefined),
                getPurchasesAsync: () => Promise.resolve(null),
            },
        },
    });
    web.exports.Yes2SDK_iap_purchase("coins", "", 51, CB);
    web.exports.Yes2SDK_iap_getPurchases(52, CB);
    await web.flush();
    assert.deepEqual(completions(web), [
        [51, 1, "{}"],
        [52, 1, "[]"],
    ]);
});

test("iap: consumePurchase success reports a nil payload (pointer 0)", async () => {
    let seen;
    const web = loadWebLib(LIBS, {
        yes2sdk: {
            iap: {
                consumePurchaseAsync(token) {
                    seen = token;
                    return Promise.resolve();
                },
            },
        },
    });
    web.exports.Yes2SDK_iap_consumePurchase("tok", 61, CB);
    await web.flush();
    assert.equal(seen, "tok");
    assert.deepEqual(completions(web), [[61, 1, 0]]);
});

test("iap: every async export completes exactly once on resolve and on reject", async () => {
    const calls = [
        ["Yes2SDK_iap_getCatalog", "getCatalogAsync", []],
        ["Yes2SDK_iap_getProduct", "getProductAsync", ["p"]],
        ["Yes2SDK_iap_purchase", "purchaseAsync", ["p", ""]],
        ["Yes2SDK_iap_getPurchases", "getPurchasesAsync", []],
        ["Yes2SDK_iap_consumePurchase", "consumePurchaseAsync", ["tok"]],
    ];
    for (const outcome of ["resolve", "reject"]) {
        const iap = {};
        for (const [, method] of calls) {
            iap[method] = () => (outcome === "resolve" ? Promise.resolve([]) : Promise.reject("x"));
        }
        const web = loadWebLib(LIBS, { yes2sdk: { iap } });
        calls.forEach(([name, , args], i) => web.exports[name](...args, 100 + i, CB));
        await web.flush();
        const done = completions(web);
        assert.deepEqual(
            done.map((args) => args[0]).sort(),
            [100, 101, 102, 103, 104],
            `${outcome}: each id completes once`,
        );
        for (const args of done) {
            assert.equal(args[1], outcome === "resolve" ? 1 : 0);
        }
        assert.deepEqual(web.problems, []);
    }
});

test("iap: the async exports depend on $Yes2SDKBridge and the old per-function slots are gone", () => {
    const web = loadWebLib(LIBS, { yes2sdk: {} });
    for (const name of [
        "Yes2SDK_iap_getCatalog",
        "Yes2SDK_iap_getProduct",
        "Yes2SDK_iap_purchase",
        "Yes2SDK_iap_getPurchases",
        "Yes2SDK_iap_consumePurchase",
    ]) {
        assert.ok(web.exports[`${name}__deps`].includes("$Yes2SDKBridge"), `${name} must list $Yes2SDKBridge`);
    }
    assert.equal(web.exports.$Yes2SDKIapCallbacks, undefined);
});
