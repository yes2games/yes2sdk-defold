// Analytics bridge: event details must reach the parameters slot of logEvent
// (eventName, valueToSum, parameters), not the valueToSum slot.

import assert from "node:assert/strict";
import { test } from "node:test";
import { loadWebLib } from "./helpers/web-lib.mjs";

const ANALYTICS = "yes2sdk/lib/web/lib_yes2sdk_analytics.js";

function load() {
    const calls = [];
    const web = loadWebLib(ANALYTICS, {
        yes2sdk: { analytics: { logEvent: (...args) => calls.push(args) } },
    });
    return { web, calls };
}

test("analytics: logGameChoice sends decision and choice in the parameters slot", () => {
    const { web, calls } = load();
    web.exports.Yes2SDK_analytics_logGameChoice("difficulty", "hard");
    assert.equal(calls.length, 1);
    assert.equal(calls[0][0], "game_choice");
    assert.equal(calls[0][1], undefined, "valueToSum must be undefined");
    assert.deepEqual(calls[0][2], { decision: "difficulty", choice: "hard" });
    assert.deepEqual(web.problems, []);
});

test("analytics: logEvent sends parsed params in the third slot", () => {
    const { web, calls } = load();
    web.exports.Yes2SDK_analytics_logEvent("boss_defeated", '{"boss":"dragon","tries":3}');
    assert.equal(calls.length, 1);
    assert.equal(calls[0][0], "boss_defeated");
    assert.equal(calls[0][1], undefined);
    assert.deepEqual(calls[0][2], { boss: "dragon", tries: 3 });
});

test("analytics: logEvent with no params leaves the third slot undefined", () => {
    const { web, calls } = load();
    web.exports.Yes2SDK_analytics_logEvent("ping", 0);
    assert.deepEqual(calls, [["ping", undefined, undefined]]);
});
