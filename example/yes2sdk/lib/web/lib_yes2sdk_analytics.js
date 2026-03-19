var Yes2SDKAnalyticsLib = {

    Yes2SDK_analytics_logLevelStart: function (levelPtr) {
        if (window.Yes2SDK && window.Yes2SDK.analytics) {
            window.Yes2SDK.analytics.logLevelStart(UTF8ToString(levelPtr));
        }
    },

    Yes2SDK_analytics_logLevelEnd: function (levelPtr, score, success) {
        if (window.Yes2SDK && window.Yes2SDK.analytics) {
            window.Yes2SDK.analytics.logLevelEnd(UTF8ToString(levelPtr), score, success === 1);
        }
    },

    Yes2SDK_analytics_logScore: function (score, levelPtr) {
        if (window.Yes2SDK && window.Yes2SDK.analytics) {
            window.Yes2SDK.analytics.logScore(score, levelPtr ? UTF8ToString(levelPtr) : undefined);
        }
    },

    Yes2SDK_analytics_logTutorialStart: function () {
        if (window.Yes2SDK && window.Yes2SDK.analytics) {
            window.Yes2SDK.analytics.logTutorialStart();
        }
    },

    Yes2SDK_analytics_logTutorialEnd: function () {
        if (window.Yes2SDK && window.Yes2SDK.analytics) {
            window.Yes2SDK.analytics.logTutorialEnd();
        }
    },

    Yes2SDK_analytics_logGameChoice: function (decisionPtr, choicePtr) {
        if (window.Yes2SDK && window.Yes2SDK.analytics) {
            window.Yes2SDK.analytics.logEvent("game_choice", {
                decision: UTF8ToString(decisionPtr),
                choice: UTF8ToString(choicePtr)
            });
        }
    }
}

addToLibrary(Yes2SDKAnalyticsLib);
