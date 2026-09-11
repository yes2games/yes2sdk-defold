#!/usr/bin/env node
// verify-workflow-governance.mjs - canonical required-CI identity governance
// (yes2games/yes2sdk-defold#29 section 7, yes2games/yes2dashboard#141 section 2).
//
// Guards one thing: that the canonical workflow name and the canonical final-gate
// job name each identify exactly one tracked object, in the canonical file, spelled
// exactly. A second workflow or job answering to the same name makes a reader, and
// any future required-check setting, unable to tell which one it is looking at.
//
// Self-referential by design: this is a mandatory result of the workflow it
// governs, which is why it parses the tracked tree rather than trusting
// github.workflow.
//
// No YAML library. This repository is a Defold SDK with no package.json and no
// npm install anywhere in CI, and the alternative is a lockfile and a dependency
// tree in a repository that ships C++ and Lua. What governance needs from a
// workflow file is a top-level `name:` and the display name of each job, which is
// two indentation levels of a document GitHub itself constrains - so it is read
// directly, and read conservatively: anything this scanner cannot account for is
// a failure rather than a shrug.
//
// Usage:
//   node ci/verify-workflow-governance.mjs [--root DIR]
//
// Exit codes: 0 compliant, 1 governance violation, 2 usage or I/O error.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const CANONICAL_WORKFLOW_NAME = "YES2 Defold Required CI Workflow";
const CANONICAL_GATE_NAME = "YES2 Defold Required CI";
const CANONICAL_WORKFLOW_FILE = ".github/workflows/required-ci.yml";

const failures = [];
const fail = (message) => failures.push(message);

function usage(message) {
    process.stderr.write(`verify-workflow-governance: ${message}\n`);
    process.stderr.write("usage: node ci/verify-workflow-governance.mjs [--root DIR]\n");
    process.exit(2);
}

function parseArgs(argv) {
    let root = process.cwd();
    for (let i = 0; i < argv.length; i++) {
        if (argv[i] === "--root") {
            if (argv[i + 1] === undefined) {
                usage("--root needs a directory");
            }
            root = argv[++i];
        } else if (argv[i] === "-h" || argv[i] === "--help") {
            process.stdout.write("usage: node ci/verify-workflow-governance.mjs [--root DIR]\n");
            process.exit(0);
        } else {
            usage(`unknown argument: ${argv[i]}`);
        }
    }
    return resolve(root);
}

/**
 * Tracked workflow files, from the Git index rather than the filesystem: an
 * untracked local workflow does not run in Actions, and a tracked one that was
 * deleted from the worktree still does on every other checkout.
 */
function trackedWorkflows(root) {
    let output;
    try {
        output = execFileSync("git", ["-C", root, "ls-files", "-z", "--", ".github/workflows"], {
            encoding: "utf8",
            stdio: ["ignore", "pipe", "pipe"],
        });
    } catch (error) {
        usage(`cannot list tracked workflows in ${root}: ${error.message.trim()}`);
    }
    return output.split("\0").filter((path) => /\.ya?ml$/i.test(path));
}

