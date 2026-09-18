// create_range.js
'use strict';

const ranks = ['A','K','Q','J','T','9','8','7','6','5','4','3','2'];
const DRAG_THRESHOLD = 10;

let currentColor = '#3498db';
let currentHands = [];
let tempSubranges = [];
let editingId = null;
let editingHands = [];

// All 169 hand-matrix cell elements, captured once after the grid is built.
// The grid is generated exactly once on load, so this stays valid for the
// lifetime of the page and avoids re-querying the DOM on every render.
let matrixCells = [];

// Frequently-accessed elements, cached once the DOM is ready.
let dom = {};

function showError(message) {
    alert('Ошибка: ' + message);
}

function showNetworkError(err) {
    alert('Ошибка сети: ' + err);
}

// Pick black or white text so hand labels stay readable against any
// user-chosen subrange color, from pale pastels to dark saturated hues.
function getContrastingTextColor(hexColor) {
    let hex = hexColor.replace('#', '');
    if (hex.length === 3) {
        hex = hex.split('').map(c => c + c).join('');
    }
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.6 ? '#24313f' : '#ffffff';
}

// Set a matrix cell's background and an automatically-contrasting text
// color together. Passing an empty color clears both, so the cell falls
// back to its default (unselected) styling from CSS.
function setCellColor(cell, color) {
    cell.style.backgroundColor = color;
    cell.style.color = color ? getContrastingTextColor(color) : '';
}

// Show "Убрать всё выделение поддиапазона" only while something is
// actually selected on the matrix.
function updateClearSelectionVisibility() {
    dom.clearSelectionBtn.style.display = currentHands.length > 0 ? 'inline-flex' : 'none';
}

// POST JSON to url. If the server reports a name collision (status
// 'exists'), ask the user to confirm and retry with overwrite=true.
function postJson(url, payload, onSuccess) {
    function attempt(overwrite) {
        fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(Object.assign({}, payload, { overwrite: overwrite }))
        })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'ok') {
                onSuccess(data);
            } else if (data.status === 'exists') {
                if (confirm(data.message)) {
                    attempt(true);
                }
            } else {
                showError(data.message);
            }
        })
        .catch(showNetworkError);
    }
    attempt(false);
}

function generateHandMatrix() {
    const container = document.getElementById('hand-matrix');
    container.innerHTML = '';
    matrixCells = [];

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
            container.appendChild(cell);
            matrixCells.push(cell);
        });
    });

    let dragData = null;

    function getCellAtPoint(clientX, clientY) {
        const elem = document.elementFromPoint(clientX, clientY);
        if (elem && elem.classList && elem.classList.contains('matrix-cell')) {
            return elem;
        }
        return null;
    }

    function handlePointerDown(e) {
        const cell = e.currentTarget;
        e.preventDefault();
        dragData = {
            cell: cell,
            startX: e.clientX,
            startY: e.clientY,
            started: false,
            dragMode: null,
            initialSelected: cell.dataset.selected === 'true'
        };
        cell.setPointerCapture(e.pointerId);
        dragData.pointerId = e.pointerId;
        document.addEventListener('pointermove', handlePointerMove);
        document.addEventListener('pointerup', handlePointerUp);
    }

    function handlePointerMove(e) {
        if (!dragData) return;
        const cell = dragData.cell;
        const dx = e.clientX - dragData.startX;
        const dy = e.clientY - dragData.startY;
        const distance = Math.sqrt(dx*dx + dy*dy);

        if (!dragData.started && distance > DRAG_THRESHOLD) {
            dragData.started = true;
            dragData.dragMode = dragData.initialSelected ? 'deselect' : 'select';
            container.classList.add('cr-matrix--dragging');
            applyAction(cell);
        }

        if (dragData.started) {
            const target = getCellAtPoint(e.clientX, e.clientY);
            if (target && target !== cell) {
                applyAction(target);
            }
        }
        e.preventDefault();
    }

    function applyAction(cell) {
        if (!dragData) return;
        const hand = cell.dataset.hand;
        if (dragData.dragMode === 'select') {
            if (cell.dataset.selected !== 'true') {
                cell.dataset.selected = 'true';
                setCellColor(cell, currentColor);
                if (!currentHands.includes(hand)) currentHands.push(hand);
                if (editingId && !editingHands.includes(hand)) editingHands.push(hand);
            }
        } else if (dragData.dragMode === 'deselect') {
            if (cell.dataset.selected === 'true') {
                cell.dataset.selected = 'false';
                setCellColor(cell, '');
                const idx = currentHands.indexOf(hand);
                if (idx > -1) currentHands.splice(idx, 1);
                if (editingId) {
                    const idx2 = editingHands.indexOf(hand);
                    if (idx2 > -1) editingHands.splice(idx2, 1);
                }
                renderCell(cell);
            }
        }
        updateClearSelectionVisibility();
    }

    function handlePointerUp(e) {
        if (!dragData) return;
        const cell = dragData.cell;
        if (!dragData.started) {
            toggleCell(cell);
        }
        container.classList.remove('cr-matrix--dragging');
        cell.releasePointerCapture(e.pointerId);
        document.removeEventListener('pointermove', handlePointerMove);
        document.removeEventListener('pointerup', handlePointerUp);
        dragData = null;
        e.preventDefault();
    }

    matrixCells.forEach(cell => {
        cell.addEventListener('pointerdown', handlePointerDown);
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
        setCellColor(cell, currentColor);
    }
    updateClearSelectionVisibility();
}

