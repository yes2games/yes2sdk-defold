-- harness.lua - load yes2sdk/yes2sdk.lua against fake Defold globals and a
-- recording fake of the native yes2sdk module, then drive it frame by frame.
--
--   local h = require("harness")
--   local fake = h.fake_native{ returns = { get_platform = "poki" } }
--   local sdk = h.load_wrapper{ native = fake, system_name = "HTML5" }
--   sdk.ads_show_interstitial("menu", before, after, no_fill)
--   fake:fire("ads_show_interstitial", 2)   -- call the 2nd callback with (self)
--   h.advance(30)                           -- run 30 s of frames
--
-- load_wrapper returns a FRESH wrapper instance per call: the file is loaded
-- with loadfile into a private environment holding new stubs, so module state
-- (ad latch, in-flight flags, mock purchases) never leaks between tests.
-- Leaving `native` out loads the wrapper with no extension, which on a
-- non-HTML5 system_name is the editor mock path.
--
-- Errors raised inside timer callbacks do not stop the frame (Defold logs and
-- continues); they are collected and run.lua fails the test unless it took
-- them with h.take_errors().
--
-- Lua 5.1 only: no goto, no //, no table.unpack, no bit ops.

local stubs = require("stubs")

local h = {}

h.FRAME = 1 / 60
local EPSILON = 1e-9

h.root = "./"
h.wrapper_path = "yes2sdk/yes2sdk.lua"
h.native_source = "yes2sdk/src/yes2sdk.cpp"

local state

local function new_state(opts)
  return {
    clock = 0,
    frame = 0,
    timers = {},
    next_handle = 0,
    config = opts.config or {},
    system_name = opts.system_name or "HTML5",
    script = opts.script or { name = "fake script instance" },
    prints = {},
    errors = {},
    html5_runs = {},
    posts = {},
  }
end

--- Reset to an empty state. run.lua calls this before every test.
function h.reset()
  state = new_state({})
  h.state = state
end
h.reset()

-- -------------------------------------------------------------------------
-- Native module fake

local native_names_cache

