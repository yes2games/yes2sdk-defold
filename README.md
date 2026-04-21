# Yes2SDK for Defold

A single SDK for your Defold HTML5 game. Integrate once against Yes2SDK, submit through the Yes2Games Dashboard, and the Yes2Games team handles the rest.

## Quick Start

### 1. Add Dependency

In your `game.project`, add:

```ini
[project]
dependencies#0 = https://github.com/yes2games/yes2sdk-defold/archive/refs/tags/v1.2.1.zip
```

Then in Defold Editor: **Project > Fetch Libraries**

> **First time?** You must Fetch Libraries before `yes2sdk` is available in your scripts. Without it, `require "yes2sdk.yes2sdk"` will fail with "module not found".

> **Note:** Always use a tagged release URL (not `/refs/heads/main.zip`). Tagged archives are cached more reliably by GitHub and Defold's library fetcher.

### 2. Minimum Integration (Required)

These calls are **mandatory**. Without them the SDK is not considered integrated and the Yes2Games team can't accept your build.

```lua
function init(self)
    -- Step 1: Initialize the SDK
    yes2sdk.initialize(function(self, success, error)
        if not success then
            print("SDK init failed: " .. tostring(error))
            return
        end

        -- Step 2: Signal the game is playable
        yes2sdk.start_game(function(self, success, error)
            if success then
                -- Step 3: Start gameplay tracking
                yes2sdk.session_gameplay_start()
            end
        end)
    end)
end

function final(self)
    -- Always stop gameplay tracking on exit
    yes2sdk.session_gameplay_stop()
end
```

> **Important:** `start_game()` must only be called after `initialize()` succeeds. Always call it inside the initialize success callback. Calling it separately or before init completes causes undefined behavior.

### 3. Show Ads (Required)

**Interstitial** — show between levels, after game over, or at natural break points:

```lua
function show_interstitial(self)
    -- Always stop gameplay before showing ads
    yes2sdk.session_gameplay_stop()

    yes2sdk.ads_show_interstitial("level-complete",
        function(self)
            -- beforeAd: pause your game (mute audio, stop timers)
        end,
        function(self)
            -- afterAd: resume your game
            yes2sdk.session_gameplay_start()
        end,
        function(self)
            -- noFill: no ad available, resume immediately
            yes2sdk.session_gameplay_start()
        end
    )
end
```

**Rewarded** — show when the player chooses to watch (revive, double coins, etc):

```lua
function show_rewarded(self)
    yes2sdk.session_gameplay_stop()

    yes2sdk.ads_show_rewarded("revive",
        function(self)
            -- beforeAd: pause game
        end,
        function(self)
            -- afterAd: ad closed, resume
            yes2sdk.session_gameplay_start()
        end,
        function(self)
            -- adDismissed: user skipped, NO reward
            yes2sdk.session_gameplay_start()
        end,
        function(self)
            -- adViewed: user watched full ad, GRANT REWARD
            grant_revive()
        end,
        function(self)
            -- noFill: no ad available
            yes2sdk.session_gameplay_start()
        end
    )
end
```

## Full API Reference

### Core (Required)

| Function | Description |
|----------|-------------|
| `yes2sdk.initialize(callback)` | Initialize the SDK. **Must be called first.** Callback: `function(self, success, error)` |
| `yes2sdk.start_game(callback)` | Signal the game is playable. **Must be called after initialize.** Callback: `function(self, success, error)` |
| `yes2sdk.set_loading_progress(progress)` | Report loading progress (0-100). Call during asset loading. |

### Ads (Required)

| Function | Description |
|----------|-------------|
| `yes2sdk.ads_show_interstitial(placement, beforeAd, afterAd, noFill)` | Show interstitial ad. `placement` is a string like `"next-level"`. |
| `yes2sdk.ads_show_rewarded(placement, beforeAd, afterAd, adDismissed, adViewed, noFill)` | Show rewarded ad. Grant reward only in `adViewed`. |

### Session / Gameplay (Required)

