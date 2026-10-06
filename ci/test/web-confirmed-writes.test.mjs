// Behaviour of the confirmed write calls in lib_yes2sdk_data.js and
// lib_yes2sdk_player.js through the request router: overlapping calls complete
// with their own id, a resolved false is a failure, a missing method is
// FEATURE_NOT_SUPPORTED.

import assert from "node:assert/strict";
import { test } from "node:test";
import { loadWebLib } from "./helpers/web-lib.mjs";

const LIBS = [
    "yes2sdk/lib/web/lib_yes2sdk.js",
    "yes2sdk/lib/web/lib_yes2sdk_data.js",
    "yes2sdk/lib/web/lib_yes2sdk_player.js",
];
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
        assert.equal(call.sig, "viii");
        assert.equal(call.ptr, CB);
        return call.args;
    });
}

test("data setStringAsync: overlapping calls resolved in reverse order complete with their own id", async () => {
    const pending = [];
    const seen = [];
    const web = loadWebLib(LIBS, {
        yes2sdk: {
            data: {
                setStringAsync(key, value) {
                    seen.push([key, value]);
                    const d = deferred();
                    pending.push(d);
                    return d.promise;
                },
            },
        },
    });
    web.exports.Yes2SDK_data_setStringAsync("a", "1", 1, CB);
    web.exports.Yes2SDK_data_setStringAsync("b", "2", 2, CB);
    assert.deepEqual(seen, [["a", "1"], ["b", "2"]]);
    pending[1].resolve(true);
    await web.flush();
    pending[0].resolve(true);
    await web.flush();
    assert.deepEqual(completions(web), [[2, 1, 0], [1, 1, 0]]);
    assert.deepEqual(web.problems, []);
});

test("data setStringAsync: resolved false is a failure with UNKNOWN_ERROR", async () => {
    const web = loadWebLib(LIBS, { yes2sdk: { data: { setStringAsync: () => Promise.resolve(false) } } });
    web.exports.Yes2SDK_data_setStringAsync("k", "v", 7, CB);
    await web.flush();
    const done = completions(web);
    assert.equal(done.length, 1);
    assert.deepEqual([done[0][0], done[0][1]], [7, 0]);
    const err = JSON.parse(done[0][2]);
    assert.equal(err.code, "UNKNOWN_ERROR");
    assert.match(err.message, /did not confirm/);
    assert.equal(err.context, "data.setStringAsync");
});

test("data setStringAsync: missing method is FEATURE_NOT_SUPPORTED", async () => {
    const web = loadWebLib(LIBS, { yes2sdk: { data: {} } });
    web.exports.Yes2SDK_data_setStringAsync("k", "v", 3, CB);
    await web.flush();
    const done = completions(web);
    assert.deepEqual([done[0][0], done[0][1]], [3, 0]);
    assert.equal(JSON.parse(done[0][2]).code, "FEATURE_NOT_SUPPORTED");
});

test("data flushAsync: overlapping calls route per id, false fails, rejection fails", async () => {
    const pending = [];
    const web = loadWebLib(LIBS, {
        yes2sdk: {
            data: {
                flushAsync() {
                    const d = deferred();
                    pending.push(d);
                    return d.promise;
                },
            },
        },
    });
    web.exports.Yes2SDK_data_flush(1, CB);
    web.exports.Yes2SDK_data_flush(2, CB);
    web.exports.Yes2SDK_data_flush(3, CB);
    pending[2].reject({ code: "NETWORK_FAILURE", message: "offline" });
    await web.flush();
    pending[1].resolve(false);
    await web.flush();
    pending[0].resolve(true);
    await web.flush();
    const done = completions(web);
    assert.deepEqual([done[0][0], done[0][1]], [3, 0]);
    assert.equal(JSON.parse(done[0][2]).code, "NETWORK_FAILURE");
    assert.deepEqual([done[1][0], done[1][1]], [2, 0]);
    assert.equal(JSON.parse(done[1][2]).code, "UNKNOWN_ERROR");
    assert.deepEqual(done[2], [1, 1, 0]);
});

test("data flushAsync: missing method is FEATURE_NOT_SUPPORTED", async () => {
    const web = loadWebLib(LIBS, { yes2sdk: { data: {} } });
    web.exports.Yes2SDK_data_flush(9, CB);
    await web.flush();
    assert.equal(JSON.parse(completions(web)[0][2]).code, "FEATURE_NOT_SUPPORTED");
});

test("player flushDataAsync: resolve is success with no payload, overlap routes per id", async () => {
    const pending = [];
    const web = loadWebLib(LIBS, {
        yes2sdk: {
            player: {
                flushDataAsync() {
                    const d = deferred();
                    pending.push(d);
                    return d.promise;
                },
            },
        },
    });
    web.exports.Yes2SDK_player_flushData(1, CB);
    web.exports.Yes2SDK_player_flushData(2, CB);
    pending[1].resolve();
    await web.flush();
    pending[0].reject(new Error("nope"));
    await web.flush();
    const done = completions(web);
    assert.deepEqual(done[0], [2, 1, 0]);
    assert.deepEqual([done[1][0], done[1][1]], [1, 0]);
    assert.equal(JSON.parse(done[1][2]).message, "nope");
});

test("player flushDataAsync: missing method is FEATURE_NOT_SUPPORTED", async () => {
    const web = loadWebLib(LIBS, { yes2sdk: { player: {} } });
    web.exports.Yes2SDK_player_flushData(4, CB);
    await web.flush();
    assert.equal(JSON.parse(completions(web)[0][2]).code, "FEATURE_NOT_SUPPORTED");
});
