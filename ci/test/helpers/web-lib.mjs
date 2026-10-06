// web-lib.mjs - load yes2sdk/lib/web/lib_yes2sdk*.js into a fake page so the
// Emscripten JS bridge can be unit tested without Bob, Emscripten or a browser.
//
//   const web = loadWebLib("yes2sdk/lib/web/lib_yes2sdk_iap.js", { yes2sdk: fake });
//   web.exports.Yes2SDK_iap_getCatalog(42);   // 42 is the "callback pointer"
//   await web.flush();
//   web.dyncalls  // [{ sig: "vii", ptr: 42, args: [1, "[...]"] }]
//
// How the Emscripten environment is faked:
//
// - Macros. Every `{{{ makeDynCall("sig", "expr") }}}` span is rewritten to
//   `__y2dyn("sig", (expr))`, which returns a function that records
//   `{ sig, ptr, args }` into `dyncalls` when the library calls it. Any other
//   `{{{ }}}` macro is refused, so a new macro kind cannot pass unnoticed. Same
//   span matching as ci/check-web-js-syntax.mjs.
// - Pointers. There is no heap. A "string pointer" is the JS string itself:
//   tests pass plain strings where C++ would pass a `const char*`, UTF8ToString
//   returns them unchanged (and maps 0 / null / undefined to "", as Emscripten
//   does for a null pointer), and stringToUTF8OnStack returns the string it was
//   given, so dyncall args and sync return values read as the strings the
//   library produced. Those two are the only string helpers the real libraries
//   use. allocateUTF8, stringToUTF8, lengthBytesUTF8 and _malloc throw: the
//   libraries must not use them (allocateUTF8 is gone from current Emscripten),
//   and a later task reaching for one should fail here, not only in Bob.
//   A callback pointer is any value the test chooses (a number is clearest).
// - Library registration. addToLibrary(obj), mergeInto(LibraryManager.library,
//   obj) and autoAddDeps(obj, name) behave like Emscripten's: every key lands in
//   `exports` under its library name (`Yes2SDK_*`, `$Helper`, `*__deps`). Each
//   `$Name` helper is bound as the free identifier `Name` in the shared library
//   scope only when some function lists it in `__deps` (directly or
//   transitively), which is what decides whether Emscripten emits it. The
//   harness pre-declares every helper name so the scope can bind it later, so
//   an unbound helper reads as `undefined` here where a real build throws
//   ReferenceError; to compensate, a helper that a library function mentions
//   but that no `__deps` binds is reported in `problems`.
// - Scope. All files given in one call are evaluated in ONE function scope, in
//   order, so a helper defined in lib_yes2sdk.js and used by another library
//   through `__deps: ['$Yes2SDKBridge']` resolves exactly as it does when Bob
//   links them together. The code runs in this realm (not node:vm), so objects
//   the library builds compare with assert.deepStrictEqual like local ones.
//
// Problems the harness can see but a library cannot report (a dyncall through a
// null pointer, a dyncall whose argument count does not match its signature, a
// `__deps` entry nothing defines, a `$Helper` used but never bound by `__deps`) are collected in `problems`; tests assert it
// is empty.
//
// Fidelity limit: Emscripten re-serializes library functions to source text, so
// a function closing over a file-local variable breaks in a real build. Here the
// closure still works. Keep library state on `$` helpers, as the files do today.

import { readFileSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

const MACRO = /\{\{\{([\s\S]*?)\}\}\}/g;
const DYNCALL = /^\s*makeDynCall\(\s*"([a-z]+)"\s*,\s*"([^"]*)"\s*\)\s*$/;
const HELPER_KEY = /^\s*\$([A-Za-z_]\w*)\s*:/gm;

// Runtime symbols the harness itself provides; a `__deps` entry naming one of
// them is satisfied without a library definition.
const RUNTIME_DEPS = new Set([
    "$UTF8ToString",
    "$stringToUTF8OnStack",
    "$autoAddDeps",
    "malloc",
    "free",
]);

const isDecorator = (key) => key.includes("__");

function rewriteMacros(source, file) {
    return source.replace(MACRO, (span, inner) => {
        const match = DYNCALL.exec(inner);
        if (match === null) {
            throw new Error(`${file}: unsupported Emscripten macro ${span.trim()}`);
        }
        const newlines = "\n".repeat((span.match(/\n/g) ?? []).length);
        return `__y2dyn(${JSON.stringify(match[1])}, (${match[2]}))${newlines}`;
    });
}

function unavailable(name) {
    return () => {
        throw new Error(
            `web-lib harness: ${name} is not modelled and the real libraries do not use it; ` +
                "use UTF8ToString / stringToUTF8OnStack, strings are passed as JS strings",
        );
    };
}

function formatArgs(args) {
    return args.map((arg) => (typeof arg === "string" ? arg : String(arg))).join(" ");
}

/**
 * @param {string | string[]} files repo-relative or absolute library paths, loaded in order
 * @param {{ yes2sdk?: object, window?: object, navigator?: object }} [options]
 */
