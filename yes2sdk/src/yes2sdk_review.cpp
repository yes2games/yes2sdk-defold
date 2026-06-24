#include "yes2sdk_review.h"
#include "luautils.h"
#if defined(DM_PLATFORM_HTML5)
lua_Listener onReviewCanReviewListener;
lua_Listener onReviewRequestReviewListener;

void Yes2SDKReview::OnCanReview(const int success, const char* result) {
    lua_State* L = onReviewCanReviewListener.m_L;
    if (!L) return;
    int top = lua_gettop(L);
    lua_pushlistener(L, onReviewCanReviewListener);
    lua_pushboolean(L, success);
    if (result) { lua_pushstring(L, result); } else { lua_pushnil(L); }
    int ret = lua_pcall(L, 3, 0, 0);
    if (ret != 0) { lua_pop(L, 1); }
    assert(top == lua_gettop(L));
}
void Yes2SDKReview::OnRequestReview(const int success, const char* result) {
    lua_State* L = onReviewRequestReviewListener.m_L;
    if (!L) return;
    int top = lua_gettop(L);
    lua_pushlistener(L, onReviewRequestReviewListener);
    lua_pushboolean(L, success);
    if (result) { lua_pushstring(L, result); } else { lua_pushnil(L); }
    int ret = lua_pcall(L, 3, 0, 0);
    if (ret != 0) { lua_pop(L, 1); }
    assert(top == lua_gettop(L));
}
int Yes2SDKReview::CanReview(lua_State* L) {
    luaL_checklistener(L, 1, onReviewCanReviewListener);
    Yes2SDK_review_canReview(Yes2SDKReview::OnCanReview);
    return 0;
}
int Yes2SDKReview::RequestReview(lua_State* L) {
    luaL_checklistener(L, 1, onReviewRequestReviewListener);
    Yes2SDK_review_requestReview(Yes2SDKReview::OnRequestReview);
    return 0;
}
int Yes2SDKReview::IsSupported(lua_State* L) {
    lua_pushboolean(L, Yes2SDK_review_isSupported());
    return 1;
}
#endif
