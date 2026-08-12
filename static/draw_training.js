// draw_training.js
'use strict';

let currentColor = '#3498db';
let currentHands = [];
let tempSubranges = [];
let editingId = null;
let editingHands = [];

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
        cell.style.backgroundColor = '';
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
        editBtn.title = 'Edit';
        editBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            startEditing(sub.id);
        });
        li.appendChild(editBtn);

        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = '🗑️';
        deleteBtn.className = 'delete-btn';
        deleteBtn.title = 'Delete';
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
    tempSubranges = tempSubranges.filter(s => s.id !== id);
    if (editingId === id) cancelEditing();
    updateSubrangeListUI();
    renderAllSubranges();
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

function addSubrange(name, hands, color) {
    const id = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15);
    const handsSet = new Set(hands);
    tempSubranges = tempSubranges.map(sub => {
        if (sub.id !== id) {
            sub.hands = sub.hands.filter(h => !handsSet.has(h));
        }
        return sub;
    });
    tempSubranges.push({ id, name, hands: hands.slice(), color });
    updateSubrangeListUI();
    renderAllSubranges();
}

function clearAllSubranges() {
    if (tempSubranges.length === 0) return;
    if (!confirm('Удалить все поддиапазоны?')) return;
    tempSubranges = [];
    updateSubrangeListUI();
    renderAllSubranges();
    cancelEditing();
    clearCurrentSelection();
}

function checkAnswer() {
    if (tempSubranges.length === 0) {
        alert('Добавьте хотя бы один поддиапазон перед проверкой');
        return;
    }
    const subranges = tempSubranges.map(sub => ({
        name: sub.name,
        hands: sub.hands.slice()
    }));

    fetch(window.location.href, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subranges })
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'ok') {
            if (data.stats) updateStats(data.stats);
            showResult(data);
        } else {
            alert('Ошибка: ' + data.message);
        }
    })
    .catch(err => alert('Ошибка сети: ' + err));
}

function formatHands(hands) {
    if (!hands || hands.length === 0) return '—';

    const rankOrder = { 'A': 14, 'K': 13, 'Q': 12, 'J': 11, 'T': 10, '9': 9, '8': 8, '7': 7, '6': 6, '5': 5, '4': 4, '3': 3, '2': 2 };
    const compareByRank = (a, b) => {
        const r1 = a[0], r2 = b[0];
        if (rankOrder[r1] !== rankOrder[r2]) return rankOrder[r2] - rankOrder[r1];
        if (a.length === 2) return 0;
        const s1 = a[1], s2 = b[1];
        if (a.length === 3 && a[2] === 's') {
            const second1 = a[1], second2 = b[1];
            return rankOrder[second2] - rankOrder[second1];
        }
        if (a.length === 3 && a[2] === 'o') {
            const second1 = a[1], second2 = b[1];
            return rankOrder[second2] - rankOrder[second1];
        }
        return 0;
    };

    const pairs = [];
    const suited = [];
    const offsuit = [];

    hands.forEach(hand => {
        if (hand.length === 2) {
            pairs.push(hand);
        } else if (hand.endsWith('s')) {
            suited.push(hand);
        } else if (hand.endsWith('o')) {
            offsuit.push(hand);
        }
    });

    const sortHands = (arr) => arr.sort(compareByRank);
    sortHands(pairs);
    sortHands(suited);
    sortHands(offsuit);

    const parts = [];
    if (pairs.length) parts.push('Пары: ' + pairs.join(', '));
    if (suited.length) parts.push('Одномастные: ' + suited.join(', '));
    if (offsuit.length) parts.push('Разномастные: ' + offsuit.join(', '));
    return parts.join('; ');
}

