import {
    joinLines,
    wildcardToRegEx,
    escapeRegExp,
    getBrowserInfo,
    getBrowserNameNavigation,
    isUserScriptAvailable,
    isDirectUserScriptSupported,
    getUserScriptUnavailableErrorText
} from "./utils.js";

/**
 * Получает title, url, tabIndex. TabIndex отсутствовал до версии .64
 * Возвращает { value: string, tabIndex: int }
 */
function parseAttachRequestParams(param) {
    try {
        param = JSON.parse(param);
        return {
            value: param.value,
            tabIndex: param.tabIndex,
            activateTab: param.activateTab
        }
    } catch (e) {
        return {
            value: param,
            tabIndex: 1,
            activateTab: false
        }
    }
}

var port;
var br_source;
var br_name_navigation;

function generateUserScriptInjectionCode(code, id) {
    let scriptCode = joinLines(
        'function g_userProvidedScript() {',
            'return ' + code,
        '}',
        'var g_br_source;',
        'function g_connectUserScript() {',
            'let g_br_source;',
            'try { ',
            'g_br_source = chrome;',
            '} catch {',
                'g_br_source = browser',
            '}',
            'g_br_source.runtime.onMessage.addListener(function (g_msg, g_sender, g_fnResponse) {',
                'if (g_msg.msg != null && g_msg.msg.action === "executeUserScript_generated") {',
                    'let g_res;',
                    'try {',
                        'g_res = g_userProvidedScript();',
                    '} catch (g_e) {',
                        'g_fnResponse({ err: g_e, msgId: g_msg.msgId });',
                    '}',
                    'g_fnResponse({ response: g_res, msgId: g_msg.msgId});',
                '} else {',
                    'return true;',
                '}',
            '});',
        '}',
        'g_connectUserScript();');
    return scriptCode;
}

