// banners_show must call the banner API that exists (showBanner), fire and forget.

import assert from "node:assert/strict";
import { test } from "node:test";
import { loadWebLib } from "./helpers/web-lib.mjs";

const BANNERS = "yes2sdk/lib/web/lib_yes2sdk_banners.js";

function load(banners) {
    return loadWebLib(BANNERS, { yes2sdk: { banners } });
}

test("banners_show: calls showBanner with id and size", () => {
    const calls = [];
    const web = load({
        showBanner: (...args) => {
            calls.push(args);
            return Promise.resolve();
        },
    });
    web.exports.Yes2SDK_banners_show("top", "320x50");
    assert.deepEqual(calls, [["top", "320x50"]]);
    assert.deepEqual(web.console.warn, []);
});

test("banners_show: a rejected promise is warned and does not throw", async () => {
    const web = load({ showBanner: () => Promise.reject(new Error("boom")) });
    assert.doesNotThrow(() => web.exports.Yes2SDK_banners_show("a", "b"));
    await web.flush();
    assert.equal(web.console.warn.length, 1);
    assert.match(web.console.warn[0], /\[Yes2SDK\] banners_show failed:.*boom/);
});

test("banners_show: a synchronous throw is warned and does not throw", () => {
    const web = load({
        showBanner: () => {
            throw new Error("sync");
        },
    });
    assert.doesNotThrow(() => web.exports.Yes2SDK_banners_show("a", "b"));
    assert.equal(web.console.warn.length, 1);
    assert.match(web.console.warn[0], /banners_show failed:.*sync/);
});

test("banners_show: a missing method warns and does not throw", () => {
    const web = load({});
    assert.doesNotThrow(() => web.exports.Yes2SDK_banners_show("a", "b"));
    assert.equal(web.console.warn.length, 1);
    assert.match(web.console.warn[0], /banner API is unavailable/);
});
