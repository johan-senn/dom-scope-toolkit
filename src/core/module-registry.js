const modules = [];
let isActive = false;
let isInitialized = false;

export function registerModule(module) {
    const hasInit = module && typeof module.init === 'function';
    const hasOnActivate = module && typeof module.onActivate === 'function';
    const hasOnDeactivate = module && typeof module.onDeactivate === 'function';

    if (!module || (!hasInit && !hasOnActivate && !hasOnDeactivate)) {
        console.warn('Module invalide ignoré');
        return;
    }

    modules.push(module);
}

export function initModules() {
    if (isInitialized) {
        return;
    }

    isInitialized = true;

    modules.forEach((module) => {
        try {
            if (typeof module.init === 'function') {
                module.init();
            }
        } catch (error) {
            console.error('Erreur lors de l’initialisation d’un module :', error);
        }
    });
}

export function activate() {
    if (isActive) {
        return;
    }

    isActive = true;

    modules.forEach((module) => {
        try {
            if (typeof module.onActivate === 'function') {
                module.onActivate();
            }
        } catch (error) {
            console.error('Erreur lors de l’activation d’un module :', error);
        }
    });
}

export function deactivate() {
    if (!isActive) {
        return;
    }

    isActive = false;

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

export function toggle() {
    if (isActive) {
        deactivate();
        return;
    }

    activate();
}

export function getIsActive() {
    return isActive;
}