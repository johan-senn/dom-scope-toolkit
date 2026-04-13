let entryNode = null;
let currentNode = null;
let highlightEnabled = false;
let lastAction = null;
let lastActionType = null;
let lastClickType = null;
const keyboardEvents = [];
const actionHistory = [];
const listeners = new Set();
const journalEntries = [];
const sectionModes = {
    attributs: 'sufficient',
    accessibilite: 'sufficient',
    css: 'sufficient',
    journal: 'sufficient'
};

const MAX_JOURNAL_ENTRIES = 40;
const MAX_HISTORY_ENTRIES = 40;

function isHtmlElement(node) {
    return node instanceof HTMLElement;
}

function createTimestamp(date = new Date()) {
    return {
        label: date.toLocaleTimeString('fr-FR'),
        ms: date.getTime()
    };
}

function getTimestampFromContext(context) {
    if (context && typeof context.timestamp === 'number') {
        return createTimestamp(new Date(context.timestamp));
    }

    return createTimestamp();
}

function limitEntries(entries, maxEntries) {
    if (entries.length > maxEntries) {
        entries.length = maxEntries;
    }
}

function normalizeShortcutDescriptor(shortcut) {
    if (!shortcut) {
        return null;
    }

    return {
        identity: shortcut.identity || null,
        codes: Array.isArray(shortcut.codes) ? [...shortcut.codes] : [],
        key: typeof shortcut.key === 'string' ? shortcut.key : null,
        ctrl: !!shortcut.ctrl,
        shift: !!shortcut.shift,
        alt: !!shortcut.alt,
        meta: !!shortcut.meta,
        configuredPressCount: Number(shortcut.pressCount || 1)
    };
}

function cloneShortcutDescriptor(shortcut) {
    if (!shortcut) {
        return null;
    }

    return {
        ...shortcut,
        codes: Array.isArray(shortcut.codes) ? [...shortcut.codes] : []
    };
}

function cloneKeyboardEventEntry(entry) {
    return {
        ...entry,
        codes: Array.isArray(entry.codes) ? [...entry.codes] : [],
        shortcut: cloneShortcutDescriptor(entry.shortcut)
    };
}

function cloneActionEntry(entry) {
    return {
        ...entry,
        codes: Array.isArray(entry.codes) ? [...entry.codes] : [],
        shortcut: cloneShortcutDescriptor(entry.shortcut)
    };
}

function getClickTypeFromPressCount(pressCount) {
    if (pressCount === 1) {
        return 'simple';
    }

    if (pressCount === 2) {
        return 'double';
    }

    if (pressCount === 3) {
        return 'triple';
    }

    return null;
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

function resolveHtmlElementFromNode(node) {
    let current = node;

    while (current) {
        if (isHtmlElement(current)) {
            return current;
        }

        current = current.parentNode;
    }

    return null;
}

function resolveEntryPoint() {
    const selection = typeof window.getSelection === 'function' ? window.getSelection() : null;

    if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const elementFromSelection = resolveHtmlElementFromNode(range ? range.startContainer : null);

        if (elementFromSelection) {
            return { node: elementFromSelection, source: 'selection' };
        }
    }

    const activeElement = document.activeElement;

    if (isHtmlElement(activeElement)) {
        return { node: activeElement, source: 'focus' };
    }

    return { node: null, source: null };
}


function pushJournalEntry(message, type = 'info') {
    const timestamp = createTimestamp().label;

    journalEntries.unshift({
        timestamp,
        type,
        message
    });

    limitEntries(journalEntries, MAX_JOURNAL_ENTRIES);
}

export function recordKeyboardEvent(actionContext) {
    if (!actionContext) {
        return null;
    }

    const timestamp = getTimestampFromContext(actionContext);
    const entry = {
        timestamp: timestamp.label,
        timestampMs: timestamp.ms,
        pressCount: Number(actionContext.pressCount || 1),
        codes: Array.isArray(actionContext.codes) ? [...actionContext.codes] : [],
        shortcut: normalizeShortcutDescriptor(actionContext.shortcut)
    };

    keyboardEvents.unshift(entry);
    limitEntries(keyboardEvents, MAX_HISTORY_ENTRIES);
    return entry;
}

