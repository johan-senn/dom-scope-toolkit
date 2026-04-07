const shortcuts = [];
let isInitialized = false;

export function registerShortcut(shortcut) {
    const hasHandler = shortcut && typeof shortcut.handler === 'function';

    if (!shortcut || !hasHandler) {
        console.warn('Raccourci invalide ignoré');
        return;
    }

    shortcuts.push(shortcut);
}

export function initKeyboard() {
    if (isInitialized) {
        return;
    }

    isInitialized = true;

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
    const expectedKey = typeof shortcut.key === 'string' ? shortcut.key.toLowerCase() : null;
    const expectedCode = typeof shortcut.code === 'string' ? shortcut.code : null;

    const keyMatches = expectedKey ? (event.key || '').toLowerCase() === expectedKey : true;
    const codeMatches = expectedCode ? event.code === expectedCode : true;

    return (
        (!!shortcut.ctrl === event.ctrlKey) &&
        (!!shortcut.shift === event.shiftKey) &&
        (!!shortcut.alt === event.altKey) &&
        (!!shortcut.meta === event.metaKey) &&
        keyMatches &&
        codeMatches
    );
}