function getUserScriptFindPrefixCode() {
    /* #"eval2" from mv2
    let f = eval(pp.script);
    let pp = JSON.parse(msg.msg.param);
    let el = null;
    if ((pp.pattern != null) && (pp.pattern.length > 0)) {
        let els = getElements(pp.pattern);
        if (els.length > 0) el = els[0];
    }
    let r = f(el, pp.arg);*/

    //Нет прямолинейного способа в данном контексте загрузить find.js как модуль, здесь находится его копия
    let scriptCommonPrefix = joinLines(
        'function arrayIntersect(array1, array2) {',
        '      return array1.filter(function (n) {',
        '        return array2.indexOf(n) !== -1;',
        '     });',
        '}',
        '',
        'function getFirstElementFromPattern(pp) {',
        '            let el = null;',
        '            if ((pp != null) && (pp.length > 0)) {',
        '                let els = getElements(pp);',
        '                if (els.length > 0) el = els[0];',
        '            }',
        '            return el;',
        '        }',
        '',
        'function getElements(pattern) {',
        '            frameIdx = 0;',
        '            let ret = findElements(pattern, [document]);',
        '            return ret;',
        '}',
        '',
        'function findElements(pattern, nodesarr, win, idx) {',
        '    let result = []; // накапливаем результат',
        '    let ret = [];',
        '    if (pattern != null) {',
        '        //признак нового поиска',
        '        let modeNew = pattern[0].searchOptions == null ? false : pattern[0].searchOptions.ExtLayersTransitionFix;',
        '        //признак прерывания в старом поиске с обнулением результатов',
        '        let searchInterrupted = true;',
        '        for (var k = 0; k < nodesarr.length; k++) {',

        '            if (searchInterrupted) {',
        '               searchInterrupted = false;',
        '               //поиск не дошел до конца',
        '               ret = [];',
        '               //в старом поиске результат затирался',
        '               if (!modeNew) result = []; ',
        '            } ',
        '            src = nodesarr[k];',
        '            if (nodesarr[k].contentWindow != null)',
        '                src = nodesarr[k].contentWindow.document;',
        '            if (pattern[0].XPathSelector) {',
        '                let nodes = document.evaluate(pattern[0].XPathSelector, src, null, XPathResult.ORDERED_NODE_ITERATOR_TYPE, null);',
        '                if (nodes.length == 0) {',
        '                    searchInterrupted = true;',
        '                    continue;',
        '                } else {',
        '                    let tnodes = [];',
        '                    let fnd = false;',
        '                    while (node = nodes.iterateNext()) {',
        '                        tnodes.push(node);',
        '                        fnd = true;',
        '                    }',
        '                    if (!fnd) {',
        '                        searchInterrupted = true;',
        '                        continue;',
        '                    }',
        '                    if (ret.length == 0) ret = Array.from(tnodes);',
        '                    else {',
        '                        ret = arrayIntersect(ret, Array.from(tnodes));',
        '                    }',
        '                }',
        '            } else {',
        '                if (pattern[0].CSSSelector) {',
        '                    let nodes = src.querySelectorAll(pattern[0].CSSSelector + \'>*\');',
        '                    if (nodes.length == 0) {',
        '                        searchInterrupted = true;',
        '                        continue;',
        '                    } else {',
        '                        ret = ret.length == 0 ? Array.from(nodes) : arrayIntersect(ret, Array.from(nodes));',
        '                    }',
        '                }',
        '                // normal value kind',
        '                if (pattern[0].tag && pattern[0].tagValueKind != 1) {',
        '                    let nodes = src.querySelectorAll(pattern[0].tag.replace("*", "$"));',
        '                    if (nodes.length == 0) {',
        '                        searchInterrupted = true;',
        '                        continue;',
        '                    } else {',
        '                        ret = ret.length == 0 ? Array.from(nodes) : arrayIntersect(ret, Array.from(nodes));',
        '                    }',
        '                }',
        '                if (pattern[0].id && pattern[0].idValueKind != 1) {',
        '                    let nodes = src.querySelectorAll("#" + CSS.escape(pattern[0].id.replace("*", "$")));',
        '                    if (nodes.length == 0) {',
        '                        searchInterrupted = true;',
        '                        continue;',
        '                    } else {',
        '                        ret = ret.length == 0 ? Array.from(nodes) : arrayIntersect(ret, Array.from(nodes));',
        '                    }',
        '                }',
        '                if (pattern[0].text && pattern[0].textValueKind != 1) {',
        '                    let ptrn = "//*[text()=\'" + pattern[0].text + "\']";',
        '                    if (pattern[0].text.indexOf("*") >= 0)',
        '                        ptrn = "//*[contains(text(), \'" + pattern[0].text.replaceAll("*", "") + "\')]";',
        '                    let nodes = document.evaluate(ptrn, src, null, XPathResult.ORDERED_NODE_ITERATOR_TYPE, null);',
        '                    if (nodes.length == 0) {',
        '                        searchInterrupted = true;',
        '                        continue;',
        '                    } else {',
        '                        let tnodes = [];',
        '                        let fnd = false;',
        '                        while (node = nodes.iterateNext()) {',
        '                            tnodes.push(node);',
        '                            fnd = true;',
        '                        }',
        '                        if (!fnd) {',
        '                            searchInterrupted = true;',
        '                            continue;',
        '                        }',
        '                        if (ret.length == 0) ret = Array.from(tnodes)',
        '                        else {',
        '                            ret = arrayIntersect(ret, Array.from(tnodes));',
        '                        }',
        '                    }',
        '                }',
        '                // regex value kind',
        '                if (ret.length == 0) {',
        '                    let nodelist = document.querySelectorAll(\'*\');',
        '                    ret = Array.from(nodelist);',
        '                }',
        '                if (pattern[0].tag && pattern[0].tagValueKind == 1) {',
        '                    let regex = new RegExp(pattern[0].tag, "i");',
        '                    ret = ret.filter(el => regex.test(el.tagName));',
        '                    if (ret.length == 0)',
        '                        continue;',
        '                }',
        '                if (pattern[0].id && pattern[0].idValueKind == 1) {',
        '                    let regex = new RegExp(pattern[0].id, "i");',
        '                    ret = ret.filter(el => regex.test(el.id));',
        '                    if (ret.length == 0)',
        '                        continue;',
        '                }',
        '                if (pattern[0].text && pattern[0].textValueKind == 1) {',
        '                    let regex = new RegExp(pattern[0].text, "i");',
        '                    let ret1 = ret.filter(el => regex.test(el.text));',
        '                if (ret1.length > 0)',
        '                    ret = ret1;',
        '                else',
        '                    ret = ret.filter(el => regex.test(el.innerText));',
        '                }',
        '                let attributes = pattern[0].atts;',
        '                if (attributes) {',
        '                    let normalAttributes = attributes.filter(el => el.valueKind != 1);',
        '                    if (normalAttributes.length > 0) {',
        '                        let p = "*";',
        '                        for (var j = 0; j < normalAttributes.length; j++) {',
        '                            p = p +',
        '                            "[" +',
        '                            normalAttributes[j].name +',
        '                            (normalAttributes[j].value.includes("*") ? "*" : "") +',
        '                            "=\'" +',
        '                            normalAttributes[j].value.replaceAll("*", "") +',
        '                            "\']";',
        '                        }',
        '                        let nodes = src.querySelectorAll(p);',
        '                        if (nodes.length == 0) {',
        '                            searchInterrupted = true;',
        '                            continue;',
        '                        } else {',
        '                            ret = ret.length == 0 ? Array.from(nodes) : arrayIntersect(ret, Array.from(nodes));',
        '                        }',
        '                    }',
        '                    // valueKind is new feature since 1.25.1',
        '                    let regexAttributes = attributes.filter(el => el.valueKind == 1);',
        '                    if (regexAttributes.length > 0) {',
        '                        for (var j = 0; j < regexAttributes.length; j++) {',
        '                            let attName = regexAttributes[j].name.toLowerCase();',
        '                            let attValue = regexAttributes[j].value;',
        '                            if (attValue) {',
        '                                let regex = new RegExp(attValue, "i");',
        '                                ret = ret.filter(el => {',
        '                                    if (el.attributes[attName])',
        '                                        return regex.test(el.attributes[attName].value);',
        '                                    else',
        '                                        return false;',
        '                                });',
        '                                if (ret.length == 0)',
        '                                    continue;',
        '                            }',
        '                        }',
        '                    }',
        '                }',
        '            }',
        '',
        '            if (pattern[0].idx != null) {',
        '                idx = idx ?? 0;',
        '                if (pattern[0].idx < 1',
        '                    || ret.length - 1 < (pattern[0].idx - 1 - idx)) {',
        '                    idx = ret.length;',
        '                    searchInterrupted = true;',
        '                    continue;',
        '                } else {',
        '                    ret = [ret[pattern[0].idx - 1 - idx]];',
        '                }',
        '            }',
        '',
        '            if ((pattern.length > 1) && (ret.length > 0)) {',
        '                let rret = null;',
        '                try {',
        '                    let sh = [];',
        '                    for (var si = 0; si < ret.length; si++) {',
        '                        if (ret[si].shadowRoot != null) sh.push(ret[si].shadowRoot);',
        '                    }',
        '                    rret = findElements(pattern.slice(1), sh);',
        '                } catch {',
        '                }',
        '                if ((rret != null) && (rret.length > 0)) {',
        '                    ret = rret;',
        '                } else {',
        '                    ret = findElements(pattern.slice(1), ret);',
        '                }',
        '            }',
        '',
        '            //Формируем результат для старого и нового поиска',
        '            if (ret.length == 0) continue;',
        '            else {',
        '                if (result.length == 0) result = Array.from(ret);',
        '                else {',
        '                    result = arrayIntersect(result, Array.from(ret));',
        '                }',
        '            }',
        '        }',

        '        if ((pattern[0].searchFrames == true) && (frameIdx < 30)) {',
        '            if (win == null) win = window;',
        '            frameIdx = frameIdx + 1;',
        '            for (var k = 0; k < win.frames.length; k++) {',
        '                try {',
        '                    let r2 = findElements(pattern, [window.frames[k].document], window.frames[k], idx);',
        '                    for (var kk = 0; kk < r2.length; r2++) {',
        '                        result.push(r2[kk]);',
        '                    }',
        '                } catch { }',
        '            }',
        '        }',
        '    }',
        '    return ret;',
        '}');
    return scriptCommonPrefix;
}