export function recordAction(action, actionContext) {
    if (!action || !action.label) {
        return null;
    }

    const timestamp = getTimestampFromContext(actionContext);
    const pressCount = actionContext ? Number(actionContext.pressCount || 0) : 0;
    const clickType = getClickTypeFromPressCount(pressCount);
    const actionEntry = {
        id: action.id || null,
        label: action.label,
        type: action.type || null,
        success: action.success !== false,
        clickType,
        timestamp: timestamp.label,
        timestampMs: timestamp.ms,
        source: actionContext ? 'keyboard' : 'ui',
        codes: actionContext && Array.isArray(actionContext.codes) ? [...actionContext.codes] : [],
        shortcut: normalizeShortcutDescriptor(actionContext ? actionContext.shortcut : null)
    };

    actionHistory.unshift(actionEntry);
    limitEntries(actionHistory, MAX_HISTORY_ENTRIES);

    lastAction = actionEntry;
    lastActionType = actionEntry.type;
    lastClickType = actionEntry.clickType;

    if (action.journalMessage) {
        pushJournalEntry(action.journalMessage, action.type || 'info');
    }

    return actionEntry;
}

export function recordActionAndNotify(action, actionContext) {
    const entry = recordAction(action, actionContext);
    notify();
    return entry;
}



export function subscribeNodeScopeState(listener) {
    if (typeof listener !== 'function') {
        console.warn('Écouteur NodeScope state invalide ignoré');
        return () => {};
    }

    listeners.add(listener);

    return () => {
        listeners.delete(listener);
    };
}

export function getNodeScopeState() {
    return {
        entryNode,
        currentNode,
        highlightEnabled,
        sectionModes: { ...sectionModes },
        journalEntries: journalEntries.map((entry) => ({ ...entry })),
        keyboardEvents: keyboardEvents.map(cloneKeyboardEventEntry),
        actionHistory: actionHistory.map(cloneActionEntry),
        lastAction: lastAction ? cloneActionEntry(lastAction) : null,
        lastActionType,
        lastClickType,
        entryDescription: describeElement(entryNode),
        currentDescription: describeElement(currentNode)
    };
}

