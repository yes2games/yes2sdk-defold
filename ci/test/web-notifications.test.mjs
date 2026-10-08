// Behaviour of yes2sdk/lib/web/lib_yes2sdk_notifications.js through the request router.

import assert from "node:assert/strict";
import { test } from "node:test";
import { loadWebLib } from "./helpers/web-lib.mjs";

const LIBS = ["yes2sdk/lib/web/lib_yes2sdk.js", "yes2sdk/lib/web/lib_yes2sdk_notifications.js"];
const CB = 42;

const errorJson = (code, message, context) => JSON.stringify({ code, message, context });

function completions(web) {
    return web.dyncalls.map((call) => {
        assert.equal(call.sig, "viii", "completions go through the request router signature");
        assert.equal(call.ptr, CB);
        return call.args;
    });
}

test("notifications: schedule parses the options JSON and reports the result", async () => {
    const seen = [];
    const scheduled = { id: "d1", title: "Hi", body: "Back", scheduledAt: 1000 };
    const web = loadWebLib(LIBS, {
        yes2sdk: {
            notifications: {
                scheduleAsync(options) {
                    seen.push(options);
                    return Promise.resolve(scheduled);
                },
            },
        },
    });
    const ptr = JSON.stringify({ id: "d1", title: "Hi", scheduledInDays: 1 });
    web.exports.Yes2SDK_notifications_schedule(ptr, 7, CB);
    await web.flush();
    assert.deepEqual(seen, [{ id: "d1", title: "Hi", scheduledInDays: 1 }]);
    assert.deepEqual(completions(web), [[7, 1, JSON.stringify(scheduled)]]);
    assert.deepEqual(web.problems, []);
});

test("notifications: schedule with options that do not parse fails with INVALID_PARAM", async () => {
    const web = loadWebLib(LIBS, { yes2sdk: { notifications: { scheduleAsync: () => Promise.resolve({}) } } });
    web.exports.Yes2SDK_notifications_schedule("{nope", 8, CB);
    await web.flush();
    const done = completions(web);
    assert.equal(done.length, 1);
    assert.equal(done[0][0], 8);
    assert.equal(done[0][1], 0);
    assert.equal(JSON.parse(done[0][2]).code, "INVALID_PARAM");
});

test("notifications: a Core rejection keeps its code", async () => {
    const web = loadWebLib(LIBS, {
        yes2sdk: { notifications: { scheduleAsync: () => Promise.reject({ code: "INVALID_PARAM", message: "title required" }) } },
    });
    web.exports.Yes2SDK_notifications_schedule("{}", 9, CB);
    await web.flush();
    assert.deepEqual(completions(web), [[9, 0, errorJson("INVALID_PARAM", "title required", "notifications.scheduleAsync")]]);
});

test("notifications: cancel passes the id and succeeds with no payload", async () => {
    const seen = [];
    const web = loadWebLib(LIBS, {
        yes2sdk: { notifications: { cancelAsync: (id) => (seen.push(id), Promise.resolve()) } },
    });
    web.exports.Yes2SDK_notifications_cancel("d3", 10, CB);
    await web.flush();
    assert.deepEqual(seen, ["d3"]);
    assert.deepEqual(completions(web), [[10, 1, 0]]);
});

test("notifications: cancelAll succeeds with no payload", async () => {
    const web = loadWebLib(LIBS, { yes2sdk: { notifications: { cancelAllAsync: () => Promise.resolve() } } });
    web.exports.Yes2SDK_notifications_cancelAll(11, CB);
    await web.flush();
    assert.deepEqual(completions(web), [[11, 1, 0]]);
});

test("notifications: a missing method completes once as FEATURE_NOT_SUPPORTED", async () => {
    const web = loadWebLib(LIBS, { yes2sdk: { notifications: {} } });
    web.exports.Yes2SDK_notifications_cancelAll(12, CB);
    await web.flush();
    const done = completions(web);
    assert.equal(done.length, 1);
    assert.equal(JSON.parse(done[0][2]).code, "FEATURE_NOT_SUPPORTED");
});

test("notifications: SDK not loaded completes every call once with its id", async () => {
    const web = loadWebLib(LIBS, {});
    web.exports.Yes2SDK_notifications_schedule("{}", 21, CB);
    web.exports.Yes2SDK_notifications_cancel("a", 22, CB);
    web.exports.Yes2SDK_notifications_cancelAll(23, CB);
    await web.flush();
    assert.deepEqual(completions(web), [
        [21, 0, errorJson("NOT_INITIALIZED", "SDK not initialized", "notifications.scheduleAsync")],
        [22, 0, errorJson("NOT_INITIALIZED", "SDK not initialized", "notifications.cancelAsync")],
        [23, 0, errorJson("NOT_INITIALIZED", "SDK not initialized", "notifications.cancelAllAsync")],
    ]);
});

test("notifications: isSupported reflects the SDK", () => {
    const yes = loadWebLib(LIBS, { yes2sdk: { notifications: { isSupported: () => true } } });
    assert.equal(yes.exports.Yes2SDK_notifications_isSupported(), 1);
    const no = loadWebLib(LIBS, { yes2sdk: { notifications: { isSupported: () => false } } });
    assert.equal(no.exports.Yes2SDK_notifications_isSupported(), 0);
    assert.equal(loadWebLib(LIBS, {}).exports.Yes2SDK_notifications_isSupported(), 0);
});

test("notifications: an empty title reaches Core", async () => {
    const seen = [];
    const web = loadWebLib(LIBS, {
        yes2sdk: { notifications: { scheduleAsync(o) { seen.push(o); return Promise.resolve({ id: "n" }); } } },
    });
    web.exports.Yes2SDK_notifications_schedule(JSON.stringify({ title: "", body: "b", scheduledInDays: 1 }), 4, CB);
    await web.flush();
    assert.deepEqual(seen, [{ title: "", body: "b", scheduledInDays: 1 }]);
    assert.equal(web.dyncalls.length, 1);
    assert.equal(web.dyncalls[0].args[1], 1);
});
