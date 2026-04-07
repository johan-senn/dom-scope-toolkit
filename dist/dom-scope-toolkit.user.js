// ==UserScript==
// @name         Dom Scope Toolkit
// @namespace    https://github.com/johan-senn/dom-scope-toolkit
// @version      0.1
// @description  Toolkit d'exploration du DOM
// @author       Johan Senn
// @match        *://*/*
// @grant        none
// @downloadURL  https://raw.githubusercontent.com/johan-senn/dom-scope-toolkit/main/dist/dom-scope-toolkit.user.js
// @updateURL    https://raw.githubusercontent.com/johan-senn/dom-scope-toolkit/main/dist/dom-scope-toolkit.user.js
// ==/UserScript==

(function () {
    'use strict';

    // ==============================
    // Core : registre des modules + état
    // ==============================

    const modules = [];
    let isActive = false;

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

    function activate() {
        if (isActive) {
            return;
        }

        isActive = true;
        syncNodeScopeInterface();
        announce('NodeScope activé');

        modules.forEach((module) => {
            try {
                if (typeof module.onActivate === 'function') {
                    module.onActivate();
                    return;
                }

                if (typeof module.init === 'function') {
                    module.init();
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
        syncNodeScopeInterface();
        announce('NodeScope désactivé');

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

    function toggle() {
        if (isActive) {
            deactivate();
            return;
        }

        activate();
    }

    function getIsActive() {
        return isActive;
    }

    // ==============================
    // Accessibilité : aria-live
    // ==============================

    let liveRegion = null;

    function createLiveRegion() {
        if (liveRegion) {
            return;
        }

        liveRegion = document.createElement('div');
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

    // ==============================
    // UI : interface NodeScope
    // ==============================

    const UI_IDS = {
        section: 'nodescope-interface',
        title: 'nodescope-interface-title',
        switch: 'nodescope-switch',
        switchLabel: 'nodescope-switch-label',
        switchHint: 'nodescope-switch-hint'
    };

    let interfaceSection = null;
    let switchControl = null;
    let switchVisibleLabel = null;
    let switchDescription = null;

    function createNodeScopeInterface() {
        const existingSection = document.getElementById(UI_IDS.section);

        if (existingSection) {
            interfaceSection = existingSection;
            switchControl = document.getElementById(UI_IDS.switch);
            switchVisibleLabel = document.getElementById(UI_IDS.switchLabel);
            switchDescription = document.getElementById(UI_IDS.switchHint);
            syncNodeScopeInterface();
            return;
        }

        interfaceSection = document.createElement('section');
        interfaceSection.id = UI_IDS.section;
        interfaceSection.setAttribute('aria-labelledby', UI_IDS.title);

        const title = document.createElement('h1');
        title.id = UI_IDS.title;
        title.textContent = 'Interface NodeScope';

        switchControl = document.createElement('button');
        switchControl.id = UI_IDS.switch;
        switchControl.type = 'button';
        switchControl.setAttribute('role', 'switch');
        switchControl.setAttribute('aria-labelledby', UI_IDS.switchLabel);
        switchControl.setAttribute('aria-describedby', UI_IDS.switchHint);

        switchVisibleLabel = document.createElement('span');
        switchVisibleLabel.id = UI_IDS.switchLabel;

        switchDescription = document.createElement('span');
        switchDescription.id = UI_IDS.switchHint;
        applyVisuallyHiddenStyles(switchDescription);

        switchControl.appendChild(switchVisibleLabel);

        switchControl.addEventListener('click', () => {
            toggle();
            switchControl.focus();
        });

        interfaceSection.appendChild(title);
        interfaceSection.appendChild(switchControl);
        document.body.appendChild(interfaceSection);

        syncNodeScopeInterface();
    }

    function syncNodeScopeInterface() {
        if (!switchControl || !switchVisibleLabel || !switchDescription) {
            return;
        }

        const active = getIsActive();

        switchControl.setAttribute('aria-checked', active ? 'true' : 'false');

        if (active) {
            switchVisibleLabel.textContent = 'NodeScope activé';
            switchDescription.textContent = 'Appuyez sur Espace pour désactiver';
        } else {
            switchVisibleLabel.textContent = 'NodeScope désactivé';
            switchDescription.textContent = 'Appuyez sur Espace pour activer';
        }
    }

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

    // ==============================
    // Module : alert-test neutralisé
    // ==============================

    const alertTestModule = {
        name: 'alert-test',

        onActivate() {
            // Module neutralisé pour éviter l'alert durant la phase UI.
        },

        onDeactivate() {
            // Rien ici pour l’instant.
        }
    };

    // ==============================
    // Bootstrap
    // ==============================

    function init() {
        if (!document.body) {
            window.setTimeout(init, 50);
            return;
        }

        createLiveRegion();
        createNodeScopeInterface();
        registerModule(alertTestModule);
    }

    init();

})();