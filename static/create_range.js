// create_range.js
'use strict';

const ranks = ['A','K','Q','J','T','9','8','7','6','5','4','3','2'];
const DRAG_THRESHOLD = 10;

let currentColor = '#3498db';
let currentHands = [];
let tempSubranges = [];
let editingId = null;
let editingHands = [];

// Name of the saved range currently loaded for editing, or null when
// working on a brand-new (not-yet-saved) range. Drives the mode
// indicator, the save button's wording, and the delete button's state.
let loadedRangeName = null;

// Which toolbar panel is visible: 'new' or 'edit'. Independent from
// loadedRangeName while browsing the edit tab before picking anything.
let activePanel = 'new';

// Content-based fingerprint of tempSubranges at the last known-clean
// point (right after loading or saving). null means "no known baseline"
// (e.g. a page reload mid-edit), in which case Save stays enabled rather
// than guessing whether there are unsaved changes.
let savedSnapshot = null;

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

// Content-based (not id-based, since ids are regenerated UUIDs on every
// load) fingerprint of a subrange list, used to detect real changes.
function snapshotSubranges(subs) {
    return JSON.stringify(
        subs.map(s => ({ name: s.name, color: s.color, hands: [...s.hands].sort() }))
            .sort((a, b) => a.name.localeCompare(b.name))
    );
}

// Whether there's anything that would actually be lost by resetting or
// navigating away right now. An in-progress matrix selection always
// counts (it's not part of any saved subrange yet); otherwise it's
// gated by real content changes relative to the last clean state.
function hasUnsavedChanges() {
    if (currentHands.length > 0) return true;
    if (loadedRangeName === null) {
        return tempSubranges.length > 0;
    }
    const nameChanged = dom.positionInput.value.trim() !== loadedRangeName;
    const subrangesChanged = savedSnapshot === null || snapshotSubranges(tempSubranges) !== savedSnapshot;
    return nameChanged || subrangesChanged;
}

// Single source of truth for whether the position field / Save / Cancel
// are usable: disabled while browsing the edit tab with nothing picked,
// gated by real changes while editing, always enabled while creating new.
function updateSaveButtonState() {
    const browsingWithNothingLoaded = activePanel === 'edit' && loadedRangeName === null;
    dom.positionInput.disabled = browsingWithNothingLoaded;

    if (browsingWithNothingLoaded) {
        dom.saveRangeBtn.disabled = true;
        dom.cancelRangeEditBtn.disabled = true;
        return;
    }

    if (loadedRangeName === null) {
        dom.saveRangeBtn.disabled = false;
        dom.cancelRangeEditBtn.disabled = true;
        return;
    }

    const nameChanged = dom.positionInput.value.trim() !== loadedRangeName;
    const subrangesChanged = savedSnapshot === null || snapshotSubranges(tempSubranges) !== savedSnapshot;
    const dirty = nameChanged || subrangesChanged;
    dom.saveRangeBtn.disabled = !dirty;
    dom.cancelRangeEditBtn.disabled = !dirty;
}

// Show/hide the dropdown+delete picker and mark the matching tab active.
function setActivePanel(panel) {
    activePanel = panel;
    const isEdit = panel === 'edit';
    dom.tabNewBtn.classList.toggle('cr-mode-tab--active', !isEdit);
    dom.tabEditBtn.classList.toggle('cr-mode-tab--active', isEdit);
    dom.editPickerGroup.classList.toggle('cr-hidden', !isEdit);
    updateSaveButtonState();
}

// Reflect whether we're creating a new range or editing a loaded one:
// updates which tab is active, the edit tab's name suffix, and the save
// button's wording.
function updateRangeModeUI() {
    const isEditing = loadedRangeName !== null;

    dom.tabEditName.textContent = isEditing ? ' — ' + loadedRangeName : '';
    setActivePanel(isEditing ? 'edit' : 'new');

    dom.saveRangeBtn.textContent = isEditing ? 'Сохранить изменения' : 'Сохранить диапазон';
    dom.cancelRangeEditBtn.style.display = isEditing ? 'inline-flex' : 'none';
}

