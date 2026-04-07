export const alertTestModule = {
    name: 'alert-test',

    onActivate() {
        alert('NodeScope activé');
    },

    onDeactivate() {
        console.log('NodeScope désactivé');
    }
};