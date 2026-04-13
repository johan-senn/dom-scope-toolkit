import { activate, deactivate, getIsActive } from '../../core/module-registry.js';
import {
    getNodeScopeState,
    getCurrentNodeSpeechText,
    defineEntryPoint,
    resetNodeScopeState,
    restoreEntryNode,
    subscribeNodeScopeState,
    moveToParent,
    moveToFirstChild,
    moveToPreviousSibling,
    moveToNextSibling,
    moveToFirstSibling,
    moveToLastSibling,
    toggleHighlightEnabled,
    toggleSectionMode,
    recordActionAndNotify,
    recordKeyboardEvent,
    clearJournal
} from '../../services/nodescope-state.js';

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
    'Alt + Maj + Origine + Page précédente simple clic : définir le point d’entrée (sélection ou focus)',
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

function describeElement(element) {
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

async function copyCurrentNodeAnalysis(actionContext) {
    if (!getIsActive()) {
        announce('NodeScope est désactivé');
        return;
    }

    if (actionContext) {
        recordKeyboardEvent(actionContext);
    }

    const state = getNodeScopeState();

    if (!state.currentNode) {
        recordActionAndNotify({
            id: 'copy-analysis',
            label: 'Copie de l’analyse',
            type: 'clipboard',
            success: false
        }, actionContext);
        announce('Aucun nœud courant à copier');
        return;
    }

    try {
        await navigator.clipboard.writeText(formatNodeAnalysis());
        recordActionAndNotify({
            id: 'copy-analysis',
            label: 'Analyse copiée dans le presse-papier',
            type: 'clipboard',
            success: true,
            journalMessage: 'Analyse copiée dans le presse-papier'
        }, actionContext);
        playSingleBeep();
        announce('Analyse copiée dans le presse-papier');
    } catch (error) {
        console.error(error);
        recordActionAndNotify({
            id: 'copy-analysis',
            label: 'Copie dans le presse-papier',
            type: 'clipboard',
            success: false
        }, actionContext);
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

    const lastActionEntry = state.lastAction;
    const lastActionLabel = lastActionEntry
        ? `Dernière action : ${lastActionEntry.timestamp} — ${lastActionEntry.label}${lastActionEntry.success ? '' : ' (échec)'}`
        : 'Dernière action : non définie';
    journalContent.appendChild(createInlineText(lastActionLabel));

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
    copyButton.addEventListener('click', () => copyCurrentNodeAnalysis());

    const setEntryButton = document.createElement('button');
    setEntryButton.type = 'button';
    setEntryButton.textContent = 'Définir le point d’entrée depuis la sélection ou l’élément focalisé';
    setEntryButton.addEventListener('click', () => handleDefineEntryPoint());

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

function handleDefineEntryPoint(actionContext) {
    if (!getIsActive()) {
        announce('NodeScope est désactivé');
        return;
    }

    const result = defineEntryPoint(actionContext);

    if (!result || !result.success) {
        announce('Aucune sélection ou élément focalisé exploitable');
        return;
    }

    playSingleBeep();
    announce('Point d’entrée défini');
}

function handleMove(actionFn, successMessage, failureMessage, actionContext) {
    if (!getIsActive()) {
        announce('NodeScope est désactivé');
        return;
    }

    const success = actionFn(actionContext);

    if (!success) {
        announce(failureMessage);
        return;
    }

    announce(`${successMessage} : ${getCurrentNodeSpeechText()}`);
}

export function triggerNodeScopeSwitch(event, actionContext) {
    if (actionContext) {
        recordKeyboardEvent(actionContext);
    }

    if (getIsActive()) {
        recordActionAndNotify({
            id: 'toggle-nodescope',
            label: 'Désactivation de NodeScope',
            type: 'system',
            success: true
        }, actionContext);
        deactivate();
        return;
    }

    recordActionAndNotify({
        id: 'toggle-nodescope',
        label: 'Activation de NodeScope',
        type: 'system',
        success: true
    }, actionContext);
    activate();
}

export function triggerSetEntry(event, actionContext) {
    handleDefineEntryPoint(actionContext);
}

export function triggerRestoreEntry(event, actionContext) {
    handleMove(restoreEntryNode, 'Retour au point d’entrée', 'Aucun point d’entrée défini', actionContext);
}

export function triggerMoveParent(event, actionContext) {
    handleMove(moveToParent, 'Nœud parent', 'Aucun nœud parent', actionContext);
}

export function triggerMoveChild(event, actionContext) {
    handleMove(moveToFirstChild, 'Premier enfant', 'Aucun enfant', actionContext);
}

export function triggerMovePrevious(event, actionContext) {
    handleMove(moveToPreviousSibling, 'Frère précédent', 'Aucun frère précédent', actionContext);
}

export function triggerMoveNext(event, actionContext) {
    handleMove(moveToNextSibling, 'Frère suivant', 'Aucun frère suivant', actionContext);
}

export function triggerMoveFirst(event, actionContext) {
    handleMove(moveToFirstSibling, 'Premier frère', 'Aucun premier frère', actionContext);
}

export function triggerMoveLast(event, actionContext) {
    handleMove(moveToLastSibling, 'Dernier frère', 'Aucun dernier frère', actionContext);
}

export function triggerHighlightToggle(event, actionContext) {
    if (!getIsActive()) {
        announce('NodeScope est désactivé');
        return;
    }

    const enabled = toggleHighlightEnabled(actionContext);

    if (enabled) {
        playSingleBeep();
        announce('Surbrillance activée');
    } else {
        playDoubleBeep();
        announce('Surbrillance désactivée');
    }
}

export function triggerCopy(event, actionContext) {
    copyCurrentNodeAnalysis(actionContext);
}

export const nodeScopeUiModule = {
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