startup();

let scale = 1;
function getScale() {
    return window.devicePixelRatio / scale;
}

/**
 * Обработчик загрузки страницы
 * @param {any} event данные события
 */
window.onload = function (event) {
    if (window.self !== window.top) return;
    let msg = new EventMessage("PAGE_LOAD");
    postEvent(msg);
};

/**
 * Обработчик события навигации
 * @param {any} event данные события
 */
function handleBeforeUnload(event) {
    if (window.self !== window.top) return;
    let msg = new EventMessage("NAVIGATION");
    postEvent(msg);
}

window.onbeforeunload = handleBeforeUnload;

function getRootWIndow(p) {
    try {
        if (p.window.self === p.window.top) {
            let ll = getRootWIndowTop(p);
            return p.window;
        }
        else {
            let ll = getRootWIndowTop(p);
            return getRootWIndow(p.parent);
        }
    } catch {
        return window;
    }
}

function getRootWIndowTop(p) {
    let l = 0;
    try {
        if (p.window.self === p.window.top) return l;
        else return p.frameElement.offsetTop - p.parent.scrollY + getRootWIndowTop(p.parent);
    } catch {
        return l;
    }
}

function getRootWIndowLeft(p) {
    let l = 0;
    try {
        if (p.window.self === p.window.top) return l;
        else return p.frameElement.offsetLeft - p.parent.scrollX + getRootWIndowLeft(p.parent);
    } catch {
        return l;
    }
}

/**
 * Обработчик события движения мыши
 * @param {any} event данные события
 */
let lastEl = null;
let lastMouse = null;
let evtMMLock = false;
let frameIdx = 0;
function handleMouseMove(event) {
    try {
        if (window.self !== window.top) {
            getRootWIndow(this).isLastFrame = true;
        } else {
            getRootWIndow(this).isLastFrame = false;
        }
        if ((!evtMMLock) && (event.srcElement != lastEl)) {
            evtMMLock = true;
            getRootWIndow(this).lastMouse = new MouseMoveEvent("MOUSE_MOVE", event);
            getRootWIndow(this).lastEl = event.srcElement;
        }
    } catch (e) {
        console.error("Error while getting root", e);
    } finally {
        evtMMLock = false;
    }
};

window.onmousemove = handleMouseMove;

/**
 * Обработчик события нажатия мыши
 */
let lastPressedElement = null;
function handleKeyDown(event) {
    getRootWIndow(this).lastPressedElement = event.srcElement;
};

window.onkeydown = handleKeyDown;

/**
 * Обработчик события выхода мыши из браузера
 */
function handleMouseLeave(event) {
    getRootWIndow(this).lastEl = null;
    getRootWIndow(this).lastMouse = null;
};

document.onmouseleave = handleMouseLeave;

/**
 * Обработчик нажатия мыши
 * @param {any} event данные события
 */
function handleClick(event) {
    let msg = new ClickEvent(event);
    postEvent(msg);
}

document.onclick = handleClick;

function IsElementMatch(pattern, isInChilds, root, element) {
    if (pattern) {
        let resList = findElements(pattern, [root.document]);
        if (resList && resList.length > 0) {
            if (!isInChilds) {
                return resList[0] === element;
            } else {
                return resList[0].contains(element);
            }
        }
    }
    return false;
}

/*
 * Над этим элементом мышка
 */
function IsElementLast(pattern, isInChilds)
{
    let top = getRootWIndow(this);
    if (top.lastEl && pattern)
    {
        if (typeof pattern === 'string')
        {
            try {
                pattern = JSON.parse(pattern);
            }
            catch (ex) { }
            }
        return IsElementMatch(pattern, isInChilds, top, top.lastEl);
        }
    return false;
}

/*
 * Проверка на последний кликнутый элемент
 */
function IsElementPressedLast(pattern, isInChilds) {
    let top = getRootWIndow(this);
    if (top.lastPressedElement && pattern) {
        if (typeof pattern === 'string') {
            try {
                pattern = JSON.parse(pattern);
            }
            catch (ex) { }
            }
        return IsElementMatch(pattern, isInChilds, top, top.lastPressedEl);
        }
    return false;
}

/*
 * Активен ли этот элемент
 */
function IsElementActive(pattern, isInChilds) {
    let top = getRootWIndow(this);
    if (document.activeElement && pattern) {
        if (typeof pattern === 'string') {
            try {
                pattern = JSON.parse(pattern);
            }
            catch (ex) { }
            }
        return IsElementMatch(pattern, isInChilds, top.document, document.activeElement) }
    return false;
}