function generateUserScriptFuncInjectionCode(code, id) {
    let inj = joinLines(
        getUserScriptFindPrefixCode(),
        'function g_userProvidedScript(v, el) {',
            code,
        '}',
        'var g_br_source;',
        'function g_connectUserScript() {',
        '   let g_br_source;',
        '   try { ',
        '      g_br_source = chrome;',
        '   } catch {',
        '      g_br_source = browser',
        '   }',
        '   g_br_source.runtime.onMessage.addListener(function (g_msg, g_sender, g_fnResponse) {',
        '      if (g_msg.msg != null && g_msg.msg.action === "executeUserScript_generated") {',
        '         let g_res;',
        '         try {',
        '            g_pp = JSON.parse(g_msg.msg.param);',
        '            g_el = getFirstElementFromPattern(g_pp.pattern);',
        '            g_res = g_userProvidedScript(g_pp.arg, g_el);',
        '         } catch (g_e) {',
        '            g_fnResponse({ err: g_e, msgId: g_msg.msgId });',
        '         }',
        '         g_fnResponse({ response: g_res, msgId: g_msg.msgId});',
        '      } else {',
        '         return true;',
        '      }',
        '   });',
        '}',
        'g_connectUserScript();');

    return inj;
}

function generateUserScriptFuncDirectCode(code, g_pat, g_arg) {
    /* #"eval2" from mv2
    let f = eval(pp.script);
    let pp = JSON.parse(msg.msg.param);
    let el = null;
    if ((pp.pattern != null) && (pp.pattern.length > 0)) {
        let els = getElements(pp.pattern);
        if (els.length > 0) el = els[0];
    }
    let r = f(el, pp.arg);*/
    let patternEmbeddedString = g_pat
        ? `g_pp_pat = '${g_pat.replace("'", "\\'")}';`
        : 'g_pp_pat = null;';
    let argEmbeddedString = g_arg
        ? `g_pp_arg = '${g_arg.replace("'", "\\'")}';`
        : 'g_pp_arg = undefined;';

    let injectionCode = joinLines(
        getUserScriptFindPrefixCode(),
        'function g_userProvidedScript(v, el) {',
            code,
        '}',
        patternEmbeddedString,
        argEmbeddedString,
        'g_el = getFirstElementFromPattern(g_pp_pat? JSON.parse(g_pp_pat) : undefined);',
        'g_userProvidedScript(g_pp_arg, g_el);');

    return injectionCode;
}

