// create_mode.js
document.addEventListener('DOMContentLoaded', function() {
    const saveBtn = document.getElementById('save-mode-btn');
    const clearBtn = document.getElementById('clear-mode-btn');
    const modeNameInput = document.getElementById('mode-name');
    const checkboxes = document.querySelectorAll('.position-checkbox');

    // Снять все галочки
    clearBtn.addEventListener('click', function() {
        checkboxes.forEach(cb => cb.checked = false);
    });

    // Сохранить режим
    saveBtn.addEventListener('click', function() {
        const name = modeNameInput.value.trim();
        if (!name) {
            alert('Введите название режима');
            return;
        }
        const selected = [];
        checkboxes.forEach(cb => {
            if (cb.checked) selected.push(cb.value);
        });
        if (selected.length === 0) {
            alert('Выберите хотя бы одну позицию');
            return;
        }

        fetch('/create_mode/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: name, positions: selected })
        })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'ok') {
                alert(data.message);
                // Очищаем форму
                modeNameInput.value = '';
                checkboxes.forEach(cb => cb.checked = false);
                // Можно перенаправить на главную, но оставим пользователя здесь
            } else {
                alert('Ошибка: ' + data.message);
            }
        })
        .catch(err => {
            alert('Ошибка сети: ' + err);
        });
    });
});