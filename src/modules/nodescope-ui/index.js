export function triggerNodeScopeSwitch() {
    if (!switchControl) {
        const existing = document.getElementById('nodescope-switch');

        if (existing) {
            switchControl = existing;
        }
    }

    if (!switchControl) {
        announce('Interface NodeScope non prête');
        return;
    }

    switchControl.click();
}