// Fetches the actual persisted subranges for a position without touching
// session/temp state (unlike load_range, which overwrites the working
// set). Used only on page load when reopening mid-edit, so the dirty
// check has a real baseline instead of assuming "unknown = dirty" and
// leaving Save/Cancel enabled even with zero actual changes.
function establishSavedBaseline(position) {
    fetch('/api/range/' + encodeURIComponent(position))
        .then(response => response.json())
        .then(data => {
            if (data.status === 'ok') {
                const subs = Object.keys(data.subranges).map(name => ({
                    name: name,
                    color: data.colors[name] || '#3498db',
                    hands: data.subranges[name]
                }));
                savedSnapshot = snapshotSubranges(subs);
                updateSaveButtonState();
            }
        })
        .catch(err => console.error('Error fetching saved baseline:', err));
}

// Discard the current working set (temp subranges + matrix selection +
// position field) and return to a blank state. Shared by both tabs, since
// leaving either one behind unsaved work means the same thing: start over.
function resetWorkingSet(onDone) {
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
            loadedRangeName = null;
            savedSnapshot = null;
            updateDeleteButtonState();
            if (onDone) onDone();
        });
}

// Confirm-if-dirty, then reset to a blank "new" state. Shared by the New
// tab and by picking the dropdown's placeholder option, since both mean
// the same thing: "I want no range loaded." onCancel runs only if the
// user backs out of a confirm that was actually shown.
function switchToNew(onCancel) {
    if (activePanel === 'new' && loadedRangeName === null && !hasUnsavedChanges()) {
        return;
    }
    if (hasUnsavedChanges() && !confirm('Начать новый диапазон? Текущие изменения будут потеряны')) {
        if (onCancel) onCancel();
        return;
    }
    resetWorkingSet(function() {
        updateRangeModeUI();
    });
}

// Delete only makes sense once an existing saved range is actually
// selected in the dropdown.
function updateDeleteButtonState() {
    dom.deleteRangeBtn.disabled = dom.loadRangeSelect.value === '';
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
                updateSaveButtonState();
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
    dom.saveSubrangeBtn.innerHTML = '<svg class="cr-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 3h10l3 3v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M7 3v5h6V3"/><path d="M6 12h8v6H6z"/></svg> Сохранить изменения';

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
            loadedRangeName = data.position;
            savedSnapshot = snapshotSubranges(data.subranges);
            updateRangeModeUI();
            updateDeleteButtonState();
            loadTempSubranges();
            cancelEditing();
        } else {
            showError(data.message);
        }
    })
    .catch(showNetworkError);
}

