import { activate, deactivate, getIsActive } from '../../core/module-registry.js';
import {
    getNodeScopeState,
    getCurrentNodeSpeechText,
    initializeNodeScopeFromFocus,
    resetNodeScopeState,
    subscribeNodeScopeState,
    moveToParent,
    moveToFirstChild,
    moveToPreviousSibling,
    moveToNextSibling
} from '../../services/nodescope-state.js';

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

/* =========================
   Accessibilité utilitaire
========================= */

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

/* =========================
   Live region
========================= */

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

/* =========================
   Status
========================= */

function getStatusText() {
    const state = getNodeScopeState();
    const activeText = getIsActive() ? 'activé' : 'désactivé';

    return [
        `État : ${activeText}`,
        `Point d’entrée : ${state.entryDescription}`,
        `Nœud courant : ${state.currentDescription}`
    ].join('\n');
}

/* =========================
   Navigation
========================= */

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

/* =========================
   Sync UI
========================= */

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

    navButtons.forEach((btn) => {
        btn.disabled = !active;
    });
}

/* =========================
   Actions
========================= */

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

/* =========================
   Création UI
========================= */

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

/* =========================
   Export module
========================= */

export function triggerNodeScopeSwitch() {
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

export const nodeScopeUiModule = {
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