function renderCell(cell) {
    const hand = cell.dataset.hand;
    let foundColor = null;
    if (editingId) {
        if (editingHands.includes(hand) && cell.dataset.selected === 'true') {
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
            if (sub.hands.includes(hand)) {
                foundColor = sub.color;
                break;
            }
        }
    }
    if (cell.dataset.selected === 'true' && editingId && editingHands.includes(hand)) {
        setCellColor(cell, currentColor);
    } else if (foundColor) {
        setCellColor(cell, foundColor);
    } else {
        setCellColor(cell, '');
    }
}

function renderAllSubranges() {
    matrixCells.forEach(cell => renderCell(cell));
}

function clearCurrentSelection() {
    matrixCells.forEach(cell => {
        cell.dataset.selected = 'false';
    });
    currentHands = [];
    if (editingId) editingHands = [];
    renderAllSubranges();
    updateClearSelectionVisibility();
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
                        matrixCells.forEach(cell => {
                            const hand = cell.dataset.hand;
                            cell.dataset.selected = editingHands.includes(hand) ? 'true' : 'false';
                        });
                    } else {
                        cancelEditing();
                    }
                }
                updateSubrangeListUI();
                highlightEditingSubrange();
                renderAllSubranges();
                updateClearSelectionVisibility();
            }
        })
        .catch(err => console.error('Error loading subranges:', err));
}

function updateSubrangeListUI() {
    dom.subrangeListUl.innerHTML = '';
    tempSubranges.forEach(sub => {
        const li = document.createElement('li');
        li.dataset.id = sub.id;
        li.classList.add('cr-fade-in');

        const dot = document.createElement('span');
        dot.className = 'color-dot';
        dot.style.backgroundColor = sub.color;
        li.appendChild(dot);

        const nameSpan = document.createElement('span');
        nameSpan.className = 'sub-name';
        nameSpan.textContent = sub.name;
        li.appendChild(nameSpan);

        const editBtn = document.createElement('button');
        editBtn.innerHTML = '<svg class="cr-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M13.5 3.5l3 3L6 17l-4 1 1-4L13.5 3.5z"/></svg>';
        editBtn.className = 'edit-btn';
        editBtn.title = 'Edit';
        editBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            startEditing(sub.id);
        });
        li.appendChild(editBtn);

        const deleteBtn = document.createElement('button');
        deleteBtn.innerHTML = '<svg class="cr-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h12M8 6V4h4v2M6 6l1 10h6l1-10"/></svg>';
        deleteBtn.className = 'delete-btn';
        deleteBtn.title = 'Delete';
        deleteBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            if (confirm(`Удалить поддиапазон "${sub.name}"?`)) {
                deleteSubrange(sub.id);
            }
        });
        li.appendChild(deleteBtn);

        dom.subrangeListUl.appendChild(li);
    });
    dom.emptyMessage.style.display = tempSubranges.length === 0 ? 'block' : 'none';
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
            showError(data.message);
        }
    })
    .catch(showNetworkError);
}