async function connect() {
    let br_name = getBrowserInfo().name.toLowerCase();
    if (br_name == "chrome" || br_name == "opera" || br_name == "edge") {
        br_source = chrome;
        br_source.runtime.onMessage.addListener(function (request, sender, sendResponse) {
            if (request.browserName)
                request.browserName = br_name_navigation;
            port.postMessage(request);
        });
        if (getBrowserInfo().name.toLowerCase() == "chrome")
            port = br_source.runtime.connectNative('com.primo.webbrowserch');
        else
            port = br_source.runtime.connectNative('com.primo.webbrowser');
    } else {
        br_source = browser;
        br_source.runtime.onMessage.addListener(function (request, sender, sendResponse) {
            if (request.browserName)
                request.browserName = br_name_navigation;
            port.postMessage(request);
        });
        port = br_source.runtime.connectNative('com.primo.webbrowser');
    }
    br_name_navigation = await getBrowserNameNavigation();

    var manifestData = br_source.runtime.getManifest();
    port.postMessage({ eventName: "EXT_INFO", version: manifestData.version, doLog: false });
    br_source.tabs.query({}, function (tabs) {
        if (tabs.length != 0) {
            for (var i = 0; i < tabs.length; i++) {
                if (tabs[i].active) port.postMessage({ eventName: "NEW_TAB", tabId: tabs[i].id });
            }
        }
    });

    br_source.tabs.onCreated.addListener(function (tab) {
        port.postMessage({ eventName: "NEW_TAB", tabId: tab.id });
        port.postMessage({ eventName: "TAB_URL_CREATED", browserName: br_name_navigation, tabId: tab.id, tabUrl: tab.url, tabPendingUrl: tab.pendingUrl });
    });

    br_source.tabs.onUpdated.addListener(function (tabId, tabChangeInfo, tab) {
        if (tabChangeInfo.url) {
            port.postMessage({ eventName: "TAB_URL_UPDATED", browserName: br_name_navigation, tabId: tabId, tabNewUrl: tabChangeInfo.url });
        }
    });

    br_source.tabs.onRemoved.addListener(function (tabId, tabRemoveInfo) {
        port.postMessage({ eventName: "TAB_URL_REMOVED", browserName: br_name_navigation, tabId: tabId,});
    });

    br_source.tabs.onReplaced.addListener(function(addedTabId, removedTabId) {
        port.postMessage({ eventName: "TAB_URL_REPLACED", browserName: br_name_navigation, tabId: addedTabId, removedTabId: removedTabId });
    });

    port.onDisconnect.addListener(function () {
        ;
    });

    await configureUserScripts();
    await br_source.storage.session.setAccessLevel({ accessLevel: "TRUSTED_AND_UNTRUSTED_CONTEXTS" });
    await br_source.storage.session.set({ attributeSubscriptionsEpoch: 0 });

    port.onMessage.addListener(function (msg) {
        var objmsg = JSON.parse(msg);
        var id = objmsg.id;
        var value;
        var tabIndex;
        var activateTab;
        var originalTabIndex;
        var found = false;
        switch (objmsg.action) {
            case "AttachByTitle":
            ({ value, tabIndex, activateTab } = parseAttachRequestParams(objmsg.param));
            originalTabIndex = tabIndex;

                br_source.tabs.query({}, function (tabs) {
                    if (tabs.length !== 0) {
                        if (activateTab && tabIndex <= 0) {
                            let alreadyActiveTabs = tabs.filter((tab) => tab.active);
                            tabs = alreadyActiveTabs.concat(tabs.filter((tab) => !tab.active));
                        }
                        tabIndex = Math.max(1, tabIndex);

                        for (var i = 0; i < tabs.length; i++) {
                            var curTab = tabs[i];
                            if (wildcardToRegEx(escapeRegExp(value).toLowerCase()).test(curTab.title.toLowerCase())) {
                                if (tabIndex === 1) {
                                    if (!curTab.active && activateTab) {
                                        br_source.tabs.update(curTab.id, { active: true });
                                    }
                                    found = true;
                                    br_source.tabs.sendMessage(//todo why is this a message at all?
                                        curTab.id,
                                        { msgId: id, action: "getPageTitle", tabId: curTab.id },
                                        (response) => {
                                            if (response == undefined) return;
                                            port.postMessage({
                                                id: response.msgId,
                                                result: response.tabId,
                                                err: response.err
                                            });
                                        });
                                    break;
                                } else tabIndex--;
                            }
                        }
                    }

                    if (!found) {
                        port.postMessage({
                            id: id,
                            err: `Failed to attach to tab via title \"${value}\" by index ${originalTabIndex} - no such tab`
                        });
                    }
                });
                break;
            case "AttachByUrl":
            ({ value, tabIndex, activateTab } = parseAttachRequestParams(objmsg.param));
            originalTabIndex = tabIndex;

            br_source.tabs.query({}, function (tabs) {
                if (tabs.length != 0) {
                        if (activateTab && tabIndex <= 0) {
                            let alreadyActiveTabs = tabs.filter((tab) => tab.active);
                            tabs = alreadyActiveTabs.concat(tabs.filter((tab) => !tab.active));
                        }
                        tabIndex = Math.max(1, tabIndex);

                    for (var i = 0; i < tabs.length; i++) {
                        var curTab = tabs[i];
                        if (wildcardToRegEx(escapeRegExp(value).toLowerCase()).test(curTab.url.toLowerCase())) {
                            if (tabIndex === 1) {
                                if (!curTab.active && activateTab) {
                                    br_source.tabs.update(curTab.id, { active: true });
                                }
                                found = true;
                                br_source.tabs.sendMessage(//todo why is this a message at all?
                                    curTab.id,
                                    { msgId: id, action: "getPageURL", tabId: curTab.id },
                                    (response) => {
                                        if (response == undefined) return;
                                        port.postMessage({
                                            id: response.msgId,
                                            result: response.tabId,
                                            err: response.err
                                        });
                                    });
                                break;
                            } else tabIndex--;
                        }
                    }
                }

                if (!found) {
                    port.postMessage({
                        id: id,
                        err: `Failed to attach to tab via url \"${value}\" by index ${originalTabIndex} - no such tab`
                    });
                }
            });
                break;
            case "AttachAll":
            let tt = [];
            br_source.tabs.query({}, function (tabs) {
                if (tabs.length != 0) {
                    for (var i = 0; i < tabs.length; i++) {
                        tt.push(tabs[i].id);
                    }
                }
                port.postMessage({ id: id, result: tt, err: null });
            });
                break;
            case "getAllWindowsTabCount":
                postResultAsync(id, getAllWindowsTabCountAsync);
                break;
            case "getActiveTabId":
                postResultAsync(id, getActiveTabIdAsync);
                break;
            case "getTabIdByIndex":
                postResultAsync(id, getTabIdByIndexAsync, objmsg.param);
                break;
            case "getTabIdByTitle":
                postResultAsync(id, getTabIdByTitleAsync, objmsg.param);
                break;
            case "closeTabById":
                postResultAsync(id, closeTabByIdAsync, objmsg.param);
                break;
            case "closeAllTabs":
                postResultAsync(id, closeAllTabsAsync);
                break;
            case "getWindowTitle":
                postResultAsync(id, getWindowTitleAsync);
                break;
            case "getCurrentTabInfo":
                postResultAsync(id, getCurrentTabInfoAsync);
                break;
            case "openTab":
                postResultAsync(id, openTabAsync, objmsg.param);
                break;
            case "duplicateTab":
                postResultAsync(id, duplicateTabAsync);
                break;
            case "activateTab":
                postResultAsync(id, activateTabAsync, objmsg.param);
                break;
            case "activateTabById":
                postResultAsync(id, activateTabByIdAsync, objmsg.param);
                break;
            case "activateTabByIndex":
                postResultAsync(id, activateTabByIndexAsync, objmsg.param);
                break;
            case "registerUserScript":
                if (isUserScriptAvailable(br_source))
                    postResultAsync(id, registerUserScriptAsync, objmsg);
                else
                    port.postMessage({ id: id, err: getUserScriptUnavailableErrorText() });
                break;
            case "fetchIsDirectUserScriptSupported":
                port.postMessage({ id: id, result: isDirectUserScriptSupported(br_source) });
                break;
            case "executeUserScriptDirect":
                postResultAsync(id, executeUserScriptDirectAsync, { params: objmsg.param, tabId: objmsg.tabId });
                break;
            case "fetchManifestInfo":
                var manifestData = br_source.runtime.getManifest();
                port.postMessage({ id: id, result: manifestData.version });
                break;
            case "queryCurrentTabs":
                port.postMessage({ id: id, result: "200" }); //code not used
                let isInitialQuery = objmsg.param === "True";
                raiseEventsAsync("TAB_URL_CREATED", getAllTabUrlCreatedAsync, isInitialQuery);
                break;
            case "registerClickTrigger":
                postResultAsync(id, registerClickTriggerAsync, objmsg);
                break;
            case "unregisterClickTrigger":
                postResultAsync(id, unregisterClickTriggerAsync, objmsg.param);
                break;
            case "registerPressTrigger":
                postResultAsync(id, registerPressTriggerAsync, objmsg);
                break;
            case "unregisterPressTrigger":
                postResultAsync(id, unregisterPressTriggerAsync, objmsg.param);
                break;
            case "registerAttributeChangedTrigger":
                postResultAsync(id, registerAttributeChangedTriggerAsync, objmsg);
                break;
            case "unregisterAttributeChangedTrigger":
                postResultAsync(id, unregisterAttributeChangedTriggerAsync, objmsg.param);
                break;
            case "processClickTrigger":
            case "processPressTrigger":
                if (objmsg.tabId)
                    return; //Message can't have predetermined tabId
                //fall through
            case "isElementLast":
            case "isElementPressedLast":
                br_source.tabs.query({ active: true, lastFocusedWindow: true }, ([tab]) => {
                    if (!tab || !tabHasContentScript(tab.url))
                        return;
                    br_source.tabs.sendMessage(tab.id, { msgId: id, msg: objmsg }, sendContentScriptResponse);
                });
                break;
            case "minimizeWindowByTabId":
                postResultAsync(id, minimizeWindowByTabIdAsync, objmsg.param);
                break;
            case "maximizeWindowByTabId":
                postResultAsync(id, maximizeWindowByTabIdAsync, objmsg.param);
                break;
            default:
                br_source.tabs.query({}, (tabs) => {
                    if (tabs.length != 0) {
                        for (var i = 0; i < tabs.length; i++) {
                            if (((!objmsg.tabId && tabs[i].active) || (tabs[i].id === parseInt(objmsg.tabId)))
                                && tabHasContentScript(tabs[i].url)) {
                                br_source.tabs.sendMessage(tabs[i].id, { msgId: id, msg: objmsg }, sendContentScriptResponse);
                            }
                        }
                    }
                });
        }
    });

    br_source.runtime.onMessage.addListener(function (request, sender, sendResponse) {
        if (request.iframe == true)
            port.postMessage({ id: request.msgId, result: request.response, err: request.err });
    });


    br_source.runtime.onInstalled.addListener(function (details) {
        if (details.OnInstalledReason === "update" && isUserScriptAvailable(br_source)) {
            br_source.userScripts.unregister();
        }
    });

    setInterval(notifyActiveTabs, 2000);
}

