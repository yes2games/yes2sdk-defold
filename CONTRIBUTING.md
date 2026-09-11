# Contributing to Yes2SDK for Defold

## Entering a checkout

Run this once per clone:

```sh
git config core.hooksPath .githooks
```

That arms the committed `.githooks/pre-push`, which refuses a direct push to the
default branch.

**It is a soft guard, not enforcement.** It fires only in a clone that has run the
command above, and `git push --no-verify` bypasses it outright. Nothing protects
`main` on the server: this organization uses no branch protection, no rulesets and
no CODEOWNERS enforcement on any SDK, including the public ones, by deliberate
decision (yes2games/yes2dashboard#141 sections 3 and 14). Do not read a green
checklist and believe `main` is protected.

## The version is not yours to edit

Root `VERSION` is the sole product SemVer authority. Three files mirror it:

| Mirror | Where |
| --- | --- |
| `game.project` | `[project] version` |
| native `#define` | `yes2sdk/src/yes2sdk.cpp` |
| README production dependency tag | `archive/refs/tags/vX.Y.Z.zip` |

Release Please owns `VERSION`, `CHANGELOG.md` and `.release-please-manifest.json`,
and opens the release pull request. `ci/sync-release-version.mjs` owns the three
mirrors, and it is the only thing that may write them:

```sh
node ci/sync-release-version.mjs --check   # report skew, change nothing
node ci/sync-release-version.mjs --write   # project the mirrors from VERSION
```

`--check` is a mandatory required-CI result, so a pull request whose mirrors are
stale cannot go green and therefore cannot be merged. Never bump a version by hand
in a feature pull request: a bump that reaches `main` outside a release pull
request has no CHANGELOG section, and the stable job refuses to publish it.

## Running the checks locally

Everything CI runs on a pull request is credential-free and runs offline, except
the two Bob lanes, which need the Defold build server:

```sh
node ci/verify-workflow-governance.mjs
node ci/verify-release-state.mjs
node ci/sync-release-version.mjs --check
node ci/check-web-js-syntax.mjs
node --test ci/test/
```

To reproduce a Bob lane, read the pinned versions from `ci/defold-toolchain.json`,
then:

```sh
node ci/stage-source-consumer.mjs --out /tmp/consumer --from-source
cd /tmp/consumer
java -jar /path/to/bob.jar --archive --platform js-web --architectures wasm-web \
  resolve distclean build bundle
```

## Pull requests from a fork

This repository is public, so a pull request from a fork gets no repository
secrets and a read-only token. Every mandatory required-CI result is
credential-free by construction, so a fork pull request can reach green. Nothing
that needs a credential may ever be added to a job that runs on `pull_request` —
it would fail every outside contribution, with a confusing error.
