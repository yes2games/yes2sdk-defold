// Workflow hygiene tests (yes2games/yes2sdk-defold#29 sections 5, 7, 12 and 14).
//
// Four rules that are otherwise only true by inspection, and each of which has a
// named failure behind it:
//
//   1. every runner class is explicit, because a floating label moves the machine
//      class under the determinism check with no commit saying so;
//   2. every action is pinned, because @main is somebody else's HEAD;
//   3. no credential reaches a job that a fork pull request can run, because this
//      repository is public and a fork run gets empty secrets - and the failure is
//      not a clean "secret missing" but a mid-job crash inside the token action;
//   4. the Bob matrix and ci/defold-toolchain.json agree, because the toolchain
//      file is what the digest is verified against and the matrix is what the job
//      reports.

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { REPO_ROOT } from "./helpers.mjs";

const WORKFLOWS = execFileSync("git", ["-C", REPO_ROOT, "ls-files", "-z", "--", ".github/workflows"], { encoding: "utf8" })
    .split("\0")
    .filter((path) => /\.ya?ml$/i.test(path));

const source = (path) => readFileSync(join(REPO_ROOT, path), "utf8");

/**
 * Every job in a workflow file, as raw text blocks keyed by job id. Enough to ask
 * "does this job hold a credential, and what gates it" without a YAML parser.
 */
function jobBlocks(text) {
    const lines = text.split("\n");
    const start = lines.findIndex((line) => /^jobs:[^\S\n]*$/.test(line));
    assert.notEqual(start, -1, "the workflow declares no jobs");

    const blocks = new Map();
    let id = null;
    let body = [];
    for (const line of lines.slice(start + 1)) {
        const header = /^ {2}([A-Za-z_][\w-]*|"[^"]+"):[^\S\n]*$/.exec(line);
        if (header !== null) {
            if (id !== null) {
                blocks.set(id, body.join("\n"));
            }
            id = header[1];
            body = [];
        } else if (id !== null) {
            body.push(line);
        }
    }
    if (id !== null) {
        blocks.set(id, body.join("\n"));
    }
    return blocks;
}

test("every tracked workflow file is one of the two this repository has", () => {
    assert.deepEqual([...WORKFLOWS].sort(), [".github/workflows/notify-release.yml", ".github/workflows/required-ci.yml"]);
});

test("every runner class is explicit, never a floating label", () => {
    for (const path of WORKFLOWS) {
        const runners = [...source(path).matchAll(/^\s*runs-on:[^\S\n]*(.+)$/gm)].map((match) => match[1].trim());
        assert.ok(runners.length > 0, `${path} declares no runs-on`);
        for (const runner of runners) {
            assert.doesNotMatch(runner, /-latest/, `${path} runs on the floating label ${runner}`);
            assert.match(runner, /^ubuntu-\d+\.\d+$/, `${path} runs on ${runner}, which is not a spelled-out version`);
        }
    }
});

test("every action is pinned to a release tag or a commit", () => {
    for (const path of WORKFLOWS) {
        for (const [, ref] of source(path).matchAll(/^\s*uses:[^\S\n]*\S+@(\S+)$/gm)) {
            assert.match(ref, /^(v\d+(\.\d+)*|[0-9a-f]{40})$/, `${path} uses an action pinned to ${ref}`);
        }
    }
});

test("no credential reaches a job a fork pull request can run", () => {
    for (const path of WORKFLOWS) {
        const text = source(path);
        if (!/^on:[\s\S]*?^\s{2}pull_request:/m.test(text)) {
            continue; // Not reachable from a pull request at all.
        }

        for (const [id, body] of jobBlocks(text)) {
            const secrets = [...body.matchAll(/secrets\.([A-Z0-9_]+)/g)].map((match) => match[1]);
            const privileged = secrets.filter((name) => name !== "GITHUB_TOKEN");
            if (privileged.length === 0) {
                continue;
            }

            // GITHUB_TOKEN is exempt: a fork run still gets one, read-only, and
            // referencing it is how a job says what it reads. Anything else has to
            // be unreachable from a pull_request run, which on this contract means
            // gated on push:main.
            // Anchored at the job's own indentation: a step-level `if:` gates one
            // step, not the job, and matching one would be a false pass.
            const gate = /^ {4}if:[^\S\n]*(.+)$/m.exec(body);
            assert.ok(gate !== null, `${path} job "${id}" holds ${privileged.join(", ")} with no if: gate`);
            assert.match(
                gate[1],
                /github\.ref == 'refs\/heads\/main'/,
                `${path} job "${id}" holds ${privileged.join(", ")} but is not gated on push:main`
            );
        }
    }
});