function updatePositionsSelect(reset = false, forceValue = null) {
    fetch('/create/get_positions')
        .then(response => response.json())
        .then(data => {
            const select = dom.loadRangeSelect;
            const currentValue = forceValue !== null ? forceValue : (reset ? '' : select.value);
            select.innerHTML = '<option value="" disabled>Выберите диапазон</option>';
            data.positions.forEach(pos => {
                const option = document.createElement('option');
                option.value = pos;
                option.textContent = pos;
                select.appendChild(option);
            });
            select.value = data.positions.includes(currentValue) ? currentValue : '';
            updateDeleteButtonState();
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
        clearSelectionBtn: document.getElementById('clear-selection-btn'),
        deleteRangeBtn: document.getElementById('delete-range-btn'),
        saveRangeBtn: document.getElementById('save-range-btn'),
        cancelRangeEditBtn: document.getElementById('cancel-range-edit-btn'),
        tabNewBtn: document.getElementById('tab-new-btn'),
        tabEditBtn: document.getElementById('tab-edit-btn'),
        tabEditName: document.getElementById('tab-edit-name'),
        editPickerGroup: document.getElementById('edit-picker-group')
    };

    loadedRangeName = window.__crInitialLoadedRange || null;
    updateRangeModeUI();
    updateDeleteButtonState();
    if (loadedRangeName !== null) {
        establishSavedBaseline(loadedRangeName);
    }

    generateHandMatrix();
    loadTempSubranges();
    updateClearSelectionVisibility();

    window.addEventListener('beforeunload', function(e) {
        if (hasUnsavedChanges()) {
            e.preventDefault();
            e.returnValue = '';
        }
    });

    dom.colorPicker.addEventListener('input', function() {
        currentColor = this.value;
        matrixCells.forEach(cell => {
            if (cell.dataset.selected === 'true') {
                setCellColor(cell, currentColor);
            }
        });
    });

    dom.positionInput.addEventListener('input', function() {
        updateSaveButtonState();
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

    dom.saveRangeBtn.addEventListener('click', function() {
        // Mirror the server's sanitization (app.py's save_range replaces
        // spaces with underscores) so the name used for the confirm text,
        // the payload, and the post-save reload all agree with what
        // actually gets persisted - otherwise a name with spaces saves
        // fine but the follow-up reload 404s under the sanitized name.
        const position = dom.positionInput.value.trim().replace(/ /g, '_');
        if (!position) {
            alert('Введите имя диапазона');
            return;
        }
        if (tempSubranges.length === 0) {
            alert('Добавьте хотя бы один поддиапазон');
            return;
        }
        if (!confirm(`Сохранить диапазон "${position}"?`)) return;

        // Capture before the request resolves: updating an existing range
        // should keep you editing it, but creating a brand-new one should
        // return you to a clean "new" state, not jump into editing what
        // you just made.
        const wasEditing = loadedRangeName !== null;

        postJson('/create/save_range', { position: position }, function(data) {
            alert(data.message);
            if (wasEditing) {
                // load_range fully overwrites the working set from what
                // was just persisted (verified server-side), so
                // re-loading here both refreshes the client and keeps
                // you in "editing this range".
                updatePositionsSelect(false, position);
                loadRange(position);
            } else {
                resetWorkingSet(function() {
                    updateRangeModeUI();
                    updatePositionsSelect(true);
                });
            }
        });
    });

    dom.cancelRangeEditBtn.addEventListener('click', function() {
        if (!confirm('Отменить изменения и вернуться к сохранённой версии диапазона?')) return;
        loadRange(loadedRangeName);
    });

    dom.loadRangeSelect.addEventListener('change', function() {
        const select = this;
        const pos = select.value;
        if (!pos) {
            // Picking the placeholder means "no range loaded" - the same
            // thing the New tab does, not a no-op that leaves the
            // dropdown showing something different from what's actually
            // still loaded.
            switchToNew(function() {
                select.value = loadedRangeName || '';
            });
            return;
        }
        if (hasUnsavedChanges() && !confirm(`Загрузить диапазон "${pos}"? Текущие изменения будут потеряны`)) {
            select.value = loadedRangeName || '';
            updateDeleteButtonState();
            return;
        }
        loadRange(pos);
    });

    dom.tabNewBtn.addEventListener('click', function() {
        switchToNew();
    });

    dom.tabEditBtn.addEventListener('click', function() {
        if (loadedRangeName !== null) {
            setActivePanel('edit');
            return;
        }
        if (!hasUnsavedChanges()) {
            setActivePanel('edit');
            return;
        }
        if (!confirm('Переключиться на редактирование? Текущие изменения будут потеряны')) return;
        resetWorkingSet(function() {
            updateRangeModeUI();
            setActivePanel('edit');
        });
    });

    dom.deleteRangeBtn.addEventListener('click', function() {
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
                // Stay on the Edit tab (picker visible, nothing loaded)
                // rather than bouncing to New - you were already in an
                // editing context and most likely want to pick a
                // different range next, not start one from scratch.
                resetWorkingSet(function() {
                    updateRangeModeUI();
                    setActivePanel('edit');
                    updatePositionsSelect(true);
                });
            } else {
                showError(data.message);
            }
        })
        .catch(showNetworkError);
    });
});
