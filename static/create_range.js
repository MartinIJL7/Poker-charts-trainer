// create_range.js

let currentColor = '#3498db';
let currentHands = [];
let tempSubranges = [];
let editingId = null;
let editingHands = [];
let editingPosition = null;   // будет хранить позицию загруженного диапазона

let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;
let dragMode = 'select';
const DRAG_THRESHOLD = 5;

const ranks = ['A','K','Q','J','T','9','8','7','6','5','4','3','2'];

function generateHandMatrix() {
    const container = document.getElementById('hand-matrix');
    container.innerHTML = '';
    ranks.forEach((rowRank, i) => {
        ranks.forEach((colRank, j) => {
            const cell = document.createElement('div');
            cell.className = 'matrix-cell';
            let hand = '';
            if (i === j) {
                hand = rowRank + colRank;
            } else if (i < j) {
                hand = rowRank + colRank + 's';
            } else {
                hand = colRank + rowRank + 'o';
            }
            cell.textContent = hand;
            cell.dataset.hand = hand;
            cell.dataset.selected = 'false';

            cell.addEventListener('pointerdown', function(e) {
                dragStartX = e.clientX;
                dragStartY = e.clientY;
                isDragging = false;
                this.dataset.dragStartSelected = this.dataset.selected === 'true';
                e.preventDefault();
            });

            cell.addEventListener('pointermove', function(e) {
                // Работаем только при зажатой левой кнопке
                if (e.buttons !== 1) return;

                if (!isDragging && (Math.abs(e.clientX - dragStartX) > DRAG_THRESHOLD || Math.abs(e.clientY - dragStartY) > DRAG_THRESHOLD)) {
                    isDragging = true;
                    const startSelected = this.dataset.dragStartSelected === 'true';
                    dragMode = startSelected ? 'deselect' : 'select';
                    if (dragMode === 'select') {
                        if (this.dataset.selected === 'false') toggleCellForDrag(this);
                    } else {
                        if (this.dataset.selected === 'true') untoggleCellForDrag(this);
                    }
                }
                if (isDragging) {
                    if (dragMode === 'select') {
                        if (this.dataset.selected === 'false') toggleCellForDrag(this);
                    } else {
                        if (this.dataset.selected === 'true') untoggleCellForDrag(this);
                    }
                }
            });

            cell.addEventListener('pointerup', function(e) {
                if (!isDragging) {
                    toggleCell(this);
                }
                isDragging = false;
            });

            container.appendChild(cell);
        });
    });
    renderAllSubranges();
}

function toggleCell(cell) {
    const hand = cell.dataset.hand;
    const isSelected = cell.dataset.selected === 'true';
    if (isSelected) {
        cell.dataset.selected = 'false';
        const index = currentHands.indexOf(hand);
        if (index > -1) currentHands.splice(index, 1);
        if (editingId) {
            const idx = editingHands.indexOf(hand);
            if (idx > -1) editingHands.splice(idx, 1);
        }
        renderCell(cell);
    } else {
        cell.dataset.selected = 'true';
        if (!currentHands.includes(hand)) currentHands.push(hand);
        if (editingId) {
            if (!editingHands.includes(hand)) editingHands.push(hand);
        }
        cell.style.backgroundColor = currentColor;
    }
}

function toggleCellForDrag(cell) {
    const hand = cell.dataset.hand;
    if (cell.dataset.selected === 'true') return;
    cell.dataset.selected = 'true';
    cell.style.backgroundColor = currentColor;
    if (!currentHands.includes(hand)) currentHands.push(hand);
    if (editingId) {
        if (!editingHands.includes(hand)) editingHands.push(hand);
    }
}

function untoggleCellForDrag(cell) {
    const hand = cell.dataset.hand;
    if (cell.dataset.selected === 'false') return;
    cell.dataset.selected = 'false';
    cell.style.backgroundColor = '';
    const index = currentHands.indexOf(hand);
    if (index > -1) currentHands.splice(index, 1);
    if (editingId) {
        const idx = editingHands.indexOf(hand);
        if (idx > -1) editingHands.splice(idx, 1);
    }
    renderCell(cell);
}

