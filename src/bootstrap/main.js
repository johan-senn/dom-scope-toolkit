import { initModules, registerModule } from '../core/module-registry.js';
import { registerShortcut, initKeyboard } from '../services/keyboard-service.js';
import { alertTestModule } from '../modules/alert-test/index.js';
import {
    nodeScopeUiModule,
    triggerNodeScopeSwitch,
    triggerSetEntry,
    triggerRestoreEntry,
    triggerMoveParent,
    triggerMoveChild,
    triggerMovePrevious,
    triggerMoveNext,
    triggerHighlightToggle,
    triggerCopy
} from '../modules/nodescope-ui/index.js';

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
            code: 'ShiftLeft',
            handler: triggerNodeScopeSwitch
        });

        registerShortcut({
            ctrl: true,
            shift: true,
            alt: false,
            meta: false,
            code: 'ShiftRight',
            handler: triggerNodeScopeSwitch
        });

        registerShortcut({
            ctrl: false,
            shift: false,
            alt: false,
            meta: false,
            codes: ['Home', 'PageUp'],
            pressCount: 1,
            handler: triggerSetEntry
        });

        registerShortcut({
            ctrl: false,
            shift: false,
            alt: false,
            meta: false,
            codes: ['Home', 'PageUp'],
            pressCount: 2,
            handler: triggerRestoreEntry
        });

        registerShortcut({
            ctrl: false,
            shift: false,
            alt: false,
            meta: false,
            codes: ['Home', 'PageUp'],
            pressCount: 3,
            handler: triggerHighlightToggle
        });

        registerShortcut({
            ctrl: false,
            shift: false,
            alt: false,
            meta: false,
            code: 'PageUp',
            handler: triggerMoveParent
        });

        registerShortcut({
            ctrl: false,
            shift: false,
            alt: false,
            meta: false,
            code: 'PageDown',
            handler: triggerMoveChild
        });

        registerShortcut({
            ctrl: false,
            shift: false,
            alt: false,
            meta: false,
            code: 'Home',
            handler: triggerMovePrevious
        });

        registerShortcut({
            ctrl: false,
            shift: false,
            alt: false,
            meta: false,
            code: 'End',
            handler: triggerMoveNext
        });

        registerShortcut({
            ctrl: false,
            shift: false,
            alt: false,
            meta: false,
            codes: ['End', 'PageDown'],
            pressCount: 1,
            handler: triggerCopy
        });

        initKeyboard();
    }

    init();
})();
