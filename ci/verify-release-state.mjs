#!/usr/bin/env node
// verify-release-state.mjs - the release-state verifier
// (yes2games/yes2sdk-defold#29 section 7, yes2games/yes2dashboard#141 sections 1 and 13).
//
// Asserts that this repository has exactly one product SemVer authority and that
// Release Please is configured to be release-PR authority only. Six things:
//
//   1. root VERSION is a strict plain X.Y.Z;
//   2. .release-please-manifest.json agrees with it, exactly;
//   3. release-please-config.json resolves release-type simple, version-file
//      VERSION, include-component-in-tag false, skip-github-release true;
//   4. no component key sits alongside include-component-in-tag false. yes2infra
//      PR #445 merged cleanly and Release Please then refused with "PR component:
//      undefined does not match configured component", leaving the manifest
//      advanced with no tag behind it. A componentless release branch can never
//      match a configured component (#141 section 13 item 1);
//   5. every mirror equals VERSION, read through the projector's own transforms
//      so the two can never disagree about what a mirror is;
//   6. game.project is neither a Release Please target nor marked up by it, so
//      the only writer of that file stays the projector.
//
// Usage:
//   node ci/verify-release-state.mjs [--root DIR]
//
// Exit codes: 0 compliant, 1 violation, 2 usage or I/O error.

import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { TRANSFORMS, projectFile, readVersion } from "./sync-release-version.mjs";

const REQUIRED_SETTINGS = [
    { key: "release-type", expected: "simple" },
    { key: "version-file", expected: "VERSION" },
    { key: "include-component-in-tag", expected: false },
    { key: "skip-github-release", expected: true },
];

// Both keys configure the component Release Please compares against the one it
// parses out of the release branch name, so both produce the #445 stuck state.
const COMPONENT_KEYS = ["package-name", "component"];

// Release Please annotates arbitrary files it owns with these markers. game.project
// is a mirror the projector owns, so a marker appearing in it means a second
// authority is writing the version (#29 section 2).
const RELEASE_PLEASE_MARKER = /x-release-please/;

const failures = [];
const fail = (message) => failures.push(message);

function usage(message) {
    process.stderr.write(`verify-release-state: ${message}\n`);
    process.stderr.write("usage: node ci/verify-release-state.mjs [--root DIR]\n");
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
            process.stdout.write("usage: node ci/verify-release-state.mjs [--root DIR]\n");
            process.exit(0);
        } else {
            usage(`unknown argument: ${argv[i]}`);
        }
    }
    return resolve(root);
}

function read(root, relativePath) {
    try {
        return readFileSync(join(root, relativePath), "utf8");
    } catch (error) {
        usage(`cannot read ${relativePath}: ${error.message}`);
    }
}

function readJson(root, relativePath) {
    const raw = read(root, relativePath);
    try {
        return JSON.parse(raw);
    } catch (error) {
        usage(`${relativePath} is not valid JSON: ${error.message}`);
    }
}

const describe = (value) => (value === undefined ? "absent" : JSON.stringify(value));

const root = parseArgs(process.argv.slice(2));

let version = null;
try {
    version = readVersion(read(root, "VERSION"));
} catch (error) {
    fail(error.message);
}

// 2. Manifest equality. The manifest is what Release Please reads to decide the
// next version; a manifest behind VERSION re-proposes a release that already
// shipped, and one ahead of it skips a version silently.
const manifest = readJson(root, ".release-please-manifest.json");
const manifestKeys = Object.keys(manifest);
if (manifestKeys.length !== 1 || manifestKeys[0] !== ".") {
    fail(`.release-please-manifest.json declares ${describe(manifestKeys)}; the single root package "." is the only entry this contract has`);
} else if (version !== null && manifest["."] !== version) {
    fail(`.release-please-manifest.json says ${describe(manifest["."])} while VERSION says ${JSON.stringify(version)}`);
}

// 3 and 4. Release Please config.
const config = readJson(root, "release-please-config.json");
const packages = config.packages;
if (packages === null || typeof packages !== "object" || Array.isArray(packages)) {
    fail("release-please-config.json has no packages object");
} else {
    for (const [path, entry] of Object.entries(packages)) {
        const settings = entry !== null && typeof entry === "object" && !Array.isArray(entry) ? entry : {};

        for (const { key, expected } of REQUIRED_SETTINGS) {
            const effective = settings[key] ?? config[key];
            if (effective !== expected) {
                fail(`package "${path}" resolves ${key} to ${describe(effective)}; #141 section 1 requires ${JSON.stringify(expected)}`);
            }
        }

        if ((settings["include-component-in-tag"] ?? config["include-component-in-tag"]) === true) {
            continue;
        }
        for (const key of COMPONENT_KEYS) {
            for (const [scope, source] of [
                ["release-please-config.json", config],
                [`package "${path}"`, settings],
            ]) {
                if (source[key] !== undefined) {
                    fail(
                        `${scope} sets ${key} to ${describe(source[key])} while package "${path}" resolves include-component-in-tag ` +
                            "to false. The componentless release branch can never match a configured component, so Release Please " +
                            "declines to tag an already-merged release PR and leaves the manifest advanced with no tag behind it " +
                            "(yes2infra PR #445)."
                    );
                }
            }
        }
    }
}

// 5. Mirror equality, through the projector's own transforms rather than a second
// description of them.
if (version !== null) {
    for (const transform of TRANSFORMS) {
        let found;
        try {
            found = projectFile(read(root, transform.path), transform, version).found;
        } catch (error) {
            fail(error.message);
            continue;
        }
        const skewed = [...new Set(found.filter((value) => value !== version))];
        if (skewed.length > 0) {
            fail(`${transform.path}: ${transform.what} reads ${skewed.map((value) => JSON.stringify(value)).join(", ")}; VERSION is ${version}`);
        }
    }
}

// 6. No second authority over game.project.
const gameProject = read(root, "game.project");
if (RELEASE_PLEASE_MARKER.test(gameProject)) {
    fail("game.project carries a Release Please marker; the projector is the only writer of that mirror (#29 section 2)");
}
if (JSON.stringify(config).includes("game.project")) {
    fail("release-please-config.json names game.project; it is a projector mirror and must never be a Release Please version-file, Generic or extra-files target");
}

if (failures.length > 0) {
    process.stderr.write(`release state is non-compliant (${failures.length} problem(s)):\n`);
    for (const problem of failures) {
        process.stderr.write(`  - ${problem}\n`);
    }
    process.exit(1);
}

process.stdout.write(
    `release state OK: VERSION ${version} is the sole authority, the manifest agrees, Release Please is ` +
        `simple + version-file VERSION + skip-github-release with no component key, and every mirror matches\n`
);
