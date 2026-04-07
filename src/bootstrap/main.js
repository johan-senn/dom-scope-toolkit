import { initModules, registerModule } from '../core/module-registry.js';
import { registerShortcut, initKeyboard } from '../services/keyboard-service.js';
import { alertTestModule } from '../modules/alert-test/index.js';
import { nodeScopeUiModule, triggerNodeScopeSwitch } from '../modules/nodescope-ui/index.js';

(function () {
    'use strict';

    function init() {
        if (!document.body) {
            window.setTimeout(init, 50);
            return;
        }

        registerModule(nodeScopeUiModule);
        registerModule(alertTestModule);

        initModules();

        registerShortcut({
            ctrl: true,
            shift: true,
            alt: false,
            meta: false,
            code: 'Numpad0',
            handler: () => {
                triggerNodeScopeSwitch();
            }
        });

        initKeyboard();
    }

    init();
})();