export function getCurrentNodeSpeechText() {
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

export function resetNodeScopeState() {
    entryNode = null;
    currentNode = null;
    highlightEnabled = false;
    recordAction({
        id: 'reset-state',
        label: 'Réinitialisation de l’état NodeScope',
        type: 'system',
        success: true,
        journalMessage: 'Réinitialisation de l’état NodeScope'
    });
    notify();
}

export function clearJournal() {
    journalEntries.length = 0;
    keyboardEvents.length = 0;
    actionHistory.length = 0;
    recordAction({
        id: 'clear-journal',
        label: 'Journal vidé',
        type: 'system',
        success: true,
        journalMessage: 'Journal vidé'
    });
    notify();
}

export function addJournalEntry(message, type = 'info') {
    pushJournalEntry(message, type);
    notify();
}

export function setEntryNode(node, actionContext) {
    if (!isHtmlElement(node)) {
        return false;
    }

    if (actionContext) {
        recordKeyboardEvent(actionContext);
    }

    entryNode = node;

    if (!isHtmlElement(currentNode)) {
        currentNode = node;
    }

    recordAction({
        id: 'set-entry',
        label: 'Point d’entrée défini',
        type: 'entry',
        success: true,
        journalMessage: `Point d’entrée défini : ${describeElement(node)}`
    }, actionContext);
    notify();
    return true;
}

export function setCurrentNode(node, actionContext) {
    if (!isHtmlElement(node)) {
        return false;
    }

    if (actionContext) {
        recordKeyboardEvent(actionContext);
    }

    currentNode = node;

    if (!isHtmlElement(entryNode)) {
        entryNode = node;
    }

    recordAction({
        id: 'set-current',
        label: 'Nœud courant défini',
        type: 'navigation',
        success: true,
        journalMessage: `Nœud courant : ${describeElement(node)}`
    }, actionContext);
    notify();
    return true;
}

export function defineEntryPoint(actionContext) {
    if (actionContext) {
        recordKeyboardEvent(actionContext);
    }

    const resolution = resolveEntryPoint();

    if (!resolution || !isHtmlElement(resolution.node)) {
        recordAction({
            id: 'define-entry',
            label: 'Définition du point d’entrée',
            type: 'entry',
            success: false
        }, actionContext);
        notify();
        return { success: false, source: null, node: null };
    }

    entryNode = resolution.node;
    currentNode = resolution.node;

    recordAction({
        id: 'define-entry',
        label: 'Point d’entrée défini',
        type: 'entry',
        success: true,
        journalMessage: `Point d’entrée défini : ${describeElement(resolution.node)}`
    }, actionContext);
    notify();
    return { success: true, source: resolution.source, node: resolution.node };
}

export function restoreEntryNode(actionContext) {
    if (actionContext) {
        recordKeyboardEvent(actionContext);
    }

    if (!isHtmlElement(entryNode)) {
        recordAction({
            id: 'restore-entry',
            label: 'Retour au point d’entrée',
            type: 'entry',
            success: false
        }, actionContext);
        notify();
        return false;
    }

    currentNode = entryNode;
    recordAction({
        id: 'restore-entry',
        label: 'Retour au point d’entrée',
        type: 'entry',
        success: true,
        journalMessage: `Retour au point d’entrée : ${describeElement(entryNode)}`
    }, actionContext);
    notify();
    return true;
}

export function moveToParent(actionContext) {
    if (actionContext) {
        recordKeyboardEvent(actionContext);
    }

    if (!isHtmlElement(currentNode)) {
        recordAction({
            id: 'move-parent',
            label: 'Déplacement vers le parent',
            type: 'navigation',
            success: false
        }, actionContext);
        notify();
        return false;
    }

    const parent = currentNode.parentElement;

    if (!isHtmlElement(parent)) {
        recordAction({
            id: 'move-parent',
            label: 'Déplacement vers le parent',
            type: 'navigation',
            success: false
        }, actionContext);
        notify();
        return false;
    }

    currentNode = parent;
    recordAction({
        id: 'move-parent',
        label: 'Déplacement vers le parent',
        type: 'navigation',
        success: true,
        journalMessage: `Déplacement vers le parent : ${describeElement(parent)}`
    }, actionContext);
    notify();
    return true;
}

export function moveToFirstChild(actionContext) {
    if (actionContext) {
        recordKeyboardEvent(actionContext);
    }

    if (!isHtmlElement(currentNode)) {
        recordAction({
            id: 'move-first-child',
            label: 'Déplacement vers le premier enfant',
            type: 'navigation',
            success: false
        }, actionContext);
        notify();
        return false;
    }

    const child = getFirstElementChild(currentNode);

    if (!isHtmlElement(child)) {
        recordAction({
            id: 'move-first-child',
            label: 'Déplacement vers le premier enfant',
            type: 'navigation',
            success: false
        }, actionContext);
        notify();
        return false;
    }

    currentNode = child;
    recordAction({
        id: 'move-first-child',
        label: 'Déplacement vers le premier enfant',
        type: 'navigation',
        success: true,
        journalMessage: `Déplacement vers le premier enfant : ${describeElement(child)}`
    }, actionContext);
    notify();
    return true;
}

export function moveToPreviousSibling(actionContext) {
    if (actionContext) {
        recordKeyboardEvent(actionContext);
    }

    if (!isHtmlElement(currentNode)) {
        recordAction({
            id: 'move-previous-sibling',
            label: 'Déplacement vers le nœud précédent au même niveau',
            type: 'navigation',
            success: false
        }, actionContext);
        notify();
        return false;
    }

    const sibling = getPreviousElementSibling(currentNode);

    if (!isHtmlElement(sibling)) {
        recordAction({
            id: 'move-previous-sibling',
            label: 'Déplacement vers le nœud précédent au même niveau',
            type: 'navigation',
            success: false
        }, actionContext);
        notify();
        return false;
    }

    currentNode = sibling;
    recordAction({
        id: 'move-previous-sibling',
        label: 'Déplacement vers le nœud précédent au même niveau',
        type: 'navigation',
        success: true,
        journalMessage: `Déplacement vers le nœud précédent au même niveau : ${describeElement(sibling)}`
    }, actionContext);
    notify();
    return true;
}

export function moveToNextSibling(actionContext) {
    if (actionContext) {
        recordKeyboardEvent(actionContext);
    }

    if (!isHtmlElement(currentNode)) {
        recordAction({
            id: 'move-next-sibling',
            label: 'Déplacement vers le nœud suivant au même niveau',
            type: 'navigation',
            success: false
        }, actionContext);
        notify();
        return false;
    }

    const sibling = getNextElementSibling(currentNode);

    if (!isHtmlElement(sibling)) {
        recordAction({
            id: 'move-next-sibling',
            label: 'Déplacement vers le nœud suivant au même niveau',
            type: 'navigation',
            success: false
        }, actionContext);
        notify();
        return false;
    }

    currentNode = sibling;
    recordAction({
        id: 'move-next-sibling',
        label: 'Déplacement vers le nœud suivant au même niveau',
        type: 'navigation',
        success: true,
        journalMessage: `Déplacement vers le nœud suivant au même niveau : ${describeElement(sibling)}`
    }, actionContext);
    notify();
    return true;
}

export function moveToFirstSibling(actionContext) {
    if (actionContext) {
        recordKeyboardEvent(actionContext);
    }

    if (!isHtmlElement(currentNode)) {
        recordAction({
            id: 'move-first-sibling',
            label: 'Déplacement vers le premier nœud du même niveau',
            type: 'navigation',
            success: false
        }, actionContext);
        notify();
        return false;
    }

    const sibling = getFirstElementSibling(currentNode);

    if (!isHtmlElement(sibling)) {
        recordAction({
            id: 'move-first-sibling',
            label: 'Déplacement vers le premier nœud du même niveau',
            type: 'navigation',
            success: false
        }, actionContext);
        notify();
        return false;
    }

    currentNode = sibling;
    recordAction({
        id: 'move-first-sibling',
        label: 'Déplacement vers le premier nœud du même niveau',
        type: 'navigation',
        success: true,
        journalMessage: `Déplacement vers le premier nœud du même niveau : ${describeElement(sibling)}`
    }, actionContext);
    notify();
    return true;
}

export function moveToLastSibling(actionContext) {
    if (actionContext) {
        recordKeyboardEvent(actionContext);
    }

    if (!isHtmlElement(currentNode)) {
        recordAction({
            id: 'move-last-sibling',
            label: 'Déplacement vers le dernier nœud du même niveau',
            type: 'navigation',
            success: false
        }, actionContext);
        notify();
        return false;
    }

    const sibling = getLastElementSibling(currentNode);

    if (!isHtmlElement(sibling)) {
        recordAction({
            id: 'move-last-sibling',
            label: 'Déplacement vers le dernier nœud du même niveau',
            type: 'navigation',
            success: false
        }, actionContext);
        notify();
        return false;
    }

    currentNode = sibling;
    recordAction({
        id: 'move-last-sibling',
        label: 'Déplacement vers le dernier nœud du même niveau',
        type: 'navigation',
        success: true,
        journalMessage: `Déplacement vers le dernier nœud du même niveau : ${describeElement(sibling)}`
    }, actionContext);
    notify();
    return true;
}

export function toggleHighlightEnabled(actionContext) {
    if (actionContext) {
        recordKeyboardEvent(actionContext);
    }

    highlightEnabled = !highlightEnabled;
    const label = `Surbrillance ${highlightEnabled ? 'activée' : 'désactivée'}`;
    recordAction({
        id: 'toggle-highlight',
        label,
        type: 'highlight',
        success: true,
        journalMessage: label
    }, actionContext);
    notify();
    return highlightEnabled;
}

export function setSectionMode(sectionName, mode, actionContext) {
    if (!Object.prototype.hasOwnProperty.call(sectionModes, sectionName)) {
        return false;
    }

    if (mode !== 'sufficient' && mode !== 'complete') {
        return false;
    }

    if (actionContext) {
        recordKeyboardEvent(actionContext);
    }

    sectionModes[sectionName] = mode;
    const label = `Mode ${sectionName} : ${mode === 'complete' ? 'complet' : 'suffisant'}`;
    recordAction({
        id: `section-mode-${sectionName}`,
        label,
        type: 'section-mode',
        success: true,
        journalMessage: label
    }, actionContext);
    notify();
    return true;
}

export function toggleSectionMode(sectionName, actionContext) {
    if (!Object.prototype.hasOwnProperty.call(sectionModes, sectionName)) {
        return null;
    }

    const nextMode = sectionModes[sectionName] === 'sufficient' ? 'complete' : 'sufficient';
    setSectionMode(sectionName, nextMode, actionContext);
    return nextMode;
}