const shortcuts = [];
let keyboardIsInitialized = false;
const pressedCodes = new Set();
const comboState = new Map();

const MULTI_PRESS_DELAY = 350;

const CONTROL_CODES = new Set(['ControlLeft', 'ControlRight']);
const SHIFT_CODES = new Set(['ShiftLeft', 'ShiftRight']);
const ALT_CODES = new Set(['AltLeft', 'AltRight']);
const META_CODES = new Set(['MetaLeft', 'MetaRight']);

export function registerShortcut(shortcut) {
    const hasHandler = shortcut && typeof shortcut.handler === 'function';

    if (!shortcut || !hasHandler) {
        console.warn('Raccourci invalide ignoré');
        return;
    }

    shortcuts.push(shortcut);
}

export function initKeyboard() {
    if (keyboardIsInitialized) {
        return;
    }

    keyboardIsInitialized = true;

    document.addEventListener('keydown', handleKeydown, true);
    document.addEventListener('keyup', handleKeyup, true);
    window.addEventListener('blur', resetKeyboardState, true);
}

function handleKeydown(event) {
    pressedCodes.add(event.code);
}

function handleKeyup(event) {
    const matchingShortcuts = shortcuts.filter((shortcut) => matchShortcutOnKeyup(event, shortcut));

    if (matchingShortcuts.length) {
        const multiPressShortcuts = matchingShortcuts.filter(
            (shortcut) => Number(shortcut.pressCount || 1) > 1 || hasSiblingMultiPressShortcut(shortcut)
        );
        const immediateShortcuts = matchingShortcuts.filter(
            (shortcut) => !multiPressShortcuts.includes(shortcut)
        );

        if (immediateShortcuts.length) {
            event.preventDefault();
            event.stopPropagation();
            immediateShortcuts.forEach((shortcut) => shortcut.handler(event));
        }

        if (multiPressShortcuts.length) {
            event.preventDefault();
            event.stopPropagation();
            queueMultiPressHandlers(event, multiPressShortcuts);
        }
    }

    pressedCodes.delete(event.code);
}

function resetKeyboardState() {
    pressedCodes.clear();

    comboState.forEach((state) => {
        if (state && state.timerId) {
            window.clearTimeout(state.timerId);
        }
    });

    comboState.clear();
}

function hasSiblingMultiPressShortcut(shortcut) {
    const identity = getShortcutIdentity(shortcut);

    return shortcuts.some(
        (candidate) => candidate !== shortcut && getShortcutIdentity(candidate) === identity
    );
}

function queueMultiPressHandlers(event, matchingShortcuts) {
    const identity = getShortcutIdentity(matchingShortcuts[0]);
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
            .find((shortcut) => Number(shortcut.pressCount || 1) === finalState.count)
            || finalState.shortcuts.find((shortcut) => Number(shortcut.pressCount || 1) === 1);

        comboState.delete(identity);

        if (exactShortcut) {
            exactShortcut.handler(finalState.event);
        }
    }, MULTI_PRESS_DELAY);

    comboState.set(identity, {
        count: nextCount,
        timerId,
        event,
        shortcuts: matchingShortcuts
    });
}

function getShortcutIdentity(shortcut) {
    const codes = Array.isArray(shortcut.codes) ? [...shortcut.codes].sort().join('+') : '';
    const code = typeof shortcut.code === 'string' ? shortcut.code : '';
    const key = typeof shortcut.key === 'string' ? shortcut.key.toLowerCase() : '';

    return [
        shortcut.ctrl ? 'CTRL' : '',
        shortcut.shift ? 'SHIFT' : '',
        shortcut.alt ? 'ALT' : '',
        shortcut.meta ? 'META' : '',
        codes,
        code,
        key
    ].filter(Boolean).join('|');
}

function matchShortcutOnKeyup(event, shortcut) {
    const expectedKey = typeof shortcut.key === 'string' ? shortcut.key.toLowerCase() : null;
    const expectedCode = typeof shortcut.code === 'string' ? shortcut.code : null;
    const expectedCodes = Array.isArray(shortcut.codes) ? shortcut.codes : null;

    const effectivePressedCodes = new Set(pressedCodes);
    effectivePressedCodes.add(event.code);

    const modifiersMatch = (
        (!!shortcut.ctrl === hasAnyCode(effectivePressedCodes, CONTROL_CODES)) &&
        (!!shortcut.shift === hasAnyCode(effectivePressedCodes, SHIFT_CODES)) &&
        (!!shortcut.alt === hasAnyCode(effectivePressedCodes, ALT_CODES)) &&
        (!!shortcut.meta === hasAnyCode(effectivePressedCodes, META_CODES))
    );

    if (!modifiersMatch) {
        return false;
    }

    if (expectedCodes && expectedCodes.length) {
        return expectedCodes.every((code) => effectivePressedCodes.has(code)) && expectedCodes.includes(event.code);
    }

    const keyMatches = expectedKey ? (event.key || '').toLowerCase() === expectedKey : true;
    const codeMatches = expectedCode ? event.code === expectedCode : true;

    return keyMatches && codeMatches;
}

function hasAnyCode(sourceCodes, expectedCodes) {
    for (const code of expectedCodes) {
        if (sourceCodes.has(code)) {
            return true;
        }
    }

    return false;
}