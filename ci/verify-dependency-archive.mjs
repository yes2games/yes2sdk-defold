#!/usr/bin/env node
// verify-dependency-archive.mjs - assert the archive a Defold consumer downloads
// is resolvable as a library (yes2games/yes2sdk-defold#29 sections 6 and 11).
//
// A consumer depends on this repository by URL to an archive of a ref - the edge
// tag, a release tag - and Bob resolves that archive by scanning it for the first
// entry named game.project, taking that file's directory as the library root, and
// mounting the directories its [library] include_dirs names. Nothing in the
// archive states which game.project is meant, and GitHub emits entries in git tree
// order, so a second Defold project under a directory sorting before the root one
// takes the role silently: Bob mounts nothing and the consumer's build dies with
// "the Lua module '/yes2sdk/yes2sdk.lua' can't be found", an error that points at
// the consumer's own script rather than at packaging. That is what ci/consumer/
// did to the edge lane on its first real run.
//
// The rule checked here is the one Bob actually depends on, not the one that broke
// today: exactly one game.project in the archive, at its root, declaring
// include_dirs whose every entry the archive contains. With exactly one, entry
// order cannot matter.
//
// It reads `git archive`, not the working tree, because .gitattributes export-ignore
// is what keeps ci/ out of the archive and only `git archive` applies it. GitHub's
// zip is the same content by the same rules - the edge and stable lanes prove that
// separately, by diffing the downloaded archive against `git archive github.sha`.
// So this needs no network, no tag and no release: it runs on every pull request,
// which is where the defect it exists for should have been caught.
//
// Usage:
//   node ci/verify-dependency-archive.mjs [--ref REF] [--repo DIR]
//
// Exit codes: 0 the archive is resolvable, 1 it is not, 2 usage/IO.

import { execFileSync } from "node:child_process";

function usage(message) {
    process.stderr.write(`verify-dependency-archive: ${message}\n`);
    process.stderr.write("usage: node ci/verify-dependency-archive.mjs [--ref REF] [--repo DIR]\n");
    process.exit(2);
}

function fail(message) {
    process.stderr.write(`verify-dependency-archive: ${message}\n`);
    process.exit(1);
}

function parseArgs(argv) {
    const options = { ref: "HEAD", repo: process.cwd() };
    for (let i = 0; i < argv.length; i++) {
        const flag = argv[i];
        if (flag === "-h" || flag === "--help") {
            process.stdout.write("usage: node ci/verify-dependency-archive.mjs [--ref REF] [--repo DIR]\n");
            process.exit(0);
        }
        const value = argv[i + 1];
        if (value === undefined) {
            usage(`${flag} needs a value`);
        }
        if (flag === "--ref") options.ref = value;
        else if (flag === "--repo") options.repo = value;
        else usage(`unknown argument: ${flag}`);
        i++;
    }
    return options;
}

const options = parseArgs(process.argv.slice(2));

/** The archive's entry names, in the order the archive lists them. */
function archiveEntries() {
    let tar;
    try {
        tar = execFileSync("git", ["-C", options.repo, "archive", "--format=tar", options.ref], {
            maxBuffer: 512 * 1024 * 1024,
        });
    } catch (error) {
        usage(`cannot archive ${options.ref}: ${String(error.stderr ?? error.message).trim()}`);
    }
    return execFileSync("tar", ["-t"], { input: tar, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 })
        .split("\n")
        .filter((line) => line !== "");
}

const entries = archiveEntries();
const files = entries.filter((entry) => !entry.endsWith("/"));

const projects = files.filter((entry) => entry === "game.project" || entry.endsWith("/game.project"));
if (projects.length === 0) {
    fail(
        `git archive ${options.ref} contains no game.project, so Bob has no library root to resolve and a consumer ` +
            "depending on this archive gets nothing mounted."
    );
}
if (projects.length > 1) {
    fail(
        `git archive ${options.ref} contains ${projects.length} game.project files:\n` +
            projects.map((entry) => `  ${entry}`).join("\n") +
            "\nBob takes the first one it meets as the library root, and GitHub emits entries in git tree order, so\n" +
            `the root would be ${projects[0].replace(/game\.project$/, "") || "the archive root"} - not necessarily the one meant.\n` +
            "Keep exactly one in the archive: mark the directory holding the other `export-ignore` in .gitattributes,\n" +
            "the way /ci/ is, so it never ships to a consumer."
    );
}
if (projects[0] !== "game.project") {
    fail(
        `git archive ${options.ref} holds its only game.project at ${projects[0]}, not at the archive root.\n` +
            "Bob would mount that directory as the library and the root's own files would be outside it."
    );
}

const manifest = execFileSync("git", ["-C", options.repo, "show", `${options.ref}:game.project`], { encoding: "utf8" });

// game.project is an INI file and include_dirs is meaningful only inside
// [library]; the same key under [project] would be a different setting, so the
// section is tracked rather than the file scanned flat.
let inLibrary = false;
let declared = null;
for (const line of manifest.split("\n")) {
    const heading = /^\[(.+)\]\s*$/.exec(line);
    if (heading !== null) {
        inLibrary = heading[1] === "library";
        continue;
    }
    const setting = /^include_dirs\s*=\s*(.*)$/.exec(line);
    if (inLibrary && setting !== null) {
        declared = setting[1];
    }
}
if (declared === null) {
    fail(
        "game.project declares no [library] include_dirs, so a consumer resolving this archive mounts nothing and " +
            "every require of this SDK fails."
    );
}

const includeDirs = declared
    .split(",")
    .map((name) => name.trim())
    .filter((name) => name !== "");
if (includeDirs.length === 0) {
    fail("game.project declares an empty include_dirs, so a consumer resolving this archive mounts nothing.");
}

for (const dir of includeDirs) {
    if (!files.some((entry) => entry.startsWith(`${dir}/`))) {
        fail(
            `game.project declares include_dirs entry ${JSON.stringify(dir)}, but git archive ${options.ref} contains ` +
                `no file under ${dir}/. A consumer would mount an empty directory and fail on the first require.`
        );
    }
}

process.stdout.write(
    `verify-dependency-archive: git archive ${options.ref} is resolvable - one game.project, at the root, ` +
        `include_dirs ${includeDirs.join(", ")} present across ${files.length} archived files\n`
);
