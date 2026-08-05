# Yes2SDK for Defold

[![Version](https://img.shields.io/github/v/tag/yes2games/yes2sdk-defold?label=version)](https://github.com/yes2games/yes2sdk-defold/releases)
[![Defold](https://img.shields.io/badge/Defold-1.6%2B-blue)](https://defold.com/)

A single SDK for your Defold HTML5 game. Integrate once against Yes2SDK, submit through the Yes2Games Dashboard, and the Yes2Games team handles the rest.

## Requirements

- Defold 1.6 or newer
- HTML5 build target (the extension is HTML5-only — non-HTML5 platforms get a warn-and-no-op stub)

## Installation

### Via Git Dependency (recommended)

In your `game.project`, add:

```ini
[project]
dependencies#0 = https://github.com/yes2games/yes2sdk-defold/archive/refs/tags/v1.6.0.zip
```

Then in Defold Editor: **Project > Fetch Libraries**.

> Pinning the URL with `tags/v1.6.0` keeps the resolved hash stable. Bump the tag when a newer release ships. **Don't use `/refs/heads/main.zip`** — branch archives are served less reliably by GitHub and `Fetch Libraries` fails intermittently.

### Via Local Copy

1. Download the latest release from [Releases](https://github.com/yes2games/yes2sdk-defold/releases/latest)
2. Copy the `yes2sdk/` folder into your project root:
   ```
   your-game/
   ├── game.project
   ├── yes2sdk/         ← copy here
   │   ├── ext.manifest
   │   ├── include/
   │   ├── src/
   │   ├── lib/web/
   │   └── yes2sdk.lua
   └── main/
   ```
3. Close and reopen Defold Editor.

---

## Quick Start

This is the **minimum integration** your game must have. The lifecycle has three distinct stages — don't chain them together:

```text
App launch         → yes2sdk.initialize       (SDK ready)
Splash + loading   → yes2sdk.set_loading_progress(0..100) as assets load
Game playable      → yes2sdk.start_game       (scene ready, accepting input)
```

```lua
local yes2sdk = require "yes2sdk.yes2sdk"

function init(self)
    -- Stage 1 — at app launch, initialize the SDK.
    yes2sdk.initialize(function(self, success, error)
        if not success then
            print("[Game] SDK init failed: " .. tostring(error))
            return
        end
        print("[Game] SDK ready")

        -- Stage 2 — load your assets and report progress (0..100).
        -- The Defold engine template reports DOWNLOAD progress automatically.
        -- Use set_loading_progress only for game-specific loading after the
        -- engine starts (LiveUpdate, procedural generation, asset streaming).

        -- Stage 3 — splash done, scene loaded, game is playable.
        yes2sdk.start_game(function(self, success, error)
            if success then
                yes2sdk.session_gameplay_start()
            end
        end)
    end)
end

function final(self)
    yes2sdk.session_gameplay_stop()
end
```

> **Don't call `start_game` directly inside the `initialize` success handler if you have a splash/loading phase.** The platform's loading bar treats `start_game` as "the game is playable now". For games with no post-engine loading phase, calling them back-to-back is fine (Defold's engine template handles the initial download progress for you).

Without this flow your game won't be accepted for review.

---

## Core API

Implement everything in this section. Together these cover what Yes2Games needs to validate and monetize your game.

### Lifecycle (required)

```lua
yes2sdk.initialize(function(self, success, error) ... end)   -- once at startup
yes2sdk.set_loading_progress(progress)                       -- 0..100 as assets load
yes2sdk.start_game(function(self, success, error) ... end)   -- when game is playable
```

> **Important:** these three calls fire in three distinct stages. `initialize` is at app launch. `set_loading_progress` is updated as your assets load. `start_game` runs **only when the game is actually playable** (splash gone, scene loaded, accepting input).

### Ads (required)

Interstitial ads run at natural break points. Rewarded ads run only when the player opts in.

> **Always wrap ad calls in `session_gameplay_stop()` / `session_gameplay_start()`.** Platforms count "active gameplay seconds" for monetization — leaving gameplay running during an ad inflates those numbers and is grounds for rejection.

```lua
function show_interstitial(self)
    yes2sdk.session_gameplay_stop()

    yes2sdk.ads_show_interstitial("level-end",
        function(self) end,                                  -- before_ad: pause
        function(self) yes2sdk.session_gameplay_start() end, -- after_ad: resume
        function(self) yes2sdk.session_gameplay_start() end  -- no_fill: resume immediately
    )
end

function show_rewarded(self)
    yes2sdk.session_gameplay_stop()

    yes2sdk.ads_show_rewarded("extra-life",
        function(self) end,                                       -- before_ad: pause
        function(self) yes2sdk.session_gameplay_start() end,      -- after_ad: resume
        function(self) yes2sdk.session_gameplay_start() end,      -- ad_dismissed: no reward
        function(self) grant_extra_life() end,                    -- ad_viewed: GRANT REWARD
        function(self) yes2sdk.session_gameplay_start() end       -- no_fill: resume
    )
end
```

#### Rewarded ad firing order

The callbacks fire in this order. Pay attention — getting it wrong silently breaks reward logic:

```text
before_ad     → pause game (always)
(ad shown)
ad_viewed     → grant reward (ONLY fires if the player watched the full ad)
   — or —
ad_dismissed  → no reward (fires if the player skipped/closed early)
   — or —
no_fill       → no ad available (fires if the platform couldn't deliver)
after_ad      → resume game (always — fires after the result)
```

> ⚠️ **Do NOT grant rewards in `after_ad`.** `after_ad` fires for completion, dismissal, and no-fill alike — granting rewards there gives them away on skip. Always grant in `ad_viewed`.

#### Concurrent ad guard + readiness

- `yes2sdk.ads_is_ad_showing()` — returns `true` while a `ads_show_interstitial` or `ads_show_rewarded` is in flight (between the call and `after_ad`/`no_fill`). Calling `ads_show_*` again while one is already showing is rejected immediately and `no_fill` fires for the rejected call.
- `yes2sdk.ads_is_rewarded_ad_available()` — best-effort check whether a rewarded ad appears available right now. Most platforms don't expose explicit readiness, so this returns `true` while the platform's ad module is loaded; the actual `ads_show_rewarded` call can still no-fill. Use it as a hint, not a guarantee.

```lua
local can_show_reward = not yes2sdk.ads_is_ad_showing()
                    and yes2sdk.ads_is_rewarded_ad_available()
gui.set_enabled(reward_button, can_show_reward)
```

### Session / Gameplay (required)

Tells Yes2Games when an active round begins and ends. Also call `session_gameplay_stop()` before any ad and `session_gameplay_start()` after.

```lua
yes2sdk.session_gameplay_start()
yes2sdk.session_gameplay_stop()

local locale = yes2sdk.session_get_locale()  -- e.g. "en", "ja", "ru"
```

> `analytics_log_level_start` / `_end` can also trigger gameplay start/stop on some platforms — use either pair, but don't call both.

### Data (required)

Key-value storage. Persists across sessions automatically.

```lua
yes2sdk.data_set_int("highScore", 9999)
yes2sdk.data_set_string("playerName", "Alice")
yes2sdk.data_set_float("volume", 0.75)

local score  = yes2sdk.data_get_int("highScore", 0)
local name   = yes2sdk.data_get_string("playerName", "Guest")
local volume = yes2sdk.data_get_float("volume", 1.0)

if yes2sdk.data_has_key("highScore") then
    yes2sdk.data_delete_key("highScore")
end
```

### Analytics (recommended)

```lua
yes2sdk.analytics_log_level_start("level-1")
yes2sdk.analytics_log_level_end("level-1", 1500, true)
-- Time-based games (racing, time-attack) can include duration:
yes2sdk.analytics_log_level_end("level-1", 1500, true, 87.3)
yes2sdk.analytics_log_score(9999)
yes2sdk.analytics_log_tutorial_start()
yes2sdk.analytics_log_tutorial_end()
yes2sdk.analytics_log_game_choice("character", "wizard")
-- Custom event with optional params (params as a JSON string):
yes2sdk.analytics_log_event("boss_defeated")
yes2sdk.analytics_log_event("boss_defeated", json.encode({ level = 3, time = 42.5 }))
```

> Custom events are delivered to Yandex Metrica as `reachGoal(event_name, params)` on builds with a Metrica counter configured; on other platforms they are logged through the SDK's analytics pipeline.

---

## Optional APIs

These modules add extra player-facing features. They are **not guaranteed** to be available at runtime — guard with a support check and handle the unsupported case gracefully. Don't make your core gameplay depend on them.

Support checks available: `ads_is_interstitial_supported()`, `ads_is_rewarded_supported()`, `auth_is_supported()`, `player_is_data_supported()`, `friends_is_supported()`, `banners_is_supported()`, `score_is_supported()`, `leaderboard_is_supported()`, `stats_is_supported()`, `config_is_supported()`, `review_is_supported()`, `iap_is_supported()`.

```lua
if yes2sdk.ads_is_rewarded_supported() then
    -- show a "Watch ad for reward" button
end
```

### Auth

```lua
if yes2sdk.auth_is_authenticated() then
    -- already signed in
else
    yes2sdk.auth_sign_in(function(self, success, error)
        if success then print("Signed in") end
    end)
end
```

### Friends

```lua
if yes2sdk.friends_is_supported() then
    yes2sdk.friends_list_friends(0, 10, function(self, success, page_json)
        if success then
            local page = json.decode(page_json)
            for _, friend in ipairs(page.friends) do
                print(friend.username, friend.id)
            end
        end
    end)
end
```

### Banners

```lua
if yes2sdk.banners_is_supported() then
    yes2sdk.banners_show("sidebar-left", "300x250")
    yes2sdk.banners_hide("sidebar-left")
    yes2sdk.banners_hide_all()
end
```

### Score

```lua
if yes2sdk.score_is_supported() then
    yes2sdk.score_add(9999)
    yes2sdk.score_submit("encrypted-score-string")
end
```

### Player Data (cloud)

```lua
yes2sdk.player_get_data(json.encode({"level"}), function(self, success, data_json)
    if success then
        local data = json.decode(data_json)
        print(data.level)
    end
end)

yes2sdk.player_set_data(json.encode({level = 5}), function(self, success, error) end)
```

### Game Extras

```lua
yes2sdk.game_happy_time()                         -- positive-moment signal
yes2sdk.game_copy_to_clipboard("https://...")
yes2sdk.game_invite_link(json.encode({roomId = "abc"}), function(self, success, url) end)
local settings_json = yes2sdk.game_get_settings()
```

> `game_happy_time()` signals to the platform that the player just hit a positive moment — level cleared, achievement unlocked, boss defeated. Some platforms (notably CrazyGames) use this to time monetization prompts so they don't interrupt frustrating moments. Call it sparingly, only on genuine highs.

---

## Integration Checklist

Your build is ready for review when:

- [ ] `initialize` is called at startup
- [ ] `set_loading_progress` is called as assets load (or you rely on the engine template's automatic download progress)
- [ ] `start_game` is called when the game is playable
- [ ] Interstitial ads run at natural break points
- [ ] Rewarded ads grant reward **only** in `ad_viewed`
- [ ] `session_gameplay_stop()` is called before every ad; `session_gameplay_start()` after
- [ ] Gameplay resumes in `after_ad` AND `no_fill`
- [ ] `data_*` functions are used for persistent player data

The QA Inspector in the Yes2Games Dashboard validates all of this automatically.

---

## Branded Loading Screen (Optional)

Yes2SDK includes a custom HTML5 template with an animated Yes2Games loading screen. To use it, add this to your `game.project`:

```ini
[html5]
custom_html_shell = /yes2sdk/html5/engine_template.html
```

This replaces the default Defold loading bar with:
- Animated Yes2Games logo with breathing glow effect
- Slim progress bar with shimmer animation
- Smooth fade-out when loading completes

The template automatically reports Defold's download progress to the loading screen — no Lua code needed for the initial load. `set_loading_progress(progress)` is for **game-specific loading** that happens after the engine starts (LiveUpdate, procedural generation, etc.).

> **Note:** Calling `set_loading_progress()` after `start_game()` has no visible effect — the loading screen is already dismissed by then.

---

## Build & Submit

1. **Build:** *Project > Bundle > HTML5 Application > Create Bundle*
2. **Zip** the output folder (the folder containing `index.html`)
3. **Upload** the zip to the [Yes2Games Dashboard](https://dashboard.yes2games.com)
4. The dashboard handles SDK injection, platform bundling, and walks you through the QA Inspector and review request.

> Always use **Project > Bundle** for HTML5, not **Project > Build**. The regular Build command doesn't compile native extensions through the build cloud.

---

## Editor Testing

The native extension is HTML5-only. In the Defold editor, `yes2sdk.*` calls run against a functional mock so you can test your integration without bundling:

- `initialize` / `start_game` succeed on the next frame
- **Ads play a timed mock flow** (3s interstitial, 5s rewarded) and then fire the full callback sequence, so pause-resume wiring in `before_ad` / `after_ad` and the reward path in `ad_viewed` are exercised like a real ad
- **IAP works end to end**: `iap_is_supported()` returns true, `iap_get_catalog` returns a sample catalog, `iap_purchase` accepts any product id and resolves with a realistic purchase payload, and `iap_get_purchases` / `iap_consume_purchase` operate on a session purchase list
- Other modules keep the one-time-warning stub with sensible defaults

Configure the mock in `game.project` (all keys optional):

```ini
[yes2sdk]
mock = 0
mock_rewarded_result = dismissed
mock_ad_result = nofill
mock_purchase_result = fail
```

- `mock = 0` disables the mock entirely (old stub behavior). Default: enabled.
- `mock_rewarded_result = dismissed` makes rewarded ads fire `ad_dismissed` (no-reward path). Default: `viewed`.
- `mock_ad_result = nofill` makes ad calls fail with `no_fill`. Default: `normal`.
- `mock_purchase_result = fail` makes `iap_purchase` fail. Default: `success`.

The mock is editor/desktop only. HTML5 bundles always use the real platform SDK, and a missing extension in an HTML5 build still prints the loud bundling warning. For richer simulation (specific locales, network conditions), use the QA Inspector in the Yes2Games Dashboard.

---

## Running alongside other SDKs

Real games often ship with multiple platform SDKs in the same build (Yes2SDK + Poki + Yandex + Playgama, etc.). A few ground rules to keep them from stepping on each other:

- **Init order.** Initialize Yes2SDK first. Yes2SDK figures out which actual platform is hosting the game and routes through it — initializing your own platform SDK directly first can race with Yes2SDK's detection.
- **One owner for pause / resume.** Pick one SDK to drive your game's pause state. If both Yes2SDK and another SDK call resume/pause via callbacks, you'll get oscillation. Recommended: handle pause/resume only via Yes2SDK's `ads_show_*` `before_ad` / `after_ad` callbacks.
- **One owner for ads.** Don't call ads via two SDKs in the same session — the platform almost always rejects the second call. Pick the SDK that targets the platform you're actually hosted on.

---

## Troubleshooting

### `yes2sdk` is nil at runtime

The native extension wasn't compiled. You used **Project > Build** instead of **Project > Bundle > HTML5 Application > Create Bundle**. Bundle compiles extensions through Defold's build cloud.

### "Couldn't install dependencies" when fetching the library

Use a tagged release URL, not a branch archive. GitHub serves tagged archives more reliably:

```ini
# Good — tagged release
dependencies#0 = https://github.com/yes2games/yes2sdk-defold/archive/refs/tags/v1.6.0.zip

# Bad — branch archive (intermittent failures)
dependencies#0 = https://github.com/yes2games/yes2sdk-defold/archive/refs/heads/main.zip
```

If it still fails, fall back to the local-copy install (see Installation > Via Local Copy).

### `excluded_content.zip` 404 in console

This is Defold's LiveUpdate feature looking for excluded content. If your project does **not** use Exclude Resources (the default), this 404 is harmless.

If your project **does** use Exclude Resources (`game.project` → `liveupdate.enabled`), this 404 means the excluded content was not uploaded alongside your game bundle. Include `excluded_content.zip` in your upload, or disable Exclude Resources and re-bundle.

### Game plays but no SDK events in the QA Inspector

1. Check the browser console for `[Yes2SDK]` log messages.
2. If no logs appear, the extension wasn't included — see "extension nil" above.
3. Make sure `yes2sdk.initialize()` is called early in `init()` of your main script.

---

## License

MIT — see [LICENSE](LICENSE).
