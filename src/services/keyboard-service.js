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

export function registerShortcut(shortcut) {
    const hasHandler = shortcut && typeof shortcut.handler === 'function';

    if (!shortcut || !hasHandler) {
        console.warn('Raccourci invalide ignoré');
        return;
    }

    shortcuts.push(normalizeShortcut(shortcut));
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

function buildShortcutContext(shortcut, pressCount) {
    return {
        timestamp: Date.now(),
        pressCount: Number(pressCount || 1),
        codes: Array.isArray(shortcut.codes) ? [...shortcut.codes] : [],
        shortcut: {
            identity: shortcut.identity,
            codes: Array.isArray(shortcut.codes) ? [...shortcut.codes] : [],
            key: typeof shortcut.key === 'string' ? shortcut.key : null,
            ctrl: !!shortcut.ctrl,
            shift: !!shortcut.shift,
            alt: !!shortcut.alt,
            meta: !!shortcut.meta,
            pressCount: Number(shortcut.pressCount || 1)
        }
    };
}

function dispatchShortcut(shortcut, event) {
    const siblingMultiPressExists = hasSiblingMultiPressShortcut(shortcut);
    const expectedPressCount = Number(shortcut.pressCount || 1);

    if (expectedPressCount > 1 || siblingMultiPressExists) {
        queueMultiPressHandlers(event, shortcut);
        return;
    }

    const context = buildShortcutContext(shortcut, expectedPressCount);
    shortcut.handler(event, context);
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
            const context = buildShortcutContext(exactShortcut, finalState.count);
            exactShortcut.handler(finalState.event, context);
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