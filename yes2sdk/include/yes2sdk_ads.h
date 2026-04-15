#pragma once

#include <dmsdk/sdk.h>

#if defined(DM_PLATFORM_HTML5)

class Yes2SDKAds
{
public:
    typedef void (*OnBeforeAdCallback)(const int success, const char* detail);
    typedef void (*OnAfterAdCallback)(const int success, const char* detail);
    typedef void (*OnAdDismissedCallback)(const int success, const char* detail);
    typedef void (*OnAdViewedCallback)(const int success, const char* detail);
    typedef void (*OnNoFillCallback)(const int success, const char* detail);

    static int ShowInterstitial(lua_State* L);
    static int ShowRewarded(lua_State* L);

private:
    static void OnBeforeAd(const int success, const char* detail);
    static void OnAfterAd(const int success, const char* detail);
    static void OnAdDismissed(const int success, const char* detail);
    static void OnAdViewed(const int success, const char* detail);
    static void OnNoFill(const int success, const char* detail);
};

extern "C"
{
    void Yes2SDK_ads_showInterstitial(const char* placement,
                                      Yes2SDKAds::OnBeforeAdCallback beforeAd,
                                      Yes2SDKAds::OnAfterAdCallback afterAd,
                                      Yes2SDKAds::OnNoFillCallback noFill);

    void Yes2SDK_ads_showRewarded(const char* placement,
                                   Yes2SDKAds::OnBeforeAdCallback beforeAd,
                                   Yes2SDKAds::OnAfterAdCallback afterAd,
                                   Yes2SDKAds::OnAdDismissedCallback adDismissed,
                                   Yes2SDKAds::OnAdViewedCallback adViewed,
                                   Yes2SDKAds::OnNoFillCallback noFill);
}

// Note: Callback signatures use (int, const char*) to match the "vii" makeDynCall
// pattern used by all other Defold JS bridges. Using "vi" (single int param) causes
// WASM call_indirect signature mismatch in Defold's Emscripten build.

#endif