function sendContentScriptResponse(response) {
    if (response == undefined) return;
    port.postMessage({
        id: response.msgId,
        result: response.response,
        err: response.err
    });
}

async function configureUserScripts() {
    if (!isUserScriptAvailable(br_source))
        return;

    br_source.userScripts.configureWorld(
        {
            csp: "script-src 'self'",
            messaging: true
        });

    await br_source.userScripts.unregister();
    if (!isUserScriptAvailable(br_source))
        return;
    await br_source.userScripts.register(
                [
                    {
                        id: "generated",
                        matches: ["*://*/*"],
                        js: [
                            {
                                code: "chrome.runtime.onMessage.addListener(function (g_msg, g_sender, g_fnResponse) { return true; });"
                            }
                        ],
                        runAt: "document_end",
                        world: "USER_SCRIPT"
                    }
                ]);
}


async function registerUserScriptAsync(objmsg) {
    let registerParams = JSON.parse(objmsg.param);

    let generatedUserScript;
    if (registerParams.isFunc) {
        generatedUserScript = generateUserScriptFuncInjectionCode(registerParams.code, registerParams.id);
    } else {
        generatedUserScript = generateUserScriptInjectionCode(registerParams.code, registerParams.id);
    }
    await br_source.userScripts.update(
        [
            {
                id: "generated",
                js: [{ code: generatedUserScript }],
            }
        ]
    );

    if (registerParams.reload) {
        await br_source.tabs.reload(Number(objmsg.tabId), { bypassCache: false });
        await new Promise(function (resolve) { setTimeout(resolve, 2000); });
    }
}


