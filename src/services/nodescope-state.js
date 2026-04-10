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
        journalEntries: [...journalEntries],
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
    pushJournalEntry('Réinitialisation de l’état NodeScope', 'system');
    notify();
}

export function clearJournal() {
    journalEntries.length = 0;
    pushJournalEntry('Journal vidé', 'system');
    notify();
}

export function addJournalEntry(message, type = 'info') {
    pushJournalEntry(message, type);
    notify();
}

export function setEntryNode(node) {
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

export function setCurrentNode(node) {
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

export function initializeNodeScopeFromFocus() {
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

export function restoreEntryNode() {
    if (!isHtmlElement(entryNode)) {
        return false;
    }

    currentNode = entryNode;
    pushJournalEntry(`Retour au point d’entrée : ${describeElement(entryNode)}`);
    notify();
    return true;
}

export function moveToParent() {
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

export function moveToFirstChild() {
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

export function moveToPreviousSibling() {
    if (!isHtmlElement(currentNode)) {
        return false;
    }

    const sibling = getPreviousElementSibling(currentNode);

    if (!isHtmlElement(sibling)) {
        return false;
    }

    currentNode = sibling;
    pushJournalEntry(`Déplacement vers le frère précédent : ${describeElement(sibling)}`);
    notify();
    return true;
}

export function moveToNextSibling() {
    if (!isHtmlElement(currentNode)) {
        return false;
    }

    const sibling = getNextElementSibling(currentNode);

    if (!isHtmlElement(sibling)) {
        return false;
    }

    currentNode = sibling;
    pushJournalEntry(`Déplacement vers le frère suivant : ${describeElement(sibling)}`);
    notify();
    return true;
}

export function toggleHighlightEnabled() {
    highlightEnabled = !highlightEnabled;
    pushJournalEntry(`Surbrillance ${highlightEnabled ? 'activée' : 'désactivée'}`);
    notify();
    return highlightEnabled;
}

export function setSectionMode(sectionName, mode) {
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

export function toggleSectionMode(sectionName) {
    if (!Object.prototype.hasOwnProperty.call(sectionModes, sectionName)) {
        return null;
    }

    const nextMode = sectionModes[sectionName] === 'sufficient' ? 'complete' : 'sufficient';
    setSectionMode(sectionName, nextMode);
    return nextMode;
}
