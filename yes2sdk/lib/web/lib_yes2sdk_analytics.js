var Yes2SDKAnalyticsLib = {

    Yes2SDK_analytics_logLevelStart: function (levelPtr) {
        if (window.Yes2SDK && window.Yes2SDK.analytics) {
            window.Yes2SDK.analytics.logLevelStart(UTF8ToString(levelPtr));
        }
    },

    Yes2SDK_analytics_logLevelEnd: function (levelPtr, score, success, durationSeconds) {
        if (window.Yes2SDK && window.Yes2SDK.analytics) {
            var duration = durationSeconds < 0 ? undefined : durationSeconds;
            window.Yes2SDK.analytics.logLevelEnd(UTF8ToString(levelPtr), score, success === 1, duration);
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
    },

    Yes2SDK_analytics_logEvent: function (namePtr, paramsJsonPtr) {
        if (window.Yes2SDK && window.Yes2SDK.analytics) {
            var params;
            if (paramsJsonPtr) {
                try { params = JSON.parse(UTF8ToString(paramsJsonPtr) || "{}"); }
                catch (e) { params = undefined; }
            }
            // Core: logEvent(eventName, valueToSum?, parameters?). Pass params in
            // the parameters slot so Yandex Metrica forwards ym(id, 'reachGoal', name, params).
            window.Yes2SDK.analytics.logEvent(UTF8ToString(namePtr), undefined, params);
        }
    }
}

addToLibrary(Yes2SDKAnalyticsLib);
