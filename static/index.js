// index.js - home page: mode picker dialog and the tables notice
const TRAINING_SUBTITLES = {
    normal: 'Обычная тренировка',
    draw: 'Рисование диапазонов'
};

const dialog = document.getElementById('mode-dialog');
if (dialog) {
    const subtitle = document.getElementById('mode-dialog-subtitle');
    let training = 'normal';

    document.querySelectorAll('[data-training]').forEach(function(tile) {
        tile.addEventListener('click', function() {
            training = tile.dataset.training;
            subtitle.textContent = TRAINING_SUBTITLES[training];
            dialog.showModal();
        });
    });

    dialog.querySelectorAll('[data-mode]').forEach(function(item) {
        item.addEventListener('click', function() {
            const baseUrl = training === 'draw' ? dialog.dataset.urlDraw : dialog.dataset.urlNormal;
            window.location.href = baseUrl + encodeURIComponent(item.dataset.mode);
        });
    });

    document.getElementById('mode-dialog-cancel').addEventListener('click', function() {
        dialog.close();
    });

    // A click on the backdrop (the dialog element itself, outside its box) dismisses it
    dialog.addEventListener('click', function(e) {
        if (e.target === dialog) dialog.close();
    });
}

const noticeClose = document.getElementById('tables-notice-close');
if (noticeClose) {
    noticeClose.addEventListener('click', function() {
        document.getElementById('tables-notice').style.display = 'none';
        fetch('/api/dismiss_tables_notice', { method: 'POST' }).catch(function() {});
    });
}
