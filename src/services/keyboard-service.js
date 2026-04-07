const shortcuts = [];

export function registerShortcut(shortcut) {
    if (!shortcut || typeof shortcut.handler !== 'function') {
        console.warn('Raccourci invalide ignoré');
        return;
    }

    shortcuts.push(shortcut);
}

export function initKeyboard() {
    document.addEventListener('keydown', (event) => {
        shortcuts.forEach((shortcut) => {
            if (matchShortcut(event, shortcut)) {
                event.preventDefault();
                shortcut.handler(event);
            }
        });
    });
}

function matchShortcut(event, shortcut) {
    return (
        (!!shortcut.ctrl === event.ctrlKey) &&
        (!!shortcut.shift === event.shiftKey) &&
        (!!shortcut.alt === event.altKey) &&
        event.key.toLowerCase() === shortcut.key.toLowerCase()
    );
}