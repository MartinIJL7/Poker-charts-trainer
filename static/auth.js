// auth.js
// Pressing Enter in a field submits the form natively but gives no visual
// feedback. Show the submit button as pressed for a moment, then submit it
// the same way a click would (requestSubmit keeps the required-field checks).
const PRESS_MS = 140;

document.querySelectorAll('.au-form').forEach(function(form) {
    const button = form.querySelector('button[type="submit"]');
    if (!button) return;

    form.addEventListener('keydown', function(event) {
        if (event.key !== 'Enter' || event.target.tagName !== 'INPUT') return;
        event.preventDefault();
        if (button.disabled) return;

        button.classList.add('is-pressed');
        setTimeout(function() {
            button.classList.remove('is-pressed');
            form.requestSubmit(button);
        }, PRESS_MS);
    });
});
