import { registerModule, toggle } from '../core/module-registry.js';
import { alertTestModule } from '../modules/alert-test/index.js';

(function () {
    'use strict';

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