// Tests for session entry point data (lib_yes2sdk_session.js).

import assert from "node:assert/strict";
import { test } from "node:test";
import { loadWebLib } from "./helpers/web-lib.mjs";

const SESSION = "yes2sdk/lib/web/lib_yes2sdk_session.js";

function get(yes2sdk) {
    return loadWebLib(SESSION, { yes2sdk }).exports.Yes2SDK_session_getEntryPointData();
}

test("entry point data: the Json method is preferred", () => {
    const out = get({
        session: {
            getEntryPointDataJson: () => '{"from":"json"}',
            getEntryPointData: () => ({ from: "object" }),
        },
    });
    assert.equal(out, '{"from":"json"}');
});

test("entry point data: falls back to stringifying the object", () => {
    const out = get({ session: { getEntryPointData: () => ({ ref: "abc", n: 2 }) } });
    assert.deepEqual(JSON.parse(out), { ref: "abc", n: 2 });
});

test("entry point data: a null object becomes {}", () => {
    assert.equal(get({ session: { getEntryPointData: () => null } }), "{}");
});

test("entry point data: neither method present returns {}", () => {
    assert.equal(get({ session: {} }), "{}");
});

test("entry point data: a throwing method returns {}", () => {
    const out = get({
        session: {
            getEntryPointDataJson: () => { throw new Error("boom"); },
            getEntryPointData: () => ({ a: 1 }),
        },
    });
    assert.equal(out, "{}");
});

test("entry point data: no SDK returns {}", () => {
    assert.equal(get(undefined), "{}");
});