function tabHasContentScript(url) {
    return url && (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("file://"));
}

/**
 * Получить количество открытых вкладок всех окон браузера
 */
async function getAllWindowsTabCountAsync() {
    let tabs = await br_source.tabs.query({});
    return tabs.length;
}

/**
 * Найти идентификатор активной вкладки
 */
async function getActiveTabIdAsync() {
    // tabs.query works incorrect in some cases
    let window = await br_source.windows.getCurrent({ populate: true });
    for (let tab of window.tabs) {
        if (tab.active)
            return tab.id;
    }
    throw ("Active Tab not found.");
}

/**
 * Найти идентификатор вкладки с указанным индексом
 */
async function getTabIdByIndexAsync(tabIndex) {
    if (tabIndex == undefined) {
        throw ("Wrong tab index :" + tabIndex);
    }
    let index = Number(tabIndex);
    let window = await br_source.windows.getCurrent({ populate: true });
    let tabs = window.tabs;
    let tabCount = tabs.length;
    if (tabCount <= index)
        throw ("Tab with index=" + index + " does not exist.");
    return tabs[index].id;
}

/**
 * Найти идентификатор вкладки с указанным заголовком
 */
async function getTabIdByTitleAsync(tabTitle) {
    let window = await br_source.windows.getCurrent({ populate: true });
    let tabs = window.tabs;
    for (let tab of tabs) {
        let match = wildcardToRegEx(escapeRegExp(tabTitle).toUpperCase()).test(tab.title.toUpperCase())
        if (match)
            return tab.id;
    }
    throw ("Tab with Title=" + tabTitle + " does not exist.");
}

/**
 * Закрыть вкладку с указанным идентификатором
 */
async function closeTabByIdAsync(tabId) {
    let id = Number(tabId);
    await br_source.tabs.remove(id);
    return true;
}

/**
 * Получить заголовок текущего окна
 */
async function getWindowTitleAsync() {
    let window = await br_source.windows.getCurrent({ populate: true });
    for (let tab of window.tabs) {
        if (tab.active)
            return tab.title;
    }
    throw ("Active window not found.");
}

/**
 * Получить информацию о текущей вкладке
 */
async function getCurrentTabInfoAsync() {
    let currentWindow = await br_source.windows.getCurrent({ populate: true });
    for (let tab of currentWindow.tabs) {
        if (tab.active) {
            var tabInfo = { tabId: tab.id, index: tab.index, title: tab.title, url: tab.url, tabCount: currentWindow.tabs.length };
            return tabInfo;
        }
    }
    throw ("Active window not found.");
}

/**
 * Получить эвенты создания всех вкладок
 */
async function* getAllTabUrlCreatedAsync(eventName, isInitialQuery) {
    for (const currentWindow of await br_source.windows.getAll({ populate: true })) {
        for (const tab of currentWindow.tabs) {
            yield {
                eventName: eventName,
                browserName: br_name_navigation,
                tabId: tab.id,
                tabUrl: tab.url,
                tabPendingUrl: tab.url,
                isInitialQuery: isInitialQuery
            }
        }
    }
}

/**
 * Закрыть все вкладки
 */
