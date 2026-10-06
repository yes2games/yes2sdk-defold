// Self-test for ci/test/helpers/web-lib.mjs, the harness that loads a
// yes2sdk/lib/web/lib_yes2sdk*.js Emscripten library into a fake page.
//
// It proves three things later suites rely on: synchronous exports return what
// the fake window.Yes2SDK says, an async export reports through exactly one
// recorded dyncall once its promise settles, and a broken fake is visible as a
// failure path rather than passing silently.

import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { REPO_ROOT, loadWebLib } from "./helpers/web-lib.mjs";

let fixtureCount = 0;
const fixtureDir = mkdtempSync(join(tmpdir(), "web-lib-fixture-"));
function fixture(source) {
    const path = join(fixtureDir, `lib_fixture_${fixtureCount++}.js`);
    writeFileSync(path, source);
    return path;
}

const SESSION = "yes2sdk/lib/web/lib_yes2sdk_session.js";
const IAP = "yes2sdk/lib/web/lib_yes2sdk_iap.js";
const CORE = "yes2sdk/lib/web/lib_yes2sdk.js";
// The IAP library completes through $Yes2SDKBridge, defined in lib_yes2sdk.js.
const IAP_LIBS = [CORE, IAP];

test("session: every Yes2SDK_session_* function is exported", () => {
    const { exports } = loadWebLib(SESSION, { yes2sdk: {} });
    for (const name of [
        "Yes2SDK_session_gameplayStart",
        "Yes2SDK_session_gameplayStop",
        "Yes2SDK_session_getLocale",
        "Yes2SDK_session_isAudioEnabled",
        "Yes2SDK_session_getDeviceInfo",
        "Yes2SDK_session_getEntryPointData",
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
    const web = loadWebLib(IAP_LIBS, { yes2sdk: { iap: { getCatalogAsync: () => Promise.resolve(catalog) } } });
    web.exports.Yes2SDK_iap_getCatalog(1, 42);
    assert.equal(web.dyncalls.length, 0, "the callback must not fire before the promise settles");
    await web.flush();
    assert.equal(web.dyncalls.length, 1);
    assert.deepEqual(web.dyncalls[0], { sig: "viii", ptr: 42, args: [1, 1, JSON.stringify(catalog)] });
    assert.deepEqual(web.problems, []);
});

test("iap: the cross-file $Yes2SDKBridge helper is exported and injected through __deps", () => {
    const { exports, problems } = loadWebLib(IAP_LIBS, { yes2sdk: {} });
    assert.equal(typeof exports.$Yes2SDKBridge, "object");
    assert.ok(exports.Yes2SDK_iap_getCatalog__deps.includes("$Yes2SDKBridge"));
    assert.deepEqual(problems, []);
    // Loaded without the file that defines it, the dependency is reported.
    const alone = loadWebLib(IAP, { yes2sdk: {} });
    assert.match(alone.problems.join("\n"), /__deps "\$Yes2SDKBridge", which no loaded library defines/);
});

test("negative: a fake missing the method yields the failure dyncall, not a success", async () => {
    // getCatalogAsync is absent: the library's sync throw path must report failure.
    const web = loadWebLib(IAP_LIBS, { yes2sdk: { iap: {} } });
    web.exports.Yes2SDK_iap_getCatalog(1, 7);
    await web.flush();
    assert.equal(web.dyncalls.length, 1);
    assert.equal(web.dyncalls[0].args[1], 0, "a broken fake must not look like success");
    // And an assertion written for the happy path really does fail on it.
    assert.throws(() => assert.equal(web.dyncalls[0].args[1], 1));
});

test("negative: a rejected promise yields one failure dyncall carrying the error", async () => {
    const web = loadWebLib(IAP_LIBS, {
        yes2sdk: { iap: { getCatalogAsync: () => Promise.reject(new Error("boom")) } },
    });
    web.exports.Yes2SDK_iap_getCatalog(1, 9);
    await web.flush();
    assert.equal(web.dyncalls.length, 1);
    assert.equal(web.dyncalls[0].args[1], 0);
});

test("harness: a dyncall through a null pointer or with the wrong arity is reported as a problem", () => {
    const web = loadWebLib(IAP_LIBS, { yes2sdk: {} });
    // No SDK module -> immediate failure dyncall through the pointer given (null here).
    web.exports.Yes2SDK_iap_getCatalog(1, 0);
    assert.equal(web.dyncalls.length, 1);
    assert.match(web.problems.join("\n"), /null function pointer/);
    // Wrong arity: sig "vii" takes 2 args, the library calls it with 1.
    const bad = loadWebLib(fixture('var L = { Yes2SDK_x: function (cb) { {{{ makeDynCall("vii", "cb") }}}(1); } };\naddToLibrary(L);'), {});
    bad.exports.Yes2SDK_x(7);
    assert.match(bad.problems.join("\n"), /"vii" expects 2 argument\(s\), got 1/);
});

test("harness: allocateUTF8, stringToUTF8, lengthBytesUTF8 and _malloc throw", () => {
    for (const fn of ["allocateUTF8", "stringToUTF8", "lengthBytesUTF8", "_malloc"]) {
        const web = loadWebLib(fixture(`var L = { Yes2SDK_x: function () { return ${fn}("a"); } };\naddToLibrary(L);`), {});
        assert.throws(() => web.exports.Yes2SDK_x(), /do not use it/);
    }
});

test("harness: a helper used by a function but never bound through __deps is a problem", () => {
    const unbound = loadWebLib(
        fixture("var L = {\n$Box: { v: 1 },\nYes2SDK_x: function () { return Box.v; },\n};\naddToLibrary(L);"),
        {},
    );
    assert.match(unbound.problems.join("\n"), /Yes2SDK_x references helper \$Box/);
    const bound = loadWebLib(
        fixture("var L = {\n$Box: { v: 1 },\nYes2SDK_x__deps: ['$Box'],\nYes2SDK_x: function () { return Box.v; },\n};\naddToLibrary(L);"),
        {},
    );
    assert.deepEqual(bound.problems, []);
    assert.equal(bound.exports.Yes2SDK_x(), 1);
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
    const web = loadWebLib(IAP_LIBS, {
        yes2sdk: {
            iap: {
                purchaseAsync: (options) => {
                    seen = options;
                    return Promise.resolve({ purchaseToken: "t" });
                },
            },
        },
    });
    web.exports.Yes2SDK_iap_purchase("coins", 0, 1, 3);
    await web.flush();
    assert.deepEqual(seen, { productId: "coins", developerPayload: undefined });
    assert.equal(web.dyncalls[0].args[1], 1);
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

test("harness: stringToUTF8OnStack lowers the fake stack pointer and stackSave/stackRestore round trip", () => {
    const web = loadWebLib(
        fixture(
            "var L = {\nYes2SDK_alloc: function (s) { return stringToUTF8OnStack(s); },\n" +
                "Yes2SDK_save: function () { return stackSave(); },\n" +
                "Yes2SDK_restore: function (sp) { stackRestore(sp); },\n};\naddToLibrary(L);",
        ),
        {},
    );
    const top = web.stackPointer();
    const sp = web.exports.Yes2SDK_save();
    assert.equal(sp, top);
    assert.equal(web.exports.Yes2SDK_alloc("hé"), "hé");
    assert.equal(web.stackPointer(), top - 4);
    web.exports.Yes2SDK_restore(sp);
    assert.equal(web.stackPointer(), top);
});
