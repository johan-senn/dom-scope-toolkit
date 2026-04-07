import { registerModule, toggle } from '../core/module-registry.js';
import { alertTestModule } from '../modules/alert-test/index.js';

(function () {
    'use strict';

    registerModule(alertTestModule);

    document.addEventListener('keydown', (event) => {
        if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'n') {
            event.preventDefault();
            toggle();
        }
    });
})();