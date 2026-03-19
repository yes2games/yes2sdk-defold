#pragma once

#include <dmsdk/sdk.h>

#if defined(DM_PLATFORM_HTML5)

class Yes2SDKAds
{
public:
    typedef void (*OnBeforeAdCallback)(const int success);
    typedef void (*OnAfterAdCallback)(const int success);
    typedef void (*OnAdDismissedCallback)(const int success);
    typedef void (*OnAdViewedCallback)(const int success);
    typedef void (*OnNoFillCallback)(const int success);

    static int ShowInterstitial(lua_State* L);
    static int ShowRewarded(lua_State* L);

private:
    static void OnBeforeAd(const int success);
    static void OnAfterAd(const int success);
    static void OnAdDismissed(const int success);
    static void OnAdViewed(const int success);
    static void OnNoFill(const int success);
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

#endif
