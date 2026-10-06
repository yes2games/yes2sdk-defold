#pragma once
#include <dmsdk/sdk.h>
#if defined(DM_PLATFORM_HTML5)
#include "luautils.h"

// Request router: one Lua callback per call, keyed by an integer id that crosses
// the JS bridge and comes back with the response, so overlapping calls of the same
// function each complete their own callback exactly once.
namespace Yes2SDKRequests {
    // Signature of the completion the JS bridge calls ("viii"): payload may be null (nil in Lua).
    typedef void (*OnCompleteCallback)(const int requestId, const int success, const char* payload);

    // Refs the Lua function at idx (raises a Lua error if it is not a function) and the
    // calling script instance, and returns a new id in [1, 2^31 - 1] not held by any live
    // request. `name` is the public Lua function name (e.g. "iap_get_catalog"), used in the
    // error log when the callback raises. It must be a string literal or otherwise outlive
    // the request: it is stored, not copied.
    // Call it after every other argument check, since a failing luaL_check* would leak the refs.
    int Register(lua_State* L, int idx, const char* name);

    // Drops a request that will never complete (unrefs and erases). Unknown ids are ignored.
    void Cancel(int requestId);

    // Called from JS. Unknown id (duplicate or stale completion) -> dmLogWarning, nothing else.
    // Otherwise erases the entry BEFORE invoking, so a call started inside the callback works,
    // calls the callback with (self, success boolean, payload string or nil) under lua_pcall,
    // logs a raised error with the request's name, then unrefs the callback and instance.
    void Complete(const int requestId, const int success, const char* payload);

    // Forgets every pending request without touching Lua (the Lua state is going away).
    // Called when the extension finalizes, so a late completion after a reboot is ignored.
    void Reset();
}
#endif
