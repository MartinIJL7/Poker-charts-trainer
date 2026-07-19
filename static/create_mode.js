// create_mode.js

let editingModeName = null;
let modesContainer;
let toggleBtn;
let saveBtn;

document.addEventListener('DOMContentLoaded', function() {
    saveBtn = document.getElementById('save-mode-btn');
    const clearBtn = document.getElementById('clear-mode-btn');
    const modeNameInput = document.getElementById('mode-name');
    const checkboxes = document.querySelectorAll('.position-checkbox');
    const cancelEditBtn = document.getElementById('cancel-edit-mode-btn');

    modesContainer = document.getElementById('modes-container');
    toggleBtn = document.getElementById('toggle-modes-btn');

    // Снять все галочки
    clearBtn.addEventListener('click', function() {
        checkboxes.forEach(cb => cb.checked = false);
    });

    // Отменить редактирование
    cancelEditBtn.addEventListener('click', cancelEditMode);

    // Показать/скрыть таблицу режимов
    toggleBtn.addEventListener('click', function() {
        if (modesContainer.style.display === 'none') {
            modesContainer.style.display = 'block';
            this.textContent = '📁 Скрыть режимы';
            loadModesTable();
        } else {
            modesContainer.style.display = 'none';
            this.textContent = '📂 Показать существующие режимы';
        }
    });

    // Сохранить или обновить режим
    saveBtn.addEventListener('click', function() {
        const name = document.getElementById('mode-name').value.trim();
        if (!name) {
            alert('Введите название режима');
            return;
        }
        const selected = [];
        document.querySelectorAll('.position-checkbox:checked').forEach(cb => {
            selected.push(cb.value);
        });
        if (selected.length === 0) {
            alert('Выберите хотя бы одну позицию');
            return;
        }

        // Режим редактирования?
        if (editingModeName) {
            // Обновление
            fetch('/create_mode/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    old_name: editingModeName, 
                    new_name: name, 
                    positions: selected 
                })
            })
            .then(response => response.json())
            .then(data => {
                if (data.status === 'ok') {
                    alert(data.message);
                    cancelEditMode();
                    if (modesContainer.style.display !== 'none') {
                        loadModesTable();
                    }
                } else {
                    alert('Ошибка: ' + data.message);
                }
            })
            .catch(err => alert('Ошибка сети: ' + err));
        } else {
            // Создание
            fetch('/create_mode/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: name, positions: selected })
            })
            .then(response => response.json())
            .then(data => {
                if (data.status === 'ok') {
                    alert(data.message);
                    document.getElementById('mode-name').value = '';
                    document.querySelectorAll('.position-checkbox').forEach(cb => cb.checked = false);
                    if (modesContainer.style.display !== 'none') {
                        loadModesTable();
                    }
                } else {
                    alert('Ошибка: ' + data.message);
                }
            })
            .catch(err => alert('Ошибка сети: ' + err));
        }
    });

    // Загрузить таблицу при первом открытии
    // (она уже загружается по клику на кнопку)
});

// Загрузка таблицы режимов
function loadModesTable() {
    fetch('/get_modes')
        .then(response => response.json())
        .then(data => {
            const tbody = document.getElementById('modes-tbody');
            tbody.innerHTML = '';
            const modes = data.modes;
            const modeNames = Object.keys(modes).sort();
            if (modeNames.length === 0) {
                tbody.innerHTML = '<tr><td colspan="3">Режимов пока нет.</td></tr>';
                return;
            }
            modeNames.forEach(name => {
                const tr = document.createElement('tr');
                const tdName = document.createElement('td');
                tdName.textContent = name;
                const tdPos = document.createElement('td');
                tdPos.textContent = modes[name].join(', ');
                const tdActions = document.createElement('td');

                // Кнопка "Редактировать"
                const editBtn = document.createElement('button');
                editBtn.textContent = '✏️';
                editBtn.className = 'btn-secondary';
                editBtn.style.padding = '4px 8px';
                editBtn.style.marginRight = '6px';
                editBtn.style.fontSize = '1em';
                editBtn.style.borderRadius = '4px';
                editBtn.style.border = 'none';
                editBtn.style.cursor = 'pointer';
                editBtn.addEventListener('click', function() {
                    editMode(name);
                });
                tdActions.appendChild(editBtn);

                // Кнопка "Удалить"
                const deleteBtn = document.createElement('button');
                deleteBtn.textContent = '🗑️';
                deleteBtn.className = 'btn-danger';
                deleteBtn.style.padding = '4px 8px';
                deleteBtn.style.fontSize = '1em';
                deleteBtn.style.borderRadius = '4px';
                deleteBtn.style.border = 'none';
                deleteBtn.style.cursor = 'pointer';
                deleteBtn.addEventListener('click', function() {
                    if (!confirm(`Удалить режим "${name}"? Это действие необратимо.`)) return;
                    fetch(`/delete_mode/${name}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' }
                    })
                    .then(response => response.json())
                    .then(data => {
                        if (data.status === 'ok') {
                            alert(data.message);
                            if (editingModeName === name) {
                                cancelEditMode();
                            }
                            if (modesContainer.style.display !== 'none') {
                                loadModesTable();
                            }
                        } else {
                            alert('Ошибка: ' + data.message);
                        }
                    })
                    .catch(err => alert('Ошибка сети: ' + err));
                });
                tdActions.appendChild(deleteBtn);

                tr.appendChild(tdName);
                tr.appendChild(tdPos);
                tr.appendChild(tdActions);
                tbody.appendChild(tr);
            });
        })
        .catch(err => console.error('Ошибка загрузки режимов:', err));
}

// Редактирование режима
function editMode(name) {
    fetch(`/get_mode/${name}`)
        .then(response => response.json())
        .then(data => {
            if (data.status === 'error') {
                alert(data.message);
                return;
            }
            // Сбросить предыдущее редактирование (без перезагрузки)
            cancelEditMode();
            // Заполнить форму
            document.getElementById('mode-name').value = name;
            document.querySelectorAll('.position-checkbox').forEach(cb => {
                cb.checked = data.positions.includes(cb.value);
            });
            editingModeName = name;
            document.getElementById('save-mode-btn').textContent = '🔄 Обновить режим';
            document.getElementById('cancel-edit-mode-btn').style.display = 'inline-block';
        })
        .catch(err => alert('Ошибка загрузки режима: ' + err));
}

// Отмена редактирования
function cancelEditMode() {
    editingModeName = null;
    document.getElementById('mode-name').value = '';
    document.querySelectorAll('.position-checkbox').forEach(cb => cb.checked = false);
    document.getElementById('save-mode-btn').textContent = '💾 Сохранить режим';
    document.getElementById('cancel-edit-mode-btn').style.display = 'none';
}