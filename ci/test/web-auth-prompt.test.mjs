// Behaviour of the registration prompt bindings in lib_yes2sdk_auth.js.
//
// Yes2SDK_auth_showRegistrationPrompt(optionsJson, requestId, cb) is synchronous:
// it returns '{"handle":n}' or '{"error":{code,message,context}}'. The router id
// carries the on_close callback: it completes once (success 1, nil payload)
// when the prompt closes. The bookkeeping (handle freed) is synchronous but the
// completion is delivered on a later tick, never inside a Lua -> C call. On an
// error result C++ cancels the id, so the JS must never complete it on that path.

import assert from "node:assert/strict";
import { test } from "node:test";
import { loadWebLib } from "./helpers/web-lib.mjs";

const LIBS = ["yes2sdk/lib/web/lib_yes2sdk.js", "yes2sdk/lib/web/lib_yes2sdk_auth.js"];
const CB = 42;

function fakePrompt(overrides = {}) {
    const calls = { show: [], login: 0, close: 0 };
    const auth = {
        showRegistrationPrompt(options) {
            calls.show.push(options);
            return {
                login() {
                    calls.login++;
                },
                close() {
                    calls.close++;
                    if (overrides.closeCallsOnClose && options && options.onClose) options.onClose();
                },
            };
        },
        ...overrides.auth,
    };
    return { auth, calls };
}

// The completion is deferred with setTimeout(0); wait past it.
const tick = () => new Promise((resolveTick) => setTimeout(resolveTick, 10));

function show(web, options, id = 7) {
    return JSON.parse(web.exports.Yes2SDK_auth_showRegistrationPrompt(options, id, CB));
}

test("prompt: success returns a handle and passes the options without onClose leaking from Lua", () => {
    const { auth, calls } = fakePrompt();
    const web = loadWebLib(LIBS, { yes2sdk: { auth } });
    const out = show(web, JSON.stringify({ theme: "light", message: "Join {{registrationCode}} now", data: { a: 1 } }));
    assert.equal(typeof out.handle, "number");
    assert.equal(calls.show.length, 1);
    assert.equal(calls.show[0].theme, "light");
    assert.equal(calls.show[0].message, "Join {{registrationCode}} now");
    assert.deepEqual(calls.show[0].data, { a: 1 });
    assert.equal(typeof calls.show[0].onClose, "function");
    assert.equal(web.dyncalls.length, 0, "showing must not complete the request");
    assert.deepEqual(web.problems, []);
});

test("prompt: empty options pointer is accepted", () => {
    const { auth, calls } = fakePrompt();
    const web = loadWebLib(LIBS, { yes2sdk: { auth } });
    const out = show(web, 0);
    assert.equal(typeof out.handle, "number");
    assert.equal(calls.show.length, 1);
});

test("prompt: onClose completes the router id once with success and nil payload, then the handle is gone", async () => {
    const { auth, calls } = fakePrompt();
    const web = loadWebLib(LIBS, { yes2sdk: { auth } });
    const { handle } = show(web, "", 9);
    calls.show[0].onClose();
    calls.show[0].onClose();
    assert.equal(web.dyncalls.length, 0, "onClose must not complete synchronously");
    await tick();
    assert.deepEqual(web.dyncalls.map((c) => [c.sig, c.ptr, ...c.args]), [["viii", CB, 9, 1, 0]]);
    assert.equal(web.exports.Yes2SDK_auth_registrationPromptClose(handle), 0);
    assert.equal(web.exports.Yes2SDK_auth_registrationPromptLogin(handle), 0);
    assert.deepEqual(web.problems, []);
});

test("prompt: close calls the stored close, completes on_close once, second close is false", async () => {
    const { auth, calls } = fakePrompt({ closeCallsOnClose: true });
    const web = loadWebLib(LIBS, { yes2sdk: { auth } });
    const { handle } = show(web, "", 11);
    assert.equal(web.exports.Yes2SDK_auth_registrationPromptClose(handle), 1);
    assert.equal(calls.close, 1);
    assert.equal(web.exports.Yes2SDK_auth_registrationPromptClose(handle), 0);
    assert.equal(calls.close, 1);
    await tick();
    assert.deepEqual(web.dyncalls.map((c) => c.args), [[11, 1, 0]]);
});

