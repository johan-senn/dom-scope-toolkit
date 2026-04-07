const modules = [];

export function registerModule(module) {
    if (!module || typeof module.init !== 'function') {
        console.warn('Module invalide ignoré');
        return;
    }

    modules.push(module);
}

export function initModules() {
    modules.forEach((module) => {
        try {
            module.init();
        } catch (error) {
            console.error('Erreur lors de l’exécution d’un module :', error);
        }
    });
}