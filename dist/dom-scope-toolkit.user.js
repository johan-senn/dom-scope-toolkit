// ==UserScript==
// @name         Dom Scope Toolkit
// @namespace    https://github.com/johan-senn/dom-scope-toolkit
// @version      0.11
// @description  Exploration DOM accessible clavier (NodeScope)
// @author       Johan Senn
// @match        *://*/*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    const USERSCRIPT_VERSION = '0.8';

    if (window.__nodescope_loaded__) {
        return;
    }
    window.__nodescope_loaded__ = true;

    /* ===== src/core/module-registry.js ===== */

    const modules = [];
    let isActive = false;
    let isInitialized = false;

    function registerModule(module) {
        const hasInit = module && typeof module.init === 'function';
        const hasOnActivate = module && typeof module.onActivate === 'function';
        const hasOnDeactivate = module && typeof module.onDeactivate === 'function';

        if (!module || (!hasInit && !hasOnActivate && !hasOnDeactivate)) {
            console.warn('Module invalide ignoré');
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
            try {
                if (typeof module.init === 'function') {
                    module.init();
                }
            } catch (error) {
                console.error('Erreur lors de l’initialisation d’un module :', error);
            }
        });
    }

    function activate() {
        if (isActive) {
            return;
        }

        isActive = true;

        modules.forEach((module) => {
            try {
                if (typeof module.onActivate === 'function') {
                    module.onActivate();
                }
            } catch (error) {
                console.error('Erreur lors de l’activation d’un module :', error);
            }
        });
    }

    function deactivate() {
        if (!isActive) {
            return;
        }

        isActive = false;

        modules.forEach((module) => {
            try {
                if (typeof module.onDeactivate === 'function') {
                    module.onDeactivate();
                }
            } catch (error) {
                console.error('Erreur lors de la désactivation d’un module :', error);
            }
        });
    }

    function getIsActive() {
        return isActive;
    }

    /* ===== src/services/keyboard-service.js ===== */

    const shortcuts = [];
    let keyboardIsInitialized = false;

    const pressedCodes = new Set();
    const comboState = new Map();

    const MULTI_PRESS_DELAY = 350;

    const CONTROL_CODES = new Set(['ControlLeft', 'ControlRight']);
    const SHIFT_CODES = new Set(['ShiftLeft', 'ShiftRight']);
    const ALT_CODES = new Set(['AltLeft', 'AltRight']);
    const META_CODES = new Set(['MetaLeft', 'MetaRight']);

    let activeShortcutCandidate = null;
    let activeShortcutExtraKeyDetected = false;

    function registerShortcut(shortcut) {
        const hasHandler = shortcut && typeof shortcut.handler === 'function';

        if (!shortcut || !hasHandler) {
            console.warn('Raccourci invalide ignoré');
            return;
        }

        shortcuts.push(normalizeShortcut(shortcut));
    }

    function initKeyboard() {
        if (keyboardIsInitialized) {
            return;
        }

        keyboardIsInitialized = true;

        document.addEventListener('keydown', handleKeydown, true);
        document.addEventListener('keyup', handleKeyup, true);
        window.addEventListener('blur', resetKeyboardState, true);
    }

    function handleKeydown(event) {
        if (event.repeat) {
            return;
        }

        pressedCodes.add(event.code);

        const matchingShortcuts = shortcuts.filter((shortcut) => (
            canOpenCandidate(event, shortcut) &&
            isShortcutEnabled(shortcut, event)
        ));

        if (!matchingShortcuts.length) {
            if (activeShortcutCandidate && !isModifierCode(event.code)) {
                activeShortcutExtraKeyDetected = true;
            }
            return;
        }

        const bestShortcut = selectBestCandidate(matchingShortcuts);

        if (!bestShortcut) {
            return;
        }

        if (
            activeShortcutCandidate &&
            activeShortcutCandidate.identity === bestShortcut.identity &&
            !belongsToShortcut(event.code, bestShortcut)
        ) {
            activeShortcutExtraKeyDetected = true;
            return;
        }

        if (!activeShortcutCandidate || activeShortcutCandidate.identity !== bestShortcut.identity) {
            activeShortcutCandidate = bestShortcut;
            activeShortcutExtraKeyDetected = false;
        }
    }

    function handleKeyup(event) {
        const pressedBeforeRelease = new Set(pressedCodes);

        if (
            activeShortcutCandidate &&
            !activeShortcutExtraKeyDetected &&
            isShortcutEnabled(activeShortcutCandidate, event) &&
            isValidKeyupForShortcut(event, activeShortcutCandidate, pressedBeforeRelease)
        ) {
            event.preventDefault();
            event.stopPropagation();
            dispatchShortcut(activeShortcutCandidate, event);
        }

        pressedCodes.delete(event.code);

        if (
            activeShortcutCandidate &&
            shouldClearCandidateAfterKeyup(activeShortcutCandidate, pressedCodes)
        ) {
            clearActiveShortcutCandidate();
        }
    }

    function resetKeyboardState() {
        pressedCodes.clear();
        clearActiveShortcutCandidate();

        comboState.forEach((state) => {
            if (state && state.timerId) {
                window.clearTimeout(state.timerId);
            }
        });

        comboState.clear();
    }

    function normalizeShortcut(shortcut) {
        const normalizedCodes = Array.isArray(shortcut.codes)
            ? Array.from(new Set(shortcut.codes))
            : (typeof shortcut.code === 'string' ? [shortcut.code] : []);

        return {
            ...shortcut,
            codes: normalizedCodes,
            identity: getShortcutIdentity({
                ...shortcut,
                codes: normalizedCodes
            })
        };
    }

    function dispatchShortcut(shortcut, event) {
        const siblingMultiPressExists = hasSiblingMultiPressShortcut(shortcut);
        const expectedPressCount = Number(shortcut.pressCount || 1);

        if (expectedPressCount > 1 || siblingMultiPressExists) {
            queueMultiPressHandlers(event, shortcut);
            return;
        }

        shortcut.handler(event);
    }

    function hasSiblingMultiPressShortcut(shortcut) {
        return shortcuts.some(
            (candidate) => candidate !== shortcut && candidate.identity === shortcut.identity
        );
    }

    function queueMultiPressHandlers(event, shortcut) {
        const identity = shortcut.identity;
        const previous = comboState.get(identity);

        if (previous && previous.timerId) {
            window.clearTimeout(previous.timerId);
        }

        const nextCount = previous ? previous.count + 1 : 1;

        const timerId = window.setTimeout(() => {
            const finalState = comboState.get(identity);

            if (!finalState) {
                return;
            }

            const exactShortcut = finalState.shortcuts
                .slice()
                .sort((a, b) => Number(b.pressCount || 1) - Number(a.pressCount || 1))
                .find((candidate) => Number(candidate.pressCount || 1) === finalState.count)
                || finalState.shortcuts.find((candidate) => Number(candidate.pressCount || 1) === 1);

            comboState.delete(identity);

            if (exactShortcut && isShortcutEnabled(exactShortcut, finalState.event)) {
                exactShortcut.handler(finalState.event);
            }
        }, MULTI_PRESS_DELAY);

        comboState.set(identity, {
            count: nextCount,
            timerId,
            event,
            shortcuts: shortcuts.filter((candidate) => (
                candidate.identity === identity &&
                isShortcutEnabled(candidate, event)
            ))
        });
    }

    function getShortcutIdentity(shortcut) {
        const codes = Array.isArray(shortcut.codes) ? [...shortcut.codes].sort().join('+') : '';
        const key = typeof shortcut.key === 'string' ? shortcut.key.toLowerCase() : '';

        return [
            shortcut.ctrl ? 'CTRL' : '',
            shortcut.shift ? 'SHIFT' : '',
            shortcut.alt ? 'ALT' : '',
            shortcut.meta ? 'META' : '',
            codes,
            key
        ].filter(Boolean).join('|');
    }

    function canOpenCandidate(event, shortcut) {
        if (!modifiersMatchShortcut(shortcut, pressedCodes)) {
            return false;
        }

        if (!Array.isArray(shortcut.codes) || !shortcut.codes.length) {
            return false;
        }

        if (!shortcut.codes.includes(event.code)) {
            return false;
        }

        return shortcut.codes.every((code) => pressedCodes.has(code));
    }

    function isValidKeyupForShortcut(event, shortcut, pressedBeforeRelease) {
        if (!Array.isArray(shortcut.codes) || !shortcut.codes.length) {
            return false;
        }

        if (!shortcut.codes.includes(event.code)) {
            return false;
        }

        if (!modifiersMatchShortcut(shortcut, pressedBeforeRelease)) {
            return false;
        }

        return shortcut.codes.every((code) => pressedBeforeRelease.has(code));
    }

    function modifiersMatchShortcut(shortcut, sourceCodes) {
        return (
            (!!shortcut.ctrl === hasAnyCode(sourceCodes, CONTROL_CODES)) &&
            (!!shortcut.shift === hasAnyCode(sourceCodes, SHIFT_CODES)) &&
            (!!shortcut.alt === hasAnyCode(sourceCodes, ALT_CODES)) &&
            (!!shortcut.meta === hasAnyCode(sourceCodes, META_CODES))
        );
    }

    function selectBestCandidate(candidates) {
        return candidates
            .slice()
            .sort((a, b) => {
                if (b.codes.length !== a.codes.length) {
                    return b.codes.length - a.codes.length;
                }

                return Number(b.pressCount || 1) - Number(a.pressCount || 1);
            })[0] || null;
    }

    function belongsToShortcut(code, shortcut) {
        return Array.isArray(shortcut.codes) && shortcut.codes.includes(code);
    }

    function shouldClearCandidateAfterKeyup(shortcut, remainingPressedCodes) {
        const remainingRequiredCodesPressed = shortcut.codes.some((code) => remainingPressedCodes.has(code));
        const modifiersStillPressed = modifiersMatchShortcut(shortcut, remainingPressedCodes);

        return !remainingRequiredCodesPressed || !modifiersStillPressed;
    }

    function clearActiveShortcutCandidate() {
        activeShortcutCandidate = null;
        activeShortcutExtraKeyDetected = false;
    }

    function isModifierCode(code) {
        return (
            CONTROL_CODES.has(code) ||
            SHIFT_CODES.has(code) ||
            ALT_CODES.has(code) ||
            META_CODES.has(code)
        );
    }

    function hasAnyCode(sourceCodes, expectedCodes) {
        for (const code of expectedCodes) {
            if (sourceCodes.has(code)) {
                return true;
            }
        }

        return false;
    }

    function isShortcutEnabled(shortcut, event) {
        if (typeof shortcut.isEnabled !== 'function') {
            return true;
        }

        try {
            return !!shortcut.isEnabled(event);
        } catch (error) {
            console.warn('Échec de l’évaluation de disponibilité du raccourci', error);
            return false;
        }
    }

    /* ===== src/services/nodescope-state.js ===== */

    let entryNode = null;
    let currentNode = null;
    let highlightEnabled = false;
    const listeners = new Set();
    const journalEntries = [];
    const sectionModes = {
        attributs: 'sufficient',
        accessibilite: 'sufficient',
        css: 'sufficient',
        journal: 'sufficient'
    };

    const MAX_JOURNAL_ENTRIES = 40;

    function isHtmlElement(node) {
        return node instanceof HTMLElement;
    }

    function notify() {
        const snapshot = getNodeScopeState();

        listeners.forEach((listener) => {
            try {
                listener(snapshot);
            } catch (error) {
                console.error('Erreur dans un écouteur NodeScope state :', error);
            }
        });
    }

    function describeElement(element) {
        if (!isHtmlElement(element)) {
            return 'aucun';
        }

        const tag = element.tagName.toLowerCase();
        const id = element.id ? `#${element.id}` : '';
        const classNames = element.classList && element.classList.length
            ? '.' + Array.from(element.classList).join('.')
            : '';

        return `${tag}${id}${classNames}`;
    }

    function truncate(text, maxLength) {
        if (!text || text.length <= maxLength) {
            return text;
        }

        return text.slice(0, maxLength - 1) + '…';
    }

    function getPreviousElementSibling(element) {
        if (!isHtmlElement(element)) {
            return null;
        }

        const sibling = element.previousElementSibling;
        return isHtmlElement(sibling) ? sibling : null;
    }

    function getNextElementSibling(element) {
        if (!isHtmlElement(element)) {
            return null;
        }

        const sibling = element.nextElementSibling;
        return isHtmlElement(sibling) ? sibling : null;
    }

    function getFirstElementChild(element) {
        if (!isHtmlElement(element)) {
            return null;
        }

        const child = element.firstElementChild;
        return isHtmlElement(child) ? child : null;
    }

    function getFirstElementSibling(element) {
        if (!isHtmlElement(element) || !isHtmlElement(element.parentElement)) {
            return null;
        }

        const firstSibling = element.parentElement.firstElementChild;
        return isHtmlElement(firstSibling) ? firstSibling : null;
    }

    function getLastElementSibling(element) {
        if (!isHtmlElement(element) || !isHtmlElement(element.parentElement)) {
            return null;
        }

        const lastSibling = element.parentElement.lastElementChild;
        return isHtmlElement(lastSibling) ? lastSibling : null;
    }

    function pushJournalEntry(message, type = 'info') {
        const timestamp = new Date().toLocaleTimeString('fr-FR');

        journalEntries.unshift({
            timestamp,
            type,
            message
        });

        if (journalEntries.length > MAX_JOURNAL_ENTRIES) {
            journalEntries.length = MAX_JOURNAL_ENTRIES;
        }
    }

    function subscribeNodeScopeState(listener) {
        if (typeof listener !== 'function') {
            console.warn('Écouteur NodeScope state invalide ignoré');
            return () => {};
        }

        listeners.add(listener);

        return () => {
            listeners.delete(listener);
        };
    }

    function getNodeScopeState() {
        return {
            entryNode,
            currentNode,
            highlightEnabled,
            sectionModes: { ...sectionModes },
            journalEntries: [...journalEntries],
            entryDescription: describeElement(entryNode),
            currentDescription: describeElement(currentNode)
        };
    }

    function getCurrentNodeSpeechText() {
        if (!isHtmlElement(currentNode)) {
            return 'aucun nœud courant';
        }

        const tag = currentNode.tagName.toLowerCase();
        const id = currentNode.id ? `, identifiant ${currentNode.id}` : '';
        const text = (currentNode.innerText || currentNode.textContent || '')
            .replace(/\s+/g, ' ')
            .trim();

        const textPart = text ? `, texte ${truncate(text, 80)}` : '';

        return `balise ${tag}${id}${textPart}`;
    }

    function resetNodeScopeState() {
        entryNode = null;
        currentNode = null;
        highlightEnabled = false;
        pushJournalEntry('Réinitialisation de l’état NodeScope', 'system');
        notify();
    }

    function clearJournal() {
        journalEntries.length = 0;
        pushJournalEntry('Journal vidé', 'system');
        notify();
    }

    function addJournalEntry(message, type = 'info') {
        pushJournalEntry(message, type);
        notify();
    }

    function setEntryNode(node) {
        if (!isHtmlElement(node)) {
            return false;
        }

        entryNode = node;

        if (!isHtmlElement(currentNode)) {
            currentNode = node;
        }

        pushJournalEntry(`Point d’entrée défini : ${describeElement(node)}`);
        notify();
        return true;
    }

    function setCurrentNode(node) {
        if (!isHtmlElement(node)) {
            return false;
        }

        currentNode = node;

        if (!isHtmlElement(entryNode)) {
            entryNode = node;
        }

        pushJournalEntry(`Nœud courant : ${describeElement(node)}`);
        notify();
        return true;
    }

    function initializeNodeScopeFromFocus() {
        const activeElement = document.activeElement;

        if (!isHtmlElement(activeElement)) {
            return false;
        }

        entryNode = activeElement;
        currentNode = activeElement;
        pushJournalEntry(`Initialisation depuis le focus : ${describeElement(activeElement)}`);
        notify();
        return true;
    }

    function restoreEntryNode() {
        if (!isHtmlElement(entryNode)) {
            return false;
        }

        currentNode = entryNode;
        pushJournalEntry(`Retour au point d’entrée : ${describeElement(entryNode)}`);
        notify();
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
        pushJournalEntry(`Déplacement vers le parent : ${describeElement(parent)}`);
        notify();
        return true;
    }

    function moveToFirstChild() {
        if (!isHtmlElement(currentNode)) {
            return false;
        }

        const child = getFirstElementChild(currentNode);

        if (!isHtmlElement(child)) {
            return false;
        }

        currentNode = child;
        pushJournalEntry(`Déplacement vers le premier enfant : ${describeElement(child)}`);
        notify();
        return true;
    }

    function moveToPreviousSibling() {
        if (!isHtmlElement(currentNode)) {
            return false;
        }

        const sibling = getPreviousElementSibling(currentNode);

        if (!isHtmlElement(sibling)) {
            return false;
        }

        currentNode = sibling;
        pushJournalEntry(`Déplacement vers le nœud précédent au même niveau : ${describeElement(sibling)}`);
        notify();
        return true;
    }

    function moveToNextSibling() {
        if (!isHtmlElement(currentNode)) {
            return false;
        }

        const sibling = getNextElementSibling(currentNode);

        if (!isHtmlElement(sibling)) {
            return false;
        }

        currentNode = sibling;
        pushJournalEntry(`Déplacement vers le nœud suivant au même niveau : ${describeElement(sibling)}`);
        notify();
        return true;
    }

    function moveToFirstSibling() {
        if (!isHtmlElement(currentNode)) {
            return false;
        }

        const sibling = getFirstElementSibling(currentNode);

        if (!isHtmlElement(sibling)) {
            return false;
        }

        currentNode = sibling;
        pushJournalEntry(`Déplacement vers le premier nœud du même niveau : ${describeElement(sibling)}`);
        notify();
        return true;
    }

    function moveToLastSibling() {
        if (!isHtmlElement(currentNode)) {
            return false;
        }

        const sibling = getLastElementSibling(currentNode);

        if (!isHtmlElement(sibling)) {
            return false;
        }

        currentNode = sibling;
        pushJournalEntry(`Déplacement vers le dernier nœud du même niveau : ${describeElement(sibling)}`);
        notify();
        return true;
    }

    function toggleHighlightEnabled() {
        highlightEnabled = !highlightEnabled;
        pushJournalEntry(`Surbrillance ${highlightEnabled ? 'activée' : 'désactivée'}`);
        notify();
        return highlightEnabled;
    }

    function setSectionMode(sectionName, mode) {
        if (!Object.prototype.hasOwnProperty.call(sectionModes, sectionName)) {
            return false;
        }

        if (mode !== 'sufficient' && mode !== 'complete') {
            return false;
        }

        sectionModes[sectionName] = mode;
        pushJournalEntry(`Mode ${sectionName} : ${mode === 'complete' ? 'complet' : 'suffisant'}`);
        notify();
        return true;
    }

    function toggleSectionMode(sectionName) {
        if (!Object.prototype.hasOwnProperty.call(sectionModes, sectionName)) {
            return null;
        }

        const nextMode = sectionModes[sectionName] === 'sufficient' ? 'complete' : 'sufficient';
        setSectionMode(sectionName, nextMode);
        return nextMode;
    }

    /* ===== src/modules/alert-test/index.js ===== */

    const alertTestModule = {
        name: 'alert-test',

        onActivate() {
            // Module neutralisé durant la phase de fondation.
        },

        onDeactivate() {
            // Rien pour l’instant.
        }
    };

    /* ===== src/modules/nodescope-ui/index.js ===== */

    const UI_IDS = {
        liveRegion: 'nodescope-live-region',
        section: 'nodescope-interface',
        title: 'nodescope-interface-title',
        helpLink: 'nodescope-help-link',
        dialog: 'nodescope-help-dialog',
        dialogTitle: 'nodescope-help-dialog-title',
        currentNodeSection: 'nodescope-current-node-section',
        currentNodeTitle: 'nodescope-current-node-title',
        currentNodeContent: 'nodescope-current-node-content',
        pathSection: 'nodescope-path-section',
        pathTitle: 'nodescope-path-title',
        pathContent: 'nodescope-path-content',
        journalSection: 'nodescope-journal-section',
        journalTitle: 'nodescope-journal-title',
        journalContent: 'nodescope-journal-content',
        highlightBox: 'nodescope-highlight-box'
    };

    const KEYBOARD_HELP = [
        'Ctrl + Maj : activer ou désactiver NodeScope',
        'Alt + Maj + Origine simple clic : nœud précédent au même niveau',
        'Alt + Maj + Origine double clic : premier nœud du même niveau',
        'Alt + Maj + Fin simple clic : nœud suivant au même niveau',
        'Alt + Maj + Fin double clic : dernier nœud du même niveau',
        'Alt + Maj + Page précédente : parent',
        'Alt + Maj + Page suivante : premier enfant',
        'Alt + Maj + Origine + Page précédente simple clic : définir le point d’entrée',
        'Alt + Maj + Origine + Page précédente double clic : revenir au point d’entrée',
        'Alt + Maj + Origine + Page précédente triple clic : activer ou désactiver la surbrillance',
        'Alt + Maj + Fin + Page suivante : copier l’analyse du nœud courant'
    ];

    const COMPLETE_CSS_PROPERTIES = [
        'display',
        'position',
        'top',
        'right',
        'bottom',
        'left',
        'z-index',
        'width',
        'height',
        'min-width',
        'min-height',
        'max-width',
        'max-height',
        'margin-top',
        'margin-right',
        'margin-bottom',
        'margin-left',
        'padding-top',
        'padding-right',
        'padding-bottom',
        'padding-left',
        'overflow',
        'visibility',
        'opacity',
        'font-family',
        'font-size',
        'font-weight',
        'line-height',
        'text-align',
        'color',
        'background-color',
        'border-top-width',
        'border-right-width',
        'border-bottom-width',
        'border-left-width',
        'border-top-style',
        'border-right-style',
        'border-bottom-style',
        'border-left-style',
        'border-top-color',
        'border-right-color',
        'border-bottom-color',
        'border-left-color',
        'box-sizing'
    ];

    const SUFFICIENT_CSS_PROPERTIES = [
        'display',
        'position',
        'width',
        'height',
        'overflow',
        'visibility',
        'opacity',
        'font-size',
        'font-weight',
        'line-height',
        'color',
        'background-color'
    ];

    let liveRegion = null;
    let dialogElement = null;
    let dialogCloseButton = null;
    let highlightElement = null;
    let lastDialogTrigger = null;
    let unsubscribeState = null;
    let currentNodeContent = null;
    let pathContent = null;
    let journalContent = null;

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

        liveRegion = document.getElementById(UI_IDS.liveRegion) || document.createElement('div');
        liveRegion.id = UI_IDS.liveRegion;
        liveRegion.setAttribute('aria-live', 'polite');
        liveRegion.setAttribute('aria-atomic', 'true');
        applyVisuallyHiddenStyles(liveRegion);

        if (!liveRegion.parentNode) {
            document.body.appendChild(liveRegion);
        }
    }

    function announce(message) {
        if (!liveRegion) {
            return;
        }

        liveRegion.textContent = '';

        window.setTimeout(() => {
            liveRegion.textContent = message;
        }, 25);
    }

    let audioContext = null;

    function getAudioContext() {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;

        if (!AudioContextClass) {
            return null;
        }

        if (!audioContext) {
            audioContext = new AudioContextClass();
        }

        return audioContext;
    }

    function playBeep(duration = 0.1, frequency = 880, delay = 0) {
        const context = getAudioContext();

        if (!context) {
            return;
        }

        const now = context.currentTime;
        const oscillator = context.createOscillator();
        const gainNode = context.createGain();

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(frequency, now + delay);
        gainNode.gain.setValueAtTime(0.001, now + delay);
        gainNode.gain.exponentialRampToValueAtTime(0.07, now + delay + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + delay + duration);

        oscillator.connect(gainNode);
        gainNode.connect(context.destination);
        oscillator.start(now + delay);
        oscillator.stop(now + delay + duration + 0.02);
    }

    function playSingleBeep() {
        playBeep(0.1, 880, 0);
    }

    function playDoubleBeep() {
        playBeep(0.08, 660, 0);
        playBeep(0.08, 660, 0.14);
    }

    function createInlineText(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div;
    }

    function createSection(titleText, id, contentId) {
        const section = document.createElement('section');
        section.id = id;

        const title = document.createElement('h2');
        title.id = `${id}-title`;
        title.textContent = titleText;

        section.setAttribute('aria-labelledby', title.id);
        section.appendChild(title);

        const content = document.createElement('div');
        content.id = contentId;
        section.appendChild(content);

        return { section, title, content };
    }

    function createSwitch(sectionName, labelText) {
        const wrapper = document.createElement('div');
        const label = document.createElement('span');
        const button = document.createElement('button');
        const buttonId = `nodescope-switch-${sectionName}`;
        const labelId = `${buttonId}-label`;

        label.id = labelId;
        label.textContent = labelText;

        button.type = 'button';
        button.id = buttonId;
        button.setAttribute('role', 'switch');
        button.setAttribute('aria-labelledby', labelId);
        button.addEventListener('click', () => {
            const nextMode = toggleSectionMode(sectionName);

            if (!nextMode) {
                return;
            }

            if (nextMode === 'complete') {
                playSingleBeep();
                announce(`Mode complet activé pour ${labelText}`);
            } else {
                playDoubleBeep();
                announce(`Mode suffisant activé pour ${labelText}`);
            }
        });

        wrapper.appendChild(label);
        wrapper.appendChild(document.createTextNode(' '));
        wrapper.appendChild(button);

        return { wrapper, button };
    }

    function getElementText(element) {
        if (!(element instanceof HTMLElement)) {
            return 'non défini';
        }

        const text = (element.innerText || element.textContent || '').replace(/\s+/g, ' ').trim();
        return text || 'non défini';
    }

    function getAttributeLines(element, mode) {
        if (!(element instanceof HTMLElement)) {
            return ['non défini'];
        }

        const entries = Array.from(element.attributes).map((attribute) => `${attribute.name}="${attribute.value}"`);

        if (!entries.length) {
            return ['non défini'];
        }

        if (mode === 'sufficient') {
            return entries.filter((entry) => !entry.startsWith('style="')).slice(0, 12);
        }

        return entries;
    }

    function getAccessibilityLines(element, mode) {
        if (!(element instanceof HTMLElement)) {
            return ['role : non défini'];
        }

        const lines = [];
        const roleValue = element.getAttribute('role') || 'non défini';
        lines.push(`role : ${roleValue}`);

        const ariaEntries = Array.from(element.attributes)
            .filter((attribute) => attribute.name.startsWith('aria-'))
            .map((attribute) => `${attribute.name}="${attribute.value}"`);

        if (!ariaEntries.length) {
            lines.push('ARIA : non défini');
            return lines;
        }

        if (mode === 'sufficient') {
            return lines.concat(ariaEntries.slice(0, 8));
        }

        return lines.concat(ariaEntries);
    }

    function getCssLines(element, mode) {
        if (!(element instanceof HTMLElement)) {
            return ['non défini'];
        }

        const computed = window.getComputedStyle(element);
        const properties = mode === 'complete' ? COMPLETE_CSS_PROPERTIES : SUFFICIENT_CSS_PROPERTIES;

        return properties.map((property) => `${property} : ${computed.getPropertyValue(property) || 'non défini'}`);
    }

    function getBreadcrumbLines(element) {
        if (!(element instanceof HTMLElement)) {
            return ['Point d’entrée : aucun', 'Fil d’Ariane : aucun'];
        }

        const ancestors = [];
        let current = element;

        while (current && ancestors.length < 5) {
            ancestors.unshift(describeElement(current));
            current = current.parentElement;
        }

        const state = getNodeScopeState();

        return [
            `Point d’entrée : ${state.entryDescription}`,
            `Fil d’Ariane : ${ancestors.join(' > ')}`
        ];
    }

    function describeElementUi(element) {
        if (!(element instanceof HTMLElement)) {
            return 'aucun';
        }

        const tag = element.tagName.toLowerCase();
        const id = element.id ? `#${element.id}` : '';
        const classNames = element.classList.length ? `.${Array.from(element.classList).join('.')}` : '';

        return `${tag}${id}${classNames}`;
    }

    function formatNodeAnalysis() {
        const state = getNodeScopeState();
        const element = state.currentNode;

        const lines = [];
        lines.push('NodeScope');
        lines.push('');
        lines.push(`Nœud courant : ${state.currentDescription}`);
        lines.push(`Point d’entrée : ${state.entryDescription}`);
        lines.push('');
        lines.push('[Identification]');
        lines.push(`Tag : ${element ? element.tagName.toLowerCase() : 'non défini'}`);
        lines.push(`ID : ${element && element.id ? element.id : 'non défini'}`);

        const classes = element && element.classList.length ? Array.from(element.classList) : [];
        lines.push(`Classes : ${classes.length ? classes.join(', ') : 'non défini'}`);
        lines.push('');
        lines.push('[Attributs]');
        lines.push(...getAttributeLines(element, state.sectionModes.attributs));
        lines.push('');
        lines.push('[Accessibilité]');
        lines.push(...getAccessibilityLines(element, state.sectionModes.accessibilite));
        lines.push('');
        lines.push('[Texte]');
        lines.push(getElementText(element));
        lines.push('');
        lines.push('[Structure HTML]');
        lines.push(element ? element.outerHTML : 'non défini');
        lines.push('');
        lines.push('[CSS calculée]');
        lines.push(...getCssLines(element, state.sectionModes.css));

        return lines.join('\n');
    }

    async function copyCurrentNodeAnalysis() {
        if (!getIsActive()) {
            announce('NodeScope est désactivé');
            return;
        }

        const state = getNodeScopeState();

        if (!state.currentNode) {
            announce('Aucun nœud courant à copier');
            return;
        }

        try {
            await navigator.clipboard.writeText(formatNodeAnalysis());
            addJournalEntry('Analyse copiée dans le presse-papier');
            playSingleBeep();
            announce('Analyse copiée dans le presse-papier');
        } catch (error) {
            console.error(error);
            announce('Impossible de copier dans le presse-papier');
        }
    }

    function renderCurrentNodeSection() {
        if (!currentNodeContent) {
            return;
        }

        currentNodeContent.innerHTML = '';

        const state = getNodeScopeState();
        const element = state.currentNode;

        const identificationTitle = document.createElement('h3');
        identificationTitle.textContent = 'Identification';
        currentNodeContent.appendChild(identificationTitle);
        currentNodeContent.appendChild(createInlineText(`Tag : ${element ? element.tagName.toLowerCase() : 'non défini'}`));
        currentNodeContent.appendChild(createInlineText(`ID : ${element && element.id ? element.id : 'non défini'}`));
        currentNodeContent.appendChild(createInlineText(`Classes : ${element && element.classList.length ? Array.from(element.classList).join(', ') : 'non défini'}`));

        const attributesTitle = document.createElement('h3');
        attributesTitle.textContent = 'Attributs';
        currentNodeContent.appendChild(attributesTitle);
        const attributesSwitch = createSwitch('attributs', 'Mode Attributs');
        attributesSwitch.button.setAttribute('aria-checked', state.sectionModes.attributs === 'complete' ? 'true' : 'false');
        attributesSwitch.button.textContent = state.sectionModes.attributs === 'complete' ? 'Complet' : 'Suffisant';
        currentNodeContent.appendChild(attributesSwitch.wrapper);
        getAttributeLines(element, state.sectionModes.attributs).forEach((line) => {
            currentNodeContent.appendChild(createInlineText(line));
        });

        const accessibilityTitle = document.createElement('h3');
        accessibilityTitle.textContent = 'Accessibilité';
        currentNodeContent.appendChild(accessibilityTitle);
        const accessibilitySwitch = createSwitch('accessibilite', 'Mode Accessibilité');
        accessibilitySwitch.button.setAttribute('aria-checked', state.sectionModes.accessibilite === 'complete' ? 'true' : 'false');
        accessibilitySwitch.button.textContent = state.sectionModes.accessibilite === 'complete' ? 'Complet' : 'Suffisant';
        currentNodeContent.appendChild(accessibilitySwitch.wrapper);
        getAccessibilityLines(element, state.sectionModes.accessibilite).forEach((line) => {
            currentNodeContent.appendChild(createInlineText(line));
        });

        const textTitle = document.createElement('h3');
        textTitle.textContent = 'Texte';
        currentNodeContent.appendChild(textTitle);
        currentNodeContent.appendChild(createInlineText(getElementText(element)));

        const htmlTitle = document.createElement('h3');
        htmlTitle.textContent = 'Structure HTML';
        currentNodeContent.appendChild(htmlTitle);
        currentNodeContent.appendChild(createInlineText(element ? element.outerHTML : 'non défini'));

        const cssTitle = document.createElement('h3');
        cssTitle.textContent = 'CSS calculée';
        currentNodeContent.appendChild(cssTitle);
        const cssSwitch = createSwitch('css', 'Mode CSS calculée');
        cssSwitch.button.setAttribute('aria-checked', state.sectionModes.css === 'complete' ? 'true' : 'false');
        cssSwitch.button.textContent = state.sectionModes.css === 'complete' ? 'Complet' : 'Suffisant';
        currentNodeContent.appendChild(cssSwitch.wrapper);
        getCssLines(element, state.sectionModes.css).forEach((line) => {
            currentNodeContent.appendChild(createInlineText(line));
        });
    }

    function renderPathSection() {
        if (!pathContent) {
            return;
        }

        pathContent.innerHTML = '';
        const state = getNodeScopeState();
        getBreadcrumbLines(state.currentNode).forEach((line) => {
            pathContent.appendChild(createInlineText(line));
        });
    }

    function renderJournalSection() {
        if (!journalContent) {
            return;
        }

        journalContent.innerHTML = '';
        const state = getNodeScopeState();

        const switchControl = createSwitch('journal', 'Mode Journal');
        switchControl.button.setAttribute('aria-checked', state.sectionModes.journal === 'complete' ? 'true' : 'false');
        switchControl.button.textContent = state.sectionModes.journal === 'complete' ? 'Complet' : 'Suffisant';
        journalContent.appendChild(switchControl.wrapper);

        const clearButton = document.createElement('button');
        clearButton.type = 'button';
        clearButton.textContent = 'Vider le journal';
        clearButton.addEventListener('click', () => {
            clearJournal();
            announce('Journal vidé');
        });
        journalContent.appendChild(clearButton);

        const entries = state.sectionModes.journal === 'complete'
            ? state.journalEntries
            : state.journalEntries.slice(0, 10);

        const lastAction = entries[0] ? `Dernière action : ${entries[0].timestamp} — ${entries[0].message}` : 'Dernière action : non définie';
        journalContent.appendChild(createInlineText(lastAction));

        if (!entries.length) {
            journalContent.appendChild(createInlineText('Journal : non défini'));
            return;
        }

        entries.forEach((entry) => {
            journalContent.appendChild(createInlineText(`${entry.timestamp} — ${entry.message}`));
        });
    }

    function ensureHighlightElement() {
        if (highlightElement) {
            return;
        }

        highlightElement = document.getElementById(UI_IDS.highlightBox) || document.createElement('div');
        highlightElement.id = UI_IDS.highlightBox;
        highlightElement.setAttribute('aria-hidden', 'true');
        highlightElement.style.position = 'absolute';
        highlightElement.style.pointerEvents = 'none';
        highlightElement.style.outline = '3px solid #d00';
        highlightElement.style.outlineOffset = '2px';
        highlightElement.style.zIndex = '2147483647';

        if (!highlightElement.parentNode) {
            document.body.appendChild(highlightElement);
        }
    }

    function syncHighlight() {
        const state = getNodeScopeState();

        if (!state.highlightEnabled || !(state.currentNode instanceof HTMLElement)) {
            if (highlightElement) {
                highlightElement.style.display = 'none';
            }
            return;
        }

        ensureHighlightElement();

        const rect = state.currentNode.getBoundingClientRect();
        highlightElement.style.display = 'block';
        highlightElement.style.top = `${window.scrollY + rect.top}px`;
        highlightElement.style.left = `${window.scrollX + rect.left}px`;
        highlightElement.style.width = `${rect.width}px`;
        highlightElement.style.height = `${rect.height}px`;
    }

    function openHelpDialog(trigger) {
        if (!dialogElement) {
            return;
        }

        lastDialogTrigger = trigger || document.activeElement;
        dialogElement.hidden = false;
        dialogCloseButton.focus();
    }

    function closeHelpDialog() {
        if (!dialogElement) {
            return;
        }

        dialogElement.hidden = true;

        if (lastDialogTrigger instanceof HTMLElement) {
            lastDialogTrigger.focus();
        }
    }

    function handleDialogKeydown(event) {
        if (event.key === 'Escape') {
            event.preventDefault();
            closeHelpDialog();
            return;
        }

        if (event.key !== 'Tab') {
            return;
        }

        const focusable = Array.from(dialogElement.querySelectorAll('button, [href], [tabindex]:not([tabindex="-1"])'))
            .filter((element) => !element.hasAttribute('disabled'));

        if (!focusable.length) {
            return;
        }

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
            return;
        }

        if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    }

    function createHelpDialog() {
        dialogElement = document.createElement('div');
        dialogElement.id = UI_IDS.dialog;
        dialogElement.setAttribute('role', 'dialog');
        dialogElement.setAttribute('aria-modal', 'true');
        dialogElement.setAttribute('aria-labelledby', UI_IDS.dialogTitle);
        dialogElement.hidden = true;
        dialogElement.addEventListener('keydown', handleDialogKeydown);

        const title = document.createElement('h2');
        title.id = UI_IDS.dialogTitle;
        title.textContent = 'Aide sur les commandes NodeScope';

        const list = document.createElement('ul');
        KEYBOARD_HELP.forEach((commandText) => {
            const item = document.createElement('li');
            item.textContent = commandText;
            list.appendChild(item);
        });

        dialogCloseButton = document.createElement('button');
        dialogCloseButton.type = 'button';
        dialogCloseButton.textContent = 'Fermer';
        dialogCloseButton.addEventListener('click', closeHelpDialog);

        dialogElement.appendChild(title);
        dialogElement.appendChild(list);
        dialogElement.appendChild(dialogCloseButton);

        return dialogElement;
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
        title.textContent = 'NodeScope';

        const helpLink = document.createElement('button');
        helpLink.type = 'button';
        helpLink.id = UI_IDS.helpLink;
        helpLink.textContent = 'Aide sur les commandes NodeScope';
        helpLink.addEventListener('click', () => openHelpDialog(helpLink));

        const copyButton = document.createElement('button');
        copyButton.type = 'button';
        copyButton.textContent = 'Copier le résultat de l’analyse';
        copyButton.addEventListener('click', copyCurrentNodeAnalysis);

        const setEntryButton = document.createElement('button');
        setEntryButton.type = 'button';
        setEntryButton.textContent = 'Définir le point d’entrée depuis l’élément focalisé';
        setEntryButton.addEventListener('click', handleSetEntryFromFocus);

        const currentNodeSection = createSection('Nœud courant', UI_IDS.currentNodeSection, UI_IDS.currentNodeContent);
        const pathSection = createSection('Chemin courant', UI_IDS.pathSection, UI_IDS.pathContent);
        const journalSection = createSection('Journal NodeScope', UI_IDS.journalSection, UI_IDS.journalContent);

        currentNodeContent = currentNodeSection.content;
        pathContent = pathSection.content;
        journalContent = journalSection.content;

        section.appendChild(title);
        section.appendChild(helpLink);
        section.appendChild(copyButton);
        section.appendChild(setEntryButton);
        section.appendChild(currentNodeSection.section);
        section.appendChild(pathSection.section);
        section.appendChild(journalSection.section);
        section.appendChild(createHelpDialog());

        document.body.appendChild(section);
    }

    function removeNodeScopeInterface() {
        const existing = document.getElementById(UI_IDS.section);

        if (existing && existing.parentNode) {
            existing.parentNode.removeChild(existing);
        }

        dialogElement = null;
        dialogCloseButton = null;
        currentNodeContent = null;
        pathContent = null;
        journalContent = null;
    }

    function syncNodeScopeInterface() {
        if (!getIsActive()) {
            syncHighlight();
            return;
        }

        renderCurrentNodeSection();
        renderPathSection();
        renderJournalSection();
        syncHighlight();
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

        playSingleBeep();
        announce('Point d’entrée défini');
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

    function triggerNodeScopeSwitch() {
        if (getIsActive()) {
            deactivate();
            return;
        }

        activate();
    }

    function triggerSetEntry() {
        handleSetEntryFromFocus();
    }

    function triggerRestoreEntry() {
        handleMove(restoreEntryNode, 'Retour au point d’entrée', 'Aucun point d’entrée défini');
    }

    function triggerMoveParent() {
        handleMove(moveToParent, 'Nœud parent', 'Aucun nœud parent');
    }

    function triggerMoveChild() {
        handleMove(moveToFirstChild, 'Premier enfant', 'Aucun enfant');
    }

    function triggerMovePrevious() {
        handleMove(moveToPreviousSibling, 'Nœud précédent au même niveau', 'Aucun nœud précédent au même niveau');
    }

    function triggerMoveNext() {
        handleMove(moveToNextSibling, 'Nœud suivant au même niveau', 'Aucun nœud suivant au même niveau');
    }

    function triggerMoveFirst() {
        handleMove(moveToFirstSibling, 'Premier nœud du même niveau', 'Aucun premier nœud du même niveau');
    }

    function triggerMoveLast() {
        handleMove(moveToLastSibling, 'Dernier nœud du même niveau', 'Aucun dernier nœud du même niveau');
    }

    function triggerHighlightToggle() {
        if (!getIsActive()) {
            announce('NodeScope est désactivé');
            return;
        }

        const enabled = toggleHighlightEnabled();

        if (enabled) {
            playSingleBeep();
            announce('Surbrillance activée');
        } else {
            playDoubleBeep();
            announce('Surbrillance désactivée');
        }
    }

    function triggerCopy() {
        copyCurrentNodeAnalysis();
    }

    const nodeScopeUiModule = {
        name: 'nodescope-ui',

        init() {
            if (!document.body) {
                return;
            }

            createLiveRegion();

            if (!unsubscribeState) {
                unsubscribeState = subscribeNodeScopeState(() => {
                    syncNodeScopeInterface();
                });
            }
        },

        onActivate() {
            createNodeScopeInterface();

            const state = getNodeScopeState();
            if (!state.entryNode || !state.currentNode) {
                initializeNodeScopeFromFocus();
            }

            playSingleBeep();
            syncNodeScopeInterface();
            announce('NodeScope activé');
        },

        onDeactivate() {
            resetNodeScopeState();
            playDoubleBeep();
            removeNodeScopeInterface();
            syncHighlight();
            announce('NodeScope désactivé');
        }
    };

    /* ===== src/bootstrap/main.js ===== */

    (function initBootstrap() {
        function init() {
            if (!document.body) {
                window.setTimeout(init, 50);
                return;
            }

            registerModule(nodeScopeUiModule);
            registerModule(alertTestModule);

            initModules();

            registerShortcut({
                ctrl: true,
                shift: true,
                alt: false,
                meta: false,
                code: 'ShiftLeft',
                handler: triggerNodeScopeSwitch
            });

            registerShortcut({
                ctrl: true,
                shift: true,
                alt: false,
                meta: false,
                code: 'ShiftRight',
                handler: triggerNodeScopeSwitch
            });

            registerShortcut({
                ctrl: false,
                shift: true,
                alt: true,
                meta: false,
                codes: ['Home', 'PageUp'],
                pressCount: 1,
                isEnabled: getIsActive,
                handler: triggerSetEntry
            });

            registerShortcut({
                ctrl: false,
                shift: true,
                alt: true,
                meta: false,
                codes: ['Home', 'PageUp'],
                pressCount: 2,
                isEnabled: getIsActive,
                handler: triggerRestoreEntry
            });

            registerShortcut({
                ctrl: false,
                shift: true,
                alt: true,
                meta: false,
                codes: ['Home', 'PageUp'],
                pressCount: 3,
                isEnabled: getIsActive,
                handler: triggerHighlightToggle
            });

            registerShortcut({
                ctrl: false,
                shift: true,
                alt: true,
                meta: false,
                code: 'PageUp',
                pressCount: 1,
                isEnabled: getIsActive,
                handler: triggerMoveParent
            });

            registerShortcut({
                ctrl: false,
                shift: true,
                alt: true,
                meta: false,
                code: 'PageDown',
                pressCount: 1,
                isEnabled: getIsActive,
                handler: triggerMoveChild
            });

            registerShortcut({
                ctrl: false,
                shift: true,
                alt: true,
                meta: false,
                code: 'Home',
                pressCount: 1,
                isEnabled: getIsActive,
                handler: triggerMovePrevious
            });

            registerShortcut({
                ctrl: false,
                shift: true,
                alt: true,
                meta: false,
                code: 'Home',
                pressCount: 2,
                isEnabled: getIsActive,
                handler: triggerMoveFirst
            });

            registerShortcut({
                ctrl: false,
                shift: true,
                alt: true,
                meta: false,
                code: 'End',
                pressCount: 1,
                isEnabled: getIsActive,
                handler: triggerMoveNext
            });

            registerShortcut({
                ctrl: false,
                shift: true,
                alt: true,
                meta: false,
                code: 'End',
                pressCount: 2,
                isEnabled: getIsActive,
                handler: triggerMoveLast
            });

            registerShortcut({
                ctrl: false,
                shift: true,
                alt: true,
                meta: false,
                codes: ['End', 'PageDown'],
                pressCount: 1,
                isEnabled: getIsActive,
                handler: triggerCopy
            });

            initKeyboard();
        }

        init();
    })();
})();