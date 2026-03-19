var Yes2SDKSessionLib = {

    Yes2SDK_session_gameplayStart: function () {
        if (window.Yes2SDK && window.Yes2SDK.game) {
            window.Yes2SDK.game.gameplayStart();
        }
    },

    Yes2SDK_session_gameplayStop: function () {
        if (window.Yes2SDK && window.Yes2SDK.game) {
            window.Yes2SDK.game.gameplayStop();
        }
    },

    Yes2SDK_session_getLocale: function () {
        var locale = "en";
        try {
            if (window.Yes2SDK && window.Yes2SDK.session) {
                locale = window.Yes2SDK.session.getLocale() || "en";
            }
        } catch (e) {
            locale = navigator.language || "en";
        }
        return stringToUTF8OnStack(locale);
    }
}

addToLibrary(Yes2SDKSessionLib);
