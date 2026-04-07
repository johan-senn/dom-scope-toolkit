// ==UserScript==
// @name         Dom Scope Toolkit
// @namespace    https://github.com/johan-senn/dom-scope-toolkit
// @version      0.2
// @description  Exploration DOM accessible clavier (NodeScope)
// @author       Johan Senn
// @match        *://*/*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    if (window.__nodescope_loaded__) {
        return;
    }
    window.__nodescope_loaded__ = true;

    /* ==============================
       Core : registre des modules
    ============================== */

    const modules = [];
    let isActive = false;
    let isInitialized = false;

    function registerModule(module) {
        if (!module) return;
        modules.push(module);
    }

    function initModules() {
        if (isInitialized) return;
        isInitialized = true;

        modules.forEach((m) => {
            if (typeof m.init === 'function') {
                try { m.init(); } catch (e) { console.error(e); }
            }
        });
    }

    function activate() {
        if (isActive) return;
        isActive = true;

        modules.forEach((m) => {
            if (typeof m.onActivate === 'function') {
                try { m.onActivate(); } catch (e) { console.error(e); }
            }
        });
    }

    function deactivate() {
        if (!isActive) return;
        isActive = false;

        modules.forEach((m) => {
            if (typeof m.onDeactivate === 'function') {
                try { m.onDeactivate(); } catch (e) { console.error(e); }
            }
        });
    }

    function getIsActive() {
        return isActive;
    }

    /* ==============================
       Service clavier
    ============================== */

    const shortcuts = [];

    function registerShortcut(shortcut) {
        shortcuts.push(shortcut);
    }

    function initKeyboard() {
        document.addEventListener('keydown', (event) => {
            shortcuts.forEach((s) => {
                if (
                    (!!s.ctrl === event.ctrlKey) &&
                    (!!s.shift === event.shiftKey) &&
                    (!!s.alt === event.altKey) &&
                    (!!s.meta === event.metaKey) &&
                    (!s.code || s.code === event.code)
                ) {
                    event.preventDefault();
                    event.stopPropagation();
                    s.handler(event);
                }
            });
        }, true);
    }

    /* ==============================
       Service état NodeScope
    ============================== */

    let entryNode = null;
    let currentNode = null;
    const listeners = new Set();

    function isHtmlElement(node) {
        return node instanceof HTMLElement;
    }

    function notify() {
        const snapshot = getState();

        listeners.forEach((l) => {
            try { l(snapshot); } catch (e) { console.error(e); }
        });
    }

    function describe(el) {
        if (!isHtmlElement(el)) return 'aucun';

        const tag = el.tagName.toLowerCase();
        const id = el.id ? `#${el.id}` : '';
        const cls = el.classList.length ? '.' + [...el.classList].join('.') : '';

        return `${tag}${id}${cls}`;
    }

    function truncate(text, max) {
        if (!text || text.length <= max) return text;
        return text.slice(0, max - 1) + '…';
    }

    function getSpeech() {
        if (!isHtmlElement(currentNode)) return 'aucun nœud courant';

        const tag = currentNode.tagName.toLowerCase();
        const text = (currentNode.innerText || '').trim();

        return `balise ${tag}${text ? ', texte ' + truncate(text, 60) : ''}`;
    }

    function getState() {
        return {
            entryNode,
            currentNode,
            entryDescription: describe(entryNode),
            currentDescription: describe(currentNode)
        };
    }

    function subscribe(listener) {
        listeners.add(listener);
        return () => listeners.delete(listener);
    }

    function resetState() {
        entryNode = null;
        currentNode = null;
        notify();
    }

    function initFromFocus() {
        const el = document.activeElement;
        if (!isHtmlElement(el)) return false;

        entryNode = el;
        currentNode = el;
        notify();
        return true;
    }

    function moveParent() {
        if (!isHtmlElement(currentNode)) return false;
        const p = currentNode.parentElement;
        if (!isHtmlElement(p)) return false;
        currentNode = p;
        notify();
        return true;
    }

    function moveChild() {
        if (!isHtmlElement(currentNode)) return false;
        const c = currentNode.firstElementChild;
        if (!isHtmlElement(c)) return false;
        currentNode = c;
        notify();
        return true;
    }

    function movePrev() {
        if (!isHtmlElement(currentNode)) return false;
        const s = currentNode.previousElementSibling;
        if (!isHtmlElement(s)) return false;
        currentNode = s;
        notify();
        return true;
    }

    function moveNext() {
        if (!isHtmlElement(currentNode)) return false;
        const s = currentNode.nextElementSibling;
        if (!isHtmlElement(s)) return false;
        currentNode = s;
        notify();
        return true;
    }

    /* ==============================
       UI NodeScope
    ============================== */

    let live = null;
    let switchBtn, label, hint, status, entryBtn, navBtns = [];

    function vh(el) {
        el.style.position = 'absolute';
        el.style.width = '1px';
        el.style.height = '1px';
        el.style.margin = '-1px';
        el.style.overflow = 'hidden';
    }

    function announce(msg) {
        if (!live) return;
        live.textContent = '';
        setTimeout(() => live.textContent = msg, 30);
    }

    function sync() {
        const active = getIsActive();

        switchBtn.setAttribute('aria-checked', active ? 'true' : 'false');

        hint.textContent = active
            ? 'Appuyez sur Espace pour désactiver'
            : 'Appuyez sur Espace pour activer';

        status.textContent = [
            `État : ${active ? 'activé' : 'désactivé'}`,
            `Entrée : ${describe(entryNode)}`,
            `Courant : ${describe(currentNode)}`
        ].join('\n');

        entryBtn.disabled = !active;
        navBtns.forEach(b => b.disabled = !active);
    }

    function move(fn, ok, ko) {
        if (!getIsActive()) {
            announce('NodeScope désactivé');
            return;
        }

        if (!fn()) {
            announce(ko);
            return;
        }

        announce(`${ok} : ${getSpeech()}`);
    }

    function buildUI() {
        live = document.createElement('div');
        live.setAttribute('aria-live', 'polite');
        vh(live);
        document.body.appendChild(live);

        const section = document.createElement('section');
        section.setAttribute('aria-labelledby', 'ns-title');

        const title = document.createElement('h1');
        title.id = 'ns-title';
        title.textContent = 'Interface NodeScope';

        switchBtn = document.createElement('button');
        switchBtn.setAttribute('role', 'switch');
        switchBtn.setAttribute('aria-checked', 'false');

        label = document.createElement('span');
        label.textContent = 'NodeScope';

        hint = document.createElement('span');
        vh(hint);

        switchBtn.appendChild(label);
        switchBtn.addEventListener('click', () => {
            getIsActive() ? deactivate() : activate();
        });

        status = document.createElement('pre');

        entryBtn = document.createElement('button');
        entryBtn.textContent = 'Définir point d’entrée';
        entryBtn.onclick = () => {
            if (initFromFocus()) {
                announce('Point d’entrée défini');
            } else {
                announce('Impossible');
            }
        };

        function nav(label, fn, ok, ko) {
            const b = document.createElement('button');
            b.textContent = label;
            b.onclick = () => move(fn, ok, ko);
            navBtns.push(b);
            return b;
        }

        section.append(
            title,
            switchBtn,
            hint,
            status,
            entryBtn,
            nav('Parent', moveParent, 'Parent', 'Aucun parent'),
            nav('Enfant', moveChild, 'Enfant', 'Aucun enfant'),
            nav('Précédent', movePrev, 'Précédent', 'Aucun précédent'),
            nav('Suivant', moveNext, 'Suivant', 'Aucun suivant')
        );

        document.body.appendChild(section);

        subscribe(sync);
        sync();
    }

    const uiModule = {
        init() {
            buildUI();
        },
        onActivate() {
            if (!currentNode) initFromFocus();
            sync();
            announce('NodeScope activé');
        },
        onDeactivate() {
            resetState();
            sync();
            announce('NodeScope désactivé');
        }
    };

    /* ==============================
       Bootstrap
    ============================== */

    function init() {
        registerModule(uiModule);
        initModules();

        registerShortcut({
            ctrl: true,
            shift: true,
            code: 'Numpad0',
            handler: () => switchBtn.click()
        });

        initKeyboard();
    }

    init();
})();