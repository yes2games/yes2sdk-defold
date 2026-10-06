// Unit tests for $Yes2SDKBridge (yes2sdk/lib/web/lib_yes2sdk.js), the shared
// helper every async binding completes through:
//
//   Yes2SDKBridge.run(cb, id, "module.method", getArgs, mapResult)
//   Yes2SDKBridge.complete(cb, id, success, payloadString)
//   Yes2SDKBridge.errorString(err, context)
//
// The helper is bound into the library scope only when a function lists it in
// __deps, so these tests load lib_yes2sdk_iap.js too (it depends on it).

import assert from "node:assert/strict";
import { test } from "node:test";
import { loadWebLib } from "./helpers/web-lib.mjs";

const LIBS = ["yes2sdk/lib/web/lib_yes2sdk.js", "yes2sdk/lib/web/lib_yes2sdk_iap.js"];
const CB = 9;

function load(yes2sdk) {
    const web = loadWebLib(LIBS, yes2sdk === undefined ? {} : { yes2sdk });
    return { web, bridge: web.exports.$Yes2SDKBridge };
}

function argsOf(web) {
    return web.dyncalls.map((call) => {
        assert.equal(call.sig, "viii");
        assert.equal(call.ptr, CB);
        return call.args;
    });
}

test("bridge: complete maps success to 1/0 and a null payload to pointer 0", () => {
    const { web, bridge } = load({});
    bridge.complete(CB, 1, true, "ok");
    bridge.complete(CB, 2, false, null);
    bridge.complete(CB, 3, 1, undefined);
    assert.deepEqual(argsOf(web), [
        [1, 1, "ok"],
        [2, 0, 0],
        [3, 1, 0],
    ]);
    assert.deepEqual(web.problems, []);
});

test("bridge: run with no SDK on the page completes once as not initialized", async () => {
    const { web, bridge } = load(undefined);
    bridge.run(CB, 1, "iap.getCatalogAsync");
    await web.flush();
    assert.deepEqual(argsOf(web), [[1, 0, "SDK not initialized"]]);
});

test("bridge: run with the module missing completes once as not initialized", async () => {
    const { web, bridge } = load({ ads: {} });
    bridge.run(CB, 2, "iap.getCatalogAsync");
    await web.flush();
    assert.deepEqual(argsOf(web), [[2, 0, "SDK not initialized"]]);
});

test("bridge: run with the method missing completes once as a failure naming it", async () => {
    const { web, bridge } = load({ iap: {} });
    bridge.run(CB, 3, "iap.getCatalogAsync");
    await web.flush();
    const done = argsOf(web);
    assert.equal(done.length, 1);
    assert.deepEqual(done[0].slice(0, 2), [3, 0]);
    assert.match(done[0][2], /iap\.getCatalogAsync/);
});

test("bridge: run calls the method on its module with the given arguments", async () => {
    const mod = {
        tag: "module",
        echo(a, b) {
            return Promise.resolve({ self: this.tag, a, b });
        },
    };
    const { web, bridge } = load({ iap: mod });
    bridge.run(CB, 4, "iap.echo", () => ["x", 2]);
    await web.flush();
    assert.deepEqual(argsOf(web), [[4, 1, JSON.stringify({ self: "module", a: "x", b: 2 })]]);
});

test("bridge: run default mapResult stringifies, mapping undefined to null", async () => {
    const { web, bridge } = load({ iap: { a: () => Promise.resolve(undefined), b: () => Promise.resolve({ n: 1 }) } });
    bridge.run(CB, 5, "iap.a");
    bridge.run(CB, 6, "iap.b");
    await web.flush();
    assert.deepEqual(argsOf(web), [
        [5, 1, "null"],
        [6, 1, '{"n":1}'],
    ]);
});

test("bridge: run accepts a synchronous return value", async () => {
    const { web, bridge } = load({ iap: { now: () => 7 } });
    bridge.run(CB, 7, "iap.now");
    await web.flush();
    assert.deepEqual(argsOf(web), [[7, 1, "7"]]);
});

test("bridge: a throwing mapResult completes once as a failure", async () => {
    const { web, bridge } = load({ iap: { a: () => Promise.resolve(1) } });
    bridge.run(CB, 8, "iap.a", null, () => {
        throw "bad map";
    });
    await web.flush();
    assert.deepEqual(argsOf(web), [[8, 0, "bad map"]]);
});

test("bridge: a throwing getArgs completes once as a failure", async () => {
    const calls = [];
    const { web, bridge } = load({ iap: { a: () => calls.push("called") } });
    bridge.run(CB, 9, "iap.a", () => {
        throw "bad args";
    });
    await web.flush();
    assert.deepEqual(calls, []);
    assert.deepEqual(argsOf(web), [[9, 0, "bad args"]]);
});

test("bridge: a cyclic error object never throws and still completes once", async () => {
    const cyclic = { message: "loop" };
    cyclic.self = cyclic;
    const { web, bridge } = load({
        iap: {
            rejects: () => Promise.reject(cyclic),
            throws() {
                throw cyclic;
            },
        },
    });
    bridge.run(CB, 10, "iap.rejects");
    bridge.run(CB, 11, "iap.throws");
    await web.flush();
    const done = argsOf(web);
    assert.deepEqual(done.map((a) => a[0]).sort(), [10, 11]);
    for (const args of done) {
        assert.equal(args[1], 0);
        assert.equal(typeof args[2], "string");
    }
});

test("bridge: errorString keeps today's semantics and never throws", () => {
    const { bridge } = load({});
    assert.equal(bridge.errorString({ code: "X" }, "ctx"), '{"code":"X"}');
    assert.equal(bridge.errorString("plain", "ctx"), "plain");
    assert.equal(bridge.errorString(5, "ctx"), "5");
    assert.equal(bridge.errorString(null, "ctx"), "null");
    assert.equal(bridge.errorString(undefined, "ctx"), "undefined");
    const cyclic = {};
    cyclic.self = cyclic;
    assert.equal(typeof bridge.errorString(cyclic, "ctx"), "string");
    const hostile = {
        toJSON() {
            throw new Error("no json");
        },
        toString() {
            throw new Error("no string");
        },
    };
    assert.equal(typeof bridge.errorString(hostile, "ctx"), "string");
});

