// Advisory pre-push hook tests (yes2games/yes2sdk-defold#29 sections 8 and 15,
// yes2games/yes2dashboard#141 section 3).
//
// The hook is a shell script, so it is driven the way git drives it: ref lines on
// stdin, remote name and URL as arguments. Two of these cases exist because of a
// shipped defect - yes2sdk-core#59, where the same hook aborted on *every* push in
// a checkout without refs/remotes/origin/HEAD, because `git symbolic-ref` exits
// 128 and `set -Eeuo pipefail` killed the script before its own fallback could
// run.

import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { REPO_ROOT, scratch } from "./helpers.mjs";

const HOOK = join(REPO_ROOT, ".githooks", "pre-push");

/**
 * A clone whose default branch is `branch`, plus the bare remote it came from.
 * `originHead` false deletes refs/remotes/origin/HEAD, which is the shape every
 * actions/checkout produces and the shape that broke yes2sdk-core#59.
 */
function clone({ branch = "main", originHead = true } = {}) {
    const root = scratch();
    const remote = join(root, "remote.git");
    const work = join(root, "work");
    const git = (cwd, ...args) => execFileSync("git", ["-C", cwd, ...args], { stdio: ["ignore", "ignore", "pipe"] });

    execFileSync("git", ["init", "-q", "--bare", "-b", branch, remote], { stdio: ["ignore", "ignore", "pipe"] });
    execFileSync("git", ["clone", "-q", remote, work], { stdio: ["ignore", "ignore", "pipe"] });
    git(work, "config", "user.email", "ci@example.invalid");
    git(work, "config", "user.name", "ci");
    git(work, "commit", "-q", "--allow-empty", "-m", "init");
    git(work, "branch", "-M", branch);
    git(work, "push", "-q", "origin", branch);
    git(work, "fetch", "-q", "origin");
    if (originHead) {
        git(work, "remote", "set-head", "origin", branch);
    } else {
        spawnSync("git", ["-C", work, "update-ref", "-d", "refs/remotes/origin/HEAD"], { stdio: "ignore" });
    }
    return { work, remote };
}

/** Run the hook over one pushed ref, as git would. */
function push({ work, remote }, ref) {
    return spawnSync("bash", [HOOK, "origin", remote], {
        cwd: work,
        input: `refs/heads/${ref} 1111111111111111111111111111111111111111 refs/heads/${ref} 0000000000000000000000000000000000000000\n`,
        encoding: "utf8",
    });
}

test("a direct push to the default branch is refused", () => {
    const repo = clone();
    const result = push(repo, "main");
    assert.equal(result.status, 1);
    assert.match(result.stderr, /direct push to 'main' is blocked/);
    assert.match(result.stderr, /--no-verify/, "the refusal says how it is bypassed");
});

test("a push to any other branch passes", () => {
    const repo = clone();
    const result = push(repo, "feature/thing");
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stderr, "");
});

test("a checkout with no refs/remotes/origin/HEAD still guards, and still allows branches", () => {
    const repo = clone({ originHead: false });

    const branch = push(repo, "feature/thing");
    assert.equal(branch.status, 0, `yes2sdk-core#59 regression: the hook refused an unrelated push: ${branch.stderr}`);

    const main = push(repo, "main");
    assert.equal(main.status, 1, main.stderr);
    assert.match(main.stderr, /direct push to 'main' is blocked/);
});

test("the default branch is read from git, so a rename cannot disarm the guard", () => {
    const repo = clone({ branch: "trunk" });

    const trunk = push(repo, "trunk");
    assert.equal(trunk.status, 1, trunk.stderr);
    assert.match(trunk.stderr, /direct push to 'trunk' is blocked/);

    const main = push(repo, "main");
    assert.equal(main.status, 0, "main is an ordinary branch once the default is named trunk");
});

test("the hook documents itself as advisory and bypassable, in the hook", () => {
    const source = readFileSync(HOOK, "utf8");
    const header = source.split("\n").slice(0, 12).join("\n");
    assert.match(header, /NOT enforcement/);
    assert.match(header, /--no-verify/);
    assert.match(header, /core\.hooksPath/);
});
