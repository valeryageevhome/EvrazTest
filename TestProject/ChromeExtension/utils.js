export function joinLines(...lines) {
    let text = '';

    for (const line of lines) {
        text += line + '\n';
    }

    return text;
}

/**
 * Преобразует wildcard к регулярному выражению
 * @param {any} str исходный фильтр
 */
export function wildcardToRegEx(str) {
    return new RegExp("^" + str.replaceAll("*", ".*") + "$", '');
}

export function escapeRegExp(string) {
    return string.replaceAll(/[.+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

/** 
 *  Получает версию браузера 
 */
export function getBrowserInfo() {
    var ua = navigator.userAgent, tem, M = ua.match(/(edge|opera|chrome|safari|firefox|msie|trident(?=\/))\/?\s*(\d+)/i) || [];
    if (/trident/i.test(M[1])) {
        tem = /\brv[ :]+(\d+)/g.exec(ua) || [];
        return { name: 'IE ', version: (tem[1] || '') };
    }
    if (/edge/i.test(ua)) {
        tem = /\brv[ :]+(\d+)/g.exec(ua) || [];
        return { name: 'Edge', version: (tem[1] || '') };
    }
    if (M[1] === 'Chrome') {
        tem = ua.match(/\bOPR\/(\d+)/)
        if (tem != null) { return { name: 'Opera', version: tem[1] }; }
    }
    M = M[2] ? [M[1], M[2]] : [navigator.appName, navigator.appVersion, '-?'];
    if ((tem = ua.match(/version\/(\d+)/i)) != null) { M.splice(1, 1, tem[1]); }
    return {
        name: M[0],
        version: M[1]
    }
}

export async function getBrowserNameNavigation(br) {
    const userAgent = navigator.userAgent;
    let firefoxApiInfo = null;
    try {
        firefoxApiInfo = await br.runtime.getBrowserInfo();
    } catch {
        //not defined
    }

    if (firefoxApiInfo && firefoxApiInfo.name.includes("Firefox")) {
        return "Firefox";
    } else if (userAgent.includes("Edg")) {
        return "Edge";
    } else if (userAgent.includes("YaBrowser")) {
        return "Yandex";
    } else {
        return "Chrome";
    }
}

export function isUserScriptAvailable(br) {
    try {
        // Property access which throws if developer mode is not enabled.
        br.userScripts.getScripts();
        return true;
    } catch {
        // Not available.
        return false;
    }
}

export function isDirectUserScriptSupported(br) {
    try {
        br.userScripts.getScripts();
        // Chromium v135+
        let hasApi = br.userScripts.execute != undefined;
        return hasApi;
    } catch {
        // Not available.
        return false;
    }
}

export function getUserScriptUnavailableErrorText() {
    let version = Number(navigator.userAgent.match(/(Chrome|Chromium)\/([0-9]+)/)?.[2]);
    if (version < 138) {
        return "UserScript API недоступно, для использования активности \"Выполнить JS\" убедитесь, что в вашем браузере активирован \"Режим разработчика\" расширений";
    } else {
        return "UserScript API недоступно, для использования активности \"Выполнить JS\" убедитесь, что в вашем браузере активировано \"Разрешить пользовательские скрипты\" для расширения Primo RPA";
    }
}