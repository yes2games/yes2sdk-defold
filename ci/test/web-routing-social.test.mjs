// Behaviour of the banner status, game, friends and sign in bindings through the request router.
// Every call carries its own request id and completes through $Yes2SDKBridge ("viii").

import assert from "node:assert/strict";
import { test } from "node:test";
import { loadWebLib } from "./helpers/web-lib.mjs";

const LIBS = [
    "yes2sdk/lib/web/lib_yes2sdk.js",
    "yes2sdk/lib/web/lib_yes2sdk_banners.js",
    "yes2sdk/lib/web/lib_yes2sdk_game.js",
    "yes2sdk/lib/web/lib_yes2sdk_friends.js",
    "yes2sdk/lib/web/lib_yes2sdk_auth.js",
];
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
        assert.equal(call.sig, "viii");
        assert.equal(call.ptr, CB);
        return call.args;
    });
}

// name, module, method, export, extra leading args, value A, payload A, value B, payload B, null-ish mapping
const CASES = [
    {
        name: "banners_get_status",
        mod: "banners",
        method: "getBannerStatusAsync",
        fn: "Yes2SDK_banners_getStatus",
        pre: [],
        a: { shown: 1 },
        b: { shown: 2 },
        pa: JSON.stringify({ shown: 1 }),
        pb: JSON.stringify({ shown: 2 }),
        nullPayload: "{}",
    },
    {
        name: "game_invite_link",
        mod: "game",
        method: "inviteLink",
        fn: "Yes2SDK_game_inviteLink",
        pre: ["{}"],
        a: "https://a",
        b: "https://b",
        pa: "https://a",
        pb: "https://b",
        nullPayload: "",
    },
    {
        name: "game_get_server_time",
        mod: "game",
        method: "getServerTimeAsync",
        fn: "Yes2SDK_game_getServerTime",
        pre: [],
        a: 111,
        b: 222,
        pa: "111",
        pb: "222",
        nullPayload: "0",
    },
    {
        name: "friends_list_friends",
        mod: "friends",
        method: "listFriendsAsync",
        fn: "Yes2SDK_friends_listFriends",
        pre: [0, 10],
        a: { friends: ["a"] },
        b: { friends: ["b"] },
        pa: JSON.stringify({ friends: ["a"] }),
        pb: JSON.stringify({ friends: ["b"] }),
        nullPayload: "null",
    },
    {
        name: "auth_sign_in",
        mod: "auth",
        method: "signInAsync",
        fn: "Yes2SDK_auth_signIn",
        pre: [],
        a: { user: 1 },
        b: { user: 2 },
        pa: 0,
        pb: 0,
        nullPayload: 0,
    },
];

for (const c of CASES) {
    test(`${c.name}: two overlapping calls resolved in reverse order complete with their own id`, async () => {
        const pending = [];
        const mod = {
            [c.method]() {
                const d = deferred();
                pending.push(d);
                return d.promise;
            },
        };
        const web = loadWebLib(LIBS, { yes2sdk: { [c.mod]: mod } });
        web.exports[c.fn](...c.pre, 1, CB);
        web.exports[c.fn](...c.pre, 2, CB);
        assert.equal(pending.length, 2);
        assert.equal(web.dyncalls.length, 0);
        pending[1].resolve(c.b);
        await web.flush();
        pending[0].resolve(c.a);
        await web.flush();
        assert.deepEqual(completions(web), [
            [2, 1, c.pb],
            [1, 1, c.pa],
        ]);
        assert.deepEqual(web.problems, []);
    });

    test(`${c.name}: a rejection completes with the id and success 0`, async () => {
        const mod = { [c.method]: () => Promise.reject({ code: "X", message: "no" }) };
        const web = loadWebLib(LIBS, { yes2sdk: { [c.mod]: mod } });
        web.exports[c.fn](...c.pre, 7, CB);
        await web.flush();
        assert.deepEqual(completions(web), [[7, 0, errorJson("X", "no", `${c.mod}.${c.method}`)]]);
    });

    test(`${c.name}: SDK not loaded completes with its id`, async () => {
        for (const yes2sdk of [undefined, {}]) {
            const web = loadWebLib(LIBS, yes2sdk === undefined ? {} : { yes2sdk });
            web.exports[c.fn](...c.pre, 9, CB);
            await web.flush();
            assert.deepEqual(completions(web), [[9, 0, errorJson("NOT_INITIALIZED", "SDK not initialized", `${c.mod}.${c.method}`)]]);
        }
    });

    test(`${c.name}: a sync throw completes once`, async () => {
        const mod = {
            [c.method]() {
                throw "boom";
            },
        };
        const web = loadWebLib(LIBS, { yes2sdk: { [c.mod]: mod } });
        web.exports[c.fn](...c.pre, 8, CB);
        await web.flush();
        assert.deepEqual(completions(web), [[8, 0, errorJson("UNKNOWN_ERROR", "boom", `${c.mod}.${c.method}`)]]);
    });

    test(`${c.name}: null result mapping and bridge dependency`, async () => {
        const mod = { [c.method]: () => Promise.resolve(null) };
        const web = loadWebLib(LIBS, { yes2sdk: { [c.mod]: mod } });
        web.exports[c.fn](...c.pre, 5, CB);
        await web.flush();
        assert.deepEqual(completions(web), [[5, 1, c.nullPayload]]);
        assert.ok(web.exports[`${c.fn}__deps`].includes("$Yes2SDKBridge"));
    });
}

test("game_invite_link: raw JSON string goes to Core, empty becomes {}", async () => {
    const seen = [];
    const web = loadWebLib(LIBS, {
        yes2sdk: {
            game: {
                inviteLink(p) {
                    seen.push(p);
                    return Promise.resolve("u");
                },
            },
        },
    });
    web.exports.Yes2SDK_game_inviteLink('{"a":1}', 1, CB);
    web.exports.Yes2SDK_game_inviteLink("", 2, CB);
    await web.flush();
    assert.deepEqual(seen, ['{"a":1}', "{}"]);
});

test("game_invite_link: invalid JSON fails without calling Core", async () => {
    let called = 0;
    const web = loadWebLib(LIBS, {
        yes2sdk: { game: { inviteLink() { called++; return Promise.resolve("u"); } } },
    });
    web.exports.Yes2SDK_game_inviteLink("{nope", 3, CB);
    await web.flush();
    assert.equal(called, 0);
    const done = completions(web);
    assert.equal(done.length, 1);
    assert.equal(done[0][0], 3);
    assert.equal(done[0][1], 0);
    assert.equal(JSON.parse(done[0][2]).code, "INVALID_PARAM");
    assert.match(JSON.parse(done[0][2]).message, /^Invalid JSON: /);
});

test("friends_list_friends passes page and size", async () => {
    let seen;
    const web = loadWebLib(LIBS, {
        yes2sdk: { friends: { listFriendsAsync(p, s) { seen = [p, s]; return Promise.resolve([]); } } },
    });
    web.exports.Yes2SDK_friends_listFriends(2, 25, 4, CB);
    await web.flush();
    assert.deepEqual(seen, [2, 25]);
});

test("the old per-module slots are gone", () => {
    const web = loadWebLib(LIBS, { yes2sdk: {} });
    assert.equal(web.exports.$Yes2SDKBannersCallbacks, undefined);
    assert.equal(web.exports.$Yes2SDKFriendsCallbacks, undefined);
    assert.equal(web.exports.$Yes2SDKAuthCallbacks, undefined);
});
