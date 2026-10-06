// Error payload contract for the web bridge: every failure string handed to Lua
// is {"code":"...","message":"...","context":"..."}, always all three keys and
// all strings. `code` is the SDK's own code when the error carries one, else a
// bridge fallback (NOT_INITIALIZED, FEATURE_NOT_SUPPORTED, INVALID_PARAM,
// UNKNOWN_ERROR). Every other field (originalError included) is dropped, and
// building the payload never throws.

import assert from "node:assert/strict";
import { test } from "node:test";
import { loadWebLib } from "./helpers/web-lib.mjs";

const BRIDGE = "yes2sdk/lib/web/lib_yes2sdk.js";
const LIBS = [
    BRIDGE,
    "yes2sdk/lib/web/lib_yes2sdk_iap.js",
    "yes2sdk/lib/web/lib_yes2sdk_player.js",
    "yes2sdk/lib/web/lib_yes2sdk_stats.js",
    "yes2sdk/lib/web/lib_yes2sdk_game.js",
];
const CB = 9;

function load(yes2sdk) {
    const web = loadWebLib(LIBS, yes2sdk === undefined ? {} : { yes2sdk });
    return { web, bridge: web.exports.$Yes2SDKBridge };
}

// Parse a failure payload and check the shape: exactly code, message, context,
// each a string.
function shape(payload) {
    assert.equal(typeof payload, "string", "a failure payload must be a string");
    const value = JSON.parse(payload);
    assert.deepEqual(Object.keys(value).sort(), ["code", "context", "message"]);
    for (const key of ["code", "message", "context"]) {
        assert.equal(typeof value[key], "string", `${key} must be a string`);
    }
    assert.notEqual(value.code, "");
    return value;
}

// The one failure completion of request `id`, parsed.
function failureOf(web, id) {
    const calls = web.dyncalls.filter((call) => call.args[0] === id);
    assert.equal(calls.length, 1, `request ${id} must complete exactly once`);
    assert.equal(calls[0].sig, "viii");
    assert.equal(calls[0].args[1], 0, `request ${id} must fail`);
    return shape(calls[0].args[2]);
}

test("errorJson: an SDK error object keeps its code, message and context and drops the rest", () => {
    const { bridge } = load({});
    const err = {
        code: "IAP_PURCHASE_CANCELLED",
        message: "closed",
        context: "iap.purchaseAsync",
        url: "https://example.invalid/doc",
        originalError: { deep: true },
    };
    assert.deepEqual(shape(bridge.errorJson(err, "UNKNOWN_ERROR", "bridge.ctx")), {
        code: "IAP_PURCHASE_CANCELLED",
        message: "closed",
        context: "iap.purchaseAsync",
    });
});

test("errorJson: missing or non-string fields fall back to the bridge values", () => {
    const { bridge } = load({});
    assert.deepEqual(shape(bridge.errorJson({ code: "", message: 3, context: {} }, "UNKNOWN_ERROR", "iap.a")), {
        code: "UNKNOWN_ERROR",
        message: "Unknown error",
        context: "iap.a",
    });
    assert.deepEqual(shape(bridge.errorJson({ code: 7 }, "FEATURE_NOT_SUPPORTED", "iap.b")).code, "FEATURE_NOT_SUPPORTED");
});

test("errorJson: a cyclic originalError does not throw", () => {
    const { bridge } = load({});
    const original = {};
    original.self = original;
    const err = { code: "PLATFORM_ERROR", message: "loop", context: "x", originalError: original };
    assert.deepEqual(shape(bridge.errorJson(err, "UNKNOWN_ERROR", "ctx")), {
        code: "PLATFORM_ERROR",
        message: "loop",
        context: "x",
    });
});

