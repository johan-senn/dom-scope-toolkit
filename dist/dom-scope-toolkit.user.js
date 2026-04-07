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
    // Core : module registry
    // ==============================

    const modules = [];

    function registerModule(module) {
        if (!module || typeof module.init !== 'function') {
            console.warn('Module invalide ignoré');
            return;
        }

        modules.push(module);
    }

    function initModules() {
        modules.forEach((module) => {
            try {
                module.init();
            } catch (error) {
                console.error('Erreur module :', module.name, error);
            }
        });
    }

    // ==============================
    // Module : alert-test
    // ==============================

    const alertTestModule = {
        name: 'alert-test',

        init() {
            alert('Dom Scope Toolkit actif');
        }
    };

    // ==============================
    // Bootstrap
    // ==============================

    registerModule(alertTestModule);
    initModules();

})();