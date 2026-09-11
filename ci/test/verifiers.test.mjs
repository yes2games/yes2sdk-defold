// Verifier fixture tests (yes2games/yes2sdk-defold#29 sections 7, 12 and 15).
//
// The rules proved here are the ones #29 section 15 asks for by name: a duplicate
// canonical workflow or final-gate identity is red, VERSION or mirror skew is red,
// a version bump with no matching CHANGELOG section is red, and the macro-aware
// syntax check reads the file the plain parser cannot.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { REPO_ROOT, gitInit, run, scratch, write } from "./helpers.mjs";

// ---------------------------------------------------------------------------
// verify-workflow-governance.mjs
// ---------------------------------------------------------------------------

const CANONICAL = ".github/workflows/required-ci.yml";

const workflow = ({ name = "YES2 Defold Required CI Workflow", gate = "YES2 Defold Required CI", extraJob = "" } = {}) => `name: ${name}

on:
  pull_request:

jobs:
  build:
    name: Build
    runs-on: ubuntu-24.04
    steps:
      - run: "true"

  required-ci:
    name: ${gate}
    needs: [build]
    runs-on: ubuntu-24.04
    steps:
      - run: "true"
${extraJob}`;

/** A git repository containing the given workflow files, all tracked. */
function workflowFixture(files) {
    const root = scratch();
    const git = gitInit(root);
    for (const [path, contents] of Object.entries(files)) {
        write(root, path, contents);
    }
    git("add", "-A");
    return root;
}

test("governance passes on the repository as it stands", () => {
    const result = run("verify-workflow-governance.mjs", ["--root", REPO_ROOT]);
    assert.equal(result.status, 0, result.stderr);
});

test("governance passes on a minimal compliant tree", () => {
    const root = workflowFixture({ [CANONICAL]: workflow() });
    const result = run("verify-workflow-governance.mjs", ["--root", root]);
    assert.equal(result.status, 0, result.stderr);
});

test("a second workflow claiming the canonical workflow name is red", () => {
    const root = workflowFixture({
        [CANONICAL]: workflow(),
        ".github/workflows/copy.yml": workflow({ gate: "Something Else" }),
    });
    const result = run("verify-workflow-governance.mjs", ["--root", root]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /workflow name "YES2 Defold Required CI Workflow" is claimed 2 times/);
});

test("a second job claiming the canonical final-gate name is red", () => {
    const root = workflowFixture({
        [CANONICAL]: workflow({
            extraJob: `
  impostor:
    name: YES2 Defold Required CI
    runs-on: ubuntu-24.04
    steps:
      - run: "true"
`,
        }),
    });
    const result = run("verify-workflow-governance.mjs", ["--root", root]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /final-gate job name "YES2 Defold Required CI" is claimed 2 times/);
});

test("a job id spelled like the final gate is a spoof, even with no name", () => {
    const root = workflowFixture({
        [CANONICAL]: workflow({
            extraJob: `
  "YES2 Defold Required CI":
    runs-on: ubuntu-24.04
    steps:
      - run: "true"
`,
        }),
    });
    const result = run("verify-workflow-governance.mjs", ["--root", root]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /claimed 2 times/);
});

for (const [label, spelling] of [
    ["case", "Yes2 Defold Required CI Workflow"],
    ["whitespace", "YES2  Defold Required CI Workflow"],
]) {
    test(`a ${label} variant of the canonical workflow name is rejected as a spoof`, () => {
        const root = workflowFixture({ [CANONICAL]: workflow({ name: spelling }) });
        const result = run("verify-workflow-governance.mjs", ["--root", root]);
        assert.equal(result.status, 1);
        assert.match(result.stderr, /must be exactly "YES2 Defold Required CI Workflow"/);
    });
}

test("the canonical identities declared in the wrong file are red", () => {
    const root = workflowFixture({ ".github/workflows/elsewhere.yml": workflow() });
    const result = run("verify-workflow-governance.mjs", ["--root", root]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /required-ci\.yml is not tracked/);
    assert.match(result.stderr, /declared in \.github\/workflows\/elsewhere\.yml/);
});

test("an untracked workflow cannot claim an identity, because it never runs", () => {
    const root = workflowFixture({ [CANONICAL]: workflow() });
    write(root, ".github/workflows/untracked.yml", workflow());
    const result = run("verify-workflow-governance.mjs", ["--root", root]);
    assert.equal(result.status, 0, result.stderr);
});

// ---------------------------------------------------------------------------
// verify-release-state.mjs
// ---------------------------------------------------------------------------

const CONFIG = {
    "include-component-in-tag": false,
    "separate-pull-requests": false,
    "skip-github-release": true,
    packages: { ".": { "release-type": "simple", "version-file": "VERSION", "changelog-path": "CHANGELOG.md" } },
};

