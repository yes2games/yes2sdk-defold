-- stubs.lua - fakes for the Defold engine globals that yes2sdk/yes2sdk.lua uses.
--
-- One call to stubs.new(state) builds a fresh set bound to one harness state
-- (manual clock, timer list, config table, captured output). Nothing here is
-- global: harness.load_wrapper places these into the private environment of a
-- freshly loaded wrapper chunk, so two loads never share timers or config.
--
-- JSON is backed by vendor/dkjson.lua, dkjson 2.8 by David Heiko Kolf (MIT,
-- license header kept in the file), fetched from
-- http://dkolf.de/dkjson-lua/dkjson-2.8.lua
-- (sha256 eb3bf160688fb395a2db6bc52eeff4f7855a6321d2b41bdc754554d13f4e7d44).
--
-- Lua 5.1 only: no goto, no //, no table.unpack, no bit ops.

local dkjson = require("dkjson")

local stubs = {}

local function serialize(value, seen)
  seen = seen or {}
  if type(value) == "string" then
    return string.format("%q", value)
  end
  if type(value) ~= "table" then
    return tostring(value)
  end
  if seen[value] then
    return "<cycle>"
  end
  seen[value] = true
  local keys = {}
  for k in pairs(value) do
    keys[#keys + 1] = k
  end
  table.sort(keys, function(a, b) return tostring(a) < tostring(b) end)
  local parts = {}
  for _, k in ipairs(keys) do
    parts[#parts + 1] = tostring(k) .. " = " .. serialize(value[k], seen)
  end
  return "{ " .. table.concat(parts, ", ") .. " }"
end
stubs.serialize = serialize

local function join_args(...)
  local parts = {}
  for i = 1, select("#", ...) do
    parts[i] = tostring((select(i, ...)))
  end
  return table.concat(parts, "\t")
end

function stubs.new(state)
  local env = {}

  -- print / pprint: captured, echoed only when YES2_LUA_VERBOSE is set.
  local verbose = os.getenv("YES2_LUA_VERBOSE")
  env.print = function(...)
    local line = join_args(...)
    state.prints[#state.prints + 1] = line
    if verbose then io.stdout:write("    | " .. line .. "\n") end
  end
  env.pprint = function(...)
    local parts = {}
    for i = 1, select("#", ...) do
      parts[i] = serialize((select(i, ...)))
    end
    env.print(table.concat(parts, "\t"))
  end

  -- sys: system name and game.project config come from the harness state.
  local function config_value(key, default)
    local value = state.config[key]
    if value == nil then return default end
    return value
  end
  env.sys = {
    get_sys_info = function()
      return {
        system_name = state.system_name,
        device_model = "harness",
        manufacturer = "harness",
        language = "en",
        device_language = "en",
        territory = "US",
      }
    end,
    get_engine_info = function()
      return { version = "1.13.1", version_sha1 = "harness", is_debug = true }
    end,
    get_config_string = function(key, default)
      local value = config_value(key, default)
      if value == nil then return nil end
      return tostring(value)
    end,
    get_config_int = function(key, default)
      local value = config_value(key, default)
      return tonumber(value) or default or 0
    end,
    get_config_number = function(key, default)
      local value = config_value(key, default)
      return tonumber(value) or default or 0
    end,
    -- Deprecated in Defold but still referenced as a fallback by the wrapper.
    get_config = function(key, default)
      local value = config_value(key, default)
      if value == nil then return nil end
      return tostring(value)
    end,
  }

  -- timer: manual clock. Callbacks get (self, handle, time_elapsed) like Defold,
  -- with self being the script instance current when the timer was created.
  env.timer = {
    INVALID_TIMER_HANDLE = 0,
    delay = function(delay, repeating, callback)
      if type(delay) ~= "number" or delay < 0 or type(callback) ~= "function" then
        error("timer.delay: bad arguments (" .. tostring(delay) .. ", " .. tostring(repeating) .. ", " .. tostring(callback) .. ")", 2)
      end
      state.next_handle = state.next_handle + 1
      local t = {
        handle = state.next_handle,
        delay = delay,
        repeating = repeating and true or false,
        callback = callback,
        remaining = delay,
        self = state.script,
        last_fire = state.clock,
        created_frame = state.frame,
      }
      state.timers[#state.timers + 1] = t
      return t.handle
    end,
    cancel = function(handle)
      for i, t in ipairs(state.timers) do
        if t.handle == handle then
          table.remove(state.timers, i)
          return true
        end
      end
      return false
    end,
    get_info = function(handle)
      for _, t in ipairs(state.timers) do
        if t.handle == handle then
          return { time_remaining = t.remaining, delay = t.delay, repeating = t.repeating }
        end
      end
      return nil
    end,
  }

  -- json: dkjson with Defold's failure semantics (decode raises on bad input).
  -- Empty tables: dkjson encodes a plain {} as "[]" (Defold behaviour not
  -- verified here); build an object explicitly if a test needs "{}".
  env.json = {
    null = dkjson.null,
    encode = function(value, options)
      local ok, result = pcall(dkjson.encode, value, options)
      if not ok then error("json.encode: " .. tostring(result), 2) end
      if result == nil then error("json.encode: value cannot be encoded", 2) end
      return result
    end,
    decode = function(text, options)
      if type(text) ~= "string" then
        error("json.decode: expected a string, got " .. type(text), 2)
      end
      -- Explicit nils for the two metatable args: Defold returns plain tables,
      -- dkjson would otherwise tag them with __jsontype metatables.
      local value, _, err = dkjson.decode(text, 1, nil, nil, nil)
      if err then error("json.decode: " .. tostring(err), 2) end
      return value
    end,
  }

  -- html5 / msg / hash: recorded so a test can assert on them.
  env.html5 = {
    run = function(code)
      state.html5_runs[#state.html5_runs + 1] = code
      return ""
    end,
    set_interaction_listener = function(callback)
      state.interaction_listener = callback
    end,
  }
  env.hash = function(value)
    return "hash: [" .. tostring(value) .. "]"
  end
  env.msg = {
    post = function(receiver, message_id, message)
      state.posts[#state.posts + 1] = { receiver = receiver, message_id = message_id, message = message }
    end,
    url = function(socket, path, fragment)
      return tostring(socket or "") .. ":" .. tostring(path or "") .. "#" .. tostring(fragment or "")
    end,
  }

  return env
end

return stubs
