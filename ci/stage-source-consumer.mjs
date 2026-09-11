#!/usr/bin/env node
// stage-source-consumer.mjs - stage the minimal consumer app into an ephemeral
// directory (yes2games/yes2sdk-defold#29 section 6).
//
// The consumer under ci/consumer/ is not buildable in place: Bob writes
// .internal/ and build/ next to game.project, and a dependency resolve caches
// downloaded archives under .internal/lib keyed on the URL. Staging a fresh copy
// per lane is what makes "clean consumer" mean anything - #29 sections 6, 11 and
// 13 all lean on it, and a reused directory would let one lane's resolved bytes
// satisfy the next lane's download.
//
// Two source modes, matching the two things CI has to prove:
//
//   --from-source            copy the working tree's yes2sdk/ in, so the required
//                            CI lanes build the extension as it stands in the PR;
//   --dependency URL         write that URL as the staged project's dependency,
//                            so the edge and stable smokes build what a consumer
//                            actually downloads.
//
// Usage:
//   node ci/stage-source-consumer.mjs --out DIR (--from-source | --dependency URL) [--root DIR]
//
// Exit codes: 0 staged, 1 refused (path escape, symlink, dirty target), 2 usage/IO.

import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";

const CONSUMER_DIR = "ci/consumer";
const EXTENSION_DIR = "yes2sdk";

function usage(message) {
    process.stderr.write(`stage-source-consumer: ${message}\n`);
    process.stderr.write("usage: node ci/stage-source-consumer.mjs --out DIR (--from-source | --dependency URL) [--root DIR]\n");
    process.exit(2);
}

function refuse(message) {
    process.stderr.write(`stage-source-consumer: ${message}\n`);
    process.exit(1);
}

function parseArgs(argv) {
    const options = { root: process.cwd() };
    for (let i = 0; i < argv.length; i++) {
        const flag = argv[i];
        if (flag === "--from-source") {
            options.fromSource = true;
            continue;
        }
        if (flag === "-h" || flag === "--help") {
            process.stdout.write("usage: node ci/stage-source-consumer.mjs --out DIR (--from-source | --dependency URL) [--root DIR]\n");
            process.exit(0);
        }
        const value = argv[i + 1];
        if (value === undefined) {
            usage(`${flag} needs a value`);
        }
        if (flag === "--out") options.out = value;
        else if (flag === "--dependency") options.dependency = value;
        else if (flag === "--root") options.root = value;
        else usage(`unknown argument: ${flag}`);
        i++;
    }
    if (options.out === undefined) {
        usage("--out is required");
    }
    if ((options.fromSource === true) === (options.dependency !== undefined)) {
        usage("exactly one of --from-source or --dependency URL is required");
    }
    if (options.dependency !== undefined && !/^https:\/\/github\.com\/yes2games\/yes2sdk-defold\/archive\/refs\/(tags|heads)\/[^\s"]+\.zip$/.test(options.dependency)) {
        usage(`--dependency must be a yes2sdk-defold archive URL, not ${JSON.stringify(options.dependency)}`);
    }
    options.root = resolve(options.root);
    options.out = resolve(options.out);
    return options;
}

/**
 * Copy a directory, one intended file at a time, refusing anything that is not a
 * plain file or directory. A symlink in the source tree would otherwise be
 * followed into a path the stage was never meant to contain, and a link whose
 * target sits outside the root is the same escape by another name - so both the
 * link itself and any resolved path leaving the root are refused rather than
 * skipped, because silently dropping a file makes a build fail somewhere else.
 */
function copyTree(from, to, root) {
    for (const entry of readdirSync(from, { withFileTypes: true })) {
        const source = join(from, entry.name);
        const target = join(to, entry.name);

        if (entry.isSymbolicLink()) {
            refuse(`${relative(root, source)} is a symlink; the consumer stage copies only plain files`);
        }
        const resolved = resolve(source);
        if (resolved !== root && !resolved.startsWith(root + sep)) {
            refuse(`${source} resolves outside ${root}`);
        }

        if (entry.isDirectory()) {
            mkdirSync(target, { recursive: true });
            copyTree(source, target, root);
        } else if (entry.isFile()) {
            cpSync(source, target);
        } else {
            refuse(`${relative(root, source)} is neither a file nor a directory`);
        }
    }
}

const options = parseArgs(process.argv.slice(2));
const consumer = join(options.root, CONSUMER_DIR);

if (!existsSync(join(consumer, "game.project"))) {
    usage(`${CONSUMER_DIR}/game.project is missing under ${options.root}`);
}
if (options.out === options.root || options.root.startsWith(options.out + sep)) {
    refuse(`--out ${options.out} contains the repository root; the stage is ephemeral and gets deleted`);
}

// Ephemeral means ephemeral: whatever a previous lane left here goes, so no
// resolved dependency cache and no build output can survive into this lane.
rmSync(options.out, { recursive: true, force: true });
mkdirSync(options.out, { recursive: true });
copyTree(consumer, options.out, resolve(consumer));

if (options.fromSource === true) {
    const extension = join(options.root, EXTENSION_DIR);
    if (!existsSync(join(extension, "ext.manifest"))) {
        usage(`${EXTENSION_DIR}/ext.manifest is missing under ${options.root}`);
    }
    const target = join(options.out, EXTENSION_DIR);
    mkdirSync(target, { recursive: true });
    copyTree(extension, target, resolve(extension));
    process.stdout.write(`staged ${CONSUMER_DIR} + ${EXTENSION_DIR}/ (working tree) into ${options.out}\n`);
} else {
    // The staged copy is the only game.project this script ever writes. The
    // repository root's game.project is a version mirror the projector owns, and
    // nothing in the consumer path may touch it (#29 section 6).
    const path = join(options.out, "game.project");
    const text = readFileSync(path, "utf8");
    if (!/^\[project\]$/m.test(text)) {
        refuse(`the staged game.project has no [project] section to add a dependency to`);
    }
    writeFileSync(path, text.replace(/^\[project\]$/m, `[project]\ndependencies#0 = ${options.dependency}`), "utf8");
    process.stdout.write(`staged ${CONSUMER_DIR} into ${options.out}, resolving ${options.dependency}\n`);
}