test("errorJson: throwing getters and hostile objects never throw", () => {
    const { bridge } = load({});
    const hostile = {};
    for (const key of ["code", "message", "context"]) {
        Object.defineProperty(hostile, key, {
            get() {
                throw new Error("getter " + key);
            },
        });
    }
    hostile.toString = () => {
        throw new Error("no string");
    };
    hostile.toJSON = () => {
        throw new Error("no json");
    };
    assert.deepEqual(shape(bridge.errorJson(hostile, "UNKNOWN_ERROR", "ctx")), {
        code: "UNKNOWN_ERROR",
        message: "Unknown error",
        context: "ctx",
    });
    const proxy = new Proxy(
        {},
        {
            get() {
                throw new Error("trap");
            },
            has() {
                throw new Error("trap");
            },
        },
    );
    assert.equal(shape(bridge.errorJson(proxy, "UNKNOWN_ERROR", "ctx")).code, "UNKNOWN_ERROR");
    assert.equal(shape(bridge.errorJson(Symbol("s"), "UNKNOWN_ERROR", "ctx")).message, "Symbol(s)");
    assert.equal(shape(bridge.errorJson(Object.create(null), undefined, undefined)).code, "UNKNOWN_ERROR");
});

test("errorJson: an Error instance is UNKNOWN_ERROR with its message", () => {
    const { bridge } = load({});
    assert.deepEqual(shape(bridge.errorJson(new Error("boom"), "UNKNOWN_ERROR", "iap.getCatalogAsync")), {
        code: "UNKNOWN_ERROR",
        message: "boom",
        context: "iap.getCatalogAsync",
    });
});

test("errorJson: primitives are UNKNOWN_ERROR with String(err)", () => {
    const { bridge } = load({});
    const cases = [
        ["cancelled", "cancelled"],
        [5, "5"],
        [null, "null"],
        [undefined, "undefined"],
        [false, "false"],
    ];
    for (const [err, message] of cases) {
        assert.deepEqual(shape(bridge.errorJson(err, "UNKNOWN_ERROR", "c")), {
            code: "UNKNOWN_ERROR",
            message,
            context: "c",
        });
    }
});

test("errorJson: the old free-text helper is gone", () => {
    const { bridge } = load({});
    assert.equal(bridge.errorString, undefined);
});

test("run: missing SDK and missing module are NOT_INITIALIZED", async () => {
    for (const sdk of [undefined, {}, { ads: {} }]) {
        const { web, bridge } = load(sdk);
        bridge.run(CB, 1, "iap.getCatalogAsync");
        await web.flush();
        assert.deepEqual(failureOf(web, 1), {
            code: "NOT_INITIALIZED",
            message: "SDK not initialized",
            context: "iap.getCatalogAsync",
        });
    }
});

test("run: a missing method is FEATURE_NOT_SUPPORTED", async () => {
    const { web, bridge } = load({ iap: {} });
    bridge.run(CB, 2, "iap.getCatalogAsync");
    await web.flush();
    const failure = failureOf(web, 2);
    assert.equal(failure.code, "FEATURE_NOT_SUPPORTED");
    assert.equal(failure.context, "iap.getCatalogAsync");
    assert.match(failure.message, /iap\.getCatalogAsync/);
});

test("run: a rejection with an SDK code keeps it; anything else is UNKNOWN_ERROR", async () => {
    const coded = { code: "PLATFORM_ERROR", message: "nope", context: "iap.getCatalogAsync", originalError: { x: 1 } };
    const { web, bridge } = load({
        iap: {
            coded: () => Promise.reject(coded),
            error: () => Promise.reject(new Error("boom")),
            text: () => Promise.reject("no"),
            throws() {
                throw new TypeError("sync");
            },
        },
    });
    bridge.run(CB, 3, "iap.coded");
    bridge.run(CB, 4, "iap.error");
    bridge.run(CB, 5, "iap.text");
    bridge.run(CB, 6, "iap.throws");
    bridge.run(CB, 7, "iap.coded", null, () => {
        throw "bad map";
    });
    await web.flush();
    assert.deepEqual(failureOf(web, 3), { code: "PLATFORM_ERROR", message: "nope", context: "iap.getCatalogAsync" });
    assert.deepEqual(failureOf(web, 4), { code: "UNKNOWN_ERROR", message: "boom", context: "iap.error" });
    assert.deepEqual(failureOf(web, 5), { code: "UNKNOWN_ERROR", message: "no", context: "iap.text" });
    assert.deepEqual(failureOf(web, 6), { code: "UNKNOWN_ERROR", message: "sync", context: "iap.throws" });
    assert.equal(failureOf(web, 7).code, "PLATFORM_ERROR", "a rejection never reaches mapResult");
});