/** A YAML flow scalar, less its quotes. Enough for a workflow or job name. */
function scalar(raw) {
    const value = raw.trim();
    const quoted = /^(["'])([\s\S]*)\1$/.exec(value);
    return quoted === null ? value : quoted[2];
}

const indentOf = (line) => /^ */.exec(line)[0].length;
const isContent = (line) => line.trim() !== "" && !line.trim().startsWith("#");

/**
 * The workflow's display name and every job's display name, where a job with no
 * `name:` displays as its own key - which is how GitHub renders it, so a job id
 * spelled like the canonical gate is a spoof too.
 */
export function displayNames(text) {
    const lines = text.split("\n");
    let workflowName = null;
    const jobNames = [];

    let jobsIndent = null;
    let jobIndent = null;
    let current = null;
    const closeJob = () => {
        if (current !== null) {
            jobNames.push(current.name ?? current.id);
            current = null;
        }
    };

    for (const line of lines) {
        if (!isContent(line)) {
            continue;
        }
        const indent = indentOf(line);
        const entry = /^ *([^\s:#][^:]*):[^\S\n]*(.*)$/.exec(line);

        if (indent === 0) {
            closeJob();
            jobsIndent = null;
            if (entry === null) {
                continue;
            }
            if (entry[1] === "name" && workflowName === null) {
                workflowName = scalar(entry[2]);
            } else if (entry[1] === "jobs") {
                jobsIndent = 0;
            }
            continue;
        }

        if (jobsIndent === null) {
            continue;
        }

        // First indented level under `jobs:` is a job id; the level under that
        // carries its keys, of which only `name:` matters here.
        if (jobIndent === null || indent === jobIndent) {
            if (entry === null) {
                continue;
            }
            jobIndent = indent;
            closeJob();
            // A job with no `name:` displays as its own key, quotes and all stripped,
            // which is how GitHub renders it - so a job id spelled like the
            // canonical gate is a spoof too.
            current = { id: scalar(entry[1]) };
        } else if (current !== null && indent > jobIndent && entry !== null && entry[1] === "name") {
            current.name ??= scalar(entry[2]);
        }
    }
    closeJob();

    return { workflowName, jobNames };
}

/**
 * Collapse a display name to the form two names have to differ in for a human to
 * tell them apart at a glance. `Yes2 Defold Required CI` and `YES2  Defold
 * Required CI` are both spoofs of the canonical gate, not distinct identities.
 */
const identityKey = (name) => name.trim().replace(/\s+/g, " ").toLowerCase();

function collectIdentities(root, workflowFiles) {
    const workflows = new Map();
    const gates = new Map();

    for (const relativePath of workflowFiles) {
        const { workflowName, jobNames } = displayNames(readFileSync(join(root, relativePath), "utf8"));

        if (workflowName !== null && identityKey(workflowName) === identityKey(CANONICAL_WORKFLOW_NAME)) {
            workflows.set(relativePath, [workflowName]);
        }
        const claimed = jobNames.filter((name) => identityKey(name) === identityKey(CANONICAL_GATE_NAME));
        if (claimed.length > 0) {
            gates.set(relativePath, claimed);
        }
    }

    return { workflows, gates };
}

function checkUnique(claims, kind, canonical) {
    const total = [...claims.values()].reduce((sum, value) => sum + value.length, 0);

    if (total === 0) {
        fail(`no tracked workflow declares the canonical ${kind} name "${canonical}"`);
        return;
    }
    if (total > 1) {
        const where = [...claims.entries()].map(([file, value]) => `${file} (${value.join(", ")})`).join("; ");
        fail(
            `the canonical ${kind} name "${canonical}" is claimed ${total} times: ${where}. ` +
                "A duplicate or spoofed identity means neither a reader nor a required-check setting can tell which object it names."
        );
        return;
    }

    const [file, value] = [...claims.entries()][0];
    if (file !== CANONICAL_WORKFLOW_FILE) {
        fail(`the canonical ${kind} name "${canonical}" is declared in ${file}, not ${CANONICAL_WORKFLOW_FILE}`);
    }
    if (value[0] !== canonical) {
        fail(`${file} spells the canonical ${kind} name "${value[0]}"; it must be exactly "${canonical}"`);
    }
}

const root = parseArgs(process.argv.slice(2));
const workflowFiles = trackedWorkflows(root);

if (!workflowFiles.includes(CANONICAL_WORKFLOW_FILE)) {
    fail(`${CANONICAL_WORKFLOW_FILE} is not tracked`);
}
const { workflows, gates } = collectIdentities(root, workflowFiles);
checkUnique(workflows, "workflow", CANONICAL_WORKFLOW_NAME);
checkUnique(gates, "final-gate job", CANONICAL_GATE_NAME);

if (failures.length > 0) {
    process.stderr.write(`workflow governance failed (${failures.length} problem(s)):\n`);
    for (const problem of failures) {
        process.stderr.write(`  - ${problem}\n`);
    }
    process.exit(1);
}

process.stdout.write(
    `workflow governance OK: "${CANONICAL_WORKFLOW_NAME}" and "${CANONICAL_GATE_NAME}" are each claimed ` +
        `exactly once, by ${CANONICAL_WORKFLOW_FILE}, across ${workflowFiles.length} tracked workflow file(s)\n`
);
