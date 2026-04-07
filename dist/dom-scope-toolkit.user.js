// (seule la partie condition change)

document.addEventListener('keydown', (event) => {
    console.log('DEBUG KEY:', {
        key: event.key,
        code: event.code,
        ctrl: event.ctrlKey,
        shift: event.shiftKey,
        alt: event.altKey
    });

    const isNumpadZero =
        event.code === 'Numpad0' ||
        event.code === 'Insert';

    if (event.ctrlKey && event.shiftKey && isNumpadZero) {
        event.preventDefault();
        console.log('NodeScope toggle déclenché');
        toggle();
    }
});