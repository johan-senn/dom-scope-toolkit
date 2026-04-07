let entryNode = null;
let currentNode = null;
const listeners = new Set();

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
    notify();
    return true;
}