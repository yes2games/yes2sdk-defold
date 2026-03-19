# Yes2SDK for Defold

Integrate your Defold HTML5 game with Poki, CrazyGames, Yandex, Game Distribution, and YouTube Playables — using a single API.

## Quick Start

### 1. Add Dependency

In your `game.project`, add:

```ini
[project]
dependencies#0 = https://github.com/yes2games/yes2sdk-defold/archive/refs/heads/main.zip
```

Then in Defold Editor: **Project > Fetch Libraries**

### 2. Minimum Integration (Required)

These calls are **mandatory** for all platforms. Your game will be rejected without them.

```lua
function init(self)
    -- Step 1: Initialize the SDK
    yes2sdk.initialize(function(self, success, error)
        if not success then
            print("SDK init failed: " .. tostring(error))
            return
        end

        -- Step 2: Signal game is ready to play
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

### 3. Show Ads (Required for Monetization)

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

**Rewarded** — show when player chooses to watch (revive, double coins, etc):

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

### Core (Mandatory)

| Function | Description |
|----------|-------------|
| `yes2sdk.initialize(callback)` | Initialize the SDK. **Must be called first.** Callback: `function(self, success, error)` |
| `yes2sdk.start_game(callback)` | Signal game is ready. **Must be called after initialize.** Callback: `function(self, success, error)` |
| `yes2sdk.set_loading_progress(progress)` | Report loading progress (0-100). Call during asset loading. |
| `yes2sdk.get_platform()` | Returns current platform name: `"poki"`, `"crazygames"`, `"yandex"`, `"debug"`, etc. |

### Ads (Mandatory for Monetization)

| Function | Description |
|----------|-------------|
| `yes2sdk.ads_show_interstitial(placement, beforeAd, afterAd, noFill)` | Show interstitial ad. `placement` is a string like `"next-level"`. |
| `yes2sdk.ads_show_rewarded(placement, beforeAd, afterAd, adDismissed, adViewed, noFill)` | Show rewarded ad. Grant reward only in `adViewed` callback. |

### Session / Gameplay (Mandatory for Poki & CrazyGames)

| Function | Description |
|----------|-------------|
| `yes2sdk.session_gameplay_start()` | Call when player starts actively playing. |
| `yes2sdk.session_gameplay_stop()` | Call when player stops (menu, loading, before ads). |
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

Persists across sessions. Uses `localStorage` on most platforms, cloud save on Yandex/YouTube.

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

### Player

| Function | Description |
|----------|-------------|
| `yes2sdk.player_get_name()` | Returns player display name (platform-dependent). |
| `yes2sdk.player_get_id()` | Returns player ID (platform-dependent). |
| `yes2sdk.player_get_data(keys_json, callback)` | Get cloud player data. `keys_json`: JSON array string. Callback: `function(self, success, data_json)` |
| `yes2sdk.player_set_data(data_json, callback)` | Set cloud player data. `data_json`: JSON object string. Callback: `function(self, success, error)` |

### Auth

| Function | Description |
|----------|-------------|
| `yes2sdk.auth_is_authenticated()` | Returns `true`/`false`. |
| `yes2sdk.auth_sign_in(callback)` | Trigger sign-in prompt. Callback: `function(self, success, error)` |

### Game

| Function | Description |
|----------|-------------|
| `yes2sdk.game_happy_time()` | Signal a happy moment (CrazyGames highlights). |
| `yes2sdk.game_get_settings()` | Returns platform game settings as JSON string. |
| `yes2sdk.game_copy_to_clipboard(text)` | Copy text to clipboard. |
| `yes2sdk.game_invite_link(params_json, callback)` | Generate invite link. Callback: `function(self, success, url)` |

### Banners

| Function | Description |
|----------|-------------|
| `yes2sdk.banners_show(id, size)` | Show banner. `size`: `"728x90"`, `"300x250"`, etc. |
| `yes2sdk.banners_hide(id)` | Hide specific banner. |
| `yes2sdk.banners_hide_all()` | Hide all banners. |

### Score

| Function | Description |
|----------|-------------|
| `yes2sdk.score_add(score)` | Submit a score to the platform. |
| `yes2sdk.score_submit(encrypted)` | Submit encrypted score (platform-specific). |

## Platform Compliance Checklist

Your game **must** implement these to pass platform review:

| Requirement | Poki | CrazyGames | Yandex | All |
|-------------|:----:|:----------:|:------:|:---:|
| `initialize()` + `start_game()` | Required | Required | Required | Required |
| `session_gameplay_start/stop()` | Required | Required | Recommended | Required |
| Interstitial ads between levels | Required | Required | Required | Required |
| Pause game during ads (`beforeAd`) | Required | Required | Required | Required |
| Resume game after ads (`afterAd`) | Required | Required | Required | Required |
| No ads during active gameplay | Required | Required | Required | Required |
| Rewarded ads grant reward only on `adViewed` | Required | Required | Required | Required |

## Build & Deploy

1. **Build:** Project > Bundle > HTML5 Application > Create Bundle
2. **Zip** the output folder contents (the folder with `index.html`)
3. **Upload** to Yes2SDK Dashboard (dashboard.yes2games.com)
4. **Test** in the Inspector — verify SDK events appear
5. **Bundle** for your target platform (Poki, CG, Yandex)
6. **Download** the platform-specific zip
7. **Upload** to the platform (inspector.poki.dev, CG developer portal, etc.)

## Example

See the `example/` folder for a minimal integration that demonstrates all core features.

## Supported Platforms

- Poki
- CrazyGames
- Yandex Games
- Game Distribution
- YouTube Playables

## License

MIT
