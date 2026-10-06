#include "yes2sdk_requests.h"
#if defined(DM_PLATFORM_HTML5)
#include <dmsdk/dlib/hashtable.h>

namespace Yes2SDKRequests {

struct Request {
    lua_Listener m_Listener;
    const char*  m_Name;
};

static const uint32_t MAX_ID = 0x7FFFFFFF; // JS ints are signed 32-bit
static const int32_t GROW_BY = 16;

static dmHashTable32<Request> s_Requests;
static uint32_t s_LastId = 0;

static uint32_t NextId() {
    // Wraps below 2^31, skips 0 and every live id. Terminates: live ids are far fewer than 2^31.
    do {
        s_LastId = (s_LastId >= MAX_ID) ? 1 : s_LastId + 1;
    } while (s_Requests.Get(s_LastId) != 0);
    return s_LastId;
}

int Register(lua_State* L, int idx, const char* name) {
    Request request;
    request.m_Name = name;
    luaL_checklistener(L, idx, request.m_Listener); // fresh listener: nothing to unref first
    if (s_Requests.Full()) {
        s_Requests.OffsetCapacity(GROW_BY);
    }
    uint32_t id = NextId();
    s_Requests.Put(id, request);
    return (int)id;
}

void Cancel(int requestId) {
    if (requestId <= 0) return;
    Request* found = s_Requests.Get((uint32_t)requestId);
    if (!found) return;
    Request request = *found;
    s_Requests.Erase((uint32_t)requestId);
    lua_unreflistener(request.m_Listener.m_L, request.m_Listener);
}

void Complete(const int requestId, const int success, const char* payload) {
    Request* found = requestId > 0 ? s_Requests.Get((uint32_t)requestId) : 0;
    if (!found) {
        dmLogWarning("[Yes2SDK] ignoring completion for unknown request %d (duplicate or stale)", requestId);
        return;
    }
    // Copy and erase first: the callback may start a new request, which can grow the table.
    Request request = *found;
    s_Requests.Erase((uint32_t)requestId);

    lua_State* L = request.m_Listener.m_L;
    int top = lua_gettop(L);
    lua_pushlistener(L, request.m_Listener);
    lua_pushboolean(L, success);
    if (payload) { lua_pushstring(L, payload); } else { lua_pushnil(L); }
    int ret = lua_pcall(L, 3, 0, 0);
    if (ret != 0) { lua_logpcallerror(L, request.m_Name); }
    assert(top == lua_gettop(L));

    lua_unreflistener(L, request.m_Listener);
}

void Reset() {
    if (s_Requests.Capacity() > 0) {
        s_Requests.Clear();
    }
}

} // namespace Yes2SDKRequests
#endif
