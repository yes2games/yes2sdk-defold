// Shared fixture plumbing for the ci/ test suites.
//
// Every rule these suites cover is exercised against a real tree and a real
// process, not against an internal function call: the projector and the verifiers
// are invoked exactly the way CI invokes them, so an exit code that CI would act
// on is the thing asserted.

import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const CI_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const REPO_ROOT = resolve(CI_DIR, "..");

const scratchRoots = [];
// One exit listener for all of them: a listener per directory trips Node's
// MaxListeners warning once a suite makes more than ten fixtures.
process.on("exit", () => {
    for (const root of scratchRoots) {
        rmSync(root, { recursive: true, force: true });
    }
});

/** A throwaway directory, removed when the test process exits. */
export function scratch() {
    const root = mkdtempSync(join(tmpdir(), "yes2sdk-defold-ci-"));
    scratchRoots.push(root);
    return root;
}

export function write(root, relativePath, contents) {
    const path = join(root, relativePath);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, contents, "utf8");
    return path;
}

/**
 * Run one of the ci/ scripts and capture what CI would see. Never throws on a
 * non-zero exit: the exit code is the assertion.
 */
export function run(script, args, options = {}) {
    try {
        const stdout = execFileSync(process.execPath, [join(CI_DIR, script), ...args], {
            encoding: "utf8",
            stdio: ["ignore", "pipe", "pipe"],
            cwd: options.cwd ?? REPO_ROOT,
        });
        return { status: 0, stdout, stderr: "" };
    } catch (error) {
        return {
            status: error.status ?? 1,
            stdout: error.stdout ?? "",
            stderr: error.stderr ?? String(error.message),
        };
    }
}

/** A git repository, because the governance and syntax checks read the index. */
export function gitInit(root) {
    const git = (...args) => execFileSync("git", ["-C", root, ...args], { stdio: ["ignore", "ignore", "pipe"] });
    git("init", "-q");
    git("config", "user.email", "ci@example.invalid");
    git("config", "user.name", "ci");
    return git;
}
