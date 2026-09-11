#!/usr/bin/env node
// verify-projected-head.mjs - the post-push half of the projector's assertion
// (yes2games/yes2sdk-defold#29 section 3: "After push, re-fetch same PR and
// require new head SHA equals pushed commit and base/head identities remain
// unchanged").
//
// The rule is right and is not relaxed here. What is fixed is the *read*. A
// single `gh pr view` immediately after a push is a read-after-write against a
// value GitHub updates asynchronously: the push had landed - the pull request
// read `head=5276d47` moments later - but the API still served the pre-push head,
// and the assertion failed claiming a projection mismatch that had not happened.
// Intermittent, and the error accused the wrong thing, which is the expensive
// shape: the next person goes looking for a mirror bug that is not there.
//
// So the read converges instead of sampling once, and lag is distinguished from a
// real conflict rather than lumped in with it:
//
//   the ref or the pull request still shows `--from`  -> not caught up yet, wait
//   either shows anything else                        -> someone else pushed, fail now
//   both show `--expect`, identities unchanged        -> the invariant holds
//   the deadline passes while still at `--from`       -> a CONSISTENCY TIMEOUT,
//                                                        said in those words
//
// The ref is polled alongside the pull request because the ref is the thing this
// job wrote and the pull request object is a cached view of it. That makes the
// ref the discriminator: a third value there is a concurrent push, full stop, and
// there is no reason to keep waiting on it.
//
// Usage:
//   node ci/verify-projected-head.mjs --number N --ref BRANCH --base BRANCH \
//     --expect SHA --from SHA [--remote origin] [--repo DIR] \
//     [--timeout-seconds 120] [--interval-ms 2000]
//
// Exit codes: 0 converged, 1 conflict or consistency timeout, 2 usage/IO.

import { execFileSync } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

function usage(message) {
    process.stderr.write(`verify-projected-head: ${message}\n`);
    process.stderr.write(
        "usage: node ci/verify-projected-head.mjs --number N --ref BRANCH --base BRANCH --expect SHA --from SHA" +
            " [--remote origin] [--repo DIR] [--timeout-seconds 120] [--interval-ms 2000]\n"
    );
    process.exit(2);
}

function fail(message) {
    process.stderr.write(`verify-projected-head: ${message}\n`);
    process.exit(1);
}

function parseArgs(argv) {
    const options = { remote: "origin", repo: process.cwd(), timeoutSeconds: 120, intervalMs: 2000 };
    for (let i = 0; i < argv.length; i++) {
        const flag = argv[i];
        if (flag === "-h" || flag === "--help") {
            process.stdout.write("usage: node ci/verify-projected-head.mjs --number N --ref BRANCH --base BRANCH --expect SHA --from SHA\n");
            process.exit(0);
        }
        const value = argv[i + 1];
        if (value === undefined) {
            usage(`${flag} needs a value`);
        }
        if (flag === "--number") options.number = value;
        else if (flag === "--ref") options.ref = value;
        else if (flag === "--base") options.base = value;
        else if (flag === "--expect") options.expect = value;
        else if (flag === "--from") options.from = value;
        else if (flag === "--remote") options.remote = value;
        else if (flag === "--repo") options.repo = value;
        else if (flag === "--timeout-seconds") options.timeoutSeconds = Number(value);
        else if (flag === "--interval-ms") options.intervalMs = Number(value);
        else usage(`unknown argument: ${flag}`);
        i++;
    }
    if (!/^[1-9][0-9]*$/.test(options.number ?? "")) usage("--number must be a positive integer");
    for (const key of ["ref", "base"]) {
        if (!options[key]) usage(`--${key} is required`);
    }
    for (const key of ["expect", "from"]) {
        if (!/^[0-9a-f]{40}$/.test(options[key] ?? "")) usage(`--${key} must be a full 40-character SHA`);
    }
    if (options.expect === options.from) usage("--expect and --from are the same commit; there is nothing to converge on");
    if (!Number.isFinite(options.timeoutSeconds) || options.timeoutSeconds < 0) usage("--timeout-seconds must be >= 0");
    if (!Number.isFinite(options.intervalMs) || options.intervalMs < 0) usage("--interval-ms must be >= 0");
    return options;
}

