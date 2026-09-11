#!/usr/bin/env node
// check-web-js-syntax.mjs - syntax check every tracked yes2sdk/lib/web/*.js
// (yes2games/yes2sdk-defold#29 section 7).
//
// These files are Emscripten JS library inputs, fed to Bob as --js-library and
// preprocessed before anything parses them as JavaScript. Twelve of the sixteen
// contain {{{ ... }}} macros, so a plain `node --check` is not a syntax check of
// them - it is a syntax check of a different language that happens to overlap.
//
// The two forms differ in whether the accident works:
//
//     {{{ makeDynCall("vii", "Yes2SDKAdsCallbacks._beforeAdPtr") }}}(1, 0);
//
// parses as three nested blocks holding an expression statement, then a separate
// `(1, 0);` sequence expression. Legal, and nothing like what Emscripten emits -
// it passes by luck. The zero-argument form cannot get that lucky:
//
//     {{{ makeDynCall("v", "Yes2SDKUtils._onPausePtr") }}}();
//
// `()` with no expression inside is a hard SyntaxError, and there are four such
// sites in lib_yes2sdk.js. So `node --check` is red on this repository as it
// stands, on files that are correct. Exempting the one file that fails would
// leave the check passing fifteen files it is misreading and skipping the one it
// read correctly, which is worse than not checking at all.
//
// This replaces each macro span with a placeholder expression before parsing, so
// the surrounding JavaScript - which is what a syntax check can meaningfully say
// anything about - is parsed as the expression it will become. Newlines inside a
// span are preserved so reported line numbers still point into the real file.
//
// Usage:
//   node ci/check-web-js-syntax.mjs [--root DIR]
//
// Exit codes: 0 every file parses, 1 a file does not, 2 usage or I/O error.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { Script } from "node:vm";

const LIBRARY_DIR = "yes2sdk/lib/web";
const MACRO = /\{\{\{[\s\S]*?\}\}\}/g;

function usage(message) {
    process.stderr.write(`check-web-js-syntax: ${message}\n`);
    process.stderr.write("usage: node ci/check-web-js-syntax.mjs [--root DIR]\n");
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
            process.stdout.write("usage: node ci/check-web-js-syntax.mjs [--root DIR]\n");
            process.exit(0);
        } else {
            usage(`unknown argument: ${argv[i]}`);
        }
    }
    return resolve(root);
}

/** Tracked files only: an untracked local scratch file is not shipped. */
function trackedLibraries(root) {
    let output;
    try {
        output = execFileSync("git", ["-C", root, "ls-files", "-z", "--", LIBRARY_DIR], {
            encoding: "utf8",
            stdio: ["ignore", "pipe", "pipe"],
        });
    } catch (error) {
        usage(`cannot list tracked files under ${LIBRARY_DIR}: ${error.message.trim()}`);
    }
    return output.split("\0").filter((path) => path.endsWith(".js"));
}

/**
 * Substitute every macro span with `(0)`, a placeholder that is legal wherever an
 * Emscripten macro legally expands - as a callee, an argument, a statement or an
 * operand - so what remains to parse is the file's own JavaScript.
 */
export function stripMacros(source) {
    return source.replace(MACRO, (span) => `(0)${"\n".repeat((span.match(/\n/g) ?? []).length)}`);
}

const root = parseArgs(process.argv.slice(2));
const files = trackedLibraries(root);

if (files.length === 0) {
    usage(`no tracked .js files under ${LIBRARY_DIR}; the check would pass by vacuity`);
}

const failures = [];
for (const relativePath of files) {
    const source = readFileSync(join(root, relativePath), "utf8");
    const macros = (source.match(MACRO) ?? []).length;
    try {
        // Parse only. `new Script` compiles without running, which is the whole
        // point: these files reference Emscripten runtime symbols that exist only
        // inside a generated module.
        new Script(stripMacros(source), { filename: relativePath });
        process.stdout.write(`ok    ${relativePath}${macros === 0 ? "" : ` (${macros} macro span(s))`}\n`);
    } catch (error) {
        // V8 puts `file:line` on the first line of the stack and nowhere in the
        // message, and the line number is the only part of a syntax error anyone
        // can act on - so it is lifted out rather than dropped.
        const where = (error.stack ?? "").split("\n")[0].trim();
        failures.push(`${where.startsWith(relativePath) ? where : relativePath}: ${error.message}`);
    }
}

if (failures.length > 0) {
    process.stderr.write(`web JS syntax check failed (${failures.length} of ${files.length} file(s)):\n`);
    for (const problem of failures) {
        process.stderr.write(`  - ${problem}\n`);
    }
    process.exit(1);
}

process.stdout.write(`web JS syntax check OK: ${files.length} tracked file(s) under ${LIBRARY_DIR} parse\n`);
