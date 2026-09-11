#!/usr/bin/env node
// sync-release-version.mjs - the deterministic mirror projector
// (yes2games/yes2sdk-defold#29 section 2, yes2games/yes2dashboard#141 section 1).
//
// Root VERSION is the sole product SemVer authority. Three files mirror it, and
// this projector is the only thing allowed to move them. Mirror skew here is not
// hypothetical: five of the fifteen releases in this repository shipped with at
// least one mirror wrong, and v1.2.2 shipped with every one of them wrong.
//
//   --check   report skew, change nothing, exit 1 if any mirror disagrees
//   --write   rewrite the mirrors from VERSION, idempotently
//
// Each transform is anchored to the one syntactic shape that carries the version
// in its file. Nothing here replaces a bare SemVer string: yes2sdk/lib/web/
// lib_yes2sdk.js carries REQUIRED_CORE_VERSION '2.2.0', a Core floor that must
// never move with this SDK's version, and a loose matcher would eat it.
//
// Usage:
//   node ci/sync-release-version.mjs --check [--root DIR]
//   node ci/sync-release-version.mjs --write [--root DIR]
//
// Exit codes: 0 in sync (or written), 1 skew or a rejected target, 2 usage/IO.

import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const STRICT_SEMVER = /^\d+\.\d+\.\d+$/;