test("the Bob matrix agrees with ci/defold-toolchain.json", () => {
    const toolchain = JSON.parse(source("ci/defold-toolchain.json"));
    const text = source(".github/workflows/required-ci.yml");

    const entries = [...text.matchAll(/- lane:[^\S\n]*(\S+)\s*\n\s*defold:[^\S\n]*"([^"]+)"\s*\n\s*java:[^\S\n]*"([^"]+)"/g)].map(
        ([, lane, defold, java]) => ({ lane, defold, java })
    );
    assert.deepEqual(
        entries.map((entry) => entry.lane),
        ["floor", "current"]
    );

    for (const { lane, defold, java } of entries) {
        assert.equal(defold, toolchain[lane].defoldVersion, `the ${lane} matrix entry disagrees with the toolchain file`);
        assert.equal(java, String(toolchain[lane].javaMajor), `the ${lane} matrix Java major disagrees with the toolchain file`);
    }
});

test("both toolchain lanes carry a strict version and a full SHA-256", () => {
    const toolchain = JSON.parse(source("ci/defold-toolchain.json"));
    for (const lane of ["floor", "current"]) {
        const entry = toolchain[lane];
        assert.match(entry.defoldVersion, /^\d+\.\d+\.\d+$/);
        assert.match(String(entry.javaMajor), /^\d+$/);
        assert.equal(entry.bobAsset, "bob.jar", "the Bob asset is the exact official bob.jar");
        assert.match(entry.bobSha256, /^[0-9a-f]{64}$/, `${lane} has no recorded SHA-256`);
    }
    assert.notEqual(toolchain.floor.bobSha256, toolchain.current.bobSha256);
});

test("the README's supported-Defold claim matches the floor lane", () => {
    // The claim and the lane drifted once already, and in the direction that
    // matters: the README promised Defold 1.6 while the build server refuses to
    // compile a native extension for anything below the floor lane's version. This
    // SDK *is* a native extension, so an unbuildable floor is a false promise, not
    // an untested one - and CI is the only thing that knows the real number.
    const floor = JSON.parse(source("ci/defold-toolchain.json")).floor.defoldVersion;
    const readme = source("README.md");

    assert.match(readme, new RegExp(`img\\.shields\\.io/badge/Defold-${floor.replace(/\./g, "\\.")}%2B-`), "the Defold badge names a different version than the floor lane");
    assert.match(readme, new RegExp(`^- Defold ${floor.replace(/\./g, "\\.")} or newer`, "m"), "the Requirements bullet names a different version than the floor lane");

    // The SDK's own release tag reads like a Defold version and is not one.
    assert.match(readme, /archive\/refs\/tags\/v\d+\.\d+\.\d+\.zip/, "the production dependency tag is this SDK's version, and is left alone");
});

test("required CI triggers on unfiltered pull_request and push:main, with no path filter", () => {
    const text = source(".github/workflows/required-ci.yml");
    const on = /^on:\n([\s\S]*?)\n[a-z]/m.exec(text)[1];
    assert.match(on, /^ {2}pull_request:[^\S\n]*$/m, "pull_request must be unfiltered");
    assert.match(on, /^ {2}push:\n {4}branches: \[main\]$/m);
    assert.doesNotMatch(on, /paths/, "a path filter would let a release skip required CI");
});

test("the release jobs are gated on the final gate succeeding in this same run", () => {
    const blocks = jobBlocks(source(".github/workflows/required-ci.yml"));
    for (const id of ["edge", "stable", "release-please"]) {
        const body = blocks.get(id);
        assert.ok(body !== undefined, `there is no ${id} job`);
        assert.match(body, /needs:\s*\[[^\]]*required-ci/, `${id} does not depend on the final gate`);
        assert.match(body, /needs\.required-ci\.result == 'success'/, `${id} does not require the final gate to have succeeded`);
        assert.match(body, /group: yes2-defold-release\n\s*cancel-in-progress: false/, `${id} is not serialized against a second merge`);
    }
});

test("the final gate is non-matrix, always(), and needs every mandatory result", () => {
    const text = source(".github/workflows/required-ci.yml");
    const gate = jobBlocks(text).get("required-ci");
    assert.match(gate, /if: always\(\)/);
    assert.doesNotMatch(gate, /strategy:/, "the final gate must be a single job, not a matrix");

    const needed = [...(/needs:\n((?:\s*- \S+\n)+)/.exec(gate)?.[1] ?? "").matchAll(/- (\S+)/g)].map((match) => match[1]);
    const mandatory = ["workflow-governance", "release-state", "mirror-check", "ci-tests", "web-js-syntax", "bob"];
    assert.deepEqual(needed.sort(), mandatory.sort());

    // Whatever the gate depends on has to exist, or it would pass by vacuity.
    const jobs = jobBlocks(text);
    for (const id of needed) {
        assert.ok(jobs.has(id), `the final gate needs "${id}", which is not a job`);
    }
});
