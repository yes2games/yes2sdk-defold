// Projector fixture and unit tests (yes2games/yes2sdk-defold#29 sections 2 and 15).
//
// Every rule the projector locks is exercised here rather than asserted in a
// comment: a malformed authority, a missing target, a duplicated target, the
// SemVer strings that must survive untouched, CRLF, a second --write that changes
// nothing, and --check catching skew.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { REPO_ROOT, run, scratch, write } from "./helpers.mjs";

const GAME_PROJECT = (version, extra = "") => `[project]
title = Yes2SDK
version = ${version}

[library]
include_dirs = yes2sdk
${extra}`;

const CPP = (version) => `#define MODULE_NAME "yes2sdk"
#define VERSION "${version}"
`;

const README = (version) => `# Yes2SDK for Defold

[![Version](https://img.shields.io/github/v/tag/yes2games/yes2sdk-defold?label=version)](https://github.com/yes2games/yes2sdk-defold/releases)

dependencies#0 = https://github.com/yes2games/yes2sdk-defold/archive/refs/tags/v${version}.zip

Integration:
dependencies#0 = https://github.com/yes2games/yes2sdk-defold/archive/refs/tags/edge.zip

# Good - tagged release
dependencies#0 = https://github.com/yes2games/yes2sdk-defold/archive/refs/tags/v${version}.zip

# Bad - branch archive
dependencies#0 = https://github.com/yes2games/yes2sdk-defold/archive/refs/heads/main.zip

REQUIRED_CORE_VERSION: '2.2.0'
`;

/** A fixture tree whose mirrors all read `mirrors` and whose VERSION is `version`. */
function fixture({ version = "1.7.0", mirrors = version, gameProject, cpp, readme, eol = "\n" } = {}) {
    const root = scratch();
    const nl = (text) => (eol === "\n" ? text : text.replace(/\n/g, eol));
    write(root, "VERSION", `${version}\n`);
    write(root, "game.project", nl(gameProject ?? GAME_PROJECT(mirrors)));
    write(root, "yes2sdk/src/yes2sdk.cpp", nl(cpp ?? CPP(mirrors)));
    write(root, "README.md", nl(readme ?? README(mirrors)));
    return root;
}

const read = (root, path) => readFileSync(`${root}/${path}`, "utf8");

test("--check passes on the repository as it stands", () => {
    const result = run("sync-release-version.mjs", ["--check", "--root", REPO_ROOT]);
    assert.equal(result.status, 0, result.stderr);
});