function showResult(data) {
    const block = document.getElementById('result-block');
    const content = document.getElementById('result-content');
    block.style.display = 'block';

    let html = `<p><strong>Позиция:</strong> ${data.position}</p>`;

    const hasErrors = data.missing.length > 0 || data.extra_hands.length > 0 || data.wrong_names.length > 0;

    if (!hasErrors) {
        html += `<p style="color: #27ae60; font-size: 1.2em;">✅ Отлично! Все поддиапазоны нарисованы верно</p>`;
    } else {
        if (data.missing.length > 0) {
            html += `<div class="result-item missing"><h4 style="color: #e67e22;">❌ Пропущенные руки (должны быть, но отсутствуют):</h4>`;
            data.missing.forEach(item => {
                html += `<p><strong>${item.name}:</strong> <span class="hands">${formatHands(item.hands)}</span></p>`;
            });
            html += `</div>`;
        }
        if (data.extra_hands.length > 0) {
            html += `<div class="result-item extra"><h4 style="color: #e74c3c;">⚠️ Лишние руки в правильных поддиапазонах:</h4>`;
            data.extra_hands.forEach(item => {
                html += `<p><strong>${item.name}:</strong> <span class="hands">${formatHands(item.hands)}</span></p>`;
            });
            html += `</div>`;
        }
        if (data.wrong_names.length > 0) {
            html += `<div class="result-item wrong-name"><h4 style="color: #8e44ad;">❌ Неправильные названия поддиапазонов:</h4>`;
            data.wrong_names.forEach(name => {
                html += `<p><strong>${name}</strong></p>`;
            });
            html += `</div>`;
        }
    }

    content.innerHTML = html;
}

function updateStats(stats) {
    document.getElementById('stats-total').textContent = stats.total;
    document.getElementById('stats-correct').textContent = stats.correct;
    document.getElementById('stats-wrong').textContent = stats.wrong;
    const total = stats.total;
    if (total > 0) {
        document.getElementById('stats-correct-pct').textContent = (stats.correct / total * 100).toFixed(1);
        document.getElementById('stats-wrong-pct').textContent = (stats.wrong / total * 100).toFixed(1);
    } else {
        document.getElementById('stats-correct-pct').textContent = '0.0';
        document.getElementById('stats-wrong-pct').textContent = '0.0';
    }
}

document.addEventListener('DOMContentLoaded', function() {
    generateHandMatrix();

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
        clearCurrentSelection();
        if (editingId) {
            const sub = tempSubranges.find(s => s.id === editingId);
            if (sub) {
                editingHands = [];
                currentHands = [];
                const cells = document.querySelectorAll('#hand-matrix .matrix-cell:not(.matrix-header)');
                cells.forEach(cell => {
                    cell.dataset.selected = 'false';
                    renderCell(cell);
                });
            }
        }
    });

    document.getElementById('save-subrange-btn').addEventListener('click', function() {
        const name = document.getElementById('subname').value.trim();
        if (!name) {
            alert('Введите имя поддиапазона');
            return;
        }
        if (currentHands.length === 0) {
            alert('Выберите хотя бы одну руку');
            return;
        }

        if (editingId) {
            const sub = tempSubranges.find(s => s.id === editingId);
            if (sub) {
                const handsSet = new Set(currentHands);
                tempSubranges = tempSubranges.map(s => {
                    if (s.id !== editingId) {
                        s.hands = s.hands.filter(h => !handsSet.has(h));
                    }
                    return s;
                });
                sub.name = name;
                sub.hands = currentHands.slice();
                sub.color = currentColor;
                updateSubrangeListUI();
                renderAllSubranges();
                cancelEditing();
            }
        } else {
            addSubrange(name, currentHands, currentColor);
            clearCurrentSelection();
            document.getElementById('subname').value = '';
        }
    });

    document.getElementById('cancel-edit-btn').addEventListener('click', function() {
        cancelEditing();
    });

    document.getElementById('clear-all-btn').addEventListener('click', function() {
        clearAllSubranges();
    });

    document.getElementById('check-btn').addEventListener('click', function() {
        checkAnswer();
    });

    function newPosition() {
        window.location.href = window.location.href;
    }

    document.getElementById('new-position-btn').addEventListener('click', newPosition);
    document.getElementById('new-after-check-btn').addEventListener('click', newPosition);

    document.getElementById('retry-btn').addEventListener('click', function() {
        document.getElementById('result-block').style.display = 'none';
    });
});