function startEditing(id) {
    const sub = tempSubranges.find(s => s.id === id);
    if (!sub) return;
    editingId = id;
    editingHands = sub.hands.slice();
    currentHands = editingHands.slice();
    currentColor = sub.color;

    dom.subnameInput.value = sub.name;
    dom.colorPicker.value = sub.color;
    dom.cancelEditBtn.style.display = 'inline-block';
    dom.saveSubrangeBtn.innerHTML = '<svg class="cr-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 3h10l3 3v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M7 3v5h6V3"/><path d="M6 12h8v6H6z"/></svg> Обновить поддиапазон';

    matrixCells.forEach(cell => {
        const hand = cell.dataset.hand;
        if (editingHands.includes(hand)) {
            cell.dataset.selected = 'true';
            setCellColor(cell, currentColor);
        } else {
            cell.dataset.selected = 'false';
            renderCell(cell);
        }
    });
    highlightEditingSubrange();
    updateClearSelectionVisibility();
}

function cancelEditing() {
    editingId = null;
    editingHands = [];
    currentHands = [];
    dom.subnameInput.value = '';
    dom.colorPicker.value = '#3498db';
    currentColor = '#3498db';
    dom.cancelEditBtn.style.display = 'none';
    dom.saveSubrangeBtn.textContent = 'Добавить поддиапазон';
    matrixCells.forEach(cell => {
        cell.dataset.selected = 'false';
    });
    renderAllSubranges();
    highlightEditingSubrange();
    updateClearSelectionVisibility();
}

function loadRange(position) {
    fetch('/create/load_range', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ position: position })
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'ok') {
            dom.positionInput.value = data.position;
            loadTempSubranges();
            cancelEditing();
        } else {
            showError(data.message);
        }
    })
    .catch(showNetworkError);
}

function updatePositionsSelect(reset = false) {
    fetch('/create/get_positions')
        .then(response => response.json())
        .then(data => {
            const select = dom.loadRangeSelect;
            const currentValue = reset ? '' : select.value;
            select.innerHTML = '<option value="">Выберите диапазон для загрузки</option>';
            data.positions.forEach(pos => {
                const option = document.createElement('option');
                option.value = pos;
                option.textContent = pos;
                select.appendChild(option);
            });
            select.value = (!reset && data.positions.includes(currentValue)) ? currentValue : '';
        })
        .catch(err => console.error('Error updating positions list:', err));
}

