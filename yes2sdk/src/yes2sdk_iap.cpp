#include "yes2sdk_iap.h"
#include "luautils.h"
#if defined(DM_PLATFORM_HTML5)
lua_Listener onIapGetCatalogListener;
lua_Listener onIapGetProductListener;
lua_Listener onIapPurchaseListener;
lua_Listener onIapGetPurchasesListener;
lua_Listener onIapConsumePurchaseListener;

void Yes2SDKIap::OnGetCatalog(const int success, const char* result) {
    lua_State* L = onIapGetCatalogListener.m_L;
    if (!L) return;
    int top = lua_gettop(L);
    lua_pushlistener(L, onIapGetCatalogListener);
    lua_pushboolean(L, success);
    if (result) { lua_pushstring(L, result); } else { lua_pushnil(L); }
    int ret = lua_pcall(L, 3, 0, 0);
    if (ret != 0) { lua_pop(L, 1); }
    assert(top == lua_gettop(L));
}
void Yes2SDKIap::OnGetProduct(const int success, const char* result) {
    lua_State* L = onIapGetProductListener.m_L;
    if (!L) return;
    int top = lua_gettop(L);
    lua_pushlistener(L, onIapGetProductListener);
    lua_pushboolean(L, success);
    if (result) { lua_pushstring(L, result); } else { lua_pushnil(L); }
    int ret = lua_pcall(L, 3, 0, 0);
    if (ret != 0) { lua_pop(L, 1); }
    assert(top == lua_gettop(L));
}
void Yes2SDKIap::OnPurchase(const int success, const char* result) {
    lua_State* L = onIapPurchaseListener.m_L;
    if (!L) return;
    int top = lua_gettop(L);
    lua_pushlistener(L, onIapPurchaseListener);
    lua_pushboolean(L, success);
    if (result) { lua_pushstring(L, result); } else { lua_pushnil(L); }
    int ret = lua_pcall(L, 3, 0, 0);
    if (ret != 0) { lua_pop(L, 1); }
    assert(top == lua_gettop(L));
}
void Yes2SDKIap::OnGetPurchases(const int success, const char* result) {
    lua_State* L = onIapGetPurchasesListener.m_L;
    if (!L) return;
    int top = lua_gettop(L);
    lua_pushlistener(L, onIapGetPurchasesListener);
    lua_pushboolean(L, success);
    if (result) { lua_pushstring(L, result); } else { lua_pushnil(L); }
    int ret = lua_pcall(L, 3, 0, 0);
    if (ret != 0) { lua_pop(L, 1); }
    assert(top == lua_gettop(L));
}
void Yes2SDKIap::OnConsumePurchase(const int success, const char* result) {
    lua_State* L = onIapConsumePurchaseListener.m_L;
    if (!L) return;
    int top = lua_gettop(L);
    lua_pushlistener(L, onIapConsumePurchaseListener);
    lua_pushboolean(L, success);
    if (result) { lua_pushstring(L, result); } else { lua_pushnil(L); }
    int ret = lua_pcall(L, 3, 0, 0);
    if (ret != 0) { lua_pop(L, 1); }
    assert(top == lua_gettop(L));
}
int Yes2SDKIap::GetCatalog(lua_State* L) {
    luaL_checklistener(L, 1, onIapGetCatalogListener);
    Yes2SDK_iap_getCatalog(Yes2SDKIap::OnGetCatalog);
    return 0;
}
int Yes2SDKIap::GetProduct(lua_State* L) {
    const char* productId = luaL_checkstring(L, 1);
    luaL_checklistener(L, 2, onIapGetProductListener);
    Yes2SDK_iap_getProduct(productId, Yes2SDKIap::OnGetProduct);
    return 0;
}
int Yes2SDKIap::Purchase(lua_State* L) {
    const char* productId = luaL_checkstring(L, 1);
    // developer payload is optional — accept a string or nil/none.
    const char* developerPayload = luaL_optstring(L, 2, "");
    luaL_checklistener(L, 3, onIapPurchaseListener);
    Yes2SDK_iap_purchase(productId, developerPayload, Yes2SDKIap::OnPurchase);
    return 0;
}
int Yes2SDKIap::GetPurchases(lua_State* L) {
    luaL_checklistener(L, 1, onIapGetPurchasesListener);
    Yes2SDK_iap_getPurchases(Yes2SDKIap::OnGetPurchases);
    return 0;
}
int Yes2SDKIap::ConsumePurchase(lua_State* L) {
    const char* purchaseToken = luaL_checkstring(L, 1);
    luaL_checklistener(L, 2, onIapConsumePurchaseListener);
    Yes2SDK_iap_consumePurchase(purchaseToken, Yes2SDKIap::OnConsumePurchase);
    return 0;
}
int Yes2SDKIap::IsSupported(lua_State* L) {
    lua_pushboolean(L, Yes2SDK_iap_isSupported());
    return 1;
}
#endif