function renderCell(cell) {
    const hand = cell.dataset.hand;
    let foundColor = null;
    if (editingId) {
        if (editingHands.includes(hand)) {
            if (cell.dataset.selected === 'true') {
                foundColor = currentColor;
            } else {
                for (let sub of tempSubranges) {
                    if (sub.id !== editingId && sub.hands.includes(hand)) {
                        foundColor = sub.color;
                        break;
                    }
                }
            }
        } else {
            for (let sub of tempSubranges) {
                if (sub.id !== editingId && sub.hands.includes(hand)) {
                    foundColor = sub.color;
                    break;
                }
            }
        }
    } else {
        for (let sub of tempSubranges) {
            if (sub.hands.includes(hand)) {
                foundColor = sub.color;
                break;
            }
        }
    }
    if (cell.dataset.selected === 'true' && editingId && editingHands.includes(hand)) {
        cell.style.backgroundColor = currentColor;
    } else if (foundColor) {
        cell.style.backgroundColor = foundColor;
    } else {
        cell.style.backgroundColor = '';
    }
}

function renderAllSubranges() {
    const cells = document.querySelectorAll('#hand-matrix .matrix-cell:not(.matrix-header)');
    cells.forEach(cell => renderCell(cell));
}

function clearCurrentSelection() {
    const cells = document.querySelectorAll('#hand-matrix .matrix-cell:not(.matrix-header)');
    cells.forEach(cell => {
        cell.dataset.selected = 'false';
    });
    currentHands = [];
    if (editingId) editingHands = [];
    renderAllSubranges();
}

function highlightEditingSubrange() {
    document.querySelectorAll('#subrange-list-ul li').forEach(li => li.classList.remove('editing-subrange'));
    if (editingId) {
        const li = document.querySelector(`#subrange-list-ul li[data-id="${editingId}"]`);
        if (li) li.classList.add('editing-subrange');
    }
}

function loadTempSubranges() {
    fetch('/create/get_temp')
        .then(response => response.json())
        .then(data => {
            if (data.subranges) {
                tempSubranges = data.subranges.map(sub => ({
                    id: sub.id,
                    name: sub.name,
                    color: sub.color || '#3498db',
                    hands: sub.hands || []
                }));
                if (editingId) {
                    const sub = tempSubranges.find(s => s.id === editingId);
                    if (sub) {
                        editingHands = sub.hands.slice();
                        currentHands = editingHands.slice();
                        const cells = document.querySelectorAll('#hand-matrix .matrix-cell:not(.matrix-header)');
                        cells.forEach(cell => {
                            const hand = cell.dataset.hand;
                            if (editingHands.includes(hand)) {
                                cell.dataset.selected = 'true';
                            } else {
                                cell.dataset.selected = 'false';
                            }
                        });
                    } else {
                        cancelEditing();
                    }
                }
                updateSubrangeListUI();
                highlightEditingSubrange();
                renderAllSubranges();
            }
        })
        .catch(err => console.error('Ошибка загрузки поддиапазонов:', err));
}

function updateSubrangeListUI() {
    const ul = document.getElementById('subrange-list-ul');
    ul.innerHTML = '';
    tempSubranges.forEach(sub => {
        const li = document.createElement('li');
        li.dataset.id = sub.id;

        const dot = document.createElement('span');
        dot.className = 'color-dot';
        dot.style.backgroundColor = sub.color;
        li.appendChild(dot);

        const nameSpan = document.createElement('span');
        nameSpan.className = 'sub-name';
        nameSpan.textContent = sub.name;
        li.appendChild(nameSpan);

        const editBtn = document.createElement('button');
        editBtn.textContent = '✏️';
        editBtn.className = 'edit-btn';
        editBtn.title = 'Редактировать';
        editBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            startEditing(sub.id);
        });
        li.appendChild(editBtn);

        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = '🗑️';
        deleteBtn.className = 'delete-btn';
        deleteBtn.title = 'Удалить';
        deleteBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            if (confirm(`Удалить поддиапазон "${sub.name}"?`)) {
                deleteSubrange(sub.id);
            }
        });
        li.appendChild(deleteBtn);

        ul.appendChild(li);
    });
    const emptyMsg = document.getElementById('empty-message');
    emptyMsg.style.display = tempSubranges.length === 0 ? 'block' : 'none';
}

function deleteSubrange(id) {
    fetch('/create/remove_subrange', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: id })
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'ok') {
            loadTempSubranges();
            if (editingId === id) cancelEditing();
        } else {
            alert('Ошибка: ' + data.message);
        }
    })
    .catch(err => alert('Ошибка сети: ' + err));
}

