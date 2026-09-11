#!/usr/bin/env node
// verify-changelog-section.mjs - the detector for a version bump made outside the
// Release Please PR (yes2games/yes2sdk-defold#29 section 12 guard 2,
// yes2games/yes2dashboard#141 section 8 guard 2).
//
// Release Please writes VERSION and the CHANGELOG entry in the same release PR, so
// the two move together. A version bump that rides inside some other PR moves only
// the first, and the stable job would then publish a release nobody wrote notes
// for. This repository already contains that shape: v1.6.0 points at 10f0618, a
// one-line LICENSE typo fix, while the 1.6.0 bump sits in the previous commit.
// Missing notes are the one cheap, reliable signal that the bump did not come from
// a release PR.
//
// Doubles as the release-notes source, so the notes the stable job publishes are
// the same bytes this check passed on, not a second rendering of them.
//
// The heading matcher accepts both shapes on purpose. Every section in this file
// today is Keep a Changelog ("## [1.6.1] - 2026-08-24"), and Release Please will
// write compare-link headings ("## [1.7.0](https://.../compare/v1.6.1...v1.7.0)
// (2026-09-11)") from the first release onward. A matcher fitted to either one
// alone fails on the other, and the one it would fail on is the first real
// release, in the stable job, after the draft already exists.
//
// Usage:
//   node ci/verify-changelog-section.mjs --version X.Y.Z [--changelog FILE] [--out FILE]
//
// Exit codes: 0 the section exists and has content, 1 it does not, 2 usage/IO.

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const HEADING = /^#{2,3}\s+\[?v?(\d+\.\d+\.\d+)\]?/;

function usage(message) {
    process.stderr.write(`verify-changelog-section: ${message}\n`);
    process.stderr.write("usage: node ci/verify-changelog-section.mjs --version X.Y.Z [--changelog FILE] [--out FILE]\n");
    process.exit(2);
}

function parseArgs(argv) {
    const options = { changelog: "CHANGELOG.md" };
    for (let i = 0; i < argv.length; i++) {
        const flag = argv[i];
        if (flag === "-h" || flag === "--help") {
            process.stdout.write("usage: node ci/verify-changelog-section.mjs --version X.Y.Z [--changelog FILE] [--out FILE]\n");
            process.exit(0);
        }
        const value = argv[i + 1];
        if (value === undefined) {
            usage(`${flag} needs a value`);
        }
        if (flag === "--version") options.version = value;
        else if (flag === "--changelog") options.changelog = value;
        else if (flag === "--out") options.out = value;
        else usage(`unknown argument: ${flag}`);
        i++;
    }
    if (!/^\d+\.\d+\.\d+$/.test(options.version ?? "")) {
        usage("--version must be a strict plain X.Y.Z");
    }
    return options;
}

const options = parseArgs(process.argv.slice(2));
const path = resolve(options.changelog);

let lines;
try {
    lines = readFileSync(path, "utf8").split("\n");
} catch (error) {
    usage(`cannot read ${options.changelog}: ${error.message}`);
}

let start = -1;
let end = lines.length;
const found = [];
for (let i = 0; i < lines.length; i++) {
    const match = HEADING.exec(lines[i]);
    if (match === null) {
        continue;
    }
    found.push(match[1]);
    if (match[1] === options.version && start === -1) {
        start = i;
    } else if (start !== -1 && i > start) {
        end = i;
        break;
    }
}

if (start === -1) {
    process.stderr.write(
        `verify-changelog-section: ${options.changelog} has no section for ${options.version}.\n` +
            "A release PR writes VERSION and the CHANGELOG entry together, so a version with no section means the\n" +
            "bump reached main some other way and no notes exist for it. Do not publish it: raise the bump through\n" +
            "a Release Please PR instead.\n" +
            (found.length > 0 ? `sections present: ${found.join(", ")}\n` : "the file documents no version at all\n")
    );
    process.exit(1);
}

const body = lines.slice(start + 1, end);
if (body.every((line) => line.trim() === "")) {
    process.stderr.write(
        `verify-changelog-section: ${options.changelog}'s section for ${options.version} is empty; ` +
            "a heading with no notes is not a release entry\n"
    );
    process.exit(1);
}

const section = `${lines.slice(start, end).join("\n").trimEnd()}\n`;
if (options.out !== undefined) {
    writeFileSync(resolve(options.out), section, "utf8");
}

process.stdout.write(
    `verify-changelog-section: ${options.changelog} documents ${options.version} in ${end - start} line(s)` +
        `${options.out === undefined ? "" : `, written to ${options.out}`}\n`
);