export function loadWebLib(files, options = {}) {
    const list = Array.isArray(files) ? files : [files];
    const dyncalls = [];
    const problems = [];
    const console = { log: [], info: [], warn: [], error: [] };
    const library = {};

    const window = options.window ?? {};
    if ("yes2sdk" in options) {
        window.Yes2SDK = options.yes2sdk;
    }
    const navigator = options.navigator ?? window.navigator ?? { language: "en" };

    const fakeConsole = {
        log: (...args) => console.log.push(formatArgs(args)),
        info: (...args) => console.info.push(formatArgs(args)),
        warn: (...args) => console.warn.push(formatArgs(args)),
        error: (...args) => console.error.push(formatArgs(args)),
    };

    const runtime = {
        window,
        navigator,
        console: fakeConsole,
        UTF8ToString: (ptr) => (ptr === 0 || ptr === null || ptr === undefined ? "" : String(ptr)),
        stringToUTF8OnStack: (str) => str,
        allocateUTF8: unavailable("allocateUTF8"),
        stringToUTF8: unavailable("stringToUTF8"),
        lengthBytesUTF8: unavailable("lengthBytesUTF8"),
        _malloc: unavailable("_malloc"),
        _free: () => {},
        addToLibrary: (obj) => Object.assign(library, obj),
        mergeInto: (target, obj) => Object.assign(target, obj),
        LibraryManager: { library },
        autoAddDeps: (obj, name) => {
            for (const key of Object.keys(obj)) {
                if (isDecorator(key) || key === name) {
                    continue;
                }
                const deps = (obj[`${key}__deps`] ??= []);
                if (!deps.includes(name)) {
                    deps.push(name);
                }
            }
        },
        __y2dyn: (sig, ptr) => (...args) => {
            dyncalls.push({ sig, ptr, args });
            if (ptr === 0 || ptr === null || ptr === undefined) {
                problems.push(`dyncall "${sig}" through a null function pointer (args ${JSON.stringify(args)})`);
            }
            if (args.length !== sig.length - 1) {
                problems.push(`dyncall "${sig}" expects ${sig.length - 1} argument(s), got ${args.length}`);
            }
        },
    };

    let body = "";
    const helperNames = new Set();
    for (const file of list) {
        const path = isAbsolute(file) ? file : resolve(REPO_ROOT, file);
        const source = rewriteMacros(readFileSync(path, "utf8"), file);
        for (const match of source.matchAll(HELPER_KEY)) {
            helperNames.add(match[1]);
        }
        body += `\n// ---- ${file}\n${source}\n`;
    }

    const names = [...helperNames];
    const declare = names.length === 0 ? "" : `var ${names.join(", ")};\n`;
    const binders = names.map((name) => `${JSON.stringify(name)}: function (v) { ${name} = v; }`).join(",\n");
    const params = Object.keys(runtime);
    // eslint-disable-next-line no-new-func
    const run = new Function(...params, `${declare}${body}\nreturn {\n${binders}\n};`);
    const bind = run(...params.map((name) => runtime[name]));

    // Bind every helper some function depends on, transitively, like Emscripten's
    // dependency walk. Unreferenced helpers stay unbound.
    const needed = new Set();
    const visit = (dep, from) => {
        if (needed.has(dep)) {
            return;
        }
        if (!(dep in library)) {
            if (!RUNTIME_DEPS.has(dep)) {
                problems.push(`${from} lists __deps "${dep}", which no loaded library defines`);
            }
            return;
        }
        needed.add(dep);
        for (const next of library[`${dep}__deps`] ?? []) {
            visit(next, dep);
        }
    };
    for (const key of Object.keys(library)) {
        if (!isDecorator(key) && !key.startsWith("$")) {
            for (const dep of library[`${key}__deps`] ?? []) {
                visit(dep, key);
            }
        }
    }
    for (const dep of needed) {
        if (!dep.startsWith("$")) {
            continue;
        }
        const name = dep.slice(1);
        if (bind[name] === undefined) {
            problems.push(`helper ${dep} is defined but its key was not found when scanning the source`);
            continue;
        }
        bind[name](library[dep]);
    }

    // A helper some library function mentions but nothing binds through __deps
    // would be a ReferenceError in a real build.
    for (const name of names) {
        if (needed.has(`$${name}`)) {
            continue;
        }
        const mention = new RegExp(`\\b${name}\\b`);
        for (const key of Object.keys(library)) {
            if (!isDecorator(key) && !key.startsWith("$") && typeof library[key] === "function") {
                if (mention.test(library[key].toString())) {
                    problems.push(`${key} references helper $${name}, which is never bound through __deps`);
                }
            }
        }
    }

    return {
        exports: library,
        dyncalls,
        problems,
        console,
        window,
        async flush(rounds = 5) {
            for (let i = 0; i < rounds; i++) {
                await new Promise((resolveRound) => setImmediate(resolveRound));
            }
        },
    };
}