test("prompt: close still completes on_close when the platform close does not call onClose", async () => {
    const { auth } = fakePrompt();
    const web = loadWebLib(LIBS, { yes2sdk: { auth } });
    const { handle } = show(web, "", 12);
    assert.equal(web.exports.Yes2SDK_auth_registrationPromptClose(handle), 1);
    await tick();
    assert.deepEqual(web.dyncalls.map((c) => c.args), [[12, 1, 0]]);
});

test("prompt: a throwing stored close still frees the handle and completes once", async () => {
    const web = loadWebLib(LIBS, {
        yes2sdk: {
            auth: {
                showRegistrationPrompt: () => ({
                    login() {},
                    close() {
                        throw new Error("boom");
                    },
                }),
            },
        },
    });
    const { handle } = show(web, "", 13);
    assert.equal(web.exports.Yes2SDK_auth_registrationPromptClose(handle), 1);
    assert.equal(web.exports.Yes2SDK_auth_registrationPromptClose(handle), 0);
    await tick();
    assert.deepEqual(web.dyncalls.map((c) => c.args), [[13, 1, 0]]);
});

test("prompt: login calls login and keeps the handle", async () => {
    const { auth, calls } = fakePrompt();
    const web = loadWebLib(LIBS, { yes2sdk: { auth } });
    const { handle } = show(web, "");
    assert.equal(web.exports.Yes2SDK_auth_registrationPromptLogin(handle), 1);
    assert.equal(web.exports.Yes2SDK_auth_registrationPromptLogin(handle), 1);
    assert.equal(calls.login, 2);
    await tick();
    assert.equal(web.dyncalls.length, 0);
    assert.equal(web.exports.Yes2SDK_auth_registrationPromptClose(handle), 1);
});

test("prompt: a throwing login returns false and keeps the handle", () => {
    const web = loadWebLib(LIBS, {
        yes2sdk: {
            auth: {
                showRegistrationPrompt: () => ({
                    login() {
                        throw new Error("nope");
                    },
                    close() {},
                }),
            },
        },
    });
    const { handle } = show(web, "");
    assert.equal(web.exports.Yes2SDK_auth_registrationPromptLogin(handle), 0);
    assert.equal(web.exports.Yes2SDK_auth_registrationPromptClose(handle), 1);
});

test("prompt: unknown handles are false", () => {
    const web = loadWebLib(LIBS, { yes2sdk: { auth: fakePrompt().auth } });
    assert.equal(web.exports.Yes2SDK_auth_registrationPromptLogin(99), 0);
    assert.equal(web.exports.Yes2SDK_auth_registrationPromptClose(99), 0);
});

test("prompt: a sync throw keeps Core's code and never completes the id (C++ cancels it)", async () => {
    for (const code of ["INVALID_OPERATION", "INVALID_PARAM", "FEATURE_NOT_SUPPORTED"]) {
        const web = loadWebLib(LIBS, {
            yes2sdk: {
                auth: {
                    showRegistrationPrompt() {
                        throw { code, message: "rejected " + code, context: "auth.showRegistrationPrompt", originalError: {} };
                    },
                },
            },
        });
        const out = show(web, "");
        assert.deepEqual(out, {
            error: { code, message: "rejected " + code, context: "auth.showRegistrationPrompt" },
        });
        await tick();
        assert.equal(web.dyncalls.length, 0, "an error result must not complete the request");
    }
});

test("prompt: bad options JSON is INVALID_PARAM and Core is not called", () => {
    const { auth, calls } = fakePrompt();
    const web = loadWebLib(LIBS, { yes2sdk: { auth } });
    for (const bad of ["{not json", "[1,2]", "5", "null"]) {
        const out = show(web, bad);
        assert.equal(out.error.code, "INVALID_PARAM", bad);
        assert.equal(out.error.context, "auth.showRegistrationPrompt");
    }
    assert.equal(calls.show.length, 0);
    assert.equal(web.dyncalls.length, 0);
});

