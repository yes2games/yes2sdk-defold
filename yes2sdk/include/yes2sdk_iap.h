#pragma once
#include <dmsdk/sdk.h>
#if defined(DM_PLATFORM_HTML5)
class Yes2SDKIap {
public:
    typedef void (*OnResultCallback)(const int success, const char* result);
    static int GetCatalog(lua_State* L);
    static int GetProduct(lua_State* L);
    static int Purchase(lua_State* L);
    static int GetPurchases(lua_State* L);
    static int ConsumePurchase(lua_State* L);
    static int IsSupported(lua_State* L);
private:
    static void OnGetCatalog(const int success, const char* result);
    static void OnGetProduct(const int success, const char* result);
    static void OnPurchase(const int success, const char* result);
    static void OnGetPurchases(const int success, const char* result);
    static void OnConsumePurchase(const int success, const char* result);
};
extern "C" {
    void Yes2SDK_iap_getCatalog(Yes2SDKIap::OnResultCallback callback);
    void Yes2SDK_iap_getProduct(const char* productId, Yes2SDKIap::OnResultCallback callback);
    void Yes2SDK_iap_purchase(const char* productId, const char* developerPayload, Yes2SDKIap::OnResultCallback callback);
    void Yes2SDK_iap_getPurchases(Yes2SDKIap::OnResultCallback callback);
    void Yes2SDK_iap_consumePurchase(const char* purchaseToken, Yes2SDKIap::OnResultCallback callback);
    int Yes2SDK_iap_isSupported();
}
#endif