| Function | Description |
|----------|-------------|
| `yes2sdk.session_gameplay_start()` | Call when the player starts actively playing. |
| `yes2sdk.session_gameplay_stop()` | Call when the player stops (menu, loading, before ads). |
| `yes2sdk.session_get_locale()` | Returns player's locale code (e.g. `"en"`, `"ja"`, `"ru"`). |

### Analytics

| Function | Description |
|----------|-------------|
| `yes2sdk.analytics_log_level_start(level_name)` | Log level start. |
| `yes2sdk.analytics_log_level_end(level_name, score, success)` | Log level end. `success`: `true`/`false`. |
| `yes2sdk.analytics_log_score(score [, level])` | Log a score. |
| `yes2sdk.analytics_log_tutorial_start()` | Log tutorial begin. |
| `yes2sdk.analytics_log_tutorial_end()` | Log tutorial complete. |
| `yes2sdk.analytics_log_game_choice(decision, choice)` | Log a player decision (e.g. `"character"`, `"wizard"`). |

### Data (Key-Value Storage)

Persists across sessions automatically.

| Function | Description |
|----------|-------------|
| `yes2sdk.data_get_int(key [, default])` | Get integer. Returns `default` (0) if not found. |
| `yes2sdk.data_set_int(key, value)` | Save integer. |
| `yes2sdk.data_get_float(key [, default])` | Get float. Returns `default` (0.0) if not found. |
| `yes2sdk.data_set_float(key, value)` | Save float. |
| `yes2sdk.data_get_string(key [, default])` | Get string. Returns `default` ("") if not found. |
| `yes2sdk.data_set_string(key, value)` | Save string. |
| `yes2sdk.data_has_key(key)` | Returns `true`/`false`. |
| `yes2sdk.data_delete_key(key)` | Delete a key. |
| `yes2sdk.data_delete_all()` | Delete all saved data. |

### Player (optional)

