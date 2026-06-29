#pragma once
#include <dmsdk/sdk.h>
#if defined(DM_PLATFORM_HTML5)
class Yes2SDKReview {
public:
    typedef void (*OnResultCallback)(const int success, const char* result);
    static int CanReview(lua_State* L);
    static int RequestReview(lua_State* L);
    static int IsSupported(lua_State* L);
private:
    static void OnCanReview(const int success, const char* result);
    static void OnRequestReview(const int success, const char* result);
};
extern "C" {
    void Yes2SDK_review_canReview(Yes2SDKReview::OnResultCallback callback);
    void Yes2SDK_review_requestReview(Yes2SDKReview::OnResultCallback callback);
    int Yes2SDK_review_isSupported();
}
#endif
