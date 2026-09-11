// Post-push projector assertion tests (yes2games/yes2sdk-defold#29 section 3).
//
// The race these cover is real and was observed on main: the projector pushed,
// the push landed, and `gh pr view` a moment later still served the pre-push head
// - so the step failed claiming a projection mismatch that had not happened.
//
// A race is hard to pin, so nothing here races. The lag is *scripted*: stub `gh`
// and `git` on PATH serve the pre-push head for a fixed number of reads and the
// projected one after. That makes "still catching up" and "someone else pushed"
// two different fixtures rather than two outcomes of one timing accident, and it
// lets the second test show the failure the fix exists for - with no convergence
// window, the very same fixture is red.

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { chmodSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { run, scratch, write } from "./helpers.mjs";

const OLD = "1111111111111111111111111111111111111111";
const NEW = "2222222222222222222222222222222222222222";
const OTHER = "3333333333333333333333333333333333333333";

const BRANCH = "release-please--branches--main";

/**
 * A scratch world holding a fake `gh` and a fake remote, each serving `lagReads`
 * reads of `OLD` before switching to `after`.
 */
function world({ lagReads = 0, after = NEW, state = "OPEN", base = "main", head = BRANCH } = {}) {
    const root = scratch();

    // One counter per stub, so "the pull request lagged" and "the ref lagged" are
    // independent facts rather than a shared accident.
    const stub = (name, lag, emit) => {
        const counter = join(root, `${name}.reads`);
        writeFileSync(counter, "0", "utf8");
        write(
            root,
            `bin/${name}`,
            `#!/usr/bin/env bash
set -eu
n=$(cat ${JSON.stringify(counter)})
echo $((n + 1)) > ${JSON.stringify(counter)}
if [ "$n" -lt ${lag} ]; then sha=${JSON.stringify(OLD)}; else sha=${JSON.stringify(after)}; fi
${emit}
`
        );
        chmodSync(join(root, "bin", name), 0o755);
        return () => Number(readFileSync(counter, "utf8").trim());
    };

    // `gh pr view --json ...` prints one JSON object; the script calls nothing else.
    const ghReads = stub(
        "gh",
        lagReads,
        `printf '{"state":"${state}","baseRefName":"${base}","headRefName":"${head}","headRefOid":"%s"}\\n' "$sha"`
    );
    // `git ls-remote <remote> refs/heads/<branch>` prints "<sha>\t<ref>". The stub
    // stands in for the remote, and refuses anything else so a future git call
    // cannot silently pass through a fixture that is not serving it.
    const gitReads = stub(
        "git",
        lagReads,
        `if [ "\${3:-}" != "ls-remote" ]; then echo "stub git: unexpected $*" >&2; exit 97; fi
if [ -n "$sha" ]; then printf '%s\\trefs/heads/${BRANCH}\\n' "$sha"; fi`
    );

    return {
        root,
        env: { ...process.env, PATH: `${join(root, "bin")}:${process.env.PATH}` },
        reads: () => ghReads() + gitReads(),
    };
}

const args = (extra = []) => [
    "--number", "35",
    "--ref", BRANCH,
    "--base", "main",
    "--expect", NEW,
    "--from", OLD,
    "--interval-ms", "10",
    ...extra,
];

test("a lagging read converges instead of accusing the projector", () => {
    const fixture = world({ lagReads: 3 });
    const result = run("verify-projected-head.mjs", args(["--repo", fixture.root, "--timeout-seconds", "30"]), {
        env: fixture.env,
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /still the pre-push head, waiting/);
    assert.match(result.stdout, new RegExp(`both read ${NEW}`));
});

test("the same fixture is red with no convergence window - the bug being fixed", () => {
    // This is the pre-fix behaviour exactly: read once, assert, fail. The fixture
    // is unchanged, so what the fix changes is the read and nothing else.
    const fixture = world({ lagReads: 3 });
    const result = run("verify-projected-head.mjs", args(["--repo", fixture.root, "--timeout-seconds", "0"]), {
        env: fixture.env,
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /CONSISTENCY TIMEOUT/);
});

test("a consistency timeout says so, and says it is not a projection mismatch", () => {
    const fixture = world({ lagReads: 1000 });
    const result = run("verify-projected-head.mjs", args(["--repo", fixture.root, "--timeout-seconds", "0"]), {
        env: fixture.env,
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /CONSISTENCY TIMEOUT/);
    assert.match(result.stderr, /NOT a projection mismatch/);
    assert.match(result.stderr, /re-running the job is the whole fix/);
    // It has to hand over what it actually saw, or the next person is back to guessing.
    assert.match(result.stderr, new RegExp(`refs/heads/${BRANCH} = "${OLD}"`));
    assert.match(result.stderr, new RegExp(`pull request head = "${OLD}"`));
});

test("a third commit on the branch is a conflict, failed at once and not waited out", () => {
    const fixture = world({ lagReads: 0, after: OTHER });
    const result = run("verify-projected-head.mjs", args(["--repo", fixture.root, "--timeout-seconds", "30"]), {
        env: fixture.env,
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Something else pushed to the release branch/);
    assert.match(result.stderr, /not a stale read/);
    // One read each, then out: a real conflict must not spend the timeout.
    assert.ok(fixture.reads() <= 2, `took ${fixture.reads()} reads`);
});

test("a deleted release branch is a conflict, not lag", () => {
    const fixture = world({ lagReads: 0, after: "" });
    const result = run("verify-projected-head.mjs", args(["--repo", fixture.root, "--timeout-seconds", "30"]), {
        env: fixture.env,
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /no longer exists/);
});

test("an identity change is reported at once, never waited out", () => {
    const fixture = world({ lagReads: 1000, state: "CLOSED" });
    const result = run("verify-projected-head.mjs", args(["--repo", fixture.root, "--timeout-seconds", "30"]), {
        env: fixture.env,
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /state is "CLOSED"; expected "OPEN"/);
    assert.match(result.stderr, /identity changed under the projector/);
});

test("the projector step invokes the verifier rather than asserting inline", () => {
    const workflow = readFileSync(
        new URL("../../.github/workflows/required-ci.yml", import.meta.url),
        "utf8"
    );
    assert.match(workflow, /node ci\/verify-projected-head\.mjs/);
    // The single post-push read is what broke; it must not come back.
    assert.doesNotMatch(workflow, /headRefOid: process\.env\.PROJECTED/);
});

test("it refuses arguments that could make it assert nothing", () => {
    for (const extra of [["--expect", OLD], ["--from", "not-a-sha"], ["--number", "0"]]) {
        const result = run("verify-projected-head.mjs", args(extra), {});
        assert.equal(result.status, 2, JSON.stringify(extra));
    }
});

test("git ls-remote really does print the sha first, tab separated", () => {
    // The parser above is only right if this is: a local bare repository is the
    // cheapest place to confirm the shape the script depends on.
    const root = scratch();
    const remote = join(root, "remote.git");
    const work = join(root, "work");
    execFileSync("git", ["init", "-q", "--bare", "-b", "main", remote]);
    execFileSync("git", ["clone", "-q", remote, work]);
    const git = (...rest) => execFileSync("git", ["-C", work, ...rest], { encoding: "utf8" });
    git("config", "user.email", "ci@example.invalid");
    git("config", "user.name", "ci");
    git("-c", "commit.gpgsign=false", "commit", "-q", "--allow-empty", "-m", "init");
    git("push", "-q", "origin", "main");

    const line = git("ls-remote", "origin", "refs/heads/main");
    const [sha, ref] = line.trim().split("\t");
    assert.match(sha, /^[0-9a-f]{40}$/);
    assert.equal(ref, "refs/heads/main");
    assert.equal(sha, git("rev-parse", "HEAD").trim());
});