// The three files --write may touch, and nothing else (#29 section 2).
//
// `occurrences` says how many matches the target must carry:
//   "one"      exactly one; a missing or a second one is a rejected target,
//   "at-least" one or more, every one rewritten.
//
// README is "at-least" deliberately. #29 section 2 was written expecting a single
// canonical production URL, but the file carries two by design - the Installation
// snippet and the "Good - tagged release" half of the Troubleshooting good/bad
// pair - and a third would be an ordinary documentation edit. Rejecting the second
// fails the projector on the README it exists to rewrite; rewriting only the first
// leaves the Troubleshooting snippet pinned at whatever version it was written
// against, forever. Rewriting every one is the only reading that keeps the file
// correct. The matcher still requires the `v<semver>.zip` tag shape, so the
// integration `archive/refs/tags/edge.zip` and the deliberate
// `archive/refs/heads/main.zip` counter-example are both left alone.
const TRANSFORMS = [
    {
        path: "game.project",
        what: "the [project] section version assignment",
        // Scoped to one section header, so a `version =` key in any other section
        // is neither read nor written, and two [project] sections are a rejected
        // target rather than a coin flip.
        section: "project",
        occurrences: "one",
        pattern: /(^version[^\S\n]*=[^\S\n]*)(\S+)([^\S\n]*)/m,
    },
    {
        path: "yes2sdk/src/yes2sdk.cpp",
        what: 'the native #define VERSION "..."',
        occurrences: "one",
        pattern: /(^#define[^\S\n]+VERSION[^\S\n]+")([^"\n]*)(")/m,
    },
    {
        path: "README.md",
        what: "the production dependency tag archive/refs/tags/vX.Y.Z.zip",
        occurrences: "at-least",
        pattern: /(archive\/refs\/tags\/v)(\d+\.\d+\.\d+)(\.zip)/,
    },
];

function usage(message) {
    process.stderr.write(`sync-release-version: ${message}\n`);
    process.stderr.write("usage: node ci/sync-release-version.mjs (--check | --write) [--root DIR]\n");
    process.exit(2);
}

function parseArgs(argv) {
    let mode = null;
    let root = process.cwd();
    for (let i = 0; i < argv.length; i++) {
        if (argv[i] === "--check" || argv[i] === "--write") {
            const requested = argv[i].slice(2);
            if (mode !== null && mode !== requested) {
                usage("--check and --write are mutually exclusive");
            }
            mode = requested;
        } else if (argv[i] === "--root") {
            if (argv[i + 1] === undefined) {
                usage("--root needs a directory");
            }
            root = argv[++i];
        } else if (argv[i] === "-h" || argv[i] === "--help") {
            process.stdout.write("usage: node ci/sync-release-version.mjs (--check | --write) [--root DIR]\n");
            process.exit(0);
        } else {
            usage(`unknown argument: ${argv[i]}`);
        }
    }
    if (mode === null) {
        usage("one of --check or --write is required");
    }
    return { mode, root: resolve(root) };
}

/**
 * Root VERSION, rejected unless it is a strict plain X.Y.Z on one line. A
 * prerelease suffix, a leading `v` or a second line is a malformed authority and
 * must never reach a mirror.
 */
export function readVersion(raw) {
    const value = raw.replace(/\r?\n$/, "");
    if (!STRICT_SEMVER.test(value)) {
        throw new Error(`VERSION is ${JSON.stringify(raw)}; the sole authority must be a strict plain X.Y.Z followed by one newline`);
    }
    return value;
}

const globalise = (pattern) => new RegExp(pattern.source, `${pattern.flags.replace("g", "")}g`);

/** The `[name]` section of an ini-shaped file, which must appear exactly once. */
function sectionRange(text, name, path) {
    const headers = [...text.matchAll(new RegExp(`^\\[${name}\\][^\\S\\n]*$`, "gm"))];
    if (headers.length !== 1) {
        throw new Error(`${path}: the [${name}] section occurs ${headers.length} times; exactly one is canonical`);
    }
    const start = headers[0].index + headers[0][0].length;
    const next = text.slice(start).search(/^\[/m);
    return [start, next === -1 ? text.length : start + next];
}

/**
 * Project one file. Returns the rewritten text and the versions found, or throws
 * when the target is missing or duplicated in a file that permits only one.
 *
 * Byte-preserving by construction: only the captured version substring is
 * replaced, so line endings, trailing whitespace and every unrelated byte survive
 * a write untouched. That is why #29's LF/CRLF requirement needs no code.
 */
export function projectFile(text, transform, version) {
    const [start, end] = transform.section === undefined ? [0, text.length] : sectionRange(text, transform.section, transform.path);
    const scope = text.slice(start, end);
    const matches = [...scope.matchAll(globalise(transform.pattern))];

    if (matches.length === 0) {
        throw new Error(`${transform.path}: ${transform.what} is missing`);
    }
    if (transform.occurrences === "one" && matches.length > 1) {
        throw new Error(`${transform.path}: ${transform.what} occurs ${matches.length} times; exactly one is canonical`);
    }

    // Every pattern captures (before, version, after), so the replacement keeps
    // whatever framed the old value - quotes, an extension, trailing spaces.
    const rewritten = scope.replace(globalise(transform.pattern), (_match, before, _found, after) => `${before}${version}${after}`);
    const projected = text.slice(0, start) + rewritten + text.slice(end);
    return { projected, found: matches.map((match) => match[2]), changed: projected !== text };
}

function run({ mode, root }) {
    const problems = [];
    let version;
    try {
        version = readVersion(readFileSync(join(root, "VERSION"), "utf8"));
    } catch (error) {
        process.stderr.write(`sync-release-version --${mode} failed: ${error.message}\n`);
        process.exit(1);
    }

    const written = [];
    for (const transform of TRANSFORMS) {
        const path = join(root, transform.path);
        let text;
        try {
            text = readFileSync(path, "utf8");
        } catch (error) {
            problems.push(`${transform.path}: cannot read mirror: ${error.message}`);
            continue;
        }

        let result;
        try {
            result = projectFile(text, transform, version);
        } catch (error) {
            problems.push(error.message);
            continue;
        }

        if (mode === "check") {
            const skewed = [...new Set(result.found.filter((value) => value !== version))];
            if (skewed.length > 0) {
                problems.push(`${transform.path}: ${transform.what} reads ${skewed.map((value) => JSON.stringify(value)).join(", ")}; VERSION is ${version}`);
            } else {
                process.stdout.write(`ok    ${transform.path} (${result.found.length} occurrence(s) at ${version})\n`);
            }
            continue;
        }

        if (result.changed) {
            writeFileSync(path, result.projected, "utf8");
            written.push(transform.path);
            process.stdout.write(`write ${transform.path} (${result.found.length} occurrence(s) -> ${version})\n`);
        } else {
            process.stdout.write(`ok    ${transform.path} (already ${version})\n`);
        }
    }

    if (problems.length > 0) {
        process.stderr.write(`sync-release-version --${mode} failed (${problems.length} problem(s)):\n`);
        for (const problem of problems) {
            process.stderr.write(`  - ${problem}\n`);
        }
        process.exit(1);
    }

    process.stdout.write(
        mode === "check"
            ? `every mirror matches VERSION ${version}\n`
            : `mirrors projected from VERSION ${version}${written.length === 0 ? " (already in sync)" : `: ${written.join(", ")}`}\n`
    );
}

export { TRANSFORMS };

if (process.argv[1] !== undefined && import.meta.url === `file://${resolve(process.argv[1])}`) {
    run(parseArgs(process.argv.slice(2)));
}