function startEditing(id) {
    const sub = tempSubranges.find(s => s.id === id);
    if (!sub) return;
    editingId = id;
    editingHands = sub.hands.slice();
    currentHands = editingHands.slice();
    currentColor = sub.color;

    document.getElementById('subname').value = sub.name;
    document.getElementById('color-picker').value = sub.color;
    document.getElementById('cancel-edit-btn').style.display = 'inline-block';
    document.getElementById('save-subrange-btn').textContent = '💾 Обновить поддиапазон';

    const cells = document.querySelectorAll('#hand-matrix .matrix-cell:not(.matrix-header)');
    cells.forEach(cell => {
        const hand = cell.dataset.hand;
        if (editingHands.includes(hand)) {
            cell.dataset.selected = 'true';
            cell.style.backgroundColor = currentColor;
        } else {
            cell.dataset.selected = 'false';
            renderCell(cell);
        }
    });
    highlightEditingSubrange();
}

function cancelEditing() {
    editingId = null;
    editingHands = [];
    currentHands = [];
    document.getElementById('edit-id').value = '';
    document.getElementById('subname').value = '';
    document.getElementById('color-picker').value = '#3498db';
    currentColor = '#3498db';
    document.getElementById('cancel-edit-btn').style.display = 'none';
    document.getElementById('save-subrange-btn').textContent = '✅ Добавить поддиапазон';
    const cells = document.querySelectorAll('#hand-matrix .matrix-cell:not(.matrix-header)');
    cells.forEach(cell => {
        cell.dataset.selected = 'false';
    });
    renderAllSubranges();
    highlightEditingSubrange();
}

// Загрузить существующий диапазон по имени позиции
function loadRange(position) {
    fetch('/create/load_range', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ position: position })
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'ok') {
            document.getElementById('position').value = data.position;
            editingPosition = data.position;
            // перезагружаем поддиапазоны из сессии
            loadTempSubranges();
            // сбрасываем редактирование, если было
            cancelEditing();
        } else {
            alert('Ошибка: ' + data.message);
        }
    })
    .catch(err => alert('Ошибка сети: ' + err));
}

// Обновить список позиций в выпадающем списке
function updatePositionsSelect(reset = false) {
    fetch('/create/get_positions')
        .then(response => response.json())
        .then(data => {
            const select = document.getElementById('load-range-select');
            const currentValue = reset ? '' : select.value;
            select.innerHTML = '<option value="">📂 Загрузить</option>';
            data.positions.forEach(pos => {
                const option = document.createElement('option');
                option.value = pos;
                option.textContent = pos;
                select.appendChild(option);
            });
            if (!reset && data.positions.includes(currentValue)) {
                select.value = currentValue;
            } else {
                select.value = '';
            }
        })
        .catch(err => console.error('Ошибка обновления списка позиций:', err));
}

