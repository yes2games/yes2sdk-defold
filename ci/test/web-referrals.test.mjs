// Behaviour of yes2sdk/lib/web/lib_yes2sdk_referrals.js through the request router.
// Overlapping calls each complete with their own id and payload; a missing method
// is FEATURE_NOT_SUPPORTED and a missing SDK is NOT_INITIALIZED.

import assert from "node:assert/strict";
import { test } from "node:test";
import { loadWebLib } from "./helpers/web-lib.mjs";

const LIBS = ["yes2sdk/lib/web/lib_yes2sdk.js", "yes2sdk/lib/web/lib_yes2sdk_referrals.js"];
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
        assert.equal(call.sig, "viii");
        assert.equal(call.ptr, CB);
        return call.args;
    });
}

// Plain strings stand in for const char* (see helpers/web-lib.mjs).
const str = (web, value) => value;

test("referrals: overlapping share calls complete in reverse order with their own id", async () => {
    const pending = [];
    const seen = [];
    const web = loadWebLib(LIBS, {
        yes2sdk: {
            referrals: {
                shareAsync(options) {
                    seen.push(options);
                    const d = deferred();
                    pending.push(d);
                    return d.promise;
                },
            },
        },
    });
    web.exports.Yes2SDK_referrals_share(str(web, JSON.stringify({ reference: "a", data: { x: 1 } })), 1, CB);
    web.exports.Yes2SDK_referrals_share(str(web, JSON.stringify({ reference: "b", title: "T" })), 2, CB);
    assert.equal(web.dyncalls.length, 0);
    pending[1].resolve({ canceled: true });
    await web.flush();
    pending[0].resolve({ canceled: false });
    await web.flush();
    assert.deepEqual(seen, [{ reference: "a", data: { x: 1 } }, { reference: "b", title: "T" }]);
    assert.deepEqual(completions(web), [
        [2, 1, JSON.stringify({ canceled: true })],
        [1, 1, JSON.stringify({ canceled: false })],
    ]);
    assert.deepEqual(web.problems, []);
});

test("referrals: a null share result reports canceled false", async () => {
    const web = loadWebLib(LIBS, { yes2sdk: { referrals: { shareAsync: () => Promise.resolve(undefined) } } });
    web.exports.Yes2SDK_referrals_share(str(web, '{"reference":"r"}'), 3, CB);
    await web.flush();
    assert.deepEqual(completions(web), [[3, 1, JSON.stringify({ canceled: false })]]);
});

test("referrals: list passes the payload through untouched", async () => {
    const payload = {
        referrals: { party: [{ playerId: "p1", joinedAt: "2026-10-01T00:00:00Z" }] },
        signedRequest: "abc.def",
    };
    const referrals = {
        listAsync() {
            return Promise.resolve(payload);
        },
    };
    const web = loadWebLib(LIBS, { yes2sdk: { referrals } });
    web.exports.Yes2SDK_referrals_list(4, CB);
    await web.flush();
    assert.deepEqual(completions(web), [[4, 1, JSON.stringify(payload)]]);
});

test("referrals: a rejection keeps the SDK error code and the call context", async () => {
    const web = loadWebLib(LIBS, {
        yes2sdk: { referrals: { listAsync: () => Promise.reject({ code: "PLATFORM_ERROR", message: "nope" }) } },
    });
    web.exports.Yes2SDK_referrals_list(5, CB);
    await web.flush();
    assert.deepEqual(completions(web), [[5, 0, errorJson("PLATFORM_ERROR", "nope", "referrals.listAsync")]]);
});

test("referrals: a missing method is FEATURE_NOT_SUPPORTED", async () => {
    const web = loadWebLib(LIBS, { yes2sdk: { referrals: {} } });
    web.exports.Yes2SDK_referrals_share(str(web, '{"reference":"r"}'), 6, CB);
    web.exports.Yes2SDK_referrals_list(7, CB);
    await web.flush();
    const done = completions(web);
    assert.equal(done.length, 2);
    for (const [id, success, payload] of done) {
        assert.ok(id === 6 || id === 7);
        assert.equal(success, 0);
        assert.equal(JSON.parse(payload).code, "FEATURE_NOT_SUPPORTED");
    }
});

test("referrals: SDK not loaded completes every call once with NOT_INITIALIZED", async () => {
    for (const yes2sdk of [undefined, {}]) {
        const web = loadWebLib(LIBS, yes2sdk === undefined ? {} : { yes2sdk });
        web.exports.Yes2SDK_referrals_share(str(web, '{"reference":"r"}'), 21, CB);
        web.exports.Yes2SDK_referrals_list(22, CB);
        await web.flush();
        assert.deepEqual(completions(web), [
            [21, 0, errorJson("NOT_INITIALIZED", "SDK not initialized", "referrals.shareAsync")],
            [22, 0, errorJson("NOT_INITIALIZED", "SDK not initialized", "referrals.listAsync")],
        ]);
    }
});

test("referrals: isSupported follows the SDK and is false when anything is missing", () => {
    const yes = loadWebLib(LIBS, { yes2sdk: { referrals: { isSupported: () => true } } });
    assert.equal(yes.exports.Yes2SDK_referrals_isSupported(), 1);
    const no = loadWebLib(LIBS, { yes2sdk: { referrals: { isSupported: () => false } } });
    assert.equal(no.exports.Yes2SDK_referrals_isSupported(), 0);
    const bare = loadWebLib(LIBS, { yes2sdk: { referrals: {} } });
    assert.equal(bare.exports.Yes2SDK_referrals_isSupported(), 0);
    const none = loadWebLib(LIBS, {});
    assert.equal(none.exports.Yes2SDK_referrals_isSupported(), 0);
});

test("referrals: onboardingSlug and notificationTemplates reach Core unchanged", async () => {
    const seen = [];
    const web = loadWebLib(LIBS, {
        yes2sdk: { referrals: { shareAsync(options) { seen.push(options); return Promise.resolve({ canceled: false }); } } },
    });
    const options = {
        reference: "r",
        onboardingSlug: "tutorial-game",
        notificationTemplates: [
            { minConversionCount: 1, variants: [{ title: null, body: "A friend joined!", ctaText: "Play", imageReference: "img" }] },
        ],
    };
    web.exports.Yes2SDK_referrals_share(str(web, JSON.stringify(options)), 3, CB);
    await web.flush();
    assert.deepEqual(seen, [options]);
    assert.deepEqual(completions(web), [[3, 1, JSON.stringify({ canceled: false })]]);
});
