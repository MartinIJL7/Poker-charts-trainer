// create_mode.js

function loadModesTable() {
    fetch('/get_modes')
        .then(response => response.json())
        .then(data => {
            const tbody = document.getElementById('modes-tbody');
            tbody.innerHTML = '';
            const modes = data.modes;
            const modeNames = Object.keys(modes).sort();
            if (modeNames.length === 0) {
                tbody.innerHTML = '<tr><td colspan="2">Режимов пока нет.</td></tr>';
                return;
            }
            modeNames.forEach(name => {
                const tr = document.createElement('tr');
                const tdName = document.createElement('td');
                tdName.textContent = name;
                const tdPos = document.createElement('td');
                tdPos.textContent = modes[name].join(', ');
                tr.appendChild(tdName);
                tr.appendChild(tdPos);
                tbody.appendChild(tr);
            });
        })
        .catch(err => console.error('Ошибка загрузки режимов:', err));
}

document.addEventListener('DOMContentLoaded', function() {
    const saveBtn = document.getElementById('save-mode-btn');
    const clearBtn = document.getElementById('clear-mode-btn');
    const modeNameInput = document.getElementById('mode-name');
    const checkboxes = document.querySelectorAll('.position-checkbox');
    const toggleBtn = document.getElementById('toggle-modes-btn');
    const modesContainer = document.getElementById('modes-container');

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
                // Обновить таблицу, если она открыта
                if (modesContainer.style.display !== 'none') {
                    loadModesTable();
                }
            } else {
                alert('Ошибка: ' + data.message);
            }
        })
        .catch(err => {
            alert('Ошибка сети: ' + err);
        });
    });

    toggleBtn.addEventListener('click', function() {
    if (modesContainer.style.display === 'none') {
        modesContainer.style.display = 'block';
        this.textContent = '📁 Скрыть режимы';
        loadModesTable(); // загружаем при открытии
    } else {
        modesContainer.style.display = 'none';
        this.textContent = '📂 Показать существующие режимы';
    }
    });
});