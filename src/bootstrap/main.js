import { registerModule, initModules } from '../core/module-registry.js';
import { alertTestModule } from '../modules/alert-test/index.js';

(function () {
    'use strict';

    registerModule(alertTestModule);

    initModules();
})();