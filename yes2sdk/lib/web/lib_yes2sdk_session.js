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
    },

    Yes2SDK_session_isAudioEnabled: function () {
        try {
            if (window.Yes2SDK && window.Yes2SDK.session && typeof window.Yes2SDK.session.isAudioEnabled === 'function') {
                return window.Yes2SDK.session.isAudioEnabled() ? 1 : 0;
            }
        } catch (e) {}
        // Default to enabled — game shouldn't start muted just because the SDK isn't ready yet.
        return 1;
    }
}

addToLibrary(Yes2SDKSessionLib);