| Function | Description |
|----------|-------------|
| `yes2sdk.player_get_name()` | Returns player display name (anonymous if sign-in isn't available). |
| `yes2sdk.player_get_id()` | Returns player ID. |
| `yes2sdk.player_get_data(keys_json, callback)` | Get cloud player data. `keys_json`: JSON array string. Callback: `function(self, success, data_json)` |
| `yes2sdk.player_set_data(data_json, callback)` | Set cloud player data. `data_json`: JSON object string. Callback: `function(self, success, error)` |

### Auth (optional)

Not guaranteed to be available at runtime — calls resolve gracefully when unsupported.

| Function | Description |
|----------|-------------|
| `yes2sdk.auth_is_authenticated()` | Returns `true`/`false`. |
| `yes2sdk.auth_sign_in(callback)` | Trigger sign-in prompt. Callback: `function(self, success, error)` |

### Game (optional)

| Function | Description |
|----------|-------------|
| `yes2sdk.game_happy_time()` | Signal a "happy moment" (high score, level complete). |
| `yes2sdk.game_get_settings()` | Returns runtime settings as JSON string. |
| `yes2sdk.game_copy_to_clipboard(text)` | Copy text to clipboard. |
| `yes2sdk.game_invite_link(params_json, callback)` | Generate invite link. Callback: `function(self, success, url)` |

### Banners (optional)

| Function | Description |
|----------|-------------|
| `yes2sdk.banners_show(id, size)` | Show banner. `size`: `"728x90"`, `"300x250"`, etc. |
| `yes2sdk.banners_hide(id)` | Hide specific banner. |
| `yes2sdk.banners_hide_all()` | Hide all banners. |

### Score (optional)

| Function | Description |
|----------|-------------|
| `yes2sdk.score_add(score)` | Submit a score. |
| `yes2sdk.score_submit(encrypted)` | Submit encrypted score. |

## Integration Checklist

Your game **must** meet these requirements for the Yes2Games team to accept your build:

- [ ] `initialize()` is called at startup
- [ ] `set_loading_progress()` is called during loading
- [ ] `start_game()` is called when loading completes (inside the initialize success callback)
- [ ] Interstitial ads run at natural break points (level transitions, menus)
- [ ] Rewarded ads grant reward **only** in `adViewed`
- [ ] `session_gameplay_stop()` is called before every ad, `session_gameplay_start()` after
- [ ] Gameplay resumes in `afterAd` AND `noFill` callbacks
- [ ] No ads during active gameplay

The QA Inspector in the Yes2Games Dashboard validates all of this automatically.

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

### Loading Progress

The engine template automatically reports Defold's download progress to the loading screen — no Lua code needed for the initial load.

The `set_loading_progress(progress)` Lua function is for **game-specific loading** that happens after the engine starts (e.g. LiveUpdate content downloads, procedural generation, asset streaming). If your game has no post-engine loading phase, you don't need to call it.

> **Note:** Calling `set_loading_progress()` after `start_game()` has no visible effect — the loading screen is already dismissed by then.

## Build & Submit

1. **Build:** Project > Bundle > HTML5 Application > Create Bundle
2. **Zip** the output folder contents (the folder with `index.html`)
3. **Upload** the zip to the Yes2Games Dashboard
4. Run through the **QA Inspector** and confirm every check is green
5. **Request Review** — the Yes2Games team takes it from there

## Troubleshooting

### Fetch Libraries silently fails (no error, but library not found)

Defold requires a `game.project` file at the root of any library dependency. Without it, `Fetch Libraries` silently skips the archive — no error message, the library simply doesn't appear.

**This was a bug in Yes2SDK versions prior to v1.2.1.** The repo was missing the required `game.project` file.

**Fix:** Update your dependency to v1.2.1 or later:

```ini
[project]
dependencies#0 = https://github.com/yes2games/yes2sdk-defold/archive/refs/tags/v1.2.1.zip
```

Then clear the cache and retry:

1. Close Defold Editor
2. Delete `.internal/lib/` folder in your project directory
3. Reopen Defold Editor
4. `Project > Fetch Libraries`

### "Couldn't install the following dependencies" when fetching library

This usually happens when using a branch archive URL (`/refs/heads/main.zip`). GitHub serves these less reliably than tagged releases.

**Fix: Use a tagged release URL** (recommended)

```ini
# Good — tagged release (reliable)
dependencies#0 = https://github.com/yes2games/yes2sdk-defold/archive/refs/tags/v1.2.1.zip

# Bad — branch archive (intermittent failures)
dependencies#0 = https://github.com/yes2games/yes2sdk-defold/archive/refs/heads/main.zip
```

Then clear the cache and retry (see steps above).

**Fallback: Manual install**

If fetch still fails (e.g. network/firewall issues):

1. Download from [GitHub Releases](https://github.com/yes2games/yes2sdk-defold/releases/latest)
2. Extract the zip
3. Copy the `yes2sdk/` folder into your game project root
4. Your project should look like:
   ```
   your-game/
   ├── game.project
   ├── yes2sdk/          ← copy this folder here
   │   ├── ext.manifest
   │   ├── include/
   │   ├── src/
   │   └── lib/web/
   └── main/
   ```
5. Remove the dependency line from `game.project` (optional — won't conflict)
6. Close and reopen Defold Editor

### Extension not found (`yes2sdk` is nil)

The `yes2sdk` Lua module is nil at runtime. This means the native extension wasn't compiled into the HTML5 build.

**Cause:** You used `Project > Build` instead of `Project > Bundle`.

**Fix:** Always use **Project > Bundle > HTML5 Application > Create Bundle** for HTML5 builds. The regular Build command doesn't compile native extensions through the build cloud.

### `excluded_content.zip` 404 error in console

This is Defold's LiveUpdate feature looking for excluded content. If your project does **not** use Exclude Resources (the default), this 404 is harmless and can be ignored.

However, if your project **does** use Exclude Resources (`game.project` → `liveupdate.enabled`), this 404 means the excluded content was not uploaded alongside your game bundle. This causes missing resources at runtime and may result in `RuntimeError: null function` crashes when game code tries to access excluded assets. Make sure `excluded_content.zip` is included in your upload.

### Game plays but no SDK events in Inspector

1. Verify the extension is compiled: open the browser console and check for `[Yes2SDK]` log messages
2. If no logs appear, the extension wasn't included — see "Extension not found" above
3. Make sure your code calls `yes2sdk.initialize()` early (in `init()` of your main script)

## License

MIT
