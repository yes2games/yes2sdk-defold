# Changelog

All notable changes to Yes2SDK for Defold will be documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com/). Versioning follows [Semantic Versioning](https://semver.org/).

## [1.6.0] - 2026-07-17

### Added
- **Editor mock for init, ads, and IAP.** In the Defold editor (any non-HTML5 build), `yes2sdk.*` calls now run against a functional mock instead of silent no-ops, so integrations are testable without bundling. `initialize` and `start_game` succeed; `ads_show_interstitial` / `ads_show_rewarded` play a timed mock flow (3s / 5s, matching the Unity SDK's Play Mode mock) and then fire the full callback sequence, so `before_ad` / `after_ad` pause-resume wiring and the `ad_viewed` reward path behave like a real ad; IAP works end to end with a sample catalog, any-product-id purchases, a session purchase list, and consume support. Failure modes are selectable in `game.project` under `[yes2sdk]`: `mock_rewarded_result = dismissed` tests the no-reward path, `mock_ad_result = nofill` fails ads, `mock_purchase_result = fail` fails purchases, and `mock = 0` disables the mock entirely. Previously ad callbacks only fired via the 30s watchdog (`no_fill`) and IAP callbacks never fired at all, permanently latching `iap_purchase` for the session. HTML5 bundles are unaffected and keep the loud missing-extension warning.

## [1.5.5] - 2026-07-08

### Added
- **Account dialog lifecycle events** — `on_account_dialog_open` and `on_account_dialog_close` fire when the platform's account-selection dialog opens and closes, so the game can pause and resume around it. Currently emitted on Yandex; other platforms simply never fire them.

## [1.5.4] - 2026-07-02

### Fixed
- **`player_get_name` / `player_get_id`** now resolve through Core's public player API instead of a private Core internal. Previously they reached into an underscore-prefixed Core member that no platform actually implements, so they always returned the `"Player"` / empty-string defaults; a Core refactor could also have broken them silently at runtime. They now prime a small identity cache from the public `getPlayer()` and return the real values. Because that call is async, the first invocation right after `initialize` may still return the default until the identity resolves — subsequent calls return the resolved value.

## [1.5.3] - 2026-07-02

### Added
- **Support checks for ads, auth, and player** — `ads_is_interstitial_supported()`, `ads_is_rewarded_supported()`, `auth_is_supported()`, and `player_is_data_supported()`. Games can now gate these optional features with a support check before use, matching the pattern already available on banners, score, friends, and the other modules. Each returns a boolean and `false` on platforms that don't support the feature (and when the extension isn't loaded).

## [1.5.2] - 2026-07-02

### Added
- **`analytics_log_event(event_name, params_json?)`** — log a custom, arbitrarily named analytics event. `params_json` is an optional JSON string of event parameters. On builds with a Yandex Metrica counter configured, custom events are delivered as `reachGoal(event_name, params)`. Brings Defold to parity with the other engines' generic event logging.

## [1.5.1] - 2026-06-29

Adds in-app purchases and signed player identity, completing parity for studios shipping a shop with consumable purchases on Yandex. Functional on platforms that expose a store; others report availability via `iap_is_supported()` and degrade gracefully.

### Added
- **In-app purchases** — `iap_get_catalog`, `iap_get_product`, `iap_purchase`, `iap_get_purchases`, `iap_consume_purchase`, `iap_is_supported`. Async results are delivered to the callback as JSON strings; verify purchases server-side.
- **`player_get_signed_info(payload, callback)`** — a cryptographically signed `{playerId, signature}` snapshot for server-side verification of purchases and identity.

## [1.5.0] - 2026-06-29

Yandex feature parity. Adds leaderboards, player stats, remote config, and a rating prompt, plus richer player/session APIs. Functional on Yandex; other platforms report availability via `*_is_supported()` and degrade gracefully.

### Added
- **Leaderboards** — `M.leaderboard_get`, `M.leaderboard_set_score`, `M.leaderboard_get_entries`, `M.leaderboard_get_player_entry`, `M.leaderboard_is_supported`. Async results are delivered to the callback as a JSON string.
- **Player stats** — `M.stats_get`, `M.stats_set`, `M.stats_increment`, `M.stats_is_supported` for server-side numeric counters. Map arguments are passed as JSON strings.
- **Remote config** — `M.config_get_flags(options_json, callback)` fetches platform feature flags (JSON map); returns your provided defaults on platforms without remote config. `M.config_is_supported`.
- **Rating prompt** — `M.review_can_review(callback)` and `M.review_request_review(callback)` show the platform's in-game rating prompt. `M.review_is_supported`.
- **Player identity** — `M.player_get_unique_id`, `M.player_get_ids_per_game`, `M.player_get_paying_status`, `M.player_get_mode`, `M.player_get_photo(size, callback)`.
- **`M.banners_get_status(callback)`** — whether a sticky banner is currently showing.
- **`M.game_get_server_time(callback)`** — tamper-proof server time where available (callback receives a number), local time otherwise.
- **`M.session_get_device_info()`** — synchronous; returns a JSON string with device type and form-factor flags (mobile / desktop / tablet / TV).

### Fixed
- Async bridge calls now route a synchronous failure (a platform method that throws instead of rejecting) to the callback's error path, so the Lua callback always fires instead of hanging.

## [1.4.0] - 2026-05-05

YouTube Playables certification readiness. Surfaces four new public lifecycle and audio-state APIs. Required for any Defold game shipping to YouTube — without these, games cannot satisfy YouTube cert integration requirements #14, #21, and #22.

### Added
- **`M.on_pause(callback)`** — subscribe to platform pause events. Required by YouTube cert (integration #21: "MUST pause all execution after onPause"). Callback signature: `function(self)`.
- **`M.on_resume(callback)`** — subscribe to platform resume events. Callback signature: `function(self)`.
- **`M.on_audio_enabled_change(callback)`** — subscribe to platform mute/unmute. Required by YouTube cert (integration #14: "MUST use isAudioEnabled and onAudioEnabledChange"). Callback signature: `function(self, enabled)` where `enabled` is a boolean.
- **`M.session_is_audio_enabled()`** — read current platform audio state. Required by YouTube cert (integration #14) so the game can set its initial mute state at startup. Returns `true` on platforms without a native signal (Poki, CrazyGames, Yandex, GameDistribution).

### Notes
- The lifecycle events fall back to `document.visibilitychange` for pause/resume on platforms without a native signal — so cross-platform pause works out of the box.
- Subscribe to lifecycle events AFTER `M.initialize()`'s callback fires. Subscribing earlier logs a console warning and the subscription is dropped.

## [1.3.0] - 2026-04-29

Brings the Defold SDK to feature parity with Yes2SDK Unity v2.2.0. Additive — no breaking changes.

### Added
- **Friends module** — new native extension files (`yes2sdk_friends.h`, `.cpp`, `lib_yes2sdk_friends.js`) exposing `friends_list_friends(page, size, callback)` and `friends_is_supported()`. Callback receives `(self, success, page_json)` where `page_json` is `{"friends":[{"username","id"}],"hasMore":bool}`.
- **`is_supported()` on optional modules** — `friends_is_supported()`, `banners_is_supported()`, `score_is_supported()`. Pair with the Optional APIs guard pattern in the README — gate UI before calling. Returns true on platforms that genuinely support the feature (CrazyGames for friends/banners; CrazyGames + Yandex + YouTube for score).
- **`ads_is_rewarded_ad_available()`** — best-effort readiness check; returns true while the platform's ad module is loaded. Treat as a UI hint — `ads_show_rewarded` can still fire `no_fill`.
- **`ads_is_ad_showing()`** — Lua-side flag tracking the in-flight state of `ads_show_interstitial` / `ads_show_rewarded`. The wrapper now rejects concurrent `ads_show_*` calls immediately and fires the rejected call's `no_fill` callback instead of letting two ad calls collide.
- **`analytics_log_level_end` `duration_seconds` parameter** — optional 4th argument. `nil` or negative value omits the field (the JS bridge passes `undefined` to the Core SDK). Useful for racing / time-attack games.

### Documentation
- README rewritten to mirror the structure of Yes2SDK Unity 2.2.0:
  - Version + Defold badges at the top.
  - Three-stage Quick Start (init at launch → loading → start_game when playable) with a "don't chain" callout.
  - Rewarded ad firing-order block: documents the Core SDK's order (`before_ad → ad_viewed/ad_dismissed/no_fill → after_ad`) and a "DO NOT grant rewards in `after_ad`" warning.
  - Concurrent-ad-guard + readiness recipe combining `ads_is_ad_showing()` + `ads_is_rewarded_ad_available()`.
  - Optional APIs section now uses `_is_supported()` guards for Friends/Banners/Score (mirrors Unity).
  - New "Running alongside other SDKs" section: init order, single-owner pause/resume, single-owner ads.
  - Analytics section shows the new `duration_seconds` argument.
- Build & Submit section trimmed; defers detailed flow to the dashboard upload UX.

### Notes
- Existing 3-arg callers of `analytics_log_level_end` keep working; the 4th arg defaults to `nil` (omitted).
- The Lua wrapper's no-op stub adds the new `_is_supported` / `_is_rewarded_ad_available` functions returning `false` so editor builds don't error.

## [1.2.3] - 2026-04-16

### Fixed
- **Ad callback errors crash entire ad flow** — WASM `RuntimeError` from game Lua callbacks (e.g. `null function`) propagated back through the SDK and broke the entire `showRewarded`/`showInterstitial` call. All 5 ad callback invocations (`beforeAd`, `afterAd`, `adDismissed`, `adViewed`, `noFill`) now wrapped with try-catch in the JS bridge. Errors are logged to console as `[Yes2SDK] <callback> callback error:` without killing the ad cycle.
- **`excluded_content.zip` docs incorrectly said "harmless"** — Corrected README to explain the 404 is only harmless when the game does not use Defold's Exclude Resources feature. Games that do use it will crash with `RuntimeError: null function` if the file is missing from the upload.

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
