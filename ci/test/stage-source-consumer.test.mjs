// Consumer staging tests (yes2games/yes2sdk-defold#29 section 6).
//
// The four properties section 6 asks for: ephemeral state, refusal of path escape
// and symlink abuse, only intended files copied, and the repository's own
// game.project never mutated - that last one matters because the root
// game.project is a version mirror the projector owns, and a consumer path that
// wrote to it would change what the mirror check already passed on.

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { REPO_ROOT, run, scratch, write } from "./helpers.mjs";

const EDGE = "https://github.com/yes2games/yes2sdk-defold/archive/refs/tags/edge.zip";

/** A repository-shaped fixture: the consumer template plus a fake extension. */
function fixture() {
    const root = scratch();
    write(root, "game.project", "[project]\ntitle = Yes2SDK\nversion = 1.6.1\n\n[library]\ninclude_dirs = yes2sdk\n");
    write(root, "ci/consumer/game.project", "[project]\ntitle = yes2sdk-ci-consumer\nversion = 0.0.0\n");
    write(root, "ci/consumer/main/main.script", 'local api = require "yes2sdk.yes2sdk"\n');
    write(root, "yes2sdk/ext.manifest", 'name: "Yes2SDK"\n');
    write(root, "yes2sdk/src/yes2sdk.cpp", '#define VERSION "1.6.1"\n');
    return root;
}

test("from-source mode copies the consumer and the working-tree extension", () => {
    const root = fixture();
    const out = join(scratch(), "stage");

    const result = run("stage-source-consumer.mjs", ["--root", root, "--out", out, "--from-source"]);
    assert.equal(result.status, 0, result.stderr);

    assert.ok(existsSync(join(out, "game.project")));
    assert.ok(existsSync(join(out, "main", "main.script")));
    assert.ok(existsSync(join(out, "yes2sdk", "ext.manifest")));
    assert.ok(existsSync(join(out, "yes2sdk", "src", "yes2sdk.cpp")));

    // Only intended files: nothing from the repository root leaks in.
    assert.equal(existsSync(join(out, "ci")), false);
    assert.doesNotMatch(readFileSync(join(out, "game.project"), "utf8"), /Yes2SDK\n/, "the staged project is the consumer's, not the repository's");
});

test("dependency mode writes the URL into the staged project only", () => {
    const root = fixture();
    const out = join(scratch(), "stage");
    const before = readFileSync(join(root, "game.project"), "utf8");

    const result = run("stage-source-consumer.mjs", ["--root", root, "--out", out, "--dependency", EDGE]);
    assert.equal(result.status, 0, result.stderr);

    assert.match(readFileSync(join(out, "game.project"), "utf8"), /^dependencies#0 = https:\/\/github\.com\/yes2games\/yes2sdk-defold\/archive\/refs\/tags\/edge\.zip$/m);
    assert.equal(existsSync(join(out, "yes2sdk")), false, "dependency mode resolves the extension, it does not copy it");
    assert.equal(readFileSync(join(root, "game.project"), "utf8"), before, "the repository game.project is a projector mirror and is never written");
});

test("the stage is ephemeral: whatever a previous lane left is gone", () => {
    const root = fixture();
    const out = join(scratch(), "stage");

    assert.equal(run("stage-source-consumer.mjs", ["--root", root, "--out", out, "--from-source"]).status, 0);
    // A resolved dependency cache is exactly the thing that must not survive into
    // the next lane, and .internal/lib is where Bob keeps it.
    write(out, ".internal/lib/stale.zip", "stale bytes");

    assert.equal(run("stage-source-consumer.mjs", ["--root", root, "--out", out, "--dependency", EDGE]).status, 0);
    assert.equal(existsSync(join(out, ".internal", "lib", "stale.zip")), false);
});

test("a symlink in the source tree is refused, not followed", () => {
    const root = fixture();
    const secret = join(scratch(), "outside.txt");
    writeFileSync(secret, "not part of the consumer\n");
    symlinkSync(secret, join(root, "ci", "consumer", "link.txt"));

    const result = run("stage-source-consumer.mjs", ["--root", root, "--out", join(scratch(), "stage"), "--from-source"]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /link\.txt is a symlink/);
});

test("a symlinked directory inside the extension is refused too", () => {
    const root = fixture();
    symlinkSync(join(root, "ci"), join(root, "yes2sdk", "escape"));

    const result = run("stage-source-consumer.mjs", ["--root", root, "--out", join(scratch(), "stage"), "--from-source"]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /escape is a symlink/);
});

for (const [label, url] of [
    ["another repository", "https://github.com/someone/else/archive/refs/tags/v1.0.0.zip"],
    ["an arbitrary host", "https://example.invalid/yes2sdk.zip"],
    ["a non-archive path", "https://github.com/yes2games/yes2sdk-defold/releases/latest"],
]) {
    test(`a dependency URL pointing at ${label} is refused`, () => {
        const result = run("stage-source-consumer.mjs", ["--root", fixture(), "--out", join(scratch(), "stage"), "--dependency", url]);
        assert.equal(result.status, 2);
        assert.match(result.stderr, /must be a yes2sdk-defold archive URL/);
    });
}

test("an --out that contains the repository root is refused, because the stage is deleted", () => {
    const root = fixture();
    const result = run("stage-source-consumer.mjs", ["--root", root, "--out", join(root, ".."), "--from-source"]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /contains the repository root/);
});

test("exactly one source mode is required", () => {
    const root = fixture();
    const out = join(scratch(), "stage");
    assert.equal(run("stage-source-consumer.mjs", ["--root", root, "--out", out]).status, 2);
    assert.equal(run("stage-source-consumer.mjs", ["--root", root, "--out", out, "--from-source", "--dependency", EDGE]).status, 2);
    assert.equal(run("stage-source-consumer.mjs", ["--root", root, "--from-source"]).status, 2);
});

test("staging the real repository changes nothing tracked in it", () => {
    // Compared before and after rather than asserted clean, so the test says the
    // same thing in a dirty development checkout as in CI.
    const state = () => execFileSync("git", ["-C", REPO_ROOT, "status", "--porcelain", "--untracked-files=no"], { encoding: "utf8" });
    const before = state();

    const out = join(scratch(), "stage");
    assert.equal(run("stage-source-consumer.mjs", ["--root", REPO_ROOT, "--out", out, "--from-source"]).status, 0);
    assert.ok(existsSync(join(out, "yes2sdk", "ext.manifest")), "the real extension staged");
    assert.equal(state(), before, "staging wrote inside the repository");
});
