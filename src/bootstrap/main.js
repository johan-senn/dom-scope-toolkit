import { initModules, registerModule } from '../core/module-registry.js';
import { registerShortcut, initKeyboard } from '../services/keyboard-service.js';
import { getIsActive } from '../services/nodescope-state.js';
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
    triggerMoveFirst,
    triggerMoveLast,
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
            shift: true,
            alt: true,
            meta: false,
            codes: ['Home', 'PageUp'],
            pressCount: 1,
            isEnabled: getIsActive,
            handler: triggerSetEntry
        });

        registerShortcut({
            ctrl: false,
            shift: true,
            alt: true,
            meta: false,
            codes: ['Home', 'PageUp'],
            pressCount: 2,
            isEnabled: getIsActive,
            handler: triggerRestoreEntry
        });

        registerShortcut({
            ctrl: false,
            shift: true,
            alt: true,
            meta: false,
            codes: ['Home', 'PageUp'],
            pressCount: 3,
            isEnabled: getIsActive,
            handler: triggerHighlightToggle
        });

        registerShortcut({
            ctrl: false,
            shift: true,
            alt: true,
            meta: false,
            code: 'PageUp',
            pressCount: 1,
            isEnabled: getIsActive,
            handler: triggerMoveParent
        });

        registerShortcut({
            ctrl: false,
            shift: true,
            alt: true,
            meta: false,
            code: 'PageDown',
            pressCount: 1,
            isEnabled: getIsActive,
            handler: triggerMoveChild
        });

        registerShortcut({
            ctrl: false,
            shift: true,
            alt: true,
            meta: false,
            code: 'Home',
            pressCount: 1,
            isEnabled: getIsActive,
            handler: triggerMovePrevious
        });

        registerShortcut({
            ctrl: false,
            shift: true,
            alt: true,
            meta: false,
            code: 'Home',
            pressCount: 2,
            isEnabled: getIsActive,
            handler: triggerMoveFirst
        });

        registerShortcut({
            ctrl: false,
            shift: true,
            alt: true,
            meta: false,
            code: 'End',
            pressCount: 1,
            isEnabled: getIsActive,
            handler: triggerMoveNext
        });

        registerShortcut({
            ctrl: false,
            shift: true,
            alt: true,
            meta: false,
            code: 'End',
            pressCount: 2,
            isEnabled: getIsActive,
            handler: triggerMoveLast
        });

        registerShortcut({
            ctrl: false,
            shift: true,
            alt: true,
            meta: false,
            codes: ['End', 'PageDown'],
            pressCount: 1,
            isEnabled: getIsActive,
            handler: triggerCopy
        });

        initKeyboard();
    }

    init();
})();