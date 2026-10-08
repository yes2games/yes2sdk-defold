// Behaviour of yes2sdk/lib/web/lib_yes2sdk_player.js async functions through the request router.
//
// Every async player call carries a request id minted in C++ and completes through the
// shared $Yes2SDKBridge with a "viii" dyncall: (requestId, success, payload).

import assert from "node:assert/strict";
import { test } from "node:test";
import { loadWebLib } from "./helpers/web-lib.mjs";

const LIBS = ["yes2sdk/lib/web/lib_yes2sdk.js", "yes2sdk/lib/web/lib_yes2sdk_player.js"];
const CB = 42;

// The failure payload the bridge hands to Lua: {"code","message","context"}.
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
        assert.equal(call.sig, "viii", "player completions go through the request router signature");
        assert.equal(call.ptr, CB);
        return call.args;
    });
}

// name: exported function, method: Core method, call(web, id): invokes the binding,
// first/second: two distinct resolution values with the payload each maps to.
const CASES = [
    {
        name: "Yes2SDK_player_getData", method: "getDataAsync",
        call: (w, id) => w.exports.Yes2SDK_player_getData('["a"]', id, CB),
        first: [{ a: 1 }, '{"a":1}'], second: [{ a: 2 }, '{"a":2}'], nullish: [null, "{}"],
    },
    {
        name: "Yes2SDK_player_setData", method: "setDataAsync",
        call: (w, id) => w.exports.Yes2SDK_player_setData('{"a":1}', id, CB),
        first: [undefined, 0], second: [undefined, 0],
    },
    {
        name: "Yes2SDK_player_getUniqueId", method: "getUniqueId",
        call: (w, id) => w.exports.Yes2SDK_player_getUniqueId(id, CB),
        first: ["u1", "u1"], second: ["u2", "u2"], nullish: [null, ""],
    },
    {
        name: "Yes2SDK_player_getIdsPerGame", method: "getIDsPerGame",
        call: (w, id) => w.exports.Yes2SDK_player_getIdsPerGame(id, CB),
        first: [[{ g: 1 }], '[{"g":1}]'], second: [[{ g: 2 }], '[{"g":2}]'], nullish: [null, "[]"],
    },
    {
        name: "Yes2SDK_player_getPayingStatus", method: "getPayingStatus",
        call: (w, id) => w.exports.Yes2SDK_player_getPayingStatus(id, CB),
        first: ["paying", "paying"], second: ["not_paying", "not_paying"], nullish: [null, "unknown"],
    },
    {
        name: "Yes2SDK_player_getMode", method: "getMode",
        call: (w, id) => w.exports.Yes2SDK_player_getMode(id, CB),
        first: ["authenticated", "authenticated"], second: ["guest", "guest"], nullish: [undefined, "unknown"],
    },
    {
        name: "Yes2SDK_player_getPhoto", method: "getPhoto",
        call: (w, id) => w.exports.Yes2SDK_player_getPhoto("small", id, CB),
        first: ["http://a", '"http://a"'], second: ["http://b", '"http://b"'], nullish: [undefined, "null"],
    },
    {
        name: "Yes2SDK_player_getBotAvatar", method: "getBotAvatarAsync",
        call: (w, id) => w.exports.Yes2SDK_player_getBotAvatar("RoboRita", "small", id, CB),
        first: ["http://a", "http://a"], second: ["http://b", "http://b"], nullish: [null, ""],
    },
    {
        name: "Yes2SDK_player_getSignedInfo", method: "getSignedPlayerInfoAsync",
        call: (w, id) => w.exports.Yes2SDK_player_getSignedInfo("p", id, CB),
        first: [{ s: 1 }, '{"s":1}'], second: [{ s: 2 }, '{"s":2}'], nullish: [null, "{}"],
    },
];

for (const c of CASES) {
    test(`${c.name}: overlapping calls resolved in reverse order each complete with their own id`, async () => {
        const pending = [];
        const web = loadWebLib(LIBS, {
            yes2sdk: {
                player: {
                    [c.method]() {
                        const d = deferred();
                        pending.push(d);
                        return d.promise;
                    },
                },
            },
        });
        c.call(web, 1);
        c.call(web, 2);
        assert.equal(pending.length, 2);
        assert.equal(web.dyncalls.length, 0);
        pending[1].resolve(c.second[0]);
        await web.flush();
        pending[0].resolve(c.first[0]);
        await web.flush();
        assert.deepEqual(completions(web), [
            [2, 1, c.second[1]],
            [1, 1, c.first[1]],
        ]);
        assert.deepEqual(web.problems, []);
    });

    test(`${c.name}: a rejection completes once with the id and success 0`, async () => {
        const web = loadWebLib(LIBS, {
            yes2sdk: { player: { [c.method]: () => Promise.reject({ code: "X", message: "nope" }) } },
        });
        c.call(web, 7);
        await web.flush();
        assert.deepEqual(completions(web), [[7, 0, errorJson("X", "nope", `player.${c.method}`)]]);
    });

    test(`${c.name}: a sync throw completes once with the id`, async () => {
        const web = loadWebLib(LIBS, {
            yes2sdk: {
                player: {
                    [c.method]() {
                        throw "not on this platform";
                    },
                },
            },
        });
        c.call(web, 8);
        await web.flush();
        assert.deepEqual(completions(web), [[8, 0, errorJson("UNKNOWN_ERROR", "not on this platform", `player.${c.method}`)]]);
    });

    test(`${c.name}: SDK not loaded completes with its id`, async () => {
        for (const yes2sdk of [undefined, {}]) {
            const web = loadWebLib(LIBS, yes2sdk === undefined ? {} : { yes2sdk });
            c.call(web, 9);
            await web.flush();
            assert.deepEqual(completions(web), [[9, 0, errorJson("NOT_INITIALIZED", "SDK not initialized", `player.${c.method}`)]]);
            assert.deepEqual(web.problems, []);
        }
    });

    if (c.nullish) {
        test(`${c.name}: an empty resolution keeps today's payload`, async () => {
            const web = loadWebLib(LIBS, { yes2sdk: { player: { [c.method]: () => Promise.resolve(c.nullish[0]) } } });
            c.call(web, 10);
            await web.flush();
            assert.deepEqual(completions(web), [[10, 1, c.nullish[1]]]);
        });
    }
}