test("prompt: method missing is FEATURE_NOT_SUPPORTED, SDK missing is NOT_INITIALIZED", () => {
    let web = loadWebLib(LIBS, { yes2sdk: { auth: {} } });
    assert.equal(show(web, "").error.code, "FEATURE_NOT_SUPPORTED");
    web = loadWebLib(LIBS, { yes2sdk: undefined });
    assert.equal(show(web, "").error.code, "NOT_INITIALIZED");
    web = loadWebLib(LIBS, { yes2sdk: {} });
    assert.equal(show(web, "").error.code, "NOT_INITIALIZED");
    assert.equal(web.dyncalls.length, 0);
});

test("prompt: a handle without functions is an error result", async () => {
    const web = loadWebLib(LIBS, { yes2sdk: { auth: { showRegistrationPrompt: () => null } } });
    const out = show(web, "");
    assert.equal(typeof out.error.code, "string");
    await tick();
    assert.equal(web.dyncalls.length, 0);
});

test("prompt: onClose fired during show completes once, after show returns, and the handle is already closed", async () => {
    const web = loadWebLib(LIBS, {
        yes2sdk: {
            auth: {
                showRegistrationPrompt(options) {
                    options.onClose();
                    return { login() {}, close() {} };
                },
            },
        },
    });
    const { handle } = show(web, "", 21);
    assert.equal(web.dyncalls.length, 0, "nothing may complete inside the show call");
    assert.equal(web.exports.Yes2SDK_auth_registrationPromptClose(handle), 0);
    await tick();
    assert.deepEqual(web.dyncalls.map((c) => c.args), [[21, 1, 0]]);
});

test("prompt: two prompts get distinct handles and close independently", async () => {
    const { auth } = fakePrompt();
    const web = loadWebLib(LIBS, { yes2sdk: { auth } });
    const a = show(web, "", 1).handle;
    const b = show(web, "", 2).handle;
    assert.notEqual(a, b);
    assert.equal(web.exports.Yes2SDK_auth_registrationPromptClose(b), 1);
    assert.equal(web.exports.Yes2SDK_auth_registrationPromptClose(a), 1);
    await tick();
    assert.deepEqual(web.dyncalls.map((c) => c.args), [[2, 1, 0], [1, 1, 0]]);
    assert.deepEqual(web.problems, []);
});

test("prompt: nothing completes before close() returns, even when the platform calls onClose from close", async () => {
    const { auth } = fakePrompt({ closeCallsOnClose: true });
    const web = loadWebLib(LIBS, { yes2sdk: { auth } });
    const { handle } = show(web, "", 31);
    assert.equal(web.exports.Yes2SDK_auth_registrationPromptClose(handle), 1);
    assert.equal(web.dyncalls.length, 0, "on_close must not run inside the close call");
    await tick();
    assert.deepEqual(web.dyncalls.map((c) => c.args), [[31, 1, 0]]);
    assert.deepEqual(web.problems, []);
});

test("prompt: a platform onClose after close() but before the deferred completion is ignored", async () => {
    const { auth, calls } = fakePrompt();
    const web = loadWebLib(LIBS, { yes2sdk: { auth } });
    const { handle } = show(web, "", 32);
    assert.equal(web.exports.Yes2SDK_auth_registrationPromptClose(handle), 1);
    calls.show[0].onClose();
    assert.equal(web.dyncalls.length, 0);
    await tick();
    calls.show[0].onClose();
    await tick();
    assert.deepEqual(web.dyncalls.map((c) => c.args), [[32, 1, 0]]);
});

test("prompt: onClose during a show that then fails never completes the id (cancel wins)", async () => {
    for (const fail of ["throw", "no-handle"]) {
        let onClose;
        const web = loadWebLib(LIBS, {
            yes2sdk: {
                auth: {
                    showRegistrationPrompt(options) {
                        onClose = options.onClose;
                        options.onClose();
                        if (fail === "throw") {
                            throw { code: "INVALID_PARAM", message: "late", context: "auth.showRegistrationPrompt" };
                        }
                        return null;
                    },
                },
            },
        });
        const out = show(web, "", 33);
        assert.equal(typeof out.error.code, "string", fail);
        onClose();
        await tick();
        assert.equal(web.dyncalls.length, 0, fail + ": on_close must never run after an error result");
    }
});
