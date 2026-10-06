// Behaviour of yes2sdk/lib/web/lib_yes2sdk_context.js through the request router.

import assert from "node:assert/strict";
import { test } from "node:test";
import { loadWebLib } from "./helpers/web-lib.mjs";

const LIBS = ["yes2sdk/lib/web/lib_yes2sdk.js", "yes2sdk/lib/web/lib_yes2sdk_context.js"];
const CB = 42;

function completions(web) {
    return web.dyncalls.map((call) => {
        assert.equal(call.sig, "viii");
        assert.equal(call.ptr, CB);
        return call.args;
    });
}

test("context: share passes the options to shareAsync and succeeds with no payload", async () => {
    const seen = [];
    const web = loadWebLib(LIBS, {
        yes2sdk: {
            context: {
                shareAsync(payload) {
                    seen.push(payload);
                    return Promise.resolve();
                },
            },
        },
    });
    web.exports.Yes2SDK_context_share(JSON.stringify({ intent: "INVITE", image: "data:image/png;base64,AAAA", text: "hi", data: { a: 1 } }), 7, CB);
    await web.flush();
    assert.deepEqual(seen, [{ intent: "INVITE", image: "data:image/png;base64,AAAA", text: "hi", data: { a: 1 } }]);
    assert.equal(completions(web).length, 1);
    assert.equal(completions(web)[0][0], 7);
    assert.equal(completions(web)[0][1], 1);
    assert.equal(completions(web)[0][2], 0, "success carries no payload");
});

test("context: a missing intent defaults to SHARE, empty options still share", async () => {
    const seen = [];
    const web = loadWebLib(LIBS, {
        yes2sdk: { context: { shareAsync: (p) => (seen.push(p), Promise.resolve()) } },
    });
    web.exports.Yes2SDK_context_share(JSON.stringify({ text: "hello" }), 1, CB);
    web.exports.Yes2SDK_context_share("", 2, CB);
    await web.flush();
    assert.deepEqual(seen, [{ text: "hello", intent: "SHARE" }, { intent: "SHARE" }]);
});

test("context: a missing method completes once as FEATURE_NOT_SUPPORTED", async () => {
    const web = loadWebLib(LIBS, { yes2sdk: { context: {} } });
    web.exports.Yes2SDK_context_share("{}", 9, CB);
    await web.flush();
    const done = completions(web);
    assert.equal(done.length, 1);
    assert.equal(done[0][0], 9);
    assert.equal(done[0][1], 0);
    assert.equal(JSON.parse(done[0][2]).code, "FEATURE_NOT_SUPPORTED");
});

test("context: invalid options fail with INVALID_PARAM without calling the SDK", async () => {
    let called = 0;
    const web = loadWebLib(LIBS, { yes2sdk: { context: { shareAsync: () => (called++, Promise.resolve()) } } });
    web.exports.Yes2SDK_context_share("{not json", 3, CB);
    await web.flush();
    assert.equal(called, 0);
    const done = completions(web);
    assert.equal(done.length, 1);
    assert.equal(done[0][1], 0);
    assert.equal(JSON.parse(done[0][2]).code, "INVALID_PARAM");
});

test("context: isSupported reflects the SDK and is false when absent", () => {
    const yes = loadWebLib(LIBS, { yes2sdk: { context: { isSupported: () => true } } });
    assert.equal(yes.exports.Yes2SDK_context_isSupported(), 1);
    const no = loadWebLib(LIBS, { yes2sdk: { context: { isSupported: () => false } } });
    assert.equal(no.exports.Yes2SDK_context_isSupported(), 0);
    const none = loadWebLib(LIBS, {});
    assert.equal(none.exports.Yes2SDK_context_isSupported(), 0);
});
