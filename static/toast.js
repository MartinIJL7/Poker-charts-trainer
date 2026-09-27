// toast.js
// Small auto-dismissing toast instead of a blocking native alert(). Only
// for one-way informational messages - confirm() still handles yes/no
// decisions natively, since a toast can't pause and wait for an answer.
// Shared by the range editor and the training page; both keep their own
// #toast-container element and pass it in.
export function showToast(container, message, type) {
    const toast = document.createElement('div');
    toast.className = 'cr-toast cr-toast--' + type;
    toast.textContent = message;

    let removed = false;
    function removeToast() {
        if (removed) return;
        removed = true;
        clearTimeout(timer);
        toast.classList.remove('cr-toast--visible');
        // Only listen for transitionend now, once the fade-out actually
        // starts - registering it earlier would catch the fade-IN
        // transition completing and remove the toast almost immediately.
        toast.addEventListener('transitionend', function() { toast.remove(); }, { once: true });
        // Fallback in case transitionend never fires (e.g. prefers-reduced-motion
        // disables the transition entirely, so it wouldn't fire naturally).
        setTimeout(function() { toast.remove(); }, 300);
    }

    const timer = setTimeout(removeToast, 4000);
    toast.addEventListener('click', removeToast);

    container.appendChild(toast);
    requestAnimationFrame(function() {
        toast.classList.add('cr-toast--visible');
    });
}