function releaseStateFixture({ version = "1.6.1", manifest = version, config = CONFIG, gameProject, cpp } = {}) {
    const root = scratch();
    write(root, "VERSION", `${version}\n`);
    write(root, ".release-please-manifest.json", `${JSON.stringify({ ".": manifest }, null, 2)}\n`);
    write(root, "release-please-config.json", `${JSON.stringify(config, null, 2)}\n`);
    write(root, "game.project", gameProject ?? `[project]\ntitle = Yes2SDK\nversion = ${version}\n`);
    write(root, "yes2sdk/src/yes2sdk.cpp", cpp ?? `#define VERSION "${version}"\n`);
    write(root, "README.md", `dependencies#0 = https://github.com/yes2games/yes2sdk-defold/archive/refs/tags/v${version}.zip\n`);
    return root;
}

test("release state passes on the repository as it stands", () => {
    const result = run("verify-release-state.mjs", ["--root", REPO_ROOT]);
    assert.equal(result.status, 0, result.stderr);
});

test("release state passes on a minimal compliant tree", () => {
    const result = run("verify-release-state.mjs", ["--root", releaseStateFixture()]);
    assert.equal(result.status, 0, result.stderr);
});

test("a manifest that disagrees with VERSION is red", () => {
    const result = run("verify-release-state.mjs", ["--root", releaseStateFixture({ version: "1.7.0", manifest: "1.6.1" })]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /manifest\.json says "1\.6\.1" while VERSION says "1\.7\.0"/);
});

test("a malformed VERSION is red", () => {
    const result = run("verify-release-state.mjs", ["--root", releaseStateFixture({ version: "1.6.1-rc.1" })]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /strict plain X\.Y\.Z/);
});

test("mirror skew is red", () => {
    const result = run("verify-release-state.mjs", ["--root", releaseStateFixture({ cpp: '#define VERSION "1.5.0"\n' })]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /yes2sdk\.cpp.*"1\.5\.0"/s);
});