test("--write projects every mirror from VERSION, then is idempotent", () => {
    const root = fixture({ version: "1.7.0", mirrors: "1.6.1" });

    const first = run("sync-release-version.mjs", ["--write", "--root", root]);
    assert.equal(first.status, 0, first.stderr);
    assert.match(read(root, "game.project"), /^version = 1\.7\.0$/m);
    assert.match(read(root, "yes2sdk/src/yes2sdk.cpp"), /^#define VERSION "1\.7\.0"$/m);
    assert.equal((read(root, "README.md").match(/tags\/v1\.7\.0\.zip/g) ?? []).length, 2);

    const before = read(root, "README.md");
    const second = run("sync-release-version.mjs", ["--write", "--root", root]);
    assert.equal(second.status, 0, second.stderr);
    assert.match(second.stdout, /already 1\.7\.0/);
    assert.equal(read(root, "README.md"), before);
});

test("--check reports skew per mirror and fails", () => {
    const root = fixture({ version: "1.7.0", mirrors: "1.6.1" });
    const result = run("sync-release-version.mjs", ["--check", "--root", root]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /game\.project/);
    assert.match(result.stderr, /yes2sdk\.cpp/);
    assert.match(result.stderr, /README\.md/);
    assert.match(result.stderr, /"1\.6\.1"/);
});

test("a single skewed mirror is enough to fail --check", () => {
    const root = fixture({ version: "1.7.0", cpp: CPP("1.6.1") });
    const result = run("sync-release-version.mjs", ["--check", "--root", root]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /yes2sdk\.cpp/);
    assert.doesNotMatch(result.stderr, /game\.project/);
});

for (const [label, value] of [
    ["a two-component version", "1.6"],
    ["a leading v", "v1.6.1"],
    ["a prerelease suffix", "1.6.1-rc.1"],
    ["build metadata", "1.6.1+build.5"],
    ["an empty file", ""],
    ["a second line", "1.6.1\n1.6.2"],
    ["leading whitespace", " 1.6.1"],
]) {
    test(`--write rejects ${label} in VERSION`, () => {
        const root = fixture();
        write(root, "VERSION", value === "" ? "" : `${value}\n`);
        const before = read(root, "game.project");
        const result = run("sync-release-version.mjs", ["--write", "--root", root]);
        assert.equal(result.status, 1, result.stdout);
        assert.match(result.stderr, /strict plain X\.Y\.Z/);
        assert.equal(read(root, "game.project"), before, "a malformed authority must not reach a mirror");
    });
}

test("a missing target is rejected, not silently skipped", () => {
    const root = fixture({ readme: "# Yes2SDK\n\nNo dependency snippet here.\n" });
    const result = run("sync-release-version.mjs", ["--write", "--root", root]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /README\.md.*is missing/);
});

test("two [project] sections in game.project are a rejected target", () => {
    const root = fixture({ gameProject: `${GAME_PROJECT("1.7.0")}\n[project]\nversion = 1.7.0\n` });
    const result = run("sync-release-version.mjs", ["--write", "--root", root]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /\[project\] section occurs 2 times/);
});

test("two version assignments inside [project] are a rejected target", () => {
    const root = fixture({ gameProject: "[project]\nversion = 1.7.0\nversion = 1.7.0\n" });
    const result = run("sync-release-version.mjs", ["--write", "--root", root]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /occurs 2 times/);
});

test('two #define VERSION lines are a rejected target', () => {
    const root = fixture({ cpp: `${CPP("1.7.0")}#define VERSION "1.7.0"\n` });
    const result = run("sync-release-version.mjs", ["--write", "--root", root]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /occurs 2 times/);
});

test("both README production URLs are rewritten, and only those", () => {
    const root = fixture({ version: "2.0.0", mirrors: "1.6.1" });
    assert.equal(run("sync-release-version.mjs", ["--write", "--root", root]).status, 0);
    const readme = read(root, "README.md");

    assert.equal((readme.match(/tags\/v2\.0\.0\.zip/g) ?? []).length, 2, "the Installation and Troubleshooting snippets both move");
    assert.doesNotMatch(readme, /v1\.6\.1/);
    // The three things a looser matcher would eat.
    assert.match(readme, /tags\/edge\.zip/, "the integration channel carries no version and stays literal");
    assert.match(readme, /heads\/main\.zip/, "the deliberate counter-example is not a version mirror");
    assert.match(readme, /REQUIRED_CORE_VERSION: '2\.2\.0'/, "a Core floor is not this SDK's version");
    assert.match(readme, /shields\.io\/github\/v\/tag/, "the badge reads the version from GitHub at render time");
});

test("CRLF line endings survive a write", () => {
    const root = fixture({ version: "1.7.0", mirrors: "1.6.1", eol: "\r\n" });
    assert.equal(run("sync-release-version.mjs", ["--write", "--root", root]).status, 0);

    for (const path of ["game.project", "yes2sdk/src/yes2sdk.cpp", "README.md"]) {
        const text = read(root, path);
        assert.match(text, /1\.7\.0/, `${path} was projected`);
        assert.equal(text.includes("\r\n"), true, `${path} keeps CRLF`);
        assert.equal(/[^\r]\n/.test(text), false, `${path} gained no bare LF`);
    }
});

test("LF line endings survive a write", () => {
    const root = fixture({ version: "1.7.0", mirrors: "1.6.1" });
    assert.equal(run("sync-release-version.mjs", ["--write", "--root", root]).status, 0);
    assert.equal(read(root, "game.project").includes("\r"), false);
});

test("a mode is required, and the two modes are mutually exclusive", () => {
    assert.equal(run("sync-release-version.mjs", ["--root", REPO_ROOT]).status, 2);
    assert.equal(run("sync-release-version.mjs", ["--check", "--write", "--root", REPO_ROOT]).status, 2);
    assert.equal(run("sync-release-version.mjs", ["--nonsense"]).status, 2);
});
