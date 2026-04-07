export const alertTestModule = {
    name: 'alert-test',

    onActivate() {
        // Module neutralisé durant la phase de fondation.
        // Aucun alert() pour ne pas perturber le clavier
        // ni les lecteurs d’écran.
    },

    onDeactivate() {
        // Rien pour l’instant.
    }
};