async function closeAllTabsAsync() {
    let currentWindow = await br_source.windows.getCurrent({ populate: true });
    for (let tab of currentWindow.tabs) {
        await br_source.tabs.remove(tab.id);
    }
}

/**
 * Открыть новую вкладку и загрузить страницу с указанным адресом
 */
async function openTabAsync(url) {
    return new Promise(resolve => {
        br_source.tabs.create({ url }, async tab => {
            br_source.tabs.onUpdated.addListener(function listener(tabId, info) {
                if (info.status === 'complete' && tabId === tab.id) {
                    br_source.tabs.onUpdated.removeListener(listener);
                    resolve(tab.id);
                }
            });
        });
    });
}

/**
 * Дублировать текущую вкладку
 */
async function duplicateTabAsync() {
    return new Promise(resolve => {
        br_source.tabs.query({ active: true, currentWindow: true }, async tabs => {
            var currentTab = tabs[0];
            if (currentTab.status === 'loading')
                br_source.tabs.onUpdated.addListener(function listener(tabId, info) {
                    if (info.status === 'complete' && tabId === currentTab.id) {
                        br_source.tabs.onUpdated.removeListener(listener);
                        br_source.tabs.duplicate(currentTab.id, newTab => {
                            resolve(newTab.id);
                        });
                    }
                });
            else
                br_source.tabs.duplicate(currentTab.id, newTab => {
                    resolve(newTab.id);
                });
        });
    });
}

/**
 * Активировать вкладку по адресу страницы и (или) заголовку вкладки
 */
async function activateTabAsync(param) {
    const { url: pageUrl, title: tabTitle } = JSON.parse(param);
    const currentWindow = await br_source.windows.getCurrent({ populate: true });

    const match = (value, pattern) =>
        value && (!pattern || pattern === "null" // hack compatibility with 25.1.3 and older
            || wildcardToRegEx(escapeRegExp(pattern).toUpperCase()).test(value.toUpperCase()));
    for (const tab of currentWindow.tabs) {
        const titleMatch = match(tab.title, tabTitle);
        const urlMatch = match(tab.url, pageUrl);
        if (titleMatch && urlMatch) {
            await br_source.tabs.update(tab.id, { active: true });
            return tab.id;
        }
    }

    throw `Tab with Title=${tabTitle} and URL=${pageUrl} does not exist.`;
}

/**
 * Активировать вкладку по её идентификатору
 */
async function activateTabByIdAsync(tabId) {
    if (tabId == undefined)
        throw ("Wrong tab id :" + tabId);

    await br_source.tabs.update(Number(tabId), { active: true });
    return tabId;
}

/**
 * Активировать вкладку по индексу
 */
async function activateTabByIndexAsync(tabIndex) {
    if (tabIndex == undefined)
        throw ("Wrong tab index :" + tabIndex);

    let index = Number(tabIndex);
    let tabs = await br_source.tabs.query({ index: index, currentWindow: true });
    if (tabs.length == 0)
        throw ("Tab with index=" + index + " does not exist.");

    await br_source.tabs.update(tabs[0].id, { active: true });
    return tabs[0].id;
}

var _clickSubscriptions = {};
var _clickSubscriptionsEpoch = 0;

async function registerClickTriggerAsync(message) {
    const { uid: uid, titleRegex: titleRegex, includeChildren: includeChildren, clickParams: clickParams } = JSON.parse(message.param);
    let patternParsed = message.pattern;
    if (typeof message.pattern === 'string') {
        try {
            patternParsed = JSON.parse(message.pattern);
        } catch (ex) { }
    }

    _clickSubscriptions[uid] = {
        titleRegex: titleRegex,
        searchPattern: patternParsed,
        includeChildren: includeChildren,
        clickParams: clickParams
    };
    await br_source.storage.session.set(
        {
            clickSubscriptions: JSON.stringify(_clickSubscriptions),
            clickSubscriptionsEpoch: ++_clickSubscriptionsEpoch
        });

    return [ true ];
}

async function unregisterClickTriggerAsync(uid) {
    delete _clickSubscriptions[uid];
    await br_source.storage.session.set(
        {
            clickSubscriptions: JSON.stringify(_clickSubscriptions),
            clickSubscriptionsEpoch: ++_clickSubscriptionsEpoch
        });

    return true;
}

var _pressSubscriptions = {};
var _pressSubscriptionsEpoch = 0;

async function registerPressTriggerAsync(message) {
    const { uid: uid, titleRegex: titleRegex, includeChildren: includeChildren, pressParams: pressParams } = JSON.parse(message.param);
    let patternParsed = message.pattern;
    if (typeof message.pattern === 'string') {
        try {
            patternParsed = JSON.parse(message.pattern);
        } catch (ex) { }
    }

    _pressSubscriptions[uid] = {
        titleRegex: titleRegex,
        searchPattern: patternParsed,
        includeChildren: includeChildren,
        pressParams: pressParams
    };
    await br_source.storage.session.set(
        {
            pressSubscriptions: JSON.stringify(_pressSubscriptions),
            pressSubscriptionsEpoch: ++_pressSubscriptionsEpoch
        });

    return [true];
}