/* Получает версию браузера */
function getBrowserInfo() {
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

function setElementCoordProperties(el, bounds) {
    var currentFramePosition = getCurrentFrameAbsolutePosition();
    bounds.windowX = 0;//window.screenX;
    bounds.windowY = 0;//window.screenY;
    bounds.elementLeft = Math.round(el.left) * getScale() + currentFramePosition.x;// + currentFramePosition.w;
    bounds.elementTop = Math.round(el.top) * getScale() + currentFramePosition.y;// + currentFramePosition.h;
    bounds.windowOuterHeight = 0;//window.outerHeight;
    bounds.windowInnerHeight = 0;//getRootWIndow(this).innerHeight - getRootWIndowTop(this);
    bounds.windowOuterWidth = 0;//window.outerWidth;
    bounds.windowInnerWidth = 0;//getRootWIndow(this).innerWidth - getRootWIndowLeft(this);
    bounds.devicePixelRatio = window.devicePixelRatio;// window.devicePixelRatio;
    bounds.fs = (Math.abs((screen.availWidth / getScale()) - window.innerWidth) <= 1);
}

function verifyMessageAndScale(msg) {
    if ((msg != null)
        && (msg.msg != null)
        && (msg.msg.pattern != null)
        && (msg.msg.pattern.length > 0)
        && (msg.msg.pattern[0].searchFrames == true)) {
    } else if (window.self !== window.top)
        return false;

    try {
        if (msg.scale != null) scale = msg.scale;
        else if (msg.msg.scale != null) scale = msg.msg.scale;
        else scale = 1;
    } catch (e) {
        scale = 1;
    }
    if (scale <= 0)
        scale = 1;
    return true;
}

var br_source;
function startup() {
    if ((getBrowserInfo().name.toLowerCase() == "chrome") || (getBrowserInfo().name.toLowerCase() == "opera")) {
        br_source = chrome;
    } else {
        br_source = browser;
    }

    br_source.runtime.onMessage.addListener(function (msg, sender, fnResponse) {
        try {
            if (!verifyMessageAndScale(msg)) return;

            if (msg.action == "getPageTitle") {
                fnResponse({ response: getPageTitle(), tabId: msg.tabId, msgId: msg.msgId });
            } else if (msg.action == "getPageURL") {
                fnResponse({ response: getPageURL(), tabId: msg.tabId, msgId: msg.msgId });
            } else if (msg.msg.action == "getPageHTML") {
                fnResponse({ response: getPageHTML(), msgId: msg.msgId });
            } else if (msg.msg.action == "currentURL") {
                fnResponse({ response: getPageURL(), msgId: msg.msgId });
            } else if (msg.msg.action == "findElements") {
                let rr = [];
                frameIdx = 0;
                let els = getElements(msg.msg.pattern);
                for (var i = 0; i < els.length; i++) {

                    let bounds = {};
                    let elb = els[i].getBoundingClientRect();
                    setElementCoordProperties(elb, bounds);
                    let doc = els[i].ownerDocument;
                    let pos = getCurrentFrameAbsolutePosition2(doc.defaultView || doc.parentWindow);
                    bounds.elementLeft = pos.x * getScale() + elb.x * getScale();
                    bounds.elementTop = pos.y * getScale() + elb.y * getScale();
                    bounds.elementWidth = els[i].offsetWidth * getScale();
                    bounds.elementHeight = els[i].offsetHeight * getScale();
                    bounds.elementHTML = els[i].outerHTML;
                    bounds.fs = (Math.abs((screen.availWidth / getScale()) - window.innerWidth) <= 1);
                    bounds.devicePixelRatio = window.devicePixelRatio;

                    rr.push({ html: els[i].outerHTML, val: els[i].value, checked: els[i].checked, bounds: bounds, bounds2: bounds });
                }

                if (window.self == window.top) {
                    fnResponse({ response: rr, msgId: msg.msgId, title: getPageTitle(), url: getPageURL() });
                } else {
                    if (((els.length == 1) && (els[0].ownerDocument == document)) || (els.length != 1))
                        chrome.runtime.sendMessage({ response: rr, msgId: msg.msgId, iframe: true });
                }
            } else if (msg.msg.action == "setScroll") {
                let elements = getElements(msg.msg.pattern);
                var param = JSON.parse(msg.msg.param);
                let x = 0, y = 0;

                if (elements.length > 0) {
                    if (msg.msg.pattern[0].anchorX && msg.msg.pattern[0].anchorY)
                        elements = filterByAnchor(elements, msg.msg.pattern);
                    if (elements.length > 0) {
                        let element = elements[0];

                        var isElementScrollable = isScrollable(element);
                        if (isElementScrollable.horizontal || isElementScrollable.vertical) {
                            if (param.x === undefined)
                                x = element.scrollLeft;
                            else
                                x = Math.round((element.scrollWidth - element.clientWidth) * param.x / 100);

                            if (param.y === undefined)
                                y = element.scrollTop;
                            else
                                y = Math.round((element.scrollHeight - element.clientHeight) * param.y / 100);

                            element.scroll(x, y);
                            fnResponse({ response: { scroll: { x: x, y: y, target: "element" } }, msgId: msg.msgId });
                            return;
                        }
                    }
                }
                let scrollWidth = Math.max(
                    document.body.scrollWidth, document.documentElement.scrollWidth,
                    document.body.offsetWidth, document.documentElement.offsetWidth,
                    document.body.clientWidth, document.documentElement.clientWidth
                );
                let scrollHeight = Math.max(
                    document.body.scrollHeight, document.documentElement.scrollHeight,
                    document.body.offsetHeight, document.documentElement.offsetHeight,
                    document.body.clientHeight, document.documentElement.clientHeight
                );
                if (param.x === undefined)
                    x = window.scrollX;
                else
                    x = Math.round((scrollWidth - window.innerWidth) * param.x / 100);

                if (param.y === undefined)
                    y = window.scrollY;
                else
                    y = Math.round((scrollHeight - window.innerHeight) * param.y / 100);

                window.scroll(x, y);
                fnResponse({ response: { scroll: { x: x, y: y, target: "window" } }, msgId: msg.msgId });
            } else if (msg.msg.action == "getScroll") {
                if (msg.msg.pattern == null) {
                    fnResponse({ response: { scroll: { x: window.scrollX, y: window.scrollY } }, msgId: msg.msgId });
                } else {
                    let els = getElements(msg.msg.pattern);
                    els = filterByAnchor(els, msg.msg.pattern);
                    fnResponse({ response: { scroll: { x: els[0].scrollLeft, y: els[0].scrollTop } }, msgId: msg.msgId });
                }
            } else if (msg.msg.action == "pageInfo") {
                fnResponse({ response: { scroll: { x: window.scrollX, y: window.scrollY } }, msgId: msg.msgId });
            } else if (msg.msg.action.startsWith("executeUserScript_")) {
                //embedded userscript will return the value
                return true;
            } else if (msg.msg.action == "eval") {
                let r = eval(msg.msg.param);
                fnResponse({ response: r, msgId: msg.msgId });
            } else if (msg.msg.action == "eval2") {
                let pp = JSON.parse(msg.msg.param);
                let f = eval(pp.script);
                let el = null;
                if ((pp.pattern != null) && (pp.pattern.length > 0)) {
                    let els = getElements(pp.pattern);
                    if (els.length > 0) el = els[0];
                }
                let r = f(el, pp.arg);
                fnResponse({ response: r, msgId: msg.msgId });
            } else if (msg.msg.action == "navBack") {
                history.back();
                fnResponse({ response: "", msgId: msg.msgId });
            } else if (msg.msg.action == "navForward") {
                history.forward();
                fnResponse({ response: "", msgId: msg.msgId });
            } else if (msg.msg.action == "refresh") {
                window.location.reload(false); 
                fnResponse({ response: "", msgId: msg.msgId });
            } else if (msg.msg.action == "click") {
                let els = getElements(msg.msg.pattern);
                els = filterByAnchor(els, msg.msg.pattern);
                if (els.length > 0) els[0].click();
                fnResponse({ response: "", msgId: msg.msgId });
            } else if (msg.msg.action == "selectClear") {
                let els = getElements(msg.msg.pattern);
                selectClear(els[0]);
                fnResponse({ response: "", msgId: msg.msgId });
            } else if (msg.msg.action == "selectByItem") {
                let els = getElements(msg.msg.pattern);
                selectItem(els[0], msg.msg.param);
                fnResponse({ response: "", msgId: msg.msgId });
            } else if (msg.msg.action == "selectByIndex") {
                let els = getElements(msg.msg.pattern);
                selectIndex(els[0], msg.msg.param);
                fnResponse({ response: "", msgId: msg.msgId });
            } else if (msg.msg.action == "selectGetItems") {
                let els = getElements(msg.msg.pattern);
                let rr = selectGetItems(els[0]);
                fnResponse({ response: rr, msgId: msg.msgId });
            } else if (msg.msg.action == "selectGetCurrentItems") {
                let els = getElements(msg.msg.pattern);
                let rr = selectGetCurrentItems(els[0]);
                fnResponse({ response: rr, msgId: msg.msgId });
            } else if (msg.msg.action == "setAttribute") {
                let els = getElements(msg.msg.pattern);
                setAttributeVal(els[0], JSON.parse(msg.msg.param));
                fnResponse({ response: "", msgId: msg.msgId });
            } else if (msg.msg.action == "setValue") {
                let els = getElements(msg.msg.pattern);
                if (els.length > 0) els[0].value = msg.msg.param;
                fnResponse({ response: "", msgId: msg.msgId });
            } else if (msg.msg.action == "setFocus") {
                let els = getElements(msg.msg.pattern);
                if (els.length > 0) els[0].focus();
                fnResponse({ response: "", msgId: msg.msgId });
            } else if (msg.msg.action == "scrollIntoView") {
                let els = getElements(msg.msg.pattern);
                if (els.length > 0) els[0].scrollIntoView();
                fnResponse({ response: "", msgId: msg.msgId });
            } else if (msg.msg.action == "close") {
                closeWindow();
                fnResponse({ response: "", msgId: msg.msgId });
            } else if (msg.msg.action == "navigateToURL") {
                navigateToURL(msg.msg.param);
                fnResponse({ response: "", msgId: msg.msgId });
            } else if (msg.msg.action == "getLastMouse") {
                let rrr = getRootWIndow(this).lastMouse;
                rrr.isLastFrame = isLastFrame;
                fnResponse({ response: rrr, msgId: msg.msgId, title: getPageTitle(), url: getPageURL() });
            } else if (msg.msg.action == "isElementLast") {
                let isLast = IsElementLast(msg.msg.pattern, msg.msg.param === "true");
                fnResponse({ response: isLast, msgId: msg.msgId });
            } else if (msg.msg.action == "isElementPressedLast") {
                let isLast = IsElementPressedLast(msg.msg.pattern, msg.msg.param === "true");
                fnResponse({ response: isLast, msgId: msg.msgId });
            } else if (msg.msg.action == "refreshWatch") {
                //console.log(`Refreshing watches visibility for ID[${msg.msg.tabId}]:"${getPageTitle()}"`);
                refreshWatchImpl(false, false);
                fnResponse({ response: "", msgId: msg.msgId });
            } else if (msg.msg.action == "setupWatchAttributes") {
                watchAttsImpl([{ pattern: msg.msg.pattern, elid: msg.msg.param }], false);
                fnResponse({ response: "", msgId: msg.msgId });
            } else if (msg.msg.action == "clearWatchAttributes") {
                watchAttsClear(msg.msg.param);
                fnResponse({ response: "", msgId: msg.msgId });
            } else if (msg.msg.action == "processClickTrigger") {
                (async () => {
                    try {
                        let uid = await processClickTriggerAsync(msg.msg.param);
                        fnResponse({ response: uid, msgId: msg.msgId });
                    } catch (e) {
                        fnResponse({ err: e, msgId: msg.msgId });
                    }
                })();
                return true;
            } else if (msg.msg.action == "processPressTrigger") {
                (async () => {
                    try {
                        let uid = await processPressTriggerAsync(msg.msg.param);
                        fnResponse({ response: uid, msgId: msg.msgId });
                    } catch (e) {
                        fnResponse({ err: e, msgId: msg.msgId });
                    }
                })();
                return true;
            } else if (msg.msg.action == "updateAttributeSubscriptions") {
                updateAttributesSubscriptionsIfNeededAsync();
                //no response expected
            } else if (msg.msg.action == "reevaluateAttributeSubscriptionsVisibility") {
                reevaluateAttributeSubscriptionsVisibilityAsync();
                //no response expected
            } else {
                throw ("Неопознанная команда. Возможно, установлено устаревшее расширение.");
            }
        } catch (e) {
            fnResponse({ err: e, msgId: msg.msgId });
        }
    });

    fetchClickSubscriptionsIfNeededAsync();
    fetchPressSubscriptionsIfNeededAsync();
    updateAttributesSubscriptionsIfNeededAsync();
}

/**
 * Отправляет данные на сервер
 * @param {any} data данные
 */
function postEvent(data) {
    try {
        br_source.runtime.sendMessage(data);
    } catch { }
}

/**
 * Получает разметку страницы
 */
function getPageHTML() {
    return document.documentElement.outerHTML;
}

/**
 * Получает заголовок страницы
 */
function getPageTitle() {
    return getRootWIndow(this).document.title;
}

function getPageTitleSafe() {
    let currentTitle;
    try {
        currentTitle = getPageTitle();
    } catch (error) {
        currentTitle = document.title;
    }
    return currentTitle;
}

/**
 * Получает URL страницы
 */
function getPageURL() {
    return getRootWIndow(this).document.URL;
}

/**
 * Закрывает окно
 */
function closeWindow() {
    window.close();
}

/**
 * Переходит к указанной URL
 * @param {any} url URL
 */
function navigateToURL(url) {
    window.location.assign(url);
}

function selectItem(el, item) {
    for (var i = 0; i < el.options.length; i++) {
        if (el.options[i].text === item) {
            el.options[i].selected = true;
            el.dispatchEvent(new Event("change"))
        }
    }
}

function selectIndex(el, index) {
    for (var i = 0; i < el.options.length; i++) {
        if (i == index) {
            el.options[i].selected = true;
            el.dispatchEvent(new Event("change"))
        }
    }
}

function selectClear(el) {
    for (var i = 0; i < el.options.length; i++) {
        el.options[i].selected = false;
        el.dispatchEvent(new Event("change"))
    }
}

function selectGetItems(el) {
    let ret = [];
    for (var i = 0; i < el.options.length; i++) {
        ret.push(el.options[i].text);
    }
    return ret;
}

function selectGetCurrentItems(el) {
    let ret = [];
    for (var i = 0; i < el.options.length; i++) {
        if (el.options[i].selected === true) {
            ret.push(el.options[i].text);
        }
    }
    return ret;
}

function setAttributeVal(el, param) {
    if (param.act == "set") {
        if (param.key == "checked") {
            el.checked = true;
        } else {
            el.setAttribute(param.key, param.value);
        }
    } else if (param.act == "rem") {
        if (param.key == "checked") {
            el.checked = false;
        } else {
            el.removeAttribute(param.key);
        }
    }
}

/**
 * Находит элементы с их размерами по шаблону
 * @param {any} pattern шаблон поиска
 */
function getElementsWSizes(pattern) {
    frameIdx = 0;
    let items = findElements(pattern, [document]);
    let ret = [];
    for (var i = 0; i < items.length; i++) {
        let it = {};
        it.element = items[i];
        it.bounds = {};
        let elb = items[i].getBoundingClientRect();
        setElementCoordProperties(elb, this);
        this.elementWidth = items[i].offsetWidth * window.devicePixelRatio;
        this.elementHeight = items[i].offsetHeight * window.devicePixelRatio;
        this.elementHTML = items[i].outerHTML;
        ret.push(it);
    }
    return ret;
}

/**
 * Фильтрует элементы по якорю
 * @param {any} els исходные элементы
 * @param {any} pattern данные шаблона поиска
 */
function filterByAnchor(els, pattern) {
    if ((pattern == null) || (pattern.length == 0) || (pattern[0].anchorX == null) || (pattern[0].anchorY == null) || (els == null)) {
        return els;
    } else {
        let ret = [];
        for (i = 0; i < els.length; i++) {
            let rect = els[i].getBoundingClientRect();
            switch (pattern[0].anchorPosition) {
                case "LEFT":
                    if (rect.x > pattern[0].anchorX) continue;
                    break;
                case "RIGHT":
                    if (rect.x < pattern[0].anchorX) continue;
                    break;
                case "TOP":
                    if (rect.y > pattern[0].anchorY) continue;
                    break;
                case "BOTTOM":
                    if (rect.y < pattern[0].anchorY) continue;
                    break;
            }
            ret.push(els[i]);
        }
        for (i = 0; i < ret.length; i++) {
            let rect = ret[i].getBoundingClientRect();
            let f = Math.sqrt(Math.pow(Math.abs(rect.x - pattern[0].anchorX), 2) + Math.pow(Math.abs(rect.y - pattern[0].anchorY), 2));
            ret[i].f = f;
        }
        ret.sort((a, b) => (a.f > b.f) ? 1 : ((b.f > a.f) ? -1 : 0)); 
        return ret;
    }
}

/**
 * Нажимает элемент
 * @param {any} pattern шаблон поиска
 */
function nodeClick(pattern) {
    let el = getElements(pattern)[0];
    el.click();
}

let watched_els = [];
/**
 * Очистка наблюдения 
 * @param {any} id
 */
function watchAttsClear(id) {
    var todel = -1;
    for (var j = 0; j < watched_els.length; j++) {
        if (watched_els[j].elid == id) {
            todel = j;
            watchAttsDisconnect(watched_els[j]);
            break;
        }
    }
    if (todel >= 0) watched_els.splice(todel, 1);
}

function watchAttsClearAll() {
    for (var i = 0; i < watched_els.length; i++) {
        if (!watched_els[i].attached)
            continue;
        watchAttsDisconnect(watched_els[i]);
    }
    watched_els = [];
}

function watchAttsDisconnect(watch_element) {
            try {
        watch_element.element.removeEventListener("change", watch_element.listener);
            } catch { }
            try {
        watch_element.observer.disconnect();
            } catch { }
}

/**
 * Создание нового наблюдения
 * @param {any} els_watch
 */
function watchAtts(els_watch) {
    watchAttsImpl(els_watch, true);
}

function watchAttsImpl(els_watch, patternIsString) {
    try {
        for (var i = 0; i < els_watch.length; i++) {
            var f = false;
            var el = els_watch[i];
            for (var j = 0; j < watched_els.length; j++) {
                if (watched_els[j].elid == el.elid) {
                    f = true;
                    break;
                }
            }
            if (f == true) break;
            var patternJSON = patternIsString ? JSON.parse(el.pattern) : el.pattern;
            var primo_els = getElements(patternJSON);
            if (primo_els.length > 0) {
                watched_els.push(watchAddObservers(primo_els[0], el));
            } else {
                watched_els.push({ elid: el.elid, pattern: el.pattern, el: el, attached: false, vis: false });
            }
        }
    } catch { }
}

/**
 * Формирование шаблона наблюдения
 * @param {any} primo_element
 * @param {any} el
 */
function watchAddObservers(primo_element, el) {
    var primo_observer = new MutationObserver(function (mutations) {
        mutations.forEach(function (mutation) {
            if (mutation.type == "attributes") {
                let nv = null;
                try {
                    nv = primo_element.getAttribute(mutation.attributeName);
                } catch { }
                let msg = new AttributeEvent(el.elid, mutation.attributeName, mutation.oldValue, nv);
                postEvent(msg);
            }
        });
    });
    primo_observer.observe(primo_element, {
        attributes: true,
        characterData: true,
        subtree: true,
        attributeOldValue: true
    });
    let listenerFunction = event => {
        if (event.origin && event.origin !== getPageURLSafe()) return; //OWASP A2_2017-Broken_Authentication
        let nv = null;
        try {
            if ((primo_element.textContent == "") || (primo_element.textContent == null)) nv = primo_element.value;
            else nv = primo_element.textContent;
        } catch {}
        let msg = new AttributeEvent(el.elid, ".text", "", nv);
        postEvent(msg);
    };

    primo_element.addEventListener('change', listenerFunction);
    return { elid: el.elid, observer: primo_observer, listener: listenerFunction, element: primo_element, pattern: el.pattern, attached: true, vis: true };
}

let bthread = false;
function refreshWatch() {
    refreshWatchImpl(true, false);
}
/**
 * Обновление наблюдения
 */
function refreshWatchImpl(patternIsString, recheckHidden) {
    if (bthread == false) {
        bthread = true;
        try {
            for (var j = 0; j < watched_els.length; j++) {
                if (watched_els[j].attached === false || recheckHidden && watched_els[j].vis === false) {
                    let patternJSON = patternIsString ? JSON.parse(watched_els[j].pattern) : watched_els[j].pattern;
                    var primo_els = getElements(patternJSON);
                    if (primo_els.length > 0) {
                        watched_els[j] = watchAddObservers(primo_els[0], watched_els[j].el);
                        let msg = new AttributeEvent(watched_els[j].el.elid, ".visibility", false, true);
                        postEvent(msg);
                    }
                } else {
                    if (watched_els[j].vis === true) {
                        let patternJSON = patternIsString ? JSON.parse(watched_els[j].pattern) : watched_els[j].pattern;
                        var primo_els = getElements(patternJSON);
                        if (primo_els.length == 0) {
                            watched_els[j].vis = false;
                            let msg = new AttributeEvent(watched_els[j].el.elid, ".visibility", true, false);
                            postEvent(msg);
                        }
                    }
                }
            }
        } catch { }

        bthread = false;
    }
}

var _clickSubscriptions = {};
var _clickSubscriptionsEpoch = 0;
async function fetchClickSubscriptionsIfNeededAsync() {
    let currentEpoch = await br_source.storage.session.get("clickSubscriptionsEpoch");
    if (currentEpoch.clickSubscriptionsEpoch && (currentEpoch.clickSubscriptionsEpoch > _clickSubscriptionsEpoch)) {
        _clickSubscriptionsEpoch = currentEpoch.clickSubscriptionsEpoch;
        var subscriptions = await br_source.storage.session.get("clickSubscriptions");
        _clickSubscriptions = JSON.parse(subscriptions.clickSubscriptions);
        return true;
    }
    return false;
}

async function processClickTriggerAsync(param) {
    if (await fetchClickSubscriptionsIfNeededAsync())
        await new Promise(r => setTimeout(r, 0));

    let topWindow = getRootWIndow(this);
    let clickedElement = topWindow.lastEl;

    const { button: button, modifiers: modifiers } = JSON.parse(param);
    let frameStart = Date.now();

    let result = [];
    for (const uid in _clickSubscriptions) {
        if (Object.prototype.hasOwnProperty.call(_clickSubscriptions, uid)) {
            if (Date.now() - frameStart > 16) {
                await new Promise(r => setTimeout(r, 0));
                frameStart = Date.now();
            }

            let sub = _clickSubscriptions[uid];
            var matchesTitle = new RegExp(sub.titleRegex).test(getPageTitleSafe().toLowerCase());
            if (!matchesTitle ||
                button !== sub.clickParams.Button ||
                (modifiers & sub.clickParams.Mod) !== sub.clickParams.Mod ||
                (modifiers & sub.clickParams.Mod2) !== sub.clickParams.Mod2)
                continue;

            if (IsElementMatch(sub.searchPattern, sub.includeChildren, topWindow, clickedElement)) {
                result.push(uid);
            }
            else
                continue;
        }
    }
    return result;
}

var _pressSubscriptions = {};
var _pressSubscriptionsEpoch = 0;
async function fetchPressSubscriptionsIfNeededAsync() {
    let currentEpoch = await br_source.storage.session.get("pressSubscriptionsEpoch");
    if (currentEpoch.pressSubscriptionsEpoch && (currentEpoch.pressSubscriptionsEpoch > _pressSubscriptionsEpoch)) {
        _pressSubscriptionsEpoch = currentEpoch.pressSubscriptionsEpoch;
        var subscriptions = await br_source.storage.session.get("pressSubscriptions");
        _pressSubscriptions = JSON.parse(subscriptions.pressSubscriptions);
        return true;
    }
    return false;
}

async function processPressTriggerAsync(param) {
    if (await fetchPressSubscriptionsIfNeededAsync())
        await new Promise(r => setTimeout(r, 0));

    let topWindow = getRootWIndow(this);
    let pressedElement = topWindow.lastPressedElement;

    const { isLegacy: isLegacy, key: key, mod: mod, state: state, mod2: mod2} = JSON.parse(param);
    let frameStart = Date.now();

    let result = [];
    for (const uid in _pressSubscriptions) {
        if (Object.prototype.hasOwnProperty.call(_pressSubscriptions, uid)) {
            if (Date.now() - frameStart > 16) {
                await new Promise(r => setTimeout(r, 0));
                frameStart = Date.now();
            }

            let sub = _pressSubscriptions[uid];
            var matchesTitle = new RegExp(sub.titleRegex).test(getPageTitleSafe().toLowerCase());
            if (!matchesTitle || sub.pressParams.State !== state
                || sub.pressParams.Key !== 0 && key !== sub.pressParams.Key)
                continue;

            if (isLegacy) {
                if (sub.pressParams.Mod !== 0 && mod !== sub.pressParams.Mod
                    || sub.pressParams.Mod2 !== 0 && mod2 !== sub.pressParams.Mod2)
                    continue;
            } else {
                let desiredMods = sub.pressParams.Mod | sub.pressParams.Mod2;
                if ((desiredMods & mod) !== desiredMods)
                    continue;
            }

            if (IsElementMatch(sub.searchPattern, sub.includeChildren, topWindow, pressedElement)) {
                result.push(uid);
            }
            else
                continue;
        }
    }
    return result;
}

var _attributeSubscriptions = {};
var _attributeSubscriptionsEpoch = 0;
async function updateAttributesSubscriptionsIfNeededAsync() {
    let currentEpoch = await br_source.storage.session.get("attributeSubscriptionsEpoch");
    let updated = false;
    if (currentEpoch.attributeSubscriptionsEpoch && (currentEpoch.attributeSubscriptionsEpoch > _attributeSubscriptionsEpoch)) {
        _attributeSubscriptionsEpoch = currentEpoch.attributeSubscriptionsEpoch;
        var subscriptions = await br_source.storage.session.get("attributeSubscriptions");
        _attributeSubscriptions = JSON.parse(subscriptions.attributeSubscriptions);
        updated = true;
    }

    if (!updated)
        return;

    watchAttsClearAll();

    for (const uid in _attributeSubscriptions) {
        if (!Object.prototype.hasOwnProperty.call(_attributeSubscriptions, uid))
            continue;

        let sub = _attributeSubscriptions[uid];
        var matchesTitle = new RegExp(sub.titleRegex).test(getPageTitleSafe().toLowerCase());
        if (!matchesTitle)
            continue;

        watchAttsImpl([{ elid: uid, pattern: sub.searchPattern }]);
    }
}

async function reevaluateAttributeSubscriptionsVisibilityAsync() {
    refreshWatchImpl(false, true);
}

function getCurrentFrameAbsolutePosition2(win) {
    let currentWindow = window;
    if (win != null) currentWindow = win;
    let currentParentWindow;
    let x = 0;
    let y = 0;

    while (currentWindow !== currentWindow.parent) {
        currentParentWindow = currentWindow.parent;
        for (let idx = 0; idx < currentParentWindow.frames.length; idx++) {
            if (currentParentWindow.frames[idx] === currentWindow) {
                for (let frameElement of currentParentWindow.document.getElementsByTagName('iframe')) {
                    if (frameElement.contentWindow === currentWindow) {
                        rect = frameElement.getBoundingClientRect();
                        x += rect.left + frameElement.clientLeft;
                        y += rect.top + frameElement.clientTop;
                    }
                }
                for (let frameElement of currentParentWindow.document.getElementsByTagName('frame')) {
                    if (frameElement.contentWindow === currentWindow) {
                        rect = frameElement.getBoundingClientRect();
                        x += rect.left + frameElement.clientLeft;
                        y += rect.top + frameElement.clientTop;
                    }
                }

                currentWindow = currentParentWindow;
                break;
            }
        }
    }

    return {
        x: currentWindow.screenLeft / getScale() + ((currentWindow.outerWidth / getScale() - currentWindow.innerWidth) * getScale()) / getScale() + x * getScale(),
        y: currentWindow.screenTop / getScale() + ((currentWindow.outerHeight / getScale() - currentWindow.innerHeight) * getScale()) / getScale() + y * getScale()
    };
}

function getCurrentFrameAbsolutePosition() {
    let currentWindow = window;
    let currentParentWindow;
    let positions = [];
    let rect;
    let hf = false;
    let fr = 0;

    while (currentWindow !== window.top) {
        currentParentWindow = currentWindow.parent;
        for (let idx = 0; idx < currentParentWindow.frames.length; idx++)
            if (currentParentWindow.frames[idx] === currentWindow) {
                for (let frameElement of currentParentWindow.document.getElementsByTagName('iframe')) {
                    if (frameElement.contentWindow === currentWindow) {
                        rect = frameElement.getBoundingClientRect();
                        positions.push({ x: rect.x, y: rect.y });
                        hf = true;
                    }
                }
                currentWindow = currentParentWindow;
                break;
            } else {
                fr++;
            }
    }

    let ax = 0;
    let ay = 0;
    if (hf) {
        ax = 0;// currentWindow.scrollX;// / window.devicePixelRatio;
        if (fr > 0) ay = frameElement.getBoundingClientRect().y * -1// 0; //currentWindow.scrollY;// / window.devicePixelRatio;
    }
    //positions.push({ x: currentWindow.screenLeft / window.devicePixelRatio + ((currentWindow.outerWidth - currentWindow.innerWidth) * window.devicePixelRatio) / window.devicePixelRatio - ax, y: currentWindow.screenTop / window.devicePixelRatio + ((currentWindow.outerHeight - currentWindow.innerHeight) * window.devicePixelRatio) / window.devicePixelRatio - ay });
    positions.push({ x: currentWindow.screenLeft / window.devicePixelRatio + ((currentWindow.outerWidth / window.devicePixelRatio - currentWindow.innerWidth) * window.devicePixelRatio) / window.devicePixelRatio - ax, y: currentWindow.screenTop / window.devicePixelRatio + ((currentWindow.outerHeight / window.devicePixelRatio - currentWindow.innerHeight) * window.devicePixelRatio) / window.devicePixelRatio - ay });

    return positions.reduce((accumulator, currentValue) => {
        return {
            x: accumulator.x + currentValue.x * (window.devicePixelRatio),
            y: accumulator.y + currentValue.y * (window.devicePixelRatio)
        };
    }, { x: 0, y: 0 });
}

/** Сообщение о событии */
class EventMessage {

    /**
     * Конструктор
     * @param {any} eventName имя события
     */
    constructor(eventName) {
        var today = new Date();
        this.currentDate = this.pad(today.getDate(), 2) + '.' + this.pad(today.getMonth() + 1, 2) + '.' + today.getFullYear() + '.' +
            this.pad(today.getHours(), 2) + "." + this.pad(today.getMinutes(), 2) + "." + this.pad(today.getSeconds(), 2) + '.' + today.getMilliseconds();
        this.eventName = eventName;
        this.browserVersion = getBrowserInfo();
        this.currentURL = getPageURL();// window.location.href;
        this.currentTitle = getPageTitle();// window.document.title;
        this.documentURL = document.location.href;
    }

    /**
     * Приводит число к строке с лидирующими нулями
     * @param {any} num число
     * @param {any} size размер
     */
    pad(num, size) {
        var s = num + "";
        while (s.length < size) s = "0" + s;
        return s;
    }

    /** Получает версию браузера */
    getBrowserInfo() {
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
}

function buildCss(el) {
    let ret = "";
    try {
        if (el != null) {
            if ((el.parentElement != null) && (el.parentElement.tagName != null) && (el.parentElement.tagName.toLowerCase() != "html")) {
                ret += buildCss(el.parentElement);
                ret += `>${el.parentElement.tagName}`;
            }
        }
    } catch (e) { }
    return ret;
}

function getXPath(element) {
    let selector = '';
    let foundRoot;
    let currentElement = element;

    if (element.parentElement == null)
        return '/html';

    do {
        const tagName = currentElement.tagName.toLowerCase();
        const parentElement = currentElement.parentElement;

        if (parentElement.childElementCount > 1) {
            const parentsChildren = [...parentElement.children];
            let tag = [];
            parentsChildren.forEach(child => {
                if (child.tagName.toLowerCase() === tagName) tag.push(child);
            });

            if (tag.length === 1) {
                selector = `/${tagName}${selector}`;
            } else {
                const position = tag.indexOf(currentElement) + 1;
                selector = `/${tagName}[${position}]${selector}`;
            }

        } else {
            selector = `/${tagName}${selector}`;
        }

        currentElement = parentElement;
        foundRoot = parentElement.tagName.toLowerCase() === 'html';
        if (foundRoot) selector = `/html${selector}`;
    }
    while (foundRoot === false);

    return selector;
}

class MouseMoveEvent extends EventMessage {

    /**
     * Конструктор
     * @param {any} name имя события
     * @param {any} event данные события
     */
    constructor(name, event) {
        super(name);
        if (event != null) {
            let ell = event.srcElement;
            if (event.srcElement.shadowRoot != null) {
                let shroot = event.srcElement;
                this.shadowRoot = [ shroot.outerHTML ];
                ell = event.srcElement.shadowRoot.elementFromPoint(event.x, event.y);
            }

            let elb = ell.getBoundingClientRect();
            let pos = getCurrentFrameAbsolutePosition2();
            this.elementLeft = pos.x * window.devicePixelRatio + elb.x * window.devicePixelRatio;
            this.elementTop = pos.y * window.devicePixelRatio + elb.y * window.devicePixelRatio;
            this.elementWidth = ell.offsetWidth * window.devicePixelRatio;
            this.elementHeight = ell.offsetHeight * window.devicePixelRatio;
            this.elementHTML = ell.outerHTML;
            this.cssSelector = buildCss(ell);
            if ((this.cssSelector != null) && (this.cssSelector.length > 1)) {
                this.cssSelector = this.cssSelector.substr(1);
            } else {
                this.cssSelector = "";
            }
            this.xPathSelector = getXPath(ell);
            this.idx = -1;
            this.bounds2 = {};

            try {
                let pat = {
                    tag: ell.tagName,
                    id: ell.id,
                    name: ell.name
                };
                if (ell.className) {
                    pat.atts = [{ name: "class", value: ell.className }]
                };
                let r = findElements([pat], [document]);
                this.maxFound = r.length;
                if (r.length > 1) {
                    pat.CSSSelector = this.cssSelector;
                    pat.xPathSelector = this.xPathSelector;
                    r = findElements([pat], [document]);
                    if (r.length > 1) {
                        for (var i = 0; i < r.length; i++) {
                            if (r[i] == ell) {
                                this.idx = i + 1;
                                break;
                            }
                        }
                    }
                }
            } catch (e) {

            }

            this.screenX = event.screenX;
            this.screenY = event.screenY;
            this.fs = (Math.abs((screen.availWidth / getScale()) - window.innerWidth) <= 1);
            this.devicePixelRatio = window.devicePixelRatio;
        }
    }

}

/** Событие работы с элементом */
class ElementEvent extends EventMessage {

    /**
     * Конструктор
     * @param {any} name имя события
     * @param {any} event данные события
     */
    constructor(name, event) {
        super(name);
        if (event != null) {
            this.screenX = event.screenX;
            this.screenY = event.screenY;
            this.clientX = event.clientX;
            this.clientY = event.clientY;
            this.readOnly = event.readOnly;

            let el = null;
            if (event.srcElement != null) {
                el = event.srcElement;
            } else if (event.toElement != null) {
                el = event.toElement;
            } else {
                el = document.activeElement;
            }

            if (el != null) {
                this.outerHTML = el.outerHTML;
                this.className = el.className;
                this.placeholder = el.placeholder;
                this.id = el.id;
                this.name = el.name;
                this.type = el.type;
                this.textContent = el.innerText;
                this.tagName = el.tagName;
                this.value = el.value;
                this.clientWidth = el.clientWidth;
                this.clientHeight = el.clientHeight;
                let elb = el.getBoundingClientRect();
                setElementCoordProperties(elb, this);
                this.attributes = [];

                for (let i = 0; i < el.attributes.length; i++) {
                    var att = {};
                    att.name = el.attributes[i].name;
                    att.value = el.attributes[i].value;
                    this.attributes.push(att);
                }
            }
        }
    }
}

/** Сообшение о клике мыши */
class ClickEvent extends ElementEvent {

    /**
     * Конструктор
     * @param {any} event данные события
     */
    constructor(event) {
        super("PAGE_CLICK", event);
    }
}

/** Сообщение об изменении аттрибута */
class AttributeEvent extends EventMessage {

    constructor(id, attr, oldVal, newVal) {
        super("ATT_CHANGE");

        this.attr = attr;
        this.elid = id;
        this.oldVal = oldVal;
        this.newVal = newVal;
    }

    browserName = "Chrome";
}

/** Прокси для отслеживания изменений обработчиков событий */
const handlers = {
    beforeunload: handleBeforeUnload,
    mousemove: handleMouseMove,
    keydown: handleKeyDown,
    mouseleave: handleMouseLeave,
    click: handleClick
};

/** Прокси для предотвращения замены обработчиков */
function createHandlerProxy(target, handlers) {
    return new Proxy(target, {
        set(obj, prop, value) {
            const eventType = prop.slice(2);
            if (prop.startsWith('on') && handlers[eventType]) {
                console.warn(`Prevented modification of ${prop} handler`);
                return false;
            }
            obj[prop] = value;
            return true;
        }
    });
}

/**  Установка и восстановление обработчиков */
function setupHandlers() {
    const eventTypes = Object.keys(handlers);

    eventTypes.forEach(eventType => {
        window[`on${eventType}`] = handlers[eventType];
        document[`on${eventType}`] = handlers[eventType];
    });

    setInterval(() => {
        eventTypes.forEach(eventType => {
            const windowHandler = window[`on${eventType}`];
            const documentHandler = document[`on${eventType}`];

            if (windowHandler !== handlers[eventType]) {
                window[`on${eventType}`] = handlers[eventType];
            }
            if (documentHandler !== handlers[eventType]) {
                document[`on${eventType}`] = handlers[eventType];
            }
        });
    }, 1000);
}

/** Создание прокси */
const windowProxy = createHandlerProxy(window, handlers);
const documentProxy = createHandlerProxy(document, handlers);

/** Инициализация обработчиков */
setupHandlers();