test("player_set_data: success completes with a nil payload", async () => {
    const web = loadWebLib(LIBS, { yes2sdk: { player: { setDataAsync: () => Promise.resolve() } } });
    web.exports.Yes2SDK_player_setData('{"a":1}', 3, CB);
    await web.flush();
    assert.equal(completions(web)[0][2], 0);
});

test("player_get_data / set_data: invalid JSON fails without calling Core", async () => {
    let called = 0;
    const player = {
        getDataAsync() { called++; return Promise.resolve({}); },
        setDataAsync() { called++; return Promise.resolve(); },
    };
    const web = loadWebLib(LIBS, { yes2sdk: { player } });
    web.exports.Yes2SDK_player_getData("{bad", 4, CB);
    web.exports.Yes2SDK_player_setData("{bad", 5, CB);
    await web.flush();
    const done = completions(web);
    assert.equal(called, 0);
    assert.equal(done.length, 2);
    assert.deepEqual([done[0][0], done[0][1]], [4, 0]);
    assert.deepEqual([done[1][0], done[1][1]], [5, 0]);
    assert.equal(JSON.parse(done[0][2]).code, "INVALID_PARAM");
    assert.equal(JSON.parse(done[1][2]).code, "INVALID_PARAM");
    assert.match(JSON.parse(done[0][2]).message, /^Invalid JSON: /);
    assert.match(JSON.parse(done[1][2]).message, /^Invalid JSON: /);
    // Even with the SDK missing the JSON error wins, as before.
    const bare = loadWebLib(LIBS, {});
    bare.exports.Yes2SDK_player_getData("{bad", 6, CB);
    assert.equal(JSON.parse(completions(bare)[0][2]).code, "INVALID_PARAM");
});

test("player: arguments reach Core (keys, data, size, payload)", async () => {
    const seen = {};
    const player = {
        getDataAsync(k) { seen.keys = k; return Promise.resolve({}); },
        setDataAsync(d) { seen.data = d; return Promise.resolve(); },
        getPhoto(s) { seen.size = s; return Promise.resolve(null); },
        getSignedPlayerInfoAsync(p) { seen.payload = p; return Promise.resolve({}); },
    };
    const web = loadWebLib(LIBS, { yes2sdk: { player } });
    web.exports.Yes2SDK_player_getData('["a","b"]', 1, CB);
    web.exports.Yes2SDK_player_setData('{"x":1}', 2, CB);
    web.exports.Yes2SDK_player_getPhoto("large", 3, CB);
    web.exports.Yes2SDK_player_getSignedInfo("", 4, CB);
    await web.flush();
    assert.deepEqual(seen.keys, ["a", "b"]);
    assert.deepEqual(seen.data, { x: 1 });
    assert.equal(seen.size, "large");
    assert.equal(seen.payload, undefined);
});

test("player_get_bot_avatar: username and size reach Core, an empty size becomes the default", async () => {
    const seen = [];
    const player = {
        getBotAvatarAsync(...args) { seen.push(args); return Promise.resolve("u"); },
    };
    const web = loadWebLib(LIBS, { yes2sdk: { player } });
    web.exports.Yes2SDK_player_getBotAvatar("RoboRita", "large", 1, CB);
    web.exports.Yes2SDK_player_getBotAvatar("Bob", "", 2, CB);
    await web.flush();
    assert.deepEqual(seen, [["RoboRita", "large"], ["Bob", undefined]]);
});

test("player_get_bot_avatar: an older SDK without the method is FEATURE_NOT_SUPPORTED", async () => {
    const web = loadWebLib(LIBS, { yes2sdk: { player: {} } });
    web.exports.Yes2SDK_player_getBotAvatar("RoboRita", "small", 5, CB);
    await web.flush();
    const done = completions(web);
    assert.equal(done.length, 1);
    assert.deepEqual([done[0][0], done[0][1]], [5, 0]);
    assert.equal(JSON.parse(done[0][2]).code, "FEATURE_NOT_SUPPORTED");
});

test("player_is_bot_avatar_supported reflects the SDK and is false when absent", () => {
    const yes = loadWebLib(LIBS, { yes2sdk: { player: { isBotAvatarSupported: () => true } } });
    assert.equal(yes.exports.Yes2SDK_player_isBotAvatarSupported(), 1);
    const no = loadWebLib(LIBS, { yes2sdk: { player: { isBotAvatarSupported: () => false } } });
    assert.equal(no.exports.Yes2SDK_player_isBotAvatarSupported(), 0);
    const older = loadWebLib(LIBS, { yes2sdk: { player: {} } });
    assert.equal(older.exports.Yes2SDK_player_isBotAvatarSupported(), 0);
    const none = loadWebLib(LIBS, {});
    assert.equal(none.exports.Yes2SDK_player_isBotAvatarSupported(), 0);
    const throwing = loadWebLib(LIBS, { yes2sdk: { player: { isBotAvatarSupported() { throw new Error("x"); } } } });
    assert.equal(throwing.exports.Yes2SDK_player_isBotAvatarSupported(), 0);
});
