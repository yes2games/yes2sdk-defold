var Yes2SDKScoreLib = {

    Yes2SDK_score_addScore: function (score) {
        try {
            if (window.Yes2SDK && window.Yes2SDK.score) {
                window.Yes2SDK.score.addScore(score);
            }
        } catch (e) {}
    },

    Yes2SDK_score_submitScore: function (encryptedPtr) {
        try {
            if (window.Yes2SDK && window.Yes2SDK.score) {
                window.Yes2SDK.score.submitScore(UTF8ToString(encryptedPtr));
            }
        } catch (e) {}
    },

    Yes2SDK_score_isSupported: function () {
        try {
            if (window.Yes2SDK && window.Yes2SDK.score && typeof window.Yes2SDK.score.isSupported === 'function') {
                return window.Yes2SDK.score.isSupported() ? 1 : 0;
            }
        } catch (e) {}
        return 0;
    }
}

addToLibrary(Yes2SDKScoreLib);
