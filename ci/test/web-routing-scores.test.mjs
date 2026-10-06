// Request routing for leaderboard, stats, config and review: every async export
// carries a request id and completes through $Yes2SDKBridge with a "viii" dyncall
// (requestId, success, payload), so overlapping calls never share a callback.

import assert from "node:assert/strict";
import { test } from "node:test";
import { loadWebLib } from "./helpers/web-lib.mjs";

const LIBS = [
    "yes2sdk/lib/web/lib_yes2sdk.js",
    "yes2sdk/lib/web/lib_yes2sdk_leaderboard.js",
    "yes2sdk/lib/web/lib_yes2sdk_stats.js",
    "yes2sdk/lib/web/lib_yes2sdk_config.js",
    "yes2sdk/lib/web/lib_yes2sdk_review.js",
];
const CB = 42;

// exportName, module, core method, extra args before (requestId, cb), resolved value,
// payload for that value, payload for a null resolution.
const CASES = [
    ["Yes2SDK_leaderboard_get", "leaderboard", "getLeaderboardAsync", ["board"], { id: "b" }, '{"id":"b"}', "{}"],
    ["Yes2SDK_leaderboard_setScore", "leaderboard", "setScoreAsync", ["board", 10, "m"], { rank: 1 }, '{"rank":1}', "{}"],
    ["Yes2SDK_leaderboard_getEntries", "leaderboard", "getEntriesAsync", ["board", 5, 0], [{ rank: 1 }], '[{"rank":1}]', "[]"],
    ["Yes2SDK_leaderboard_getPlayerEntry", "leaderboard", "getPlayerEntryAsync", ["board"], { rank: 7 }, '{"rank":7}', "null"],
    ["Yes2SDK_stats_get", "stats", "getStatsAsync", ['["a"]'], { a: 1 }, '{"a":1}', "{}"],
    ["Yes2SDK_stats_set", "stats", "setStatsAsync", ['{"a":1}'], undefined, 0, 0],
    ["Yes2SDK_stats_increment", "stats", "incrementStatsAsync", ['{"a":1}'], { a: 2 }, '{"a":2}', "{}"],
    ["Yes2SDK_config_getFlags", "config", "getFlagsAsync", ["{}"], { f: true }, '{"f":true}', "{}"],
    ["Yes2SDK_review_canReview", "review", "canReviewAsync", [], { canReview: true }, '{"canReview":true}', "{}"],
    ["Yes2SDK_review_requestReview", "review", "requestReviewAsync", [], { reviewed: true }, '{"reviewed":true}', "{}"],
];

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

function fake(mod, method, impl) {
    return { yes2sdk: { [mod]: { [method]: impl } } };
}

for (const [name, mod, method, args, value, payload] of CASES) {
    test(`${name}: overlapping calls resolved in reverse order complete with their own id`, async () => {
        const pending = [];
        const web = loadWebLib(
            LIBS,
            fake(mod, method, () => {
                const d = deferred();
                pending.push(d);
                return d.promise;
            }),
        );
        web.exports[name](...args, 1, CB);
        web.exports[name](...args, 2, CB);
        assert.equal(pending.length, 2);
        assert.equal(web.dyncalls.length, 0);
        pending[1].resolve(value);
        await web.flush();
        pending[0].resolve(value);
        await web.flush();
        assert.deepEqual(completions(web), [
            [2, 1, payload],
            [1, 1, payload],
        ]);
        assert.deepEqual(web.problems, []);
    });

    test(`${name}: a rejection completes once with the id and success 0`, async () => {
        const web = loadWebLib(LIBS, fake(mod, method, () => Promise.reject({ code: "X", message: "no" })));
        web.exports[name](...args, 7, CB);
        await web.flush();
        assert.deepEqual(completions(web), [[7, 0, JSON.stringify({ code: "X", message: "no" })]]);
    });

    test(`${name}: a sync throw completes once as a failure`, async () => {
        const web = loadWebLib(
            LIBS,
            fake(mod, method, () => {
                throw "unsupported";
            }),
        );
        web.exports[name](...args, 8, CB);
        await web.flush();
        assert.deepEqual(completions(web), [[8, 0, "unsupported"]]);
    });

    test(`${name}: SDK not loaded completes with the id`, async () => {
        for (const opts of [{}, { yes2sdk: {} }]) {
            const web = loadWebLib(LIBS, opts);
            web.exports[name](...args, 9, CB);
            await web.flush();
            assert.deepEqual(completions(web), [[9, 0, "SDK not initialized"]]);
        }
    });

    test(`${name}: depends on $Yes2SDKBridge`, () => {
        const web = loadWebLib(LIBS, { yes2sdk: {} });
        assert.ok(web.exports[`${name}__deps`].includes("$Yes2SDKBridge"));
    });
}

