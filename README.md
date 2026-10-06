# Yes2SDK for Defold

[![Version](https://img.shields.io/github/v/tag/yes2games/yes2sdk-defold?label=version)](https://github.com/yes2games/yes2sdk-defold/releases)
[![Defold](https://img.shields.io/badge/Defold-1.10.2%2B-blue)](https://defold.com/)

A single SDK for your Defold HTML5 game. Integrate once against Yes2SDK, submit through the Yes2Games Dashboard, and the Yes2Games team handles the rest.

## Requirements

- Defold 1.10.2 or newer — the oldest version `build.defold.com`, Defold's hosted extension build server, still compiles native extensions for. This SDK *is* a native extension, so on an older Defold the bundle fails at the build server with `HTTP 501 — Engine version '<sha>' is not supported on the current server`, whatever else your project does.

  Do not lower this number without first checking that the hosted server accepts the older SDK again. Defold prunes old SDKs from that server as new versions ship, so this floor moves up over time and never down. It is a floor of the hosted server rather than of the engine: Defold still publishes the older SDK archives, so a self-hosted extender may well build further back — untested here, and not something this SDK promises.
- HTML5 build target (the extension is HTML5-only — non-HTML5 platforms get a warn-and-no-op stub)

## Installation

### Via Git Dependency (recommended)

In your `game.project`, add:

```ini
[project]
dependencies#0 = https://github.com/yes2games/yes2sdk-defold/archive/refs/tags/v1.7.0.zip
```

Then in Defold Editor: **Project > Fetch Libraries**.

> Pinning the URL to a `tags/vX.Y.Z` ref keeps the resolved hash stable. Bump the tag when a newer release ships. **Don't use `/refs/heads/main.zip`** — branch archives are served less reliably by GitHub and `Fetch Libraries` fails intermittently.

### Channels

Two dependency URLs, and nothing else is a channel:

| Channel | Dependency URL | What it is |
| --- | --- | --- |
| production | `https://github.com/yes2games/yes2sdk-defold/archive/refs/tags/vX.Y.Z.zip` | An immutable release tag at an exact commit. Use this in a shipping game. |
| integration | `https://github.com/yes2games/yes2sdk-defold/archive/refs/tags/edge.zip` | A mutable `edge` tag that moves to the newest commit on `main` that passed required CI. Use it to test against unreleased changes. |

```ini
# production — pin a release
dependencies#0 = https://github.com/yes2games/yes2sdk-defold/archive/refs/tags/vX.Y.Z.zip

# integration — track the tested tip of main
dependencies#0 = https://github.com/yes2games/yes2sdk-defold/archive/refs/tags/edge.zip
```

`edge` is a Git tag and nothing more: there is no `edge` GitHub Release, no
prerelease, and no `edge-X.Y.Z`. It moves, so the resolved hash changes under you
and a stale Defold dependency cache can serve older bytes — re-fetch libraries
after clearing `.internal/lib` if `edge` looks behind. Never ship a game against
it.

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

### Lifecycle events (required)

The platform tells the game when to pause, when it may resume and when the player muted or unmuted audio. Some platforms reject a game that ignores these. Subscribe inside the `initialize` success callback: the events are not available before the SDK is ready.

```lua
yes2sdk.initialize(function(self, success, error)
    if not success then return end

    -- Initial audio state, then follow every change.
    set_game_audio(yes2sdk.session_is_audio_enabled())
    yes2sdk.on_audio_enabled_change(function(self, enabled)
        set_game_audio(enabled)
    end)

    yes2sdk.on_pause(function(self)
        pause_game()   -- stop the game loop, audio and network calls
    end)
    yes2sdk.on_resume(function(self)
        resume_game()  -- the game may continue
    end)

    -- The platform's account selection dialog (only some platforms show one).
    yes2sdk.on_account_dialog_open(function(self) pause_game() end)
    yes2sdk.on_account_dialog_close(function(self) resume_game() end)
end)
```

- `on_pause`: the game must stop its loop, audio and network calls until `on_resume`.
- `on_resume`: the game may continue. A resume is not guaranteed to follow every pause.
- `on_exit_requested`: on platforms that support it, the platform is about to close the game and the player has not confirmed leaving. Save synchronously inside the handler (for example with `data_set_string`): the SDK flushes player data right after it returns, and async work started there is not awaited. Register it after `initialize`, like the other events.
- `on_audio_enabled_change`: `enabled` is a boolean. Keep the game's audio in line with it, and read `session_is_audio_enabled()` once at startup for the initial state.
- `on_account_dialog_open` / `on_account_dialog_close`: pause while the dialog is open, resume when it closes. Platforms without such a dialog never fire them.
- Each callback runs once per platform event. Registering again for the same event replaces the previous callback.
- Register from a long-lived script (see [Callbacks and script lifetime](#callbacks-and-script-lifetime)).

### Ads (required)

Interstitial ads run at natural break points. Rewarded ads run only when the player opts in.

> **Always wrap ad calls in `session_gameplay_stop()` / `session_gameplay_start()`.** Platforms count "active gameplay seconds" for monetization: leaving gameplay running during an ad inflates those numbers and is grounds for rejection.

```lua
function show_interstitial(self)
    yes2sdk.session_gameplay_stop()

    yes2sdk.ads_show_interstitial("level-end",
        function(self) end,                                  -- before_ad: pause
        function(self) yes2sdk.session_gameplay_start() end, -- after_ad: resume
        function(self) end                                   -- no_fill: no ad, after_ad follows
    )
end

function show_rewarded(self)
    yes2sdk.session_gameplay_stop()

    yes2sdk.ads_show_rewarded("extra-life",
        function(self) end,                                       -- before_ad: pause
        function(self) yes2sdk.session_gameplay_start() end,      -- after_ad: resume
        function(self) end,                                       -- ad_dismissed: no reward
        function(self) grant_extra_life() end,                    -- ad_viewed: GRANT REWARD
        function(self) end                                        -- no_fill: no reward, after_ad follows
    )
end
```

#### Rewarded ad firing order

The callbacks fire in this order. Pay attention: getting it wrong silently breaks reward logic:

```text
before_ad     → pause game (fires when the ad starts; usually skipped on no_fill)
(ad shown)
ad_viewed     → grant reward (ONLY fires if the player watched the full ad)
   or
ad_dismissed  → no reward (fires if the player skipped/closed early)
   or
no_fill       → no ad available (fires if the platform couldn't deliver)
after_ad      → resume game (always, fires after the result, no_fill included)
```

Every rewarded ad ends with exactly one of `ad_viewed`, `ad_dismissed` or `no_fill`, then `after_ad`, and `after_ad` fires at most once:

- If the platform reports a second result for the same ad, the SDK drops it and logs a warning. The first result wins.
- If the platform sends `after_ad` without a result, the SDK calls `ad_dismissed` first (with a warning), then `after_ad`. It never calls `ad_viewed` on its own, so a reward is only granted when the platform says the ad was watched.
- An error raised inside one of your ad callbacks is logged as `[Yes2SDK] <name> callback error: ...` and does not stop the next callback, so an error in `ad_dismissed` still lets `after_ad` resume the game.
- `no_fill` is always followed by `after_ad`, for interstitials too: if the platform sends no `after_ad` by the next frame, the SDK calls it. Resume the game in `after_ad`. The one exception is a call rejected because another ad is already in flight: it gets `no_fill` only, since its `after_ad` would resume the game while the other ad is still on screen. That `no_fill` runs at once, inside the `ads_show_*` call, and with no arguments, so `self` is `nil` there.
- A watchdog covers ads that never report back. An ad that never starts gets `no_fill` and then `after_ad` after 30 s. An ad that stays on screen for 180 s gets `after_ad`, preceded by a synthesized `ad_dismissed` if it is rewarded.

> ⚠️ **Do NOT grant rewards in `after_ad`.** `after_ad` fires for completion, dismissal, and no-fill alike, so granting rewards there gives them away on skip. Always grant in `ad_viewed`.

#### Concurrent ad guard + readiness

- `yes2sdk.ads_is_ad_showing()`: returns `true` while a `ads_show_interstitial` or `ads_show_rewarded` is in flight (between the call and `after_ad`/`no_fill`). Calling `ads_show_*` again while one is already showing is rejected immediately and `no_fill` fires for the rejected call (no `after_ad` follows it). `ads_is_ad_showing()` is already `false` inside `no_fill`, so you can retry from there, or on the next frame. Retry only from the ad's own `no_fill`, and at most once: a rejected call's `no_fill` and the not-loaded path run synchronously inside `ads_show_*`, so retrying without a bound recurses until the stack overflows. A retry from inside `no_fill` receives the first ad's `after_ad` first, during the `ads_show_*` call.
- `yes2sdk.ads_is_rewarded_ad_available()`: best-effort check whether a rewarded ad appears available right now. Most platforms don't expose explicit readiness, so this returns `true` while the platform's ad module is loaded; the actual `ads_show_rewarded` call can still no-fill. Use it as a hint, not a guarantee.

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

Entry point data is whatever the player arrived with, for example from a shared link or after registering. It is always a table (empty when there is none, or on platforms that do not support it):

```lua
local entry = yes2sdk.session_get_entry_point_data()
if entry.invite then
    show_welcome(entry.invite)
end
```

> `analytics_log_level_start` / `_end` can also trigger gameplay start/stop on some platforms. Calling both pairs is safe: the SDK keeps a single owner of the gameplay state, so a start or stop that is already in effect is not sent twice.

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

#### Registration prompt

On platforms that support it, `auth_show_registration_prompt(options)` opens the platform's minimal registration overlay and you draw the rest of the prompt yourself. It returns a handle, or `nil` and an error JSON string (read it with `parse_error`):

```lua
if not yes2sdk.auth_is_authenticated() then
    -- save progress first (for example data_set_string_async, then data_flush)
    local prompt, err = yes2sdk.auth_show_registration_prompt({
        theme = "dark",
        message = "Join me in the game! {{registrationCode}} is my code.",
        data = { reward = "welcome_back" },
        on_close = function(self) hide_my_prompt_ui() end,
    })
    if prompt then
        -- wire your own buttons:
        --   prompt.login()  starts the platform login flow (the prompt stays open)
        --   prompt.close()  closes the prompt (on_close fires once)
    else
        print(yes2sdk.parse_error(err).code)
    end
end
```

- Guests only: a registered player gets `INVALID_OPERATION`. Use `auth_is_authenticated()` to tell registered players apart.
- Save the player's progress before showing the prompt.
- `message` is optional. It must contain `{{registrationCode}}` exactly once, with a space or punctuation around it, and be at most 140 characters; otherwise you get `INVALID_PARAM`.
- `data` comes back from `session_get_entry_point_data()` after the player registers.
- `on_close` runs once when the prompt closes, from `prompt.close()` or the platform's own close button. `login()` and `close()` return `false` once the prompt is closed.
- For a custom prompt, the platform's own login reminders must be turned off for the game. That is a per-game platform setting, not an SDK call.
- Platforms without a registration prompt return `FEATURE_NOT_SUPPORTED`.

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

### In-app purchases

Gate every purchase UI on `iap_is_supported()`. Product ids are the ones configured for your game on the platform.

```lua
-- Purchases waiting to be consumed. iap_consume_purchase takes one call at a
-- time, so they are consumed one by one: the next starts in the previous callback.
local consume_queue = {}
local consuming = false

local function consume_next()
    local purchase = table.remove(consume_queue, 1)
    consuming = purchase ~= nil
    if not purchase then return end
    yes2sdk.iap_consume_purchase(purchase.purchaseToken, function(self, success, error)
        if not success then
            -- Still unconsumed: iap_get_purchases returns it again on the next launch.
            print("Consume failed: " .. yes2sdk.parse_error(error).code)
        end
        consume_next()
    end)
end

local function finish_purchase(purchase)
    -- Grants are keyed by purchaseToken and saved with the progress, so a purchase
    -- whose consume failed is not granted a second time on the next launch.
    if not save_data.granted[purchase.purchaseToken] then
        grant_product(purchase.productId)              -- give the item
        save_data.granted[purchase.purchaseToken] = true
        save_progress()                                -- persist it BEFORE consuming
    end
    table.insert(consume_queue, purchase)
    if not consuming then consume_next() end
end

-- On launch, after initialize: finish purchases a previous session never completed.
if yes2sdk.iap_is_supported() then
    yes2sdk.iap_get_purchases(function(self, success, purchases_json)
        if success then
            for _, purchase in ipairs(json.decode(purchases_json)) do
                finish_purchase(purchase)
            end
        end
    end)
end

-- Buying goes through the same queue.
yes2sdk.iap_purchase("coins_100", nil, function(self, success, result)
    if success then
        finish_purchase(json.decode(result))
    elseif yes2sdk.parse_error(result).code ~= "IAP_PURCHASE_CANCELLED" then
        show_purchase_failed()
    end
end)
```

- **Finish incomplete purchases on launch.** A purchase can be paid for and then lost to a reload or a crash before the game granted it. `iap_get_purchases` returns every purchase that was not consumed yet; grant each one that was not granted before, then consume them one at a time.
- **Grant and save before consuming.** Consuming tells the platform the item was delivered. If the game consumes first and then fails to save, the player paid for nothing. Key saved grants by `purchaseToken`: a purchase whose consume failed comes back on the next launch and must not be granted twice.
- **Purchase JSON fields:** `purchaseToken` (pass it to `iap_consume_purchase`), `productId`, `paymentId`, `purchaseTime` (ISO 8601), `developerPayload` (when you passed one), and, where the platform provides them, `signedRequest` (for server verification) and `isSandbox` (`true` when no real money changed hands; grant the item as usual but keep it out of revenue reporting).
- **Verify server side.** For anything of value, send `signedRequest` to your own server and check it there. Never trust a purchase on the client alone.
- **One checkout at a time.** A second `iap_purchase` while one is open is rejected: it logs a warning and its callback is never called. The same applies to `iap_consume_purchase`. Wait for the callback before the next call, as the queue above does.
- The catalog: `iap_get_catalog(callback)` returns a JSON array of products (`productId`, `title`, `description`, `imageUri`, `price`, `priceCurrencyCode`, `priceAmount`); `iap_get_product(product_id, callback)` returns one product, or the literal `"null"` when the id is unknown.
- Failures carry an error code, see [Errors](#errors). In the editor, purchases run against a mock: `mock_purchase_result = fail` in `game.project` tests the failure path (see [Editor Testing](#editor-testing)).

### Leaderboard

```lua
if yes2sdk.leaderboard_is_supported() then
    yes2sdk.leaderboard_set_score("weekly", 1500, nil, function(self, success, entry_json)
        if success then
            local entry = json.decode(entry_json)
            print("Rank " .. entry.rank .. ", score " .. entry.formattedScore)
        end
    end)

    -- Top 10 entries (count, offset).
    yes2sdk.leaderboard_get_entries("weekly", 10, 0, function(self, success, entries_json)
        if success then
            for _, entry in ipairs(json.decode(entries_json)) do
                print(entry.rank, entry.playerName, entry.score)
            end
        end
    end)
end
```

`leaderboard_get(name, callback)` returns the leaderboard (`name`, `contextId`, `entries`). `leaderboard_get_player_entry(name, callback)` returns the player's own entry, or the literal `"null"` when the player is not ranked. The third argument of `leaderboard_set_score` is an optional metadata string (pass `nil` to omit).

### Stats

```lua
if yes2sdk.stats_is_supported() then
    yes2sdk.stats_increment(json.encode({ kills = 1 }), function(self, success, stats_json)
        if success then
            print("Kills: " .. json.decode(stats_json).kills)
        end
    end)

    yes2sdk.stats_get(json.encode({ "kills", "deaths" }), function(self, success, stats_json) end)
    yes2sdk.stats_set(json.encode({ deaths = 0 }), function(self, success, error) end)
end
```

### Remote config

```lua
if yes2sdk.config_is_supported() then
    local options = json.encode({ defaults = { new_shop = "false" } })
    yes2sdk.config_get_flags(options, function(self, success, flags_json)
        if success then
            local flags = json.decode(flags_json)
            enable_new_shop(flags.new_shop == "true")
        end
    end)
end
```

Flag values are strings. Pass `"{}"` when you have no options; options that are not valid JSON are treated as no options.

### Review

Ask for a rating at a positive moment, never in the middle of play.

```lua
if yes2sdk.review_is_supported() then
    yes2sdk.review_can_review(function(self, success, eligibility_json)
        if success and json.decode(eligibility_json).canReview then
            yes2sdk.review_request_review(function(self, success, result_json) end)
        end
    end)
end
```

---

## Callbacks and script lifetime

- Every async function except the `ads_show_*` calls takes a callback `function(self, success, result)`. Overlapping calls to the same function each get their own callback, with their own result. The exceptions: `iap_purchase`, `iap_consume_purchase` and the `ads_show_*` calls reject a second call while one is open, and `initialize` and `start_game` are called once per session.
- A call that fails at runtime is reported through its callback with `success == false` and an error string, not raised into your script; only wrong argument types raise. That includes a call the loaded SDK does not provide (see [Errors](#errors)).
- Call SDK functions from a long-lived script, for example the script of your main collection. The callback and the SDK's own timers belong to the script instance that made the call. A script in a collection proxy that gets unloaded, or that is paused with a time step of 0 while an ad is up, can miss its callbacks or delay the ad's release.
- If the script instance that made a call is deleted before the response arrives, the response is dropped and a warning is logged. Nothing runs against the deleted instance.

---

## Errors

> **Behaviour change:** failure strings used to be free text or a raw JSON dump of whatever the platform rejected with. Every failed callback now receives one JSON shape with a stable `code`. Code that compared or printed the old text should switch to `parse_error`.

When a callback reports `success == false`, its error argument is a JSON string with exactly three string fields:

```json
{"code":"IAP_PURCHASE_CANCELLED","message":"The player closed the checkout","context":"iap.purchaseAsync"}
```

- `code`: a stable identifier to branch on. It is the SDK's own code when the failure carries one, otherwise one of the fallbacks below.
- `message`: human readable text for logs. Do not match on it, it can change.
- `context`: the call that failed.

Fallback codes added by the extension itself:

| Code | Meaning |
|---|---|
| `NOT_INITIALIZED` | The SDK runtime (or the module behind the call) is not available, or the SDK is not initialized yet. |
| `FEATURE_NOT_SUPPORTED` | The loaded SDK does not provide this call, for example an older runtime without the method. |
| `INVALID_PARAM` | The arguments were rejected before the call was made, e.g. a JSON string that does not parse. |
| `UNKNOWN_ERROR` | Anything else. Check `message`. |

Common SDK codes games may branch on:

| Code | Meaning |
|---|---|
| `IAP_PURCHASE_CANCELLED` | The player closed the checkout without paying. Not an error to retry or report. |
| `IAP_PURCHASE_FAILED` | The purchase did not go through. |
| `IAP_ALREADY_PURCHASED` | The player already owns this product. |
| `IAP_NOT_AVAILABLE` | Purchases are not available right now. |
| `PLAYER_NOT_AUTHENTICATED` | The call needs a signed in player. |
| `FEATURE_NOT_SUPPORTED`, `PLATFORM_NOT_SUPPORTED` | Not available on this platform. |
| `NETWORK_FAILURE`, `TIMEOUT` | Transient, usually worth a later retry. |
| `INVALID_PARAM` | An argument was rejected. |
| `PLATFORM_ERROR` | The platform reported a failure. |

`yes2sdk.parse_error(err)` turns the error into a table `{ code = string, message = string, context = string }`. It never raises: a plain string that is not this JSON (for example from an older SDK) comes back as `code = "UNKNOWN_ERROR"` with the string as `message`, and `nil` gives an empty message.

```lua
yes2sdk.iap_purchase("coins_100", nil, function(self, success, result)
    if success then
        local purchase = json.decode(result)
        -- grant, then consume
    else
        local err = yes2sdk.parse_error(result)
        if err.code == "IAP_PURCHASE_CANCELLED" then
            -- the player changed their mind, nothing to report
        else
            print("Purchase failed: " .. err.code .. " (" .. err.message .. ")")
        end
    end
end)
```

---

## Integration Checklist

Your build is ready for review when:

- [ ] `initialize` is called at startup
- [ ] `set_loading_progress` is called as assets load (or you rely on the engine template's automatic download progress)
- [ ] `start_game` is called when the game is playable
- [ ] Interstitial ads run at natural break points
- [ ] Rewarded ads grant reward **only** in `ad_viewed`
- [ ] `session_gameplay_stop()` is called before every ad; `session_gameplay_start()` after
- [ ] Gameplay resumes in `after_ad` (`no_fill` is followed by `after_ad`)
- [ ] `data_*` functions are used for persistent player data
- [ ] Lifecycle events are handled: `on_pause` / `on_resume` pause and resume the game, `on_audio_enabled_change` follows the platform's mute state
- [ ] If the game sells items: incomplete purchases from `iap_get_purchases` are granted and consumed on launch

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
- `auth_show_registration_prompt` returns a handle: `login()` prints a line, `close()` fires `on_close` on the next frame
- Other modules keep the one-time-warning stub with sensible defaults

Configure the mock in `game.project` (all keys optional):

```ini
[yes2sdk]
mock = 0
mock_rewarded_result = dismissed
mock_ad_result = nofill
mock_purchase_result = fail
mock_entry_point_data = {"invite":"friend1"}
```

- `mock = 0` disables the mock entirely (old stub behavior). Default: enabled.
- `mock_rewarded_result = dismissed` makes rewarded ads fire `ad_dismissed` (no-reward path). Default: `viewed`.
- `mock_ad_result = nofill` makes ad calls fail with `no_fill`. Default: `normal`.
- `mock_entry_point_data` is a JSON object string returned by `session_get_entry_point_data()`. Default: `{}`.
- `mock_purchase_result = fail` makes `iap_purchase` fail with an `IAP_PURCHASE_FAILED` error (see [Errors](#errors)). Default: `success`.

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
dependencies#0 = https://github.com/yes2games/yes2sdk-defold/archive/refs/tags/v1.7.0.zip

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
