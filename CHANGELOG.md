# Changelog

All notable changes to Yes2SDK for Defold will be documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com/). Versioning follows [Semantic Versioning](https://semver.org/).

## [1.2.1] - 2026-04-16

### Fixed
- **Engine template broken for direct Defold bundling** — Template used `{{DEFOLD_BINARY_PREFIX}}`, `{{DEFOLD_APP_TITLE}}`, etc. which are not real Defold variables. Replaced with standard Defold template variables (`{{exe-name}}`, `{{project.title}}`, `{{display.width}}`, `{{display.height}}`). Heap size hardcoded to 256MB. Previously, using the template with `Project > Bundle` resulted in a permanent black screen because the engine binary path was a literal placeholder string.
- **Missing keyboard scroll prevention** — Arrow keys and space bar scrolled the browser page behind the game canvas. Added `keydown` event listener to prevent default on game keys.
- **Missing canvas focus handling** — Keyboard input didn't work until the player clicked the canvas. Added auto-focus on page load and click-to-refocus handler.

### Added
- **Lua wrapper nil guard with helpful error message** — When native extension isn't loaded (using `Project > Build` instead of `Bundle`), the wrapper now prints a clear error once and provides a stub that no-ops all SDK calls. Games can run in the editor without crashing.
- **Complete Lua wrapper** — Expanded from 9 functions to all 35 (analytics, player, auth, data, game, banners, score were missing). All native extension functions are now accessible via `require "yes2sdk.yes2sdk"`.
- **README: loading progress documentation** — Clarifies that the engine template auto-reports download progress; `set_loading_progress()` is only for game-specific post-engine loading.
- **README: init + start_game coupling warning** — Explicit warning that `start_game()` must only be called inside the `initialize()` success callback.
- **README: Fetch Libraries note** — Reminds new developers to Fetch Libraries before the module is available.

## [1.2.0] - 2026-04-15

### Fixed
- **WASM signature mismatch on ad callbacks** — All 5 ad callback typedefs (`beforeAd`, `afterAd`, `adDismissed`, `adViewed`, `noFill`) used `"vi"` makeDynCall signature while every other module uses `"vii"`. This caused `RuntimeError: function signature mismatch` when rewarded/interstitial ads completed, freezing the game on Debug platform and failing silently on Poki.
- **Null lua_State dereference in async callbacks** — If a JS callback fired after the Lua state was destroyed (e.g. script exits before async promise resolves), `m_L` was null and `lua_gettop(L)` crashed. Added null guard to all 11 async callbacks across core, ads, player, auth, and game modules.
- **`lua_pushstring(L, NULL)` undefined behavior** — JS passes `(1, 0)` on success paths, mapping the second arg to a null `const char*`. Calling `lua_pushstring` with NULL is undefined in Lua 5.1. Changed to push `nil` when string pointer is null. Affects core init, player data, auth sign-in, and game invite link callbacks.
- **Ads null callback pointer invocation** — `showInterstitial` only sets 3 of 5 callback pointers but all 5 shims could fire depending on the platform SDK. Calling `makeDynCall` on a null pointer resolves to WASM table index 0 — undefined behavior. Added null check before every callback invocation.
- **Core JS missing `window.Yes2SDK` null guards** — `initializeAsync`, `startGameAsync`, `setLoadingProgress`, and `getPlatform` were the only bridge functions without SDK existence checks. If the SDK wasn't loaded yet, these threw `TypeError` in the WASM frame.
- **Ads JS missing `window.Yes2SDK.ads` null guard** — `showInterstitial` and `showRewarded` accessed `window.Yes2SDK.ads` without checking. Now falls back to `noFill` callback when SDK is unavailable.
- **`JSON.parse` without try/catch in player and game bridges** — Malformed JSON from Lua threw synchronously outside the promise chain, crashing the WASM frame. Now catches parse errors and fires the error callback.

### Changed
- Added Lua stack balance asserts (`lua_gettop` checks) to analytics, banners, data, and score modules — previously missing, making stack corruption from future changes undetectable.
- Reset unused ad callback pointers to `null` in `showInterstitial` to prevent stale pointer reuse from a previous `showRewarded` call.
- Player and auth JS bridges now use stored callback pointers consistently in SDK-not-initialized branches.

## [1.1.1] - 2026-04-06

### Fixed
- Added `game.project` file for Defold library dependency resolution. Without it, `Fetch Libraries` silently skipped the archive.

## [1.1.0] - 2026-04-05

### Added
- Branded Yes2Games HTML5 loading screen with animated logo, progress bar, and fade-out.

## [1.0.0] - 2026-04-04

### Added
- Initial release with full API: 10 modules, 39 functions.
- Platform adapters: Poki, CrazyGames, Yandex, Game Distribution, YouTube Playables.
- Lua wrapper (`yes2sdk.lua`) for core, ads, and session modules.
- Integration guide with API reference and compliance checklist.
