#pragma once
#include <dmsdk/sdk.h>
#if defined(DM_PLATFORM_HTML5)
class Yes2SDKData {
public:
    static int GetInt(lua_State* L);
    static int SetInt(lua_State* L);
    static int GetFloat(lua_State* L);
    static int SetFloat(lua_State* L);
    static int GetString(lua_State* L);
    static int SetString(lua_State* L);
    static int HasKey(lua_State* L);
    static int DeleteKey(lua_State* L);
    static int DeleteAll(lua_State* L);
};
extern "C" {
    int Yes2SDK_data_getInt(const char* key, int defaultValue);
    void Yes2SDK_data_setInt(const char* key, int value);
    float Yes2SDK_data_getFloat(const char* key, float defaultValue);
    void Yes2SDK_data_setFloat(const char* key, float value);
    const char* Yes2SDK_data_getString(const char* key, const char* defaultValue);
    void Yes2SDK_data_setString(const char* key, const char* value);
    int Yes2SDK_data_hasKey(const char* key);
    void Yes2SDK_data_deleteKey(const char* key);
    void Yes2SDK_data_deleteAll();
}
#endif
