// Stale ad callbacks: a completion from an ad that is no longer the current one
// must not reach the pointers of the newest request.

import assert from "node:assert/strict";
import { test } from "node:test";
import { loadWebLib } from "./helpers/web-lib.mjs";

const ADS = "yes2sdk/lib/web/lib_yes2sdk_ads.js";
const STALE = /ignoring \w+ from an ad that is no longer current/;

// A fake ads module that records the callback object of every show call.
function fakeAds() {
    const shown = [];
    return {
        shown,
        ads: {
            showInterstitial: (placement, cb) => shown.push(cb),
            showRewarded: (placement, cb) => shown.push(cb),
        },
    };
}

const KINDS = [
    ["interstitial", (e, ptrs) => e.Yes2SDK_ads_showInterstitial("p", ptrs.before, ptrs.after, ptrs.noFill)],
    ["rewarded", (e, ptrs) => e.Yes2SDK_ads_showRewarded("p", ptrs.before, ptrs.after, ptrs.dismissed, ptrs.viewed, ptrs.noFill)],
];
const ptrs = (n) => ({ before: n + 1, after: n + 2, dismissed: n + 3, viewed: n + 4, noFill: n + 5 });

for (const [kind, show] of KINDS) {
    test(`${kind}: late afterAd, noFill and adViewed from ad A are dropped once B started`, () => {
        const fake = fakeAds();
        const web = loadWebLib(ADS, { yes2sdk: fake });
        show(web.exports, ptrs(100));
        show(web.exports, ptrs(200));
        const [a] = fake.shown;
        a.afterAd();
        a.noFill();
        if (a.adViewed) a.adViewed();
        if (a.adDismissed) a.adDismissed();
        a.beforeAd();
        assert.deepEqual(web.dyncalls, []);
        assert.ok(web.console.warn.length >= 3);
        for (const line of web.console.warn) assert.match(line, STALE);
        assert.deepEqual(web.problems, []);
    });

    test(`${kind}: ad B's own callbacks fire to B's pointers`, () => {
        const fake = fakeAds();
        const web = loadWebLib(ADS, { yes2sdk: fake });
        show(web.exports, ptrs(100));
        show(web.exports, ptrs(200));
        const b = fake.shown[1];
        b.beforeAd();
        b.afterAd();
        assert.deepEqual(web.dyncalls.map((c) => c.ptr), [201, 202]);
        assert.deepEqual(web.console.warn, []);
    });

    test(`${kind}: a duplicate afterAd for the current ad still reaches the dyncall twice`, () => {
        const fake = fakeAds();
        const web = loadWebLib(ADS, { yes2sdk: fake });
        show(web.exports, ptrs(100));
        const [a] = fake.shown;
        a.afterAd();
        a.afterAd();
        assert.deepEqual(web.dyncalls.map((c) => c.ptr), [102, 102]);
    });

    test(`${kind}: SDK not loaded reports noFill`, () => {
        const web = loadWebLib(ADS, {});
        show(web.exports, ptrs(100));
        assert.deepEqual(web.dyncalls.map((c) => c.ptr), [105]);
    });

    test(`${kind}: a synchronous throw reports noFill to the current call`, () => {
        const boom = () => {
            throw new Error("x");
        };
        const web = loadWebLib(ADS, { yes2sdk: { ads: { showInterstitial: boom, showRewarded: boom } } });
        show(web.exports, ptrs(100));
        assert.deepEqual(web.dyncalls.map((c) => c.ptr), [105]);
    });
}

test("a sync throw from ad A cannot report noFill once B has started", () => {
    let calls = 0;
    const web = loadWebLib(ADS, {
        yes2sdk: {
            ads: {
                showInterstitial: (p, cb) => {
                    calls++;
                    if (calls === 1) {
                        // Re-entrant start of B, then A throws.
                        web.exports.Yes2SDK_ads_showInterstitial("p", 201, 202, 205);
                        throw new Error("x");
                    }
                },
            },
        },
    });
    web.exports.Yes2SDK_ads_showInterstitial("p", 101, 102, 105);
    assert.deepEqual(web.dyncalls, []);
});