for (const [label, mutate, expected] of [
    ["release-type node", (config) => ({ ...config, packages: { ".": { ...config.packages["."], "release-type": "node" } } }), /release-type to "node"/],
    ["a missing version-file", (config) => ({ ...config, packages: { ".": { "release-type": "simple" } } }), /version-file to absent/],
    ["skip-github-release false", (config) => ({ ...config, "skip-github-release": false }), /skip-github-release to false/],
    ["include-component-in-tag true", (config) => ({ ...config, "include-component-in-tag": true }), /include-component-in-tag to true/],
    ["package-name alongside a componentless tag", (config) => ({ ...config, "package-name": "yes2sdk-defold" }), /yes2infra PR #445/],
    ["a component key on the package", (config) => ({ ...config, packages: { ".": { ...config.packages["."], component: "defold" } } }), /yes2infra PR #445/],
    ["game.project as a target", (config) => ({ ...config, packages: { ".": { ...config.packages["."], "extra-files": ["game.project"] } } }), /names game\.project/],
]) {
    test(`Release Please config with ${label} is red`, () => {
        const result = run("verify-release-state.mjs", ["--root", releaseStateFixture({ config: mutate(CONFIG) })]);
        assert.equal(result.status, 1, result.stdout);
        assert.match(result.stderr, expected);
    });
}

test("a Release Please marker in game.project is red", () => {
    const root = releaseStateFixture({ gameProject: "[project]\nversion = 1.6.1 # x-release-please-version\n" });
    const result = run("verify-release-state.mjs", ["--root", root]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Release Please marker/);
});

// ---------------------------------------------------------------------------
// verify-changelog-section.mjs
// ---------------------------------------------------------------------------

test("the repository CHANGELOG documents the version in VERSION", () => {
    const version = readFileSync(`${REPO_ROOT}/VERSION`, "utf8").trim();
    const result = run("verify-changelog-section.mjs", ["--version", version, "--changelog", `${REPO_ROOT}/CHANGELOG.md`]);
    assert.equal(result.status, 0, result.stderr);
});

test("a version with no CHANGELOG section is red", () => {
    const root = scratch();
    write(root, "CHANGELOG.md", "# Changelog\n\n## [1.6.1] - 2026-08-24\n\n- something\n");
    const result = run("verify-changelog-section.mjs", ["--version", "1.7.0", "--changelog", `${root}/CHANGELOG.md`]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /has no section for 1\.7\.0/);
    assert.match(result.stderr, /sections present: 1\.6\.1/);
});

test("a Release Please compare-link heading is accepted, and its notes extracted", () => {
    const root = scratch();
    write(
        root,
        "CHANGELOG.md",
        "# Changelog\n\n## [1.7.0](https://github.com/yes2games/yes2sdk-defold/compare/v1.6.1...v1.7.0) (2026-09-11)\n\n### Features\n\n* a thing\n\n## [1.6.1] - 2026-08-24\n\n- older\n"
    );
    const result = run("verify-changelog-section.mjs", [
        "--version",
        "1.7.0",
        "--changelog",
        `${root}/CHANGELOG.md`,
        "--out",
        `${root}/notes.md`,
    ]);
    assert.equal(result.status, 0, result.stderr);

    const notes = readFileSync(`${root}/notes.md`, "utf8");
    assert.match(notes, /^## \[1\.7\.0\]/);
    assert.match(notes, /a thing/);
    assert.doesNotMatch(notes, /older/, "the notes stop at the next version heading");
});

test("a Keep a Changelog heading is accepted too", () => {
    const root = scratch();
    write(root, "CHANGELOG.md", "# Changelog\n\n## [1.6.1] - 2026-08-24\n\n### Fixed\n\n- a fix\n");
    const result = run("verify-changelog-section.mjs", ["--version", "1.6.1", "--changelog", `${root}/CHANGELOG.md`]);
    assert.equal(result.status, 0, result.stderr);
});

test("a heading with no notes under it is red", () => {
    const root = scratch();
    write(root, "CHANGELOG.md", "# Changelog\n\n## [1.7.0] - 2026-09-11\n\n## [1.6.1] - 2026-08-24\n\n- older\n");
    const result = run("verify-changelog-section.mjs", ["--version", "1.7.0", "--changelog", `${root}/CHANGELOG.md`]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /is empty/);
});

// ---------------------------------------------------------------------------
// check-web-js-syntax.mjs
// ---------------------------------------------------------------------------

/** A git repository with tracked JS library files under yes2sdk/lib/web. */
function jsFixture(files) {
    const root = scratch();
    const git = gitInit(root);
    for (const [name, contents] of Object.entries(files)) {
        write(root, `yes2sdk/lib/web/${name}`, contents);
    }
    git("add", "-A");
    return root;
}

test("the syntax check passes on every tracked library file as it stands", () => {
    const result = run("check-web-js-syntax.mjs", ["--root", REPO_ROOT]);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /16 tracked file\(s\)/);
});

test("the zero-argument macro form parses, which node --check cannot do", () => {
    // The exact shape at lib_yes2sdk.js:110, 125, 156 and 171.
    const source = 'var lib = {\n  pause: function () {\n    {{{ makeDynCall("v", "Yes2SDKUtils._onPausePtr") }}}();\n  },\n};\n';

    const checked = run("check-web-js-syntax.mjs", ["--root", jsFixture({ "lib_probe.js": source })]);
    assert.equal(checked.status, 0, checked.stderr);

    // And the premise this check exists for: the same bytes really do fail a plain
    // parse, because `{{{ ... }}}()` reads as a call with an empty argument list on
    // a block. Without the macro pass the mandatory result is red on correct files.
    const bare = scratch();
    const path = write(bare, "probe.js", source);
    const plain = spawnSync(process.execPath, ["--check", path], { encoding: "utf8" });
    assert.notEqual(plain.status, 0, "node --check unexpectedly accepted a bare macro call");
    assert.match(plain.stderr, /SyntaxError/);
});

test("the argument-taking macro form parses", () => {
    const root = jsFixture({
        "lib_probe.js": 'var lib = {\n  before: function () {\n    {{{ makeDynCall("vii", "Yes2SDKAdsCallbacks._beforeAdPtr") }}}(1, 0);\n  },\n};\n',
    });
    const result = run("check-web-js-syntax.mjs", ["--root", root]);
    assert.equal(result.status, 0, result.stderr);
});

test("a genuine syntax error outside a macro is red, with the real line number", () => {
    const root = jsFixture({
        "lib_probe.js": 'var lib = {\n  ok: function () {\n    {{{ makeDynCall("v", "p") }}}();\n  },\n  broken: function ( {\n  },\n};\n',
    });
    const result = run("check-web-js-syntax.mjs", ["--root", root]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /lib_probe\.js/);
    // Line 7 is where the parser gives up on the malformed parameter list on line
    // 5, and 7 is a line of the real file - which is the property being checked:
    // a macro span keeps its newlines, so a reported line is not offset by them.
    assert.match(result.stderr, /lib_probe\.js:7:/);
});

test("a multi-line macro span keeps the line count", () => {
    const root = jsFixture({
        "lib_probe.js": 'var a = {{{\n  makeDynCall("v",\n    "p")\n}}}();\nvar b = ;\n',
    });
    const result = run("check-web-js-syntax.mjs", ["--root", root]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /:5/);
});

test("an empty library directory is a usage error, not a vacuous pass", () => {
    const root = scratch();
    gitInit(root)("commit", "--allow-empty", "-qm", "empty");
    const result = run("check-web-js-syntax.mjs", ["--root", root]);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /pass by vacuity/);
});
