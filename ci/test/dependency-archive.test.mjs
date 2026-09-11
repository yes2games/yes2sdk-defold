// Dependency archive tests (yes2games/yes2sdk-defold#29 sections 6 and 11).
//
// The shape under test is the one that broke the edge lane on its first real run:
// #33 added ci/consumer/game.project, which sorts before the root game.project in
// git tree order, and Bob takes the first game.project in the archive as the
// library root. Every fixture here is that shape or a neighbour of it, and the
// second test is the one that matters - it fails on the pre-fix tree, so a pass on
// the fixed tree means something.

import assert from "node:assert/strict";
import { test } from "node:test";
import { REPO_ROOT, gitInit, run, scratch, write } from "./helpers.mjs";

const ROOT_PROJECT = `[project]
title = Yes2SDK
version = 1.6.1

[library]
include_dirs = yes2sdk
`;

const CONSUMER_PROJECT = `[project]
title = yes2sdk-ci-consumer
version = 0.0.0
`;

/**
 * A committed repository. `files` is written first, so a .gitattributes among
 * them is in effect for the `git archive` the verifier runs.
 */
function repo(files) {
    const root = scratch();
    const git = gitInit(root);
    for (const [path, contents] of Object.entries(files)) {
        write(root, path, contents);
    }
    git("add", "-A");
    git("-c", "commit.gpgsign=false", "commit", "-qm", "fixture");
    return root;
}

const sdk = {
    "game.project": ROOT_PROJECT,
    "yes2sdk/ext.manifest": 'name: "Yes2SDK"\n',
    "yes2sdk/yes2sdk.lua": "return {}\n",
};

test("this repository's own archive is resolvable as a Defold library", () => {
    const result = run("verify-dependency-archive.mjs", ["--repo", REPO_ROOT]);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /one game\.project, at the root/);
});

test("a second game.project in the archive is red - the defect #33 shipped", () => {
    const result = run("verify-dependency-archive.mjs", [
        "--repo",
        repo({ ...sdk, "ci/consumer/game.project": CONSUMER_PROJECT }),
    ]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /contains 2 game\.project files/);
    // Named in the order Bob meets them, because that order is the whole defect.
    assert.match(result.stderr, /ci\/consumer\/game\.project[\s\S]*\n {2}game\.project/);
});

test("export-ignore on the offending directory is what turns that green again", () => {
    const result = run("verify-dependency-archive.mjs", [
        "--repo",
        repo({
            ...sdk,
            "ci/consumer/game.project": CONSUMER_PROJECT,
            ".gitattributes": "/ci/ export-ignore\n",
        }),
    ]);
    assert.equal(result.status, 0, result.stderr);
});

test("an archive whose only game.project is not at the root is red", () => {
    const result = run("verify-dependency-archive.mjs", [
        "--repo",
        repo({ "sdk/game.project": ROOT_PROJECT, "sdk/yes2sdk/yes2sdk.lua": "return {}\n" }),
    ]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /not at the archive root/);
});

test("no game.project at all is red", () => {
    const result = run("verify-dependency-archive.mjs", ["--repo", repo({ "yes2sdk/yes2sdk.lua": "return {}\n" })]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /no game\.project/);
});

test("a game.project declaring no [library] include_dirs is red", () => {
    const result = run("verify-dependency-archive.mjs", [
        "--repo",
        repo({ ...sdk, "game.project": "[project]\ntitle = Yes2SDK\n" }),
    ]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /no \[library\] include_dirs/);
});

test("include_dirs outside the [library] section does not count", () => {
    const result = run("verify-dependency-archive.mjs", [
        "--repo",
        repo({ ...sdk, "game.project": "[project]\ninclude_dirs = yes2sdk\n" }),
    ]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /no \[library\] include_dirs/);
});

test("an include_dirs entry the archive does not contain is red", () => {
    // The other way export-ignore can go wrong: a pattern wide enough to take the
    // extension out of the archive leaves a manifest promising a directory no
    // consumer receives.
    const result = run("verify-dependency-archive.mjs", [
        "--repo",
        repo({ ...sdk, ".gitattributes": "/yes2sdk/ export-ignore\n" }),
    ]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /contains no file under yes2sdk\//);
});
