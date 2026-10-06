-- run.lua - Lua 5.1 test runner for the yes2sdk.lua wrapper.
--
-- Usage, from the repository root:
--   lua5.1 ci/test/lua/run.lua            run every ci/test/lua/test_*.lua
--   lua5.1 ci/test/lua/run.lua smoke      only files whose name contains "smoke"
--
-- A test file returns a table of named functions; each runs in isolation
-- (harness.reset() first, and every test loads its own wrapper instance), in
-- name order. Output is TAP-like. Exit status is non-zero when any test fails,
-- any file fails to load, or nothing ran at all (a suite that finds no tests
-- must not pass by vacuity). Set YES2_LUA_VERBOSE=1 to echo captured prints.
--
-- Lua 5.1 only: no goto, no //, no table.unpack, no bit ops.

local script = (arg and arg[0]) or "ci/test/lua/run.lua"
local dir = script:match("^(.*[/\\])") or "./"
local root = dir:gsub("ci[/\\]test[/\\]lua[/\\]$", "")
if root == dir then root = dir .. "../../../" end
if root == "" then root = "./" end

package.path = dir .. "?.lua;" .. dir .. "vendor/?.lua;" .. package.path

local h = require("harness")
h.root = root

local filter = arg and arg[1]

local function list_tests()
  local pipe = io.popen('ls "' .. dir .. '"')
  if not pipe then error("io.popen is unavailable; cannot discover test files") end
  local files = {}
  for name in pipe:lines() do
    if name:match("^test_.*%.lua$") and (not filter or name:find(filter, 1, true)) then
      files[#files + 1] = name
    end
  end
  pipe:close()
  table.sort(files)
  return files
end

local passed, failed, count = 0, 0, 0
local failures = {}

local function report(ok, label, detail)
  count = count + 1
  if ok then
    passed = passed + 1
    print("ok " .. count .. " - " .. label)
  else
    failed = failed + 1
    failures[#failures + 1] = label
    print("not ok " .. count .. " - " .. label)
    for line in tostring(detail):gmatch("[^\n]+") do
      print("    # " .. line)
    end
  end
end

local files = list_tests()
for _, file in ipairs(files) do
  local chunk, load_err = loadfile(dir .. file)
  local suite
  if chunk then
    local ok, result = pcall(chunk)
    if ok and type(result) == "table" then
      suite = result
    else
      load_err = ok and ("did not return a table of tests") or result
    end
  end
  if not suite then
    report(false, file .. " (load)", load_err)
  else
    local names = {}
    for name, fn in pairs(suite) do
      if type(fn) == "function" then names[#names + 1] = name end
    end
    table.sort(names)
    if #names == 0 then
      report(false, file .. " (no tests)", "the file returned no test functions")
    end
    for _, name in ipairs(names) do
      h.reset()
      local ok, err = xpcall(suite[name], debug.traceback)
      if ok then
        local stray = h.take_errors()
        if #stray > 0 then
          ok = false
          err = "uncaught error(s) in timer callbacks:\n" .. table.concat(stray, "\n")
        end
      end
      report(ok, file:gsub("%.lua$", "") .. ": " .. name, err)
    end
  end
end

print("1.." .. count)
print("# pass " .. passed)
print("# fail " .. failed)

if count == 0 then
  print("# no tests ran" .. (filter and (" for filter '" .. filter .. "'") or ""))
  os.exit(1)
end
if failed > 0 then
  for _, label in ipairs(failures) do print("# FAILED: " .. label) end
  os.exit(1)
end
os.exit(0)