const options = parseArgs(process.argv.slice(2));

/** The remote ref's tip, or "" when the remote does not have it. */
function readRef() {
    const line = execFileSync("git", ["-C", options.repo, "ls-remote", options.remote, `refs/heads/${options.ref}`], {
        encoding: "utf8",
    });
    return line.split("\t")[0]?.trim() ?? "";
}

function readPullRequest() {
    const json = execFileSync(
        "gh",
        ["pr", "view", options.number, "--json", "state,baseRefName,headRefName,headRefOid"],
        { encoding: "utf8", cwd: options.repo }
    );
    return JSON.parse(json);
}

/**
 * "" when the observation is consistent with the write not having propagated
 * yet, otherwise the reason it is a real conflict rather than lag.
 */
function conflict(what, observed) {
    if (observed === options.expect || observed === options.from) {
        return "";
    }
    if (observed === "" || observed === null || observed === undefined) {
        return `${what} no longer exists; the release branch was deleted under the projector`;
    }
    return (
        `${what} is ${JSON.stringify(observed)}, which is neither the commit this job pushed (${options.expect}) ` +
        `nor the head it started from (${options.from}). Something else pushed to the release branch: that is a real ` +
        "conflict, not a stale read, so it fails now rather than waiting."
    );
}

const deadline = Date.now() + options.timeoutSeconds * 1000;
let observedRef = "";
let observedPr = null;

for (let attempt = 1; ; attempt++) {
    observedRef = readRef();
    observedPr = readPullRequest();

    // Identity is settled state, never a value in flight, so a mismatch here is
    // reported at once instead of being waited out.
    const identity = Object.entries({ state: "OPEN", baseRefName: options.base, headRefName: options.ref }).filter(
        ([key, value]) => observedPr[key] !== value
    );
    if (identity.length > 0) {
        for (const [key, value] of identity) {
            process.stderr.write(
                `verify-projected-head: after the push the release pull request ${key} is ` +
                    `${JSON.stringify(observedPr[key])}; expected ${JSON.stringify(value)}\n`
            );
        }
        fail("the release pull request's identity changed under the projector");
    }

    const reason = conflict(`refs/heads/${options.ref}`, observedRef) || conflict("the pull request head", observedPr.headRefOid);
    if (reason !== "") {
        fail(reason);
    }

    if (observedRef === options.expect && observedPr.headRefOid === options.expect) {
        process.stdout.write(
            `verify-projected-head: refs/heads/${options.ref} and pull request #${options.number} both read ` +
                `${options.expect}, the projected commit, with base ${options.base} and head ${options.ref} unchanged ` +
                `(after ${attempt} read(s))\n`
        );
        break;
    }

    if (Date.now() >= deadline) {
        process.stderr.write(
            `verify-projected-head: CONSISTENCY TIMEOUT after ${options.timeoutSeconds}s and ${attempt} read(s).\n` +
                "This is NOT a projection mismatch. The push reported success and the mirrors are on the commit it\n" +
                `pushed; what did not happen is GitHub catching up to it. Read back: refs/heads/${options.ref} = ` +
                `${JSON.stringify(observedRef)}, pull request head = ${JSON.stringify(observedPr.headRefOid)}, both\n` +
                `still at the pre-push head ${options.from} rather than the projected ${options.expect}.\n` +
                "Check the release pull request before changing anything: if it now shows the projected commit, this\n" +
                "was propagation delay and re-running the job is the whole fix.\n"
        );
        process.exit(1);
    }

    process.stdout.write(
        `verify-projected-head: read ${attempt}: refs/heads/${options.ref} = ${JSON.stringify(observedRef)}, ` +
            `pull request head = ${JSON.stringify(observedPr.headRefOid)}; still the pre-push head, waiting\n`
    );
    await sleep(options.intervalMs);
}