for (const [name, mod, method, args, , , nullPayload] of CASES) {
    test(`${name}: a null resolution reports the existing default`, async () => {
        const web = loadWebLib(LIBS, fake(mod, method, () => Promise.resolve(null)));
        web.exports[name](...args, 3, CB);
        await web.flush();
        assert.deepEqual(completions(web), [[3, 1, nullPayload]]);
    });
}

test("leaderboard: getPlayerEntry maps undefined to null and passes the name", async () => {
    let seen;
    const web = loadWebLib(
        LIBS,
        fake("leaderboard", "getPlayerEntryAsync", (n) => {
            seen = n;
            return Promise.resolve(undefined);
        }),
    );
    web.exports.Yes2SDK_leaderboard_getPlayerEntry("top", 4, CB);
    await web.flush();
    assert.equal(seen, "top");
    assert.deepEqual(completions(web), [[4, 1, "null"]]);
});

test("leaderboard: setScore passes metadata or undefined, getEntries passes count and offset", async () => {
    const seen = [];
    const web = loadWebLib(LIBS, {
        yes2sdk: {
            leaderboard: {
                setScoreAsync: (...a) => (seen.push(a), Promise.resolve({})),
                getEntriesAsync: (...a) => (seen.push(a), Promise.resolve([])),
            },
        },
    });
    web.exports.Yes2SDK_leaderboard_setScore("b", 5, "", 1, CB);
    web.exports.Yes2SDK_leaderboard_setScore("b", 6, "meta", 2, CB);
    web.exports.Yes2SDK_leaderboard_getEntries("b", 10, 20, 3, CB);
    await web.flush();
    assert.deepEqual(seen, [["b", 5, undefined], ["b", 6, "meta"], ["b", 10, 20]]);
});

test("stats: invalid JSON fails with the id without calling Core, even with the SDK missing", async () => {
    for (const [name, defaults] of [
        ["Yes2SDK_stats_get", "[]"],
        ["Yes2SDK_stats_set", "{}"],
        ["Yes2SDK_stats_increment", "{}"],
    ]) {
        let called = false;
        const web = loadWebLib(LIBS, fake("stats", "getStatsAsync", () => ((called = true), Promise.resolve({}))));
        web.exports[name]("{not json", 15, CB);
        await web.flush();
        const done = completions(web);
        assert.equal(done.length, 1, name);
        assert.equal(done[0][0], 15);
        assert.equal(done[0][1], 0);
        assert.match(done[0][2], /^Invalid JSON: /);
        assert.equal(called, false);
        // An empty string is valid and means the default for that call.
        const web2 = loadWebLib(LIBS, {});
        web2.exports[name]("", 16, CB);
        await web2.flush();
        assert.deepEqual(completions(web2), [[16, 0, "SDK not initialized"]], defaults);
    }
});

test("stats: parsed arguments reach Core and set reports a nil payload", async () => {
    const seen = [];
    const web = loadWebLib(LIBS, {
        yes2sdk: {
            stats: {
                getStatsAsync: (k) => (seen.push(k), Promise.resolve({})),
                setStatsAsync: (s) => (seen.push(s), Promise.resolve()),
                incrementStatsAsync: (i) => (seen.push(i), Promise.resolve({})),
            },
        },
    });
    web.exports.Yes2SDK_stats_get('["a","b"]', 1, CB);
    web.exports.Yes2SDK_stats_set('{"a":1}', 2, CB);
    web.exports.Yes2SDK_stats_increment('{"a":2}', 3, CB);
    web.exports.Yes2SDK_stats_get("", 4, CB);
    web.exports.Yes2SDK_stats_set("", 5, CB);
    await web.flush();
    assert.deepEqual(seen, [["a", "b"], { a: 1 }, { a: 2 }, [], {}]);
    const byId = Object.fromEntries(completions(web).map((a) => [a[0], a]));
    assert.deepEqual(byId[2], [2, 1, 0]);
    assert.deepEqual(byId[5], [5, 1, 0]);
});

test("config: invalid or empty options JSON falls back to {} instead of failing", async () => {
    const seen = [];
    const web = loadWebLib(LIBS, fake("config", "getFlagsAsync", (o) => (seen.push(o), Promise.resolve({ ok: 1 }))));
    web.exports.Yes2SDK_config_getFlags("{bad", 1, CB);
    web.exports.Yes2SDK_config_getFlags("", 2, CB);
    web.exports.Yes2SDK_config_getFlags('{"k":"v"}', 3, CB);
    await web.flush();
    assert.deepEqual(seen, [{}, {}, { k: "v" }]);
    assert.deepEqual(completions(web).map((a) => a[1]), [1, 1, 1]);
});

test("the four modules no longer keep per-function callback slots", () => {
    const web = loadWebLib(LIBS, { yes2sdk: {} });
    for (const m of ["Leaderboard", "Stats", "Config", "Review"]) {
        assert.equal(web.exports[`$Yes2SDK${m}Callbacks`], undefined);
    }
});
