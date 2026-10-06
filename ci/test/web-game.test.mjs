// Tests for the game bridge (lib_yes2sdk_game.js): invite link.

import assert from "node:assert/strict";
import { test } from "node:test";
import { loadWebLib } from "./helpers/web-lib.mjs";

const GAME = "yes2sdk/lib/web/lib_yes2sdk_game.js";

function load(inviteLink) {
    return loadWebLib(GAME, { yes2sdk: { game: { inviteLink } } });
}

test("inviteLink: success passes the URL through with success 1", async () => {
    const web = load(() => Promise.resolve("https://example.test/join?x=1"));
    web.exports.Yes2SDK_game_inviteLink('{"a":1}', 7);
    await web.flush();
    assert.equal(web.dyncalls.length, 1);
    assert.deepEqual(web.dyncalls[0], { sig: "vii", ptr: 7, args: [1, "https://example.test/join?x=1"] });
    assert.deepEqual(web.problems, []);
});

test("inviteLink: Core receives the raw JSON string", async () => {
    const seen = [];
    const web = load((arg) => { seen.push(arg); return Promise.resolve("u"); });
    web.exports.Yes2SDK_game_inviteLink('{"room": "abc"}', 1);
    await web.flush();
    assert.equal(seen.length, 1);
    assert.equal(typeof seen[0], "string");
    assert.equal(seen[0], '{"room": "abc"}');
});

test("inviteLink: empty input sends {}", async () => {
    const seen = [];
    const web = load((arg) => { seen.push(arg); return Promise.resolve("u"); });
    web.exports.Yes2SDK_game_inviteLink("", 1);
    await web.flush();
    assert.deepEqual(seen, ["{}"]);
});

test("inviteLink: invalid JSON fails without calling Core", async () => {
    let called = 0;
    const web = load(() => { called++; return Promise.resolve("u"); });
    web.exports.Yes2SDK_game_inviteLink("{nope", 3);
    await web.flush();
    assert.equal(called, 0);
    assert.equal(web.dyncalls.length, 1);
    assert.equal(web.dyncalls[0].args[0], 0);
});

test("inviteLink: a rejection reports success 0", async () => {
    const web = load(() => Promise.reject(new Error("nope")));
    web.exports.Yes2SDK_game_inviteLink("{}", 4);
    await web.flush();
    assert.equal(web.dyncalls.length, 1);
    assert.equal(web.dyncalls[0].args[0], 0);
});