// -------------------------------------------------------------------
// DOM ready
// -------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', function() {
    dom = {
        positionInput: document.getElementById('position'),
        subnameInput: document.getElementById('subname'),
        loadRangeSelect: document.getElementById('load-range-select'),
        colorPicker: document.getElementById('color-picker'),
        cancelEditBtn: document.getElementById('cancel-edit-btn'),
        saveSubrangeBtn: document.getElementById('save-subrange-btn'),
        subrangeListUl: document.getElementById('subrange-list-ul'),
        emptyMessage: document.getElementById('empty-message'),
        clearSelectionBtn: document.getElementById('clear-selection-btn')
    };

    generateHandMatrix();
    loadTempSubranges();
    updateClearSelectionVisibility();

    dom.colorPicker.addEventListener('input', function() {
        currentColor = this.value;
        matrixCells.forEach(cell => {
            if (cell.dataset.selected === 'true') {
                setCellColor(cell, currentColor);
            }
        });
    });

    dom.clearSelectionBtn.addEventListener('click', function() {
        matrixCells.forEach(cell => {
            cell.dataset.selected = 'false';
            setCellColor(cell, '');
        });
        currentHands = [];
        if (editingId) editingHands = [];
        renderAllSubranges();
        updateClearSelectionVisibility();
    });

    dom.saveSubrangeBtn.addEventListener('click', function() {
        const name = dom.subnameInput.value.trim();
        if (!name) {
            alert('Введите имя поддиапазона');
            return;
        }
        if (currentHands.length === 0) {
            alert('Выберите хотя бы одну руку');
            return;
        }

        const payload = { name: name, hands: currentHands, color: currentColor };
        let url = '/create/add_subrange';
        if (editingId) {
            url = '/create/update_subrange';
            payload.id = editingId;
        }

        postJson(url, payload, function() {
            loadTempSubranges();
            if (editingId) {
                cancelEditing();
            } else {
                clearCurrentSelection();
                dom.subnameInput.value = '';
            }
        });
    });

    dom.cancelEditBtn.addEventListener('click', function() {
        cancelEditing();
    });

    document.getElementById('clear-all-btn').addEventListener('click', function() {
        if (confirm('Удалить все добавленные поддиапазоны?')) {
            fetch('/create/clear_temp', { method: 'POST' })
                .then(() => {
                    loadTempSubranges();
                    clearCurrentSelection();
                    dom.subnameInput.value = '';
                    cancelEditing();
                });
        }
    });

    document.getElementById('save-range-btn').addEventListener('click', function() {
        const position = dom.positionInput.value.trim();
        if (!position) {
            alert('Введите имя диапазона');
            return;
        }
        if (tempSubranges.length === 0) {
            alert('Добавьте хотя бы один поддиапазон');
            return;
        }
        if (!confirm(`Сохранить диапазон "${position}"?`)) return;

        postJson('/create/save_range', { position: position }, function(data) {
            alert(data.message);
            fetch('/create/clear_temp', { method: 'POST' })
                .then(() => {
                    tempSubranges = [];
                    updateSubrangeListUI();
                    renderAllSubranges();
                    clearCurrentSelection();
                    dom.positionInput.value = '';
                    dom.subnameInput.value = '';
                    cancelEditing();
                    updatePositionsSelect(true);
                });
        });
    });

    dom.loadRangeSelect.addEventListener('change', function() {
        const pos = this.value;
        if (!pos) return;
        if (!confirm(`Загрузить диапазон "${pos}"? Текущие изменения будут потеряны`)) {
            this.value = '';
            return;
        }
        loadRange(pos);
    });

    document.getElementById('new-range-btn').addEventListener('click', function() {
        if (!confirm('Начать новый диапазон? Текущие изменения будут потеряны')) return;
        fetch('/create/reset', { method: 'POST' })
            .then(() => {
                dom.positionInput.value = '';
                dom.loadRangeSelect.value = '';
                tempSubranges = [];
                updateSubrangeListUI();
                renderAllSubranges();
                clearCurrentSelection();
                dom.subnameInput.value = '';
                cancelEditing();
            });
    });

    document.getElementById('delete-range-btn').addEventListener('click', function() {
        const pos = dom.loadRangeSelect.value;
        if (!pos) {
            alert('Выберите диапазон для удаления');
            return;
        }
        if (!confirm(`Удалить диапазон "${pos}"? Данное действие необратимо`)) return;

        fetch('/create/delete_range', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ position: pos })
        })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'ok') {
                alert(data.message);
                fetch('/create/clear_temp', { method: 'POST' })
                    .then(() => {
                        dom.positionInput.value = '';
                        tempSubranges = [];
                        updateSubrangeListUI();
                        renderAllSubranges();
                        clearCurrentSelection();
                        dom.subnameInput.value = '';
                        cancelEditing();
                        updatePositionsSelect(true);
                    });
            } else {
                showError(data.message);
            }
        })
        .catch(showNetworkError);
    });
});
