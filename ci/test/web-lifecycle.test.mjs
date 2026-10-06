// Tests for the lifecycle bridge (lib_yes2sdk.js): exit requested.

import assert from "node:assert/strict";
import { test } from "node:test";
import { loadWebLib } from "./helpers/web-lib.mjs";

const LIB = ["yes2sdk/lib/web/lib_yes2sdk.js"];

function load(on) {
    return loadWebLib(LIB, { yes2sdk: on === undefined ? {} : { on } });
}

test("onExitRequested: subscribes once however often it is registered", () => {
    const subs = [];
    const web = load((name, fn) => { subs.push({ name, fn }); });
    web.exports.Yes2SDK_onExitRequested(11);
    web.exports.Yes2SDK_onExitRequested(12);
    assert.equal(subs.length, 1);
    assert.equal(subs[0].name, "exitRequested");
});

test("onExitRequested: the latest pointer is called, synchronously and without arguments", () => {
    const subs = [];
    const web = load((name, fn) => { subs.push(fn); });
    web.exports.Yes2SDK_onExitRequested(11);
    web.exports.Yes2SDK_onExitRequested(12);
    subs[0]();
    assert.equal(web.dyncalls.length, 1);
    assert.deepEqual(web.dyncalls[0], { sig: "v", ptr: 12, args: [] });
    assert.deepEqual(web.problems, []);
});

test("onExitRequested: warns when Yes2SDK.on is missing, and wires on a later call", () => {
    const web = load(undefined);
    web.exports.Yes2SDK_onExitRequested(11);
    assert.equal(web.console.warn.length, 1);
    assert.match(web.console.warn[0], /on_exit_requested/);
    const subs = [];
    web.window.Yes2SDK.on = (name, fn) => { subs.push(name); };
    web.exports.Yes2SDK_onExitRequested(11);
    assert.deepEqual(subs, ["exitRequested"]);
});