async function unregisterPressTriggerAsync(uid) {
    delete _pressSubscriptions[uid];
    await br_source.storage.session.set(
        {
            pressSubscriptions: JSON.stringify(_pressSubscriptions),
            pressSubscriptionsEpoch: ++_pressSubscriptionsEpoch
        });

    return true;
}

var _attributeSubscriptions = {};
var _attributeSubscriptionsEpoch = 0;

async function registerAttributeChangedTriggerAsync(message) {
    const { uid: uid, titleRegex: titleRegex, attributeName: attributeName } = JSON.parse(message.param);
    let patternParsed = message.pattern;
    if (typeof message.pattern === 'string') {
        try {
            patternParsed = JSON.parse(message.pattern);
        } catch (ex) { }
    }

    _attributeSubscriptions[uid] = {
        titleRegex: titleRegex,
        searchPattern: patternParsed,
        attributeName: attributeName
    };
    await br_source.storage.session.set(
        {
            attributeSubscriptions: JSON.stringify(_attributeSubscriptions),
            attributeSubscriptionsEpoch: ++_attributeSubscriptionsEpoch
        });

    notifyAllTabsOfAttributesSubscriptionsUpdatedAsync();
    return [ true ];
}

async function unregisterAttributeChangedTriggerAsync(uid) {
    delete _attributeSubscriptions[uid];
    await br_source.storage.session.set(
        {
            attributeSubscriptions: JSON.stringify(_attributeSubscriptions),
            attributeSubscriptionsEpoch: ++_attributeSubscriptionsEpoch
        });

    notifyAllTabsOfAttributesSubscriptionsUpdatedAsync();
    return true;
}

var currentNotifyTimeoutId;
async function notifyAllTabsOfAttributesSubscriptionsUpdatedAsync() {
    if (currentNotifyTimeoutId)
        clearTimeout(currentNotifyTimeoutId);
    await new Promise(r => {
        currentNotifyTimeoutId = setTimeout(r, 1000);
        return currentNotifyTimeoutId;
    });

    br_source.tabs.query({}, tabs => {
        for (var i = 0; i < tabs.length; i++) {
            if (!tabHasContentScript(tabs[i].url))
                continue;
            br_source.tabs.sendMessage(tabs[i].id, { msgId: undefined, msg: { action: "updateAttributeSubscriptions" } }, undefined);
        }
    });
    return;
}

function notifyActiveTabs() {
    br_source.tabs.query({ active: true }, tabs => {
        for (var i = 0; i < tabs.length; i++) {
            if (!tabHasContentScript(tabs[i].url))
                continue;
            br_source.tabs.sendMessage(tabs[i].id, { msgId: undefined, msg: { action: "reevaluateAttributeSubscriptionsVisibility" } }, undefined);
        }
    });
}

/**
 * Свернуть окно, в котором есть вкладка с указанным идентификатором
 */
async function minimizeWindowByTabIdAsync(tabId) {
    if (!tabId) throw new Error("Wrong tab id: " + tabId);

    const tab = await br_source.tabs.get(Number(tabId));
    if (!tab) throw new Error("Tab with id=" + tabId + " does not exist.");

    await br_source.windows.update(tab.windowId, { state: "minimized" });
    return tab.windowId;
}

/**
 * Развернуть окно, в котором есть вкладка с указанным идентификатором
 */
async function maximizeWindowByTabIdAsync(tabId) {
    if (!tabId) throw new Error("Wrong tab id: " + tabId);

    const tab = await br_source.tabs.get(Number(tabId));
    if (!tab) throw new Error("Tab with id=" + tabId + " does not exist.");

    await br_source.windows.update(tab.windowId, { state: "maximized" });
    return tab.windowId;
}

async function executeUserScriptInTabAsync(code, tabIdStr) {
    return await br_source.userScripts.execute(
        {
            injectImmediately: true,
            js: [{ code: code }],
            target: { tabId: parseInt(tabIdStr) }
        });
}

async function executeUserScriptDirectAsync(args) {
    let { code: code, isFunc: isFunc, pattern: pattern, arg: arg } = JSON.parse(args.params);
    let injectionResult;
    if (!isFunc) {
        [ injectionResult ] = await executeUserScriptInTabAsync(code, args.tabId);
    } else {
        [ injectionResult ] = await executeUserScriptInTabAsync(generateUserScriptFuncDirectCode(code, JSON.stringify(pattern), arg), args.tabId);
    }

    if (injectionResult.error)
        throw injectionResult.error;
    return injectionResult.result;
}

async function postResultAsync(id, method, param = undefined) {
    try {
        var res;
        if (param == undefined)
            res = await method();
        else
            res = await method(param);

        port.postMessage({ id: id, result: res, err: null });
        return res;
    }
    catch (err) {
        port.postMessage({ id: id, result: res, err: err });
    }
}

async function raiseEventsAsync(eventName, asyncGeneratorMethod, param = undefined) {
    try {
        if (param == undefined) {
            for await (const event of asyncGeneratorMethod(eventName)) {
                port.postMessage(event);
            }
        } else {
            for await (const event of asyncGeneratorMethod(eventName, param)) {
                port.postMessage(event);
            }
        }
    } catch (err) {
        //skip
    }
}

connect();