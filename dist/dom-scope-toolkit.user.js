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
    // Accessibilité : aria-live
    // ==============================

    let liveRegion = null;

    function createLiveRegion() {
        liveRegion = document.createElement('div');

        liveRegion.setAttribute('aria-live', 'polite');
        liveRegion.setAttribute('aria-atomic', 'true');

        // Masqué visuellement mais lisible par lecteur d’écran
        liveRegion.style.position = 'absolute';
        liveRegion.style.width = '1px';
        liveRegion.style.height = '1px';
        liveRegion.style.margin = '-1px';
        liveRegion.style.border = '0';
        liveRegion.style.padding = '0';
        liveRegion.style.overflow = 'hidden';
        liveRegion.style.clip = 'rect(0 0 0 0)';
        liveRegion.style.whiteSpace = 'nowrap';

        document.body.appendChild(liveRegion);
    }

    function announce(message) {
        if (!liveRegion) return;

        // reset pour forcer l’annonce
        liveRegion.textContent = '';
        setTimeout(() => {
            liveRegion.textContent = message;
        }, 50);
    }

    // ==============================
    // Core : modules + état
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
        if (isActive) return;

        isActive = true;

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
                console.error('Erreur activation module :', module.name, error);
            }
        });
    }

    function deactivate() {
        if (!isActive) return;

        isActive = false;

        announce('NodeScope désactivé');

        modules.forEach((module) => {
            try {
                if (typeof module.onDeactivate === 'function') {
                    module.onDeactivate();
                }
            } catch (error) {
                console.error('Erreur désactivation module :', module.name, error);
            }
        });
    }

    function toggle() {
        if (isActive) {
            deactivate();
        } else {
            activate();
        }
    }

    // ==============================
    // Module : alert-test (désactivé visuellement)
    // ==============================

    const alertTestModule = {
        name: 'alert-test',

        onActivate() {
            // plus d'alert → remplacé par aria-live
        },

        onDeactivate() {
            // rien ici
        }
    };

    // ==============================
    // Bootstrap
    // ==============================

    createLiveRegion();

    registerModule(alertTestModule);

    document.addEventListener('keydown', (event) => {
        console.log('DEBUG KEY:', {
            key: event.key,
            code: event.code,
            ctrl: event.ctrlKey,
            shift: event.shiftKey,
            alt: event.altKey
        });

        if (event.ctrlKey && event.shiftKey && event.code === 'Numpad0') {
            event.preventDefault();
            console.log('NodeScope toggle déclenché');
            toggle();
        }
    });

})();