document.addEventListener('DOMContentLoaded', function() {
    generateHandMatrix();
    loadTempSubranges();

    document.getElementById('color-picker').addEventListener('input', function() {
        currentColor = this.value;
        const cells = document.querySelectorAll('#hand-matrix .matrix-cell:not(.matrix-header)');
        cells.forEach(cell => {
            if (cell.dataset.selected === 'true') {
                cell.style.backgroundColor = currentColor;
            }
        });
    });

    document.getElementById('clear-selection-btn').addEventListener('click', function() {
        const cells = document.querySelectorAll('#hand-matrix .matrix-cell:not(.matrix-header)');
        cells.forEach(cell => {
            cell.dataset.selected = 'false';
            cell.style.backgroundColor = '';
        });
        currentHands = [];
        if (editingId) editingHands = [];
        renderAllSubranges();
    });

    document.getElementById('save-subrange-btn').addEventListener('click', function() {
        const name = document.getElementById('subname').value.trim();
        if (!name) {
            alert('Введите название поддиапазона');
            return;
        }
        if (currentHands.length === 0) {
            alert('Выберите хотя бы одну руку');
            return;
        }

        if (editingId) {
            fetch('/create/update_subrange', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: editingId,
                    name: name,
                    hands: currentHands,
                    color: currentColor
                })
            })
            .then(response => response.json())
            .then(data => {
                if (data.status === 'ok') {
                    loadTempSubranges();
                    cancelEditing();
                } else {
                    alert('Ошибка: ' + data.message);
                }
            })
            .catch(err => alert('Ошибка сети: ' + err));
        } else {
            fetch('/create/add_subrange', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, hands: currentHands, color: currentColor })
            })
            .then(response => response.json())
            .then(data => {
                if (data.status === 'ok') {
                    loadTempSubranges();
                    clearCurrentSelection();
                    document.getElementById('subname').value = '';
                } else {
                    alert('Ошибка: ' + data.message);
                }
            })
            .catch(err => alert('Ошибка сети: ' + err));
        }
    });

    document.getElementById('cancel-edit-btn').addEventListener('click', function() {
        cancelEditing();
    });

    document.getElementById('clear-all-btn').addEventListener('click', function() {
        if (confirm('Удалить все добавленные поддиапазоны?')) {
            fetch('/create/clear_temp', { method: 'POST' })
                .then(() => {
                    loadTempSubranges();
                    clearCurrentSelection();
                    document.getElementById('subname').value = '';
                    cancelEditing();
                });
        }
    });

    document.getElementById('save-range-btn').addEventListener('click', function() {
        const position = document.getElementById('position').value.trim();
        if (!position) {
            alert('Введите название диапазона');
            return;
        }
        if (tempSubranges.length === 0) {
            alert('Добавьте хотя бы один поддиапазон');
            return;
        }
        if (!confirm(`Сохранить диапазон для позиции "${position}"?`)) return;

        fetch('/create/save_range', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ position })
        })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'ok') {
                alert(data.message);
                editingPosition = null;   // сбрасываем флаг на клиенте

                // Очищаем всё через сервер (temp_subranges и editing_position)
                fetch('/create/clear_temp', { method: 'POST' })
                    .then(() => {
                        tempSubranges = [];
                        updateSubrangeListUI();
                        renderAllSubranges();
                        clearCurrentSelection();
                        document.getElementById('position').value = '';
                        document.getElementById('subname').value = '';
                        cancelEditing();
                        // Обновляем список позиций в селекте
                        updatePositionsSelect(true);
                    });
            } else {
                alert('Ошибка: ' + data.message);
            }
        })
        .catch(err => alert('Ошибка сети: ' + err));
    });

    // Обработчик выбора существующего диапазона из списка
    document.getElementById('load-range-select').addEventListener('change', function() {
        const pos = this.value;
        if (!pos) return;
        if (!confirm('Загрузить диапазон "' + pos + '"? Текущие изменения будут потеряны.')) {
            this.value = ''; // сбросить выбор
            return;
        }
        loadRange(pos);   // вызываем функцию, которую добавили выше
    });

    // Кнопка "Новый диапазон"
    document.getElementById('new-range-btn').addEventListener('click', function() {
        if (!confirm('Начать новый диапазон? Текущие изменения будут потеряны.')) return;
        fetch('/create/clear_temp', { method: 'POST' })
            .then(() => {
                editingPosition = null;
                document.getElementById('position').value = '';
                document.getElementById('load-range-select').value = '';
                tempSubranges = [];
                updateSubrangeListUI();
                renderAllSubranges();
                clearCurrentSelection();
                document.getElementById('subname').value = '';
                cancelEditing();
            });
    });

    // Удаление выбранного диапазона
    document.getElementById('delete-range-btn').addEventListener('click', function() {
        const select = document.getElementById('load-range-select');
        const pos = select.value;
        if (!pos) {
            alert('Выберите диапазон для удаления');
            return;
        }
        if (!confirm(`Удалить диапазон "${pos}"? Это действие необратимо.`)) return;

        fetch('/create/delete_range', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ position: pos })
        })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'ok') {
                alert(data.message);
                // После удаления всегда очищаем интерфейс, так как удаляемый диапазон был загружен
                fetch('/create/clear_temp', { method: 'POST' })
                    .then(() => {
                        editingPosition = null;
                        document.getElementById('position').value = '';
                        tempSubranges = [];
                        updateSubrangeListUI();
                        renderAllSubranges();
                        clearCurrentSelection();
                        document.getElementById('subname').value = '';
                        cancelEditing();
                        // Обновляем селект (удалённая позиция исчезнет)
                        updatePositionsSelect(true);
                    });
            } else {
                alert('Ошибка: ' + data.message);
            }
        })
        .catch(err => alert('Ошибка сети: ' + err));
    });
});