#pragma once
#include <dmsdk/sdk.h>
#include "yes2sdk_requests.h"
#if defined(DM_PLATFORM_HTML5)
class Yes2SDKReview {
public:
    static int CanReview(lua_State* L);
    static int RequestReview(lua_State* L);
    static int IsSupported(lua_State* L);
};
extern "C" {
    void Yes2SDK_review_canReview(int requestId, Yes2SDKRequests::OnCompleteCallback callback);
    void Yes2SDK_review_requestReview(int requestId, Yes2SDKRequests::OnCompleteCallback callback);
    int Yes2SDK_review_isSupported();
}
#endif
