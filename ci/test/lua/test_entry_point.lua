-- session_get_entry_point_data: decodes the native JSON string, tolerates junk,
-- and has an editor mock and a warn stub.

local h = require("harness")

local T = {}

local function wrapper_with(json_text)
  local fake = h.fake_native{ returns = { session_get_entry_point_data = json_text } }
  return h.load_wrapper{ native = fake }
end

function T.decodes_the_native_json()
  local sdk = wrapper_with('{"ref":"abc","level":3}')
  h.deep_eq(sdk.session_get_entry_point_data(), { ref = "abc", level = 3 })
end

function T.garbage_gives_an_empty_table()
  local sdk = wrapper_with("{not json")
  h.deep_eq(sdk.session_get_entry_point_data(), {})
end

function T.nil_gives_an_empty_table()
  local sdk = wrapper_with(nil)
  h.deep_eq(sdk.session_get_entry_point_data(), {})
end

function T.a_number_scalar_gives_an_empty_table()
  local sdk = wrapper_with("5")
  h.deep_eq(sdk.session_get_entry_point_data(), {})
end

function T.a_string_scalar_gives_an_empty_table()
  local sdk = wrapper_with('"x"')
  h.deep_eq(sdk.session_get_entry_point_data(), {})
end

function T.editor_mock_decodes_the_configured_json()
  local sdk = h.load_wrapper{
    system_name = "Darwin",
    config = { ["yes2sdk.mock_entry_point_data"] = '{"invite":"friend1"}' },
  }
  h.deep_eq(sdk.session_get_entry_point_data(), { invite = "friend1" })
end

function T.editor_mock_defaults_to_empty()
  local sdk = h.load_wrapper{ system_name = "Darwin" }
  h.deep_eq(sdk.session_get_entry_point_data(), {})
end

function T.editor_mock_ignores_bad_config()
  local sdk = h.load_wrapper{
    system_name = "Darwin",
    config = { ["yes2sdk.mock_entry_point_data"] = "7" },
  }
  h.deep_eq(sdk.session_get_entry_point_data(), {})
end

function T.warn_stub_returns_an_empty_table()
  local sdk = h.load_wrapper{ system_name = "HTML5" }
  h.deep_eq(sdk.session_get_entry_point_data(), {})
  h.truthy(h.printed("Extension not loaded"))
end

return T
