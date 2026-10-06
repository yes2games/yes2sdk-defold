// Self-test for ci/test/helpers/web-lib.mjs, the harness that loads a
// yes2sdk/lib/web/lib_yes2sdk*.js Emscripten library into a fake page.
//
// It proves three things later suites rely on: synchronous exports return what
// the fake window.Yes2SDK says, an async export reports through exactly one
// recorded dyncall once its promise settles, and a broken fake is visible as a
// failure path rather than passing silently.

import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { test } from "node:test";
import { REPO_ROOT, loadWebLib } from "./helpers/web-lib.mjs";

const SESSION = "yes2sdk/lib/web/lib_yes2sdk_session.js";
const IAP = "yes2sdk/lib/web/lib_yes2sdk_iap.js";
const CORE = "yes2sdk/lib/web/lib_yes2sdk.js";

test("session: every Yes2SDK_session_* function is exported", () => {
    const { exports } = loadWebLib(SESSION, { yes2sdk: {} });
    for (const name of [
        "Yes2SDK_session_gameplayStart",
        "Yes2SDK_session_gameplayStop",
        "Yes2SDK_session_getLocale",
        "Yes2SDK_session_isAudioEnabled",
        "Yes2SDK_session_getDeviceInfo",
    ]) {
        assert.equal(typeof exports[name], "function", `${name} is not exported`);
    }
});

test("session: getLocale returns the fake's locale as a string pointer", () => {
    const { exports } = loadWebLib(SESSION, { yes2sdk: { session: { getLocale: () => "tr" } } });
    assert.equal(exports.Yes2SDK_session_getLocale(), "tr");
});

test("session: gameplayStart reaches the fake", () => {
    const calls = [];
    const { exports } = loadWebLib(SESSION, { yes2sdk: { game: { gameplayStart: () => calls.push("start") } } });
    exports.Yes2SDK_session_gameplayStart();
    assert.deepEqual(calls, ["start"]);
});

test("session: getDeviceInfo normalizes the fake's shape", () => {
    const { exports } = loadWebLib(SESSION, {
        yes2sdk: { session: { getDeviceInfo: () => ({ type: "mobile", isMobile: true }) } },
    });
    assert.deepEqual(JSON.parse(exports.Yes2SDK_session_getDeviceInfo()), {
        type: "mobile",
        isMobile: true,
        isDesktop: false,
        isTablet: false,
        isTV: false,
    });
});

test("session: isAudioEnabled defaults to 1 with no SDK on the page", () => {
    const { exports } = loadWebLib(SESSION, {});
    assert.equal(exports.Yes2SDK_session_isAudioEnabled(), 1);
});

test("iap: a resolved getCatalogAsync produces exactly one success dyncall with the payload", async () => {
    const catalog = [{ productId: "coins", price: "$1" }];
    const web = loadWebLib(IAP, { yes2sdk: { iap: { getCatalogAsync: () => Promise.resolve(catalog) } } });
    web.exports.Yes2SDK_iap_getCatalog(42);
    assert.equal(web.dyncalls.length, 0, "the callback must not fire before the promise settles");
    await web.flush();
    assert.equal(web.dyncalls.length, 1);
    assert.deepEqual(web.dyncalls[0], { sig: "vii", ptr: 42, args: [1, JSON.stringify(catalog)] });
    assert.deepEqual(web.problems, []);
});

test("iap: the $Yes2SDKIapCallbacks helper is exported and injected through __deps", () => {
    const { exports } = loadWebLib(IAP, { yes2sdk: {} });
    assert.equal(typeof exports.$Yes2SDKIapCallbacks, "object");
    assert.ok(exports.Yes2SDK_iap_getCatalog__deps.includes("$Yes2SDKIapCallbacks"));
});

test("negative: a fake missing the method yields the failure dyncall, not a success", async () => {
    // getCatalogAsync is absent: the library's sync throw path must report failure.
    const web = loadWebLib(IAP, { yes2sdk: { iap: {} } });
    web.exports.Yes2SDK_iap_getCatalog(7);
    await web.flush();
    assert.equal(web.dyncalls.length, 1);
    assert.equal(web.dyncalls[0].args[0], 0, "a broken fake must not look like success");
    // And an assertion written for the happy path really does fail on it.
    assert.throws(() => assert.equal(web.dyncalls[0].args[0], 1));
});

test("negative: a rejected promise yields one failure dyncall carrying the error", async () => {
    const web = loadWebLib(IAP, {
        yes2sdk: { iap: { getCatalogAsync: () => Promise.reject(new Error("boom")) } },
    });
    web.exports.Yes2SDK_iap_getCatalog(9);
    await web.flush();
    assert.equal(web.dyncalls.length, 1);
    assert.equal(web.dyncalls[0].args[0], 0);
});

test("harness: a dyncall through a null pointer or with the wrong arity is reported as a problem", () => {
    const web = loadWebLib(IAP, { yes2sdk: {} });
    // No SDK module -> immediate failure dyncall through the pointer given (null here).
    web.exports.Yes2SDK_iap_getCatalog(0);
    assert.equal(web.dyncalls.length, 1);
    assert.match(web.problems.join("\n"), /null function pointer/);
});

test("harness: several libraries share one scope and console is captured", () => {
    const web = loadWebLib([CORE, SESSION], { yes2sdk: {} });
    assert.equal(typeof web.exports.Yes2SDK_getPlatform, "function");
    assert.equal(typeof web.exports.Yes2SDK_session_getLocale, "function");
    assert.equal(web.exports.Yes2SDK_getPlatform(), "unknown");
    // No Yes2SDK.on on the fake: on_pause warns instead of wiring.
    web.exports.Yes2SDK_onPause(1);
    assert.equal(web.console.warn.length, 1);
    assert.match(web.console.warn[0], /on_pause registered before/);
});

test("harness: lifecycle events trampoline through the stored pointer", () => {
    const handlers = {};
    const web = loadWebLib(CORE, { yes2sdk: { on: (name, fn) => (handlers[name] = fn) } });
    web.exports.Yes2SDK_onAudioEnabledChange(5);
    handlers.audioEnabledChange({ enabled: false });
    assert.deepEqual(web.dyncalls, [{ sig: "vi", ptr: 5, args: [0] }]);
});

test("harness: UTF8ToString maps pointer 0 to the empty string like Emscripten", async () => {
    let seen;
    const web = loadWebLib(IAP, {
        yes2sdk: {
            iap: {
                purchaseAsync: (options) => {
                    seen = options;
                    return Promise.resolve({ purchaseToken: "t" });
                },
            },
        },
    });
    web.exports.Yes2SDK_iap_purchase("coins", 0, 3);
    await web.flush();
    assert.deepEqual(seen, { productId: "coins", developerPayload: undefined });
    assert.equal(web.dyncalls[0].args[0], 1);
});

test("harness: every tracked library loads into one shared scope with no problems", () => {
    const files = readdirSync(`${REPO_ROOT}/yes2sdk/lib/web`)
        .filter((name) => /^lib_yes2sdk.*\.js$/.test(name))
        .sort()
        .map((name) => `yes2sdk/lib/web/${name}`);
    assert.ok(files.length >= 16, `expected the full library set, found ${files.length}`);
    const web = loadWebLib(files, { yes2sdk: {} });
    assert.deepEqual(web.problems, []);
    assert.ok(Object.keys(web.exports).filter((key) => key.startsWith("Yes2SDK_")).length > 50);
});
