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
        if (!module) {
            return;
        }

        modules.push(module);
    }

    function initModules() {
        if (isInitialized) {
            return;
        }

        isInitialized = true;

        modules.forEach((module) => {
            if (typeof module.init === 'function') {
                try {
                    module.init();
                } catch (error) {
                    console.error(error);
                }
            }
        });
    }

    function activate() {
        if (isActive) {
            return;
        }

        isActive = true;

        modules.forEach((module) => {
            if (typeof module.onActivate === 'function') {
                try {
                    module.onActivate();
                } catch (error) {
                    console.error(error);
                }
            }
        });
    }

    function deactivate() {
        if (!isActive) {
            return;
        }

        isActive = false;

        modules.forEach((module) => {
            if (typeof module.onDeactivate === 'function') {
                try {
                    module.onDeactivate();
                } catch (error) {
                    console.error(error);
                }
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
    let keyboardInitialized = false;

    function registerShortcut(shortcut) {
        const hasHandler = shortcut && typeof shortcut.handler === 'function';

        if (!shortcut || !hasHandler) {
            console.warn('Raccourci invalide ignoré');
            return;
        }

        shortcuts.push(shortcut);
    }

    function initKeyboard() {
        if (keyboardInitialized) {
            return;
        }

        keyboardInitialized = true;
        document.addEventListener('keydown', handleKeydown, true);
    }

    function handleKeydown(event) {
        shortcuts.forEach((shortcut) => {
            if (!matchShortcut(event, shortcut)) {
                return;
            }

            event.preventDefault();
            event.stopPropagation();
            shortcut.handler(event);
        });
    }

    function matchShortcut(event, shortcut) {
        const expectedKey = typeof shortcut.key === 'string'
            ? shortcut.key.toLowerCase()
            : null;

        const expectedCode = typeof shortcut.code === 'string'
            ? shortcut.code
            : null;

        const keyMatches = expectedKey
            ? (event.key || '').toLowerCase() === expectedKey
            : true;

        const codeMatches = expectedCode
            ? event.code === expectedCode
            : true;

        return (
            (!!shortcut.ctrl === event.ctrlKey) &&
            (!!shortcut.shift === event.shiftKey) &&
            (!!shortcut.alt === event.altKey) &&
            (!!shortcut.meta === event.metaKey) &&
            keyMatches &&
            codeMatches
        );
    }

    /* ==============================
       Service état NodeScope
    ============================== */

    let entryNode = null;
    let currentNode = null;
    const stateListeners = new Set();

    function isHtmlElement(node) {
        return node instanceof HTMLElement;
    }

    function notifyStateChange() {
        const snapshot = getNodeScopeState();

        stateListeners.forEach((listener) => {
            try {
                listener(snapshot);
            } catch (error) {
                console.error(error);
            }
        });
    }

    function describeNode(element) {
        if (!isHtmlElement(element)) {
            return 'aucun';
        }

        const tag = element.tagName.toLowerCase();
        const id = element.id ? `#${element.id}` : '';
        const classes = element.classList.length
            ? '.' + Array.from(element.classList).join('.')
            : '';

        return `${tag}${id}${classes}`;
    }

    function truncateText(text, maxLength) {
        if (!text || text.length <= maxLength) {
            return text;
        }

        return text.slice(0, maxLength - 1) + '…';
    }

    function getCurrentNodeSpeechText() {
        if (!isHtmlElement(currentNode)) {
            return 'aucun nœud courant';
        }

        const tag = currentNode.tagName.toLowerCase();
        const text = (currentNode.innerText || '').trim();

        return `balise ${tag}${text ? ', texte ' + truncateText(text, 60) : ''}`;
    }

    function getNodeScopeState() {
        return {
            entryNode,
            currentNode,
            entryDescription: describeNode(entryNode),
            currentDescription: describeNode(currentNode)
        };
    }

    function subscribeNodeScopeState(listener) {
        stateListeners.add(listener);
        return () => stateListeners.delete(listener);
    }

    function resetNodeScopeState() {
        entryNode = null;
        currentNode = null;
        notifyStateChange();
    }

    function initializeNodeScopeFromFocus() {
        const focusedElement = document.activeElement;

        if (!isHtmlElement(focusedElement)) {
            return false;
        }

        entryNode = focusedElement;
        currentNode = focusedElement;
        notifyStateChange();

        return true;
    }

    function moveToParent() {
        if (!isHtmlElement(currentNode)) {
            return false;
        }

        const parent = currentNode.parentElement;

        if (!isHtmlElement(parent)) {
            return false;
        }

        currentNode = parent;
        notifyStateChange();

        return true;
    }

    function moveToFirstChild() {
        if (!isHtmlElement(currentNode)) {
            return false;
        }

        const child = currentNode.firstElementChild;

        if (!isHtmlElement(child)) {
            return false;
        }

        currentNode = child;
        notifyStateChange();

        return true;
    }

    function moveToPreviousSibling() {
        if (!isHtmlElement(currentNode)) {
            return false;
        }

        const sibling = currentNode.previousElementSibling;

        if (!isHtmlElement(sibling)) {
            return false;
        }

        currentNode = sibling;
        notifyStateChange();

        return true;
    }

    function moveToNextSibling() {
        if (!isHtmlElement(currentNode)) {
            return false;
        }

        const sibling = currentNode.nextElementSibling;

        if (!isHtmlElement(sibling)) {
            return false;
        }

        currentNode = sibling;
        notifyStateChange();

        return true;
    }

    /* ==============================
       UI NodeScope
    ============================== */

    const UI_IDS = {
        liveRegion: 'nodescope-live-region',
        section: 'nodescope-interface',
        title: 'nodescope-interface-title',
        switch: 'nodescope-switch',
        switchLabel: 'nodescope-switch-label',
        switchHint: 'nodescope-switch-hint',
        status: 'nodescope-status',
        setEntryButton: 'nodescope-set-entry-button',
        navGroup: 'nodescope-nav-group'
    };

    let liveRegion = null;
    let switchControl = null;
    let switchVisibleLabel = null;
    let switchDescription = null;
    let statusBlock = null;
    let setEntryButton = null;
    let navButtons = [];
    let unsubscribeState = null;

    function applyVisuallyHiddenStyles(element) {
        element.style.position = 'absolute';
        element.style.width = '1px';
        element.style.height = '1px';
        element.style.margin = '-1px';
        element.style.border = '0';
        element.style.padding = '0';
        element.style.overflow = 'hidden';
        element.style.clip = 'rect(0 0 0 0)';
        element.style.whiteSpace = 'nowrap';
    }

    function createLiveRegion() {
        if (liveRegion) {
            return;
        }

        const existing = document.getElementById(UI_IDS.liveRegion);

        if (existing) {
            liveRegion = existing;
            return;
        }

        liveRegion = document.createElement('div');
        liveRegion.id = UI_IDS.liveRegion;
        liveRegion.setAttribute('aria-live', 'polite');
        liveRegion.setAttribute('aria-atomic', 'true');

        applyVisuallyHiddenStyles(liveRegion);

        document.body.appendChild(liveRegion);
    }

    function announce(message) {
        if (!liveRegion) {
            return;
        }

        liveRegion.textContent = '';

        window.setTimeout(() => {
            liveRegion.textContent = message;
        }, 50);
    }

    function getStatusText() {
        const state = getNodeScopeState();
        const activeText = getIsActive() ? 'activé' : 'désactivé';

        return [
            `État : ${activeText}`,
            `Point d’entrée : ${state.entryDescription}`,
            `Nœud courant : ${state.currentDescription}`
        ].join('\n');
    }

    function handleMove(actionFn, successMessage, failureMessage) {
        if (!getIsActive()) {
            announce('NodeScope est désactivé');
            return;
        }

        const success = actionFn();

        if (!success) {
            announce(failureMessage);
            return;
        }

        announce(`${successMessage} : ${getCurrentNodeSpeechText()}`);
    }

    function syncNodeScopeInterface() {
        if (!switchControl || !statusBlock || !setEntryButton) {
            return;
        }

        const active = getIsActive();

        switchControl.setAttribute('aria-checked', active ? 'true' : 'false');

        switchVisibleLabel.textContent = 'NodeScope';

        switchDescription.textContent = active
            ? 'Appuyez sur Espace pour désactiver'
            : 'Appuyez sur Espace pour activer';

        statusBlock.textContent = getStatusText();

        setEntryButton.disabled = !active;

        navButtons.forEach((button) => {
            button.disabled = !active;
        });
    }

    function handleSwitchActivation() {
        if (getIsActive()) {
            deactivate();
        } else {
            activate();
        }

        switchControl.focus();
    }

    function handleSetEntryFromFocus() {
        if (!getIsActive()) {
            announce('NodeScope est désactivé');
            return;
        }

        const success = initializeNodeScopeFromFocus();

        if (!success) {
            announce('Aucun élément focalisé exploitable');
            return;
        }

        announce('Point d’entrée défini');
    }

    function createButton(label, handler) {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = label;
        button.addEventListener('click', handler);
        return button;
    }

    function createNavigationGroup() {
        const group = document.createElement('div');
        group.id = UI_IDS.navGroup;
        group.setAttribute('role', 'group');
        group.setAttribute('aria-label', 'Navigation DOM');

        const btnParent = createButton('Noeud parent', () =>
            handleMove(moveToParent, 'Noeud parent', 'Aucun noeud parent')
        );

        const btnChild = createButton('Noeud enfant', () =>
            handleMove(moveToFirstChild, 'Noeud enfant', 'Aucun noeud enfant')
        );

        const btnPrev = createButton('Frère précédent', () =>
            handleMove(moveToPreviousSibling, 'Frère précédent', 'Aucun frère précédent')
        );

        const btnNext = createButton('Frère suivant', () =>
            handleMove(moveToNextSibling, 'Frère suivant', 'Aucun frère suivant')
        );

        navButtons = [btnParent, btnChild, btnPrev, btnNext];

        group.appendChild(btnParent);
        group.appendChild(btnChild);
        group.appendChild(btnPrev);
        group.appendChild(btnNext);

        return group;
    }

    function createNodeScopeInterface() {
        const existing = document.getElementById(UI_IDS.section);

        if (existing) {
            return;
        }

        const section = document.createElement('section');
        section.id = UI_IDS.section;
        section.setAttribute('aria-labelledby', UI_IDS.title);

        const title = document.createElement('h1');
        title.id = UI_IDS.title;
        title.textContent = 'Interface NodeScope';

        switchControl = document.createElement('button');
        switchControl.id = UI_IDS.switch;
        switchControl.type = 'button';
        switchControl.setAttribute('role', 'switch');
        switchControl.setAttribute('aria-checked', 'false');
        switchControl.setAttribute('aria-labelledby', UI_IDS.switchLabel);
        switchControl.setAttribute('aria-describedby', UI_IDS.switchHint);

        switchVisibleLabel = document.createElement('span');
        switchVisibleLabel.id = UI_IDS.switchLabel;
        switchVisibleLabel.textContent = 'NodeScope';

        switchDescription = document.createElement('span');
        switchDescription.id = UI_IDS.switchHint;
        applyVisuallyHiddenStyles(switchDescription);

        switchControl.appendChild(switchVisibleLabel);
        switchControl.addEventListener('click', handleSwitchActivation);

        statusBlock = document.createElement('pre');
        statusBlock.id = UI_IDS.status;
        statusBlock.setAttribute('aria-live', 'polite');
        statusBlock.setAttribute('aria-atomic', 'true');

        setEntryButton = createButton(
            'Définir le point d’entrée depuis l’élément focalisé',
            handleSetEntryFromFocus
        );

        const navGroup = createNavigationGroup();

        section.appendChild(title);
        section.appendChild(switchControl);
        section.appendChild(switchDescription);
        section.appendChild(statusBlock);
        section.appendChild(setEntryButton);
        section.appendChild(navGroup);

        document.body.appendChild(section);

        syncNodeScopeInterface();
    }

    function triggerNodeScopeSwitch() {
        if (!switchControl) {
            const existing = document.getElementById(UI_IDS.switch);

            if (existing) {
                switchControl = existing;
            }
        }

        if (!switchControl) {
            announce('Interface NodeScope non prête');
            return;
        }

        switchControl.click();
    }

    const nodeScopeUiModule = {
        name: 'nodescope-ui',

        init() {
            if (!document.body) {
                return;
            }

            createLiveRegion();
            createNodeScopeInterface();

            if (!unsubscribeState) {
                unsubscribeState = subscribeNodeScopeState(() => {
                    syncNodeScopeInterface();
                });
            }

            syncNodeScopeInterface();
        },

        onActivate() {
            const state = getNodeScopeState();

            if (!state.entryNode || !state.currentNode) {
                initializeNodeScopeFromFocus();
            }

            syncNodeScopeInterface();
            announce('NodeScope activé');
        },

        onDeactivate() {
            resetNodeScopeState();
            syncNodeScopeInterface();
            announce('NodeScope désactivé');
        }
    };

    /* ==============================
       Bootstrap
    ============================== */

    function init() {
        if (!document.body) {
            window.setTimeout(init, 50);
            return;
        }

        registerModule(nodeScopeUiModule);
        initModules();

        registerShortcut({
            ctrl: true,
            shift: true,
            alt: false,
            meta: false,
            code: 'Numpad0',
            handler: () => {
                triggerNodeScopeSwitch();
            }
        });

        initKeyboard();
    }

    init();
})();