--- The function names yes2sdk.cpp registers in Module_methods, in order.
function h.native_names()
  if native_names_cache then return native_names_cache end
  local file = assert(io.open(h.root .. h.native_source, "r"), "cannot open " .. h.native_source)
  local source = file:read("*a")
  file:close()
  local body = source:match("Module_methods%[%]%s*=%s*(%b{})")
  assert(body, "Module_methods table not found in " .. h.native_source)
  local names = {}
  for name in body:gmatch('{%s*"([%w_]+)"%s*,') do
    names[#names + 1] = name
  end
  assert(#names > 0, "Module_methods in " .. h.native_source .. " lists no functions")
  native_names_cache = names
  return names
end

local Fake = {}
Fake.__index = Fake

--- A recording fake of the native module.
-- opts.returns   { name = value | function(...) } return value of a native call
-- opts.overrides { name = function(...) } full replacement (still recorded)
-- opts.missing   { "name", ... } leave these out, as a broken build would
-- Every other registered name records the call and returns nil. Indexing a
-- name the extension does not register raises, so a wrapper typo is caught.
-- That also means feature detection (`if yes2sdk.some_fn then`) raises, unlike
-- a real module where it is nil. Pass `lenient = true` to get nil for unknown
-- names instead, for a test that exercises such a guard.
function h.fake_native(opts)
  opts = opts or {}
  local fake = setmetatable({ calls = {} }, Fake)
  local module = {}
  local missing = {}
  for _, name in ipairs(opts.missing or {}) do missing[name] = true end
  local returns = opts.returns or {}
  local overrides = opts.overrides or {}

  for _, name in ipairs(h.native_names()) do
    if not missing[name] then
      module[name] = function(...)
        local call = { name = name, n = select("#", ...), args = { ... } }
        fake.calls[#fake.calls + 1] = call
        if overrides[name] then return overrides[name](...) end
        local r = returns[name]
        if type(r) == "function" then return r(...) end
        return r
      end
    end
  end
  setmetatable(module, {
    __index = function(_, key)
      if opts.lenient then return nil end
      error("fake native: yes2sdk." .. tostring(key) .. " is not a registered native function", 2)
    end,
  })
  fake.module = module
  return fake
end

--- Every recorded call to `name`, oldest first.
function Fake:calls_to(name)
  local out = {}
  for _, call in ipairs(self.calls) do
    if call.name == name then out[#out + 1] = call end
  end
  return out
end

--- The most recent call to `name`, or nil.
function Fake:last(name)
  local list = self:calls_to(name)
  return list[#list]
end

--- The index-th function argument (1-based, counting functions only) of the
-- last call to `name`.
function Fake:callback(name, index)
  local call = self:last(name)
  assert(call, "fake native: yes2sdk." .. name .. " was never called")
  local seen = 0
  for i = 1, call.n do
    if type(call.args[i]) == "function" then
      seen = seen + 1
      if seen == (index or 1) then return call.args[i] end
    end
  end
  error("fake native: call to yes2sdk." .. name .. " has no function argument #" .. tostring(index or 1), 2)
end

--- Fire a stored callback the way the extension does: (self, ...).
function Fake:fire(name, index, ...)
  return self:callback(name, index)(state.script, ...)
end

-- -------------------------------------------------------------------------
-- Loading the wrapper

--- opts.native       a h.fake_native() result, or any table used as `yes2sdk`
-- opts.system_name   sys.get_sys_info().system_name (default "HTML5")
-- opts.config        game.project values keyed "section.key"
-- opts.script        the fake script instance passed as self (default: a table)
function h.load_wrapper(opts)
  opts = opts or {}
  state = new_state(opts)
  h.state = state

  local env = stubs.new(state)
  local native = opts.native
  if type(native) == "table" and rawget(native, "module") ~= nil then
    native = native.module
  end
  env.yes2sdk = native or nil
  setmetatable(env, { __index = _G })

  local chunk, err
  if opts.internals then
    -- Test-only seam: expose chosen file-level locals without adding anything
    -- to the public module. The single trailing `return M` becomes
    -- `return M, { name = name, ... }`; same chunk name keeps error lines.
    local f, ferr = io.open(h.root .. h.wrapper_path, "rb")
    if not f then error("cannot read wrapper: " .. tostring(ferr), 2) end
    local src = f:read("*a")
    f:close()
    local pairs_src = {}
    for _, name in ipairs(opts.internals) do
      pairs_src[#pairs_src + 1] = name .. " = " .. name
    end
    local replaced, count = src:gsub("\nreturn M%s*$", function()
      return "\nreturn M, { " .. table.concat(pairs_src, ", ") .. " }\n"
    end)
    assert(count == 1, "expected exactly one trailing 'return M', found " .. count)
    chunk, err = loadstring(replaced, "@" .. h.wrapper_path)
  else
    chunk, err = loadfile(h.root .. h.wrapper_path)
  end
  if not chunk then error("cannot load wrapper: " .. tostring(err), 2) end
  setfenv(chunk, env)
  local module, internals = chunk()
  h.env = env
  return module, internals
end

--- Load a fresh wrapper and also return the named file-level locals:
--   local sdk, i = h.load_internals({ native = fake }, { "encode_options" })
-- names defaults to the shared option helpers. Test-only.
function h.load_internals(opts, names)
  opts = opts or {}
  local copy = {}
  for k, v in pairs(opts) do copy[k] = v end
  copy.internals = names or { "encode_options", "fail_async", "invalid_param" }
  return h.load_wrapper(copy)
end

-- -------------------------------------------------------------------------
-- Clock

--- Run one frame of dt seconds. Timers created during this frame wait for the
-- next one, matching Defold.
function h.step(dt)
  dt = dt or h.FRAME
  state.frame = state.frame + 1
  state.clock = state.clock + dt
  local snapshot = {}
  for i, t in ipairs(state.timers) do snapshot[i] = t end
  for _, t in ipairs(snapshot) do
    local alive = false
    for _, live in ipairs(state.timers) do
      if live == t then alive = true break end
    end
    if alive then
      t.remaining = t.remaining - dt
      if t.remaining <= EPSILON then
        local elapsed = state.clock - t.last_fire
        t.last_fire = state.clock
        if t.repeating then
          t.remaining = t.remaining + t.delay
          if t.remaining < 0 then t.remaining = 0 end
        else
          h.env.timer.cancel(t.handle)
        end
        local ok, cb_err = pcall(t.callback, t.self, t.handle, elapsed)
        if not ok then
          state.errors[#state.errors + 1] = "timer callback: " .. tostring(cb_err)
        end
      end
    end
  end
end

--- Advance the clock by `seconds`, frame by frame (frame_dt default 1/60).
-- advance(0) still runs a single frame, so next-frame timers fire.
function h.advance(seconds, frame_dt)
  frame_dt = frame_dt or h.FRAME
  seconds = seconds or 0
  local frames = math.max(1, math.floor(seconds / frame_dt + 0.5))
  for _ = 1, frames do h.step(frame_dt) end
end

function h.now() return state.clock end
function h.pending_timers() return #state.timers end
function h.prints() return state.prints end

--- Return and clear the errors raised inside timer callbacks.
function h.take_errors()
  local errors = state.errors
  state.errors = {}
  return errors
end

--- True when some captured print line contains `needle` (plain find).
function h.printed(needle)
  for _, line in ipairs(state.prints) do
    if line:find(needle, 1, true) then return true end
  end
  return false
end

-- -------------------------------------------------------------------------
-- Assertions

local function fail(message, level)
  error(message, (level or 1) + 2)
end

function h.eq(actual, expected, message)
  if actual ~= expected then
    fail((message and (message .. ": ") or "") .. "expected " .. stubs.serialize(expected) .. ", got " .. stubs.serialize(actual))
  end
end

function h.truthy(value, message)
  if not value then fail(message or ("expected a truthy value, got " .. tostring(value))) end
end

function h.falsy(value, message)
  if value then fail(message or ("expected a falsy value, got " .. tostring(value))) end
end

function h.deep_eq(actual, expected, message)
  local a, e = stubs.serialize(actual), stubs.serialize(expected)
  if a ~= e then
    fail((message and (message .. ": ") or "") .. "expected " .. e .. ", got " .. a)
  end
end

function h.match(text, pattern, message)
  if type(text) ~= "string" or not text:find(pattern) then
    fail((message and (message .. ": ") or "") .. "expected " .. stubs.serialize(text) .. " to match " .. pattern)
  end
end

--- Run fn and require it to fail. Returns the error message. Lets the suite
-- prove an assertion really fires without turning the run red.
function h.expect_failure(fn, message)
  local ok, err = pcall(fn)
  if ok then fail(message or "expected a failure, but the function passed") end
  return tostring(err)
end

return h
