#pragma once
#include <dmsdk/sdk.h>
#if defined(DM_PLATFORM_HTML5)
#include "yes2sdk_requests.h"
class Yes2SDKIap {
public:
    static int GetCatalog(lua_State* L);
    static int GetProduct(lua_State* L);
    static int Purchase(lua_State* L);
    static int GetPurchases(lua_State* L);
    static int ConsumePurchase(lua_State* L);
    static int IsSupported(lua_State* L);
};
extern "C" {
    void Yes2SDK_iap_getCatalog(int requestId, Yes2SDKRequests::OnCompleteCallback callback);
    void Yes2SDK_iap_getProduct(const char* productId, int requestId, Yes2SDKRequests::OnCompleteCallback callback);
    void Yes2SDK_iap_purchase(const char* productId, const char* developerPayload, int requestId, Yes2SDKRequests::OnCompleteCallback callback);
    void Yes2SDK_iap_getPurchases(int requestId, Yes2SDKRequests::OnCompleteCallback callback);
    void Yes2SDK_iap_consumePurchase(const char* purchaseToken, int requestId, Yes2SDKRequests::OnCompleteCallback callback);
    int Yes2SDK_iap_isSupported();
}
#endif
