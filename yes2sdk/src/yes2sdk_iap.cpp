#include "yes2sdk_iap.h"
#include "yes2sdk_requests.h"
#if defined(DM_PLATFORM_HTML5)
// Every async call registers its own request (callback + script instance) and passes
// the id through the JS bridge, so overlapping calls each complete their own callback.
// Register comes after the argument checks so a bad argument cannot leak a request.
int Yes2SDKIap::GetCatalog(lua_State* L) {
    int id = Yes2SDKRequests::Register(L, 1, "iap_get_catalog");
    Yes2SDK_iap_getCatalog(id, Yes2SDKRequests::Complete);
    return 0;
}
int Yes2SDKIap::GetProduct(lua_State* L) {
    const char* productId = luaL_checkstring(L, 1);
    int id = Yes2SDKRequests::Register(L, 2, "iap_get_product");
    Yes2SDK_iap_getProduct(productId, id, Yes2SDKRequests::Complete);
    return 0;
}
int Yes2SDKIap::Purchase(lua_State* L) {
    const char* productId = luaL_checkstring(L, 1);
    // developer payload is optional: accept a string or nil/none.
    const char* developerPayload = luaL_optstring(L, 2, "");
    int id = Yes2SDKRequests::Register(L, 3, "iap_purchase");
    Yes2SDK_iap_purchase(productId, developerPayload, id, Yes2SDKRequests::Complete);
    return 0;
}
int Yes2SDKIap::GetPurchases(lua_State* L) {
    int id = Yes2SDKRequests::Register(L, 1, "iap_get_purchases");
    Yes2SDK_iap_getPurchases(id, Yes2SDKRequests::Complete);
    return 0;
}
int Yes2SDKIap::ConsumePurchase(lua_State* L) {
    const char* purchaseToken = luaL_checkstring(L, 1);
    int id = Yes2SDKRequests::Register(L, 2, "iap_consume_purchase");
    Yes2SDK_iap_consumePurchase(purchaseToken, id, Yes2SDKRequests::Complete);
    return 0;
}
int Yes2SDKIap::IsSupported(lua_State* L) {
    lua_pushboolean(L, Yes2SDK_iap_isSupported());
    return 1;
}
#endif
