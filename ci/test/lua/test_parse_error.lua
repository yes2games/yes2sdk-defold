-- parse_error: every failure string the SDK hands to a callback is
-- {"code":"...","message":"...","context":"..."}. parse_error turns it (or any
-- older free-text string) into a table with three string fields, and never
-- raises.

local h = require("harness")

local T = {}

local function load()
  return h.load_wrapper{ native = h.fake_native() }
end

function T.json_error_is_parsed()
  local sdk = load()
  h.deep_eq(
    sdk.parse_error('{"code":"IAP_PURCHASE_CANCELLED","message":"closed","context":"iap.purchaseAsync"}'),
    { code = "IAP_PURCHASE_CANCELLED", message = "closed", context = "iap.purchaseAsync" })
end

function T.legacy_string_is_unknown_error_with_the_text_as_message()
  local sdk = load()
  h.deep_eq(sdk.parse_error("SDK not initialized"),
    { code = "UNKNOWN_ERROR", message = "SDK not initialized", context = "" })
end

function T.nil_is_unknown_error_with_an_empty_message()
  local sdk = load()
  h.deep_eq(sdk.parse_error(nil), { code = "UNKNOWN_ERROR", message = "", context = "" })
  h.deep_eq(sdk.parse_error(), { code = "UNKNOWN_ERROR", message = "", context = "" })
end

function T.malformed_json_is_kept_as_the_message()
  local sdk = load()
  h.deep_eq(sdk.parse_error('{"code":'), { code = "UNKNOWN_ERROR", message = '{"code":', context = "" })
  h.deep_eq(sdk.parse_error("42"), { code = "UNKNOWN_ERROR", message = "42", context = "" })
  h.deep_eq(sdk.parse_error("[1,2]"), { code = "UNKNOWN_ERROR", message = "[1,2]", context = "" })
end

function T.partial_json_fills_the_missing_fields()
  local sdk = load()
  h.deep_eq(sdk.parse_error('{"code":"TIMEOUT"}'), { code = "TIMEOUT", message = "", context = "" })
  h.deep_eq(sdk.parse_error('{"message":"m","context":5}'), { code = "UNKNOWN_ERROR", message = "m", context = "" })
  h.deep_eq(sdk.parse_error('{"code":"","message":"m"}'), { code = "UNKNOWN_ERROR", message = "m", context = "" })
end

function T.non_string_input_never_raises()
  local sdk = load()
  h.deep_eq(sdk.parse_error(12), { code = "UNKNOWN_ERROR", message = "12", context = "" })
  h.deep_eq(sdk.parse_error({ code = "X", message = "m" }), { code = "X", message = "m", context = "" })
  h.eq(sdk.parse_error(function() end).code, "UNKNOWN_ERROR")
end

function T.mock_purchase_failure_is_a_json_error()
  local sdk = h.load_wrapper{
    system_name = "Darwin",
    config = { ["yes2sdk.mock_purchase_result"] = "fail" },
  }
  local got
  sdk.iap_purchase("coins", nil, function(self, success, err) got = { success = success, err = err } end)
  h.advance(0)
  h.truthy(got, "the mock must complete the purchase")
  h.eq(got.success, false)
  local decoded = h.env.json.decode(got.err)
  h.deep_eq(decoded, { code = "IAP_PURCHASE_FAILED", message = "Simulated purchase failure (mock)", context = "iap.purchaseAsync" })
  h.deep_eq(sdk.parse_error(got.err), decoded)
end

return T
