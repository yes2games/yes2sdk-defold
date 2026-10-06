#include "yes2sdk_review.h"
#include "yes2sdk_requests.h"
#if defined(DM_PLATFORM_HTML5)
// Every async call registers its own request (callback + script instance) and passes
// the id through the JS bridge, so overlapping calls each complete their own callback.
int Yes2SDKReview::CanReview(lua_State* L) {
    int id = Yes2SDKRequests::Register(L, 1, "review_can_review");
    Yes2SDK_review_canReview(id, Yes2SDKRequests::Complete);
    return 0;
}
int Yes2SDKReview::RequestReview(lua_State* L) {
    int id = Yes2SDKRequests::Register(L, 1, "review_request_review");
    Yes2SDK_review_requestReview(id, Yes2SDKRequests::Complete);
    return 0;
}
int Yes2SDKReview::IsSupported(lua_State* L) {
    lua_pushboolean(L, Yes2SDK_review_isSupported());
    return 1;
}
#endif
