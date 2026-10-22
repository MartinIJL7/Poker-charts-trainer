// auth.js
// Pressing Enter in a field submits the form natively but gives no visual
// feedback. Show the submit button as pressed for a moment, then submit it
// the same way a click would (requestSubmit keeps the required-field checks).
const PRESS_MS = 140;

// Password managers fill the fields without focusing them, so focus can stay
// on <body> and Enter would do nothing. Listen on the document and also accept
// Enter when nothing interactive is focused.
document.querySelectorAll('.au-form').forEach(function(form) {
    const button = form.querySelector('button[type="submit"]');
    if (!button) return;

    document.addEventListener('keydown', function(event) {
        if (event.key !== 'Enter' || event.isComposing) return;

        const target = event.target;
        const inForm = form.contains(target) && target.tagName === 'INPUT';
        const idle = target === document.body || target === document.documentElement;
        if (!inForm && !idle) return;

        event.preventDefault();
        if (button.disabled) return;

        button.classList.add('is-pressed');
        setTimeout(function() {
            button.classList.remove('is-pressed');
            form.requestSubmit(button);
        }, PRESS_MS);
    });
});