test("bindings: invalid JSON from Lua is INVALID_PARAM, before Core is called", async () => {
    const called = [];
    const spy = () => {
        called.push("core");
        return Promise.resolve(null);
    };
    const { web } = load({
        player: { getDataAsync: spy, setDataAsync: spy },
        stats: { getStatsAsync: spy, setStatsAsync: spy, incrementStatsAsync: spy },
        game: { inviteLink: spy },
    });
    web.exports.Yes2SDK_player_getData("{bad", 1, CB);
    web.exports.Yes2SDK_player_setData("{bad", 2, CB);
    web.exports.Yes2SDK_stats_get("{bad", 3, CB);
    web.exports.Yes2SDK_stats_set("{bad", 4, CB);
    web.exports.Yes2SDK_stats_increment("{bad", 5, CB);
    web.exports.Yes2SDK_game_inviteLink("{bad", 6, CB);
    await web.flush();
    const contexts = {
        1: "player.getDataAsync",
        2: "player.setDataAsync",
        3: "stats.getStatsAsync",
        4: "stats.setStatsAsync",
        5: "stats.incrementStatsAsync",
        6: "game.inviteLink",
    };
    for (const [id, context] of Object.entries(contexts)) {
        const failure = failureOf(web, Number(id));
        assert.equal(failure.code, "INVALID_PARAM", context);
        assert.equal(failure.context, context);
        assert.match(failure.message, /^Invalid JSON: /);
    }
    assert.deepEqual(called, []);
    assert.deepEqual(web.problems, []);
});

// initialize and start_game complete through their own (success, payload)
// callback, not the request router.
function lifecycleFailures(web) {
    return web.dyncalls.map((call) => {
        assert.equal(call.sig, "vii");
        assert.equal(call.ptr, CB);
        assert.equal(call.args[0], 0);
        return shape(call.args[1]);
    });
}

for (const [name, method, context] of [
    ["Yes2SDK_initializeAsync", "initializeAsync", "initializeAsync"],
    ["Yes2SDK_startGameAsync", "startGameAsync", "startGameAsync"],
]) {
    test(`${name}: SDK not loaded is NOT_INITIALIZED`, () => {
        const { web } = load(undefined);
        web.exports[name](CB);
        assert.deepEqual(lifecycleFailures(web), [
            { code: "NOT_INITIALIZED", message: "Yes2SDK not loaded", context },
        ]);
        assert.deepEqual(web.problems, []);
    });

    test(`${name}: a rejection is normalized and keeps an SDK code`, async () => {
        const errors = [
            { code: "INITIALIZATION_ERROR", message: "failed", context: method, originalError: { big: true } },
            new Error("boom"),
            "plain",
        ];
        const expected = [
            { code: "INITIALIZATION_ERROR", message: "failed", context: method },
            { code: "UNKNOWN_ERROR", message: "boom", context },
            { code: "UNKNOWN_ERROR", message: "plain", context },
        ];
        for (let i = 0; i < errors.length; i++) {
            const err = errors[i];
            const { web } = load({ [method]: () => Promise.reject(err) });
            const top = web.stackPointer();
            web.exports[name](CB);
            await web.flush();
            assert.deepEqual(lifecycleFailures(web), [expected[i]]);
            assert.equal(web.stackPointer(), top, "an async failure must give its stack bytes back");
        }
    });

    test(`${name}: a sync throw from Core completes once as a failure`, async () => {
        const { web } = load({
            [method]() {
                throw new Error("sync");
            },
        });
        assert.doesNotThrow(() => web.exports[name](CB));
        await web.flush();
        assert.deepEqual(lifecycleFailures(web), [{ code: "UNKNOWN_ERROR", message: "sync", context }]);
    });

    test(`${name}: success passes a null payload and leaves the stack unchanged`, async () => {
        const { web } = load({ [method]: () => Promise.resolve() });
        const top = web.stackPointer();
        web.exports[name](CB);
        await web.flush();
        assert.deepEqual(
            web.dyncalls.map((call) => call.args),
            [[1, 0]],
        );
        assert.equal(web.stackPointer(), top);
    });
}
