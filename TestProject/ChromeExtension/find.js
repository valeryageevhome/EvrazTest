//Все эти функции попадают в глобальный неймспейс расширения и доступны в content.js без явных импортов (штатный функционал api расширений хрома)

/**
 * Находит пересечения массивов
 * @param {any} array1
 * @param {any} array2
 */
function arrayIntersect(array1, array2) {
    return array1.filter(function (n) {
        return array2.indexOf(n) !== -1;
    });
}

function getFirstElementFromPattern(pp) {
    let el = null;
    if ((pp != null) && (pp.length > 0)) {
        let els = getElements(pp);
        if (els.length > 0) el = els[0];
    }
    return el;
}

/**
 * Находит элементы по шаблону
 * @param {any} pattern шаблон поиска
 */
function getElements(pattern) {
    frameIdx = 0;
    let ret = findElements(pattern, [document]);
    return ret;
}

/**
 * Ищет элементы
 * @param {any} pattern шаблон поиска
 * @param {any} nodesarr массив поиска
 */
function findElements(pattern, nodesarr, win, idx) {
    let result = []; // накапливаем результат
    let ret = [];
    if (pattern != null) {
        //признак нового поиска
        let modeNew = pattern[0].searchOptions == null ? false : pattern[0].searchOptions.ExtLayersTransitionFix;
        //признак прерывания в старом поиске с обнулением результатов
        let searchInterrupted = true;
        for (var k = 0; k < nodesarr.length; k++) {

            if (searchInterrupted) {
                searchInterrupted = false;
                //поиск не дошел до конца
                ret = [];
                //в старом поиске результат затирался
                if (!modeNew) result = [];
            }

            src = nodesarr[k];
            if (nodesarr[k].contentWindow != null)
                src = nodesarr[k].contentWindow.document;

            if (pattern[0].XPathSelector) {
                let nodes = document.evaluate(pattern[0].XPathSelector, src, null, XPathResult.ORDERED_NODE_ITERATOR_TYPE, null);
                if (nodes.length == 0) {
                    searchInterrupted = true;
                    continue;
                } else {
                    let tnodes = [];
                    let fnd = false;
                    while (node = nodes.iterateNext()) {
                        tnodes.push(node);
                        fnd = true;
                    }
                    if (!fnd) {
                        searchInterrupted = true;
                        continue;
                    }
                    if (ret.length == 0) ret = Array.from(tnodes);
                    else {
                        ret = arrayIntersect(ret, Array.from(tnodes));
                    }
                }
            } else {
                if (pattern[0].CSSSelector) {
                    let nodes = src.querySelectorAll(pattern[0].CSSSelector + '>*');
                    if (nodes.length == 0) {
                        searchInterrupted = true;
                        continue;
                    } else {
                        ret = ret.length == 0 ? Array.from(nodes) : arrayIntersect(ret, Array.from(nodes));
                    }
                }
                // normal value kind
                if (pattern[0].tag && pattern[0].tagValueKind != 1) {
                    let nodes = src.querySelectorAll(pattern[0].tag.replace("*", "$"));
                    if (nodes.length == 0) {
                        searchInterrupted = true;
                        continue;
                    } else {
                        ret = ret.length == 0 ? Array.from(nodes) : arrayIntersect(ret, Array.from(nodes));
                    }
                }
                if (pattern[0].id && pattern[0].idValueKind != 1) {
                    let nodes = src.querySelectorAll("#" + CSS.escape(pattern[0].id.replace("*", "$")));
                    if (nodes.length == 0) {
                        searchInterrupted = true;
                        continue;
                    } else {
                        ret = ret.length == 0 ? Array.from(nodes) : arrayIntersect(ret, Array.from(nodes));
                    }
                }
                if (pattern[0].text && pattern[0].textValueKind != 1) {
                    let ptrn = "//*[text()='" + pattern[0].text + "']";
                    if (pattern[0].text.indexOf("*") >= 0)
                        ptrn = "//*[contains(text(), '" + pattern[0].text.replaceAll("*", "") + "')]";
                    let nodes = document.evaluate(ptrn, src, null, XPathResult.ORDERED_NODE_ITERATOR_TYPE, null);
                    if (nodes.length == 0) {
                        searchInterrupted = true;
                        continue;
                    } else {
                        let tnodes = [];
                        let fnd = false;
                        while (node = nodes.iterateNext()) {
                            tnodes.push(node);
                            fnd = true;
                        }
                        if (!fnd) {
                            searchInterrupted = true;
                            continue;
                        }
                        if (ret.length == 0) ret = Array.from(tnodes)
                        else {
                            ret = arrayIntersect(ret, Array.from(tnodes));
                        }
                    }
                }
                // regex value kind
                if (ret.length == 0) {
                    let nodelist = document.querySelectorAll('*');
                    ret = Array.from(nodelist);
                }
                if (pattern[0].tag && pattern[0].tagValueKind == 1) {
                    let regex = new RegExp(pattern[0].tag, "i");
                    ret = ret.filter(el => regex.test(el.tagName));
                    if (ret.length == 0)
                        continue;
                }
                if (pattern[0].id && pattern[0].idValueKind == 1) {
                    let regex = new RegExp(pattern[0].id, "i");
                    ret = ret.filter(el => regex.test(el.id));
                    if (ret.length == 0)
                        continue;
                }
                if (pattern[0].text && pattern[0].textValueKind == 1) {
                    let regex = new RegExp(pattern[0].text, "i");
                    let ret1 = ret.filter(el => regex.test(el.text));
                    if (ret1.length > 0)
                        ret = ret1;
                    else
                        ret = ret.filter(el => regex.test(el.innerText));
                }
                let attributes = pattern[0].atts;
                if (attributes) {
                    let normalAttributes = attributes.filter(el => el.valueKind != 1);
                    if (normalAttributes.length > 0) {
                        let p = "*";
                        for (var j = 0; j < normalAttributes.length; j++) {
                            p = p +
                                "[" +
                                normalAttributes[j].name +
                                (normalAttributes[j].value.includes("*") ? "*" : "") +
                                "='" +
                                normalAttributes[j].value.replaceAll("*", "") +
                                "']";
                        }
                        let nodes = src.querySelectorAll(p);
                        if (nodes.length == 0) {
                            searchInterrupted = true;
                            continue;
                        } else {
                            ret = ret.length == 0 ? Array.from(nodes) : arrayIntersect(ret, Array.from(nodes));
                        }
                    }
                    // valueKind is new feature since 1.25.1
                    let regexAttributes = attributes.filter(el => el.valueKind == 1);
                    if (regexAttributes.length > 0) {
                        for (var j = 0; j < regexAttributes.length; j++) {
                            let attName = regexAttributes[j].name.toLowerCase();
                            let attValue = regexAttributes[j].value;
                            if (attValue) {
                                let regex = new RegExp(attValue, "i");
                                ret = ret.filter(el => {
                                    if (el.attributes[attName])
                                        return regex.test(el.attributes[attName].value);
                                    else
                                        return false;
                                });
                                if (ret.length == 0)
                                    continue;
                            }
                        }
                    }
                }
            }

            if (pattern[0].idx != null) {
                idx = idx ?? 0;
                if (pattern[0].idx < 1
                    || ret.length - 1 < (pattern[0].idx - 1 - idx)) {
                    idx = ret.length;
                    searchInterrupted = true;
                    continue;
                } else {
                    ret = [ret[pattern[0].idx - 1 - idx]];
                }
            }

            if ((pattern.length > 1) && (ret.length > 0)) {
                let rret = null;
                try {
                    let sh = [];
                    for (var si = 0; si < ret.length; si++) {
                        if (ret[si].shadowRoot != null) sh.push(ret[si].shadowRoot);
                    }
                    rret = findElements(pattern.slice(1), sh);
                } catch {
                }
                if ((rret != null) && (rret.length > 0)) {
                    ret = rret;
                } else {
                    ret = findElements(pattern.slice(1), ret);
                }
            }

            //Формируем результат для старого и нового поиска
            if (ret.length == 0) continue;
            else {
                if (result.length == 0) result = Array.from(ret);
                else {
                    result = arrayIntersect(result, Array.from(ret));
                }
            }
        }

        if ((pattern[0].searchFrames == true) && (frameIdx < 30)) {
            if (win == null) win = window;
            frameIdx = frameIdx + 1;
            for (var k = 0; k < win.frames.length; k++) {
                try {
                    let r2 = findElements(pattern, [window.frames[k].document], window.frames[k], idx);
                    for (var kk = 0; kk < r2.length; r2++) {
                        result.push(r2[kk]);
                    }
                } catch { }
            }
        }

    }
    return result;
}

/**
 * Определяет, имеет ли элемент полосы прокрутки
 * @param {any} node элемент
 */
function isScrollable(node) {
    var overflowY = window.getComputedStyle(node)['overflow-y'];
    var overflowX = window.getComputedStyle(node)['overflow-x'];
    return {
        vertical: (overflowY === 'scroll' || overflowY === 'auto') && node.scrollHeight > node.clientHeight,
        horizontal: (overflowX === 'scroll' || overflowX === 'auto') && node.scrollWidth > node.clientWidth,
    };
}