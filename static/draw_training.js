// draw_training.js
// Draw training: the user paints the hands of every subrange of one range on
// the hand matrix, the server grades the drawing, and the result offers a
// visual comparison with the correct range. Matrix building, drag-select and
// cell colouring are shared with the range editor (hand_matrix.js).
import {
    DEFAULT_COLOR,
    buildMatrix,
    enableDragSelect,
    handsByCategory,
    resolveCellColor,
    setCellColor
} from './hand_matrix.js';
import { showToast } from './toast.js';

const drawData = JSON.parse(document.getElementById('draw-data').textContent);

const ICON_CHECK = '<svg class="cr-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10.5l4 4 8-9"/></svg>';
const ICON_CROSS = '<svg class="cr-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 5l10 10M15 5L5 15"/></svg>';
const LABEL_SHOW_CORRECT = 'Показать правильный диапазон';
const LABEL_SHOW_MINE = 'Показать мой диапазон';

// Subranges being drawn: [{id, name, color, hands}]. Names and colors come
// from the server; the user only decides which hands belong to which.
let tempSubranges = [];

// The subrange currently being painted. currentHands is the working
// selection on the matrix; editingHands mirrors it for the edited subrange.
let editingId = null;
let editingHands = [];
let currentHands = [];
let currentColor = DEFAULT_COLOR;

let matrixCells = [];
let locked = false;     // the result is on screen, drawing is frozen
let canCompare = false; // the result was wrong, so the correct range can be shown
let checking = false;   // a check request is in flight

// "Show correct range" toggle: the user's drawing and the expected one
let userSubranges = null;
let correctSubranges = null;
let showingCorrect = false;

const dom = {
    matrix: document.getElementById('hand-matrix'),
    clearBtn: document.getElementById('clear-selection-btn'),
    subrangeList: document.getElementById('subrange-list-ul'),
    editTools: document.getElementById('edit-tools'),
    cancelEditBtn: document.getElementById('cancel-edit-btn'),
    quickBtns: document.querySelectorAll('.dt-quick-btn'),
    checkBtn: document.getElementById('check-btn'),
    resultBlock: document.getElementById('result-block'),
    verdictIcon: document.getElementById('verdict-icon'),
    verdictTitle: document.getElementById('verdict-title'),
    verdictText: document.getElementById('verdict-text'),
    toggleCorrectBtn: document.getElementById('toggle-correct-btn'),
    retryBtn: document.getElementById('retry-btn'),
    newBtn: document.getElementById('new-after-check-btn'),
    matrixCol: document.getElementById('matrix-col'),
    subrangesCol: document.getElementById('subranges-col'),
    matrixCard: document.getElementById('matrix-card'),
    subrangesCard: document.getElementById('subranges-card'),
    statsCard: document.getElementById('stats-card'),
    toastContainer: document.getElementById('flash-toast-container')
};

function notify(message, type) {
    showToast(dom.toastContainer, message, type);
}

function copySubranges(subranges) {
    return subranges.map(sub => ({ ...sub, hands: sub.hands.slice() }));
}

// -------------------------------------------------------------------
// Matrix
// -------------------------------------------------------------------
function renderCell(cell) {
    setCellColor(cell, resolveCellColor(cell.dataset.hand, {
        subranges: tempSubranges,
        editingId,
        editingHands,
        selected: cell.dataset.selected === 'true',
        currentColor
    }));
}

function renderAllCells() {
    matrixCells.forEach(renderCell);
}

// Select or deselect one cell, keeping currentHands / editingHands in step.
// Idempotent: a cell that already has the requested state is left alone.
function setHandSelected(cell, selected) {
    if (editingId === null || (cell.dataset.selected === 'true') === selected) return;
    const hand = cell.dataset.hand;
    cell.dataset.selected = String(selected);
    if (selected) {
        if (!currentHands.includes(hand)) currentHands.push(hand);
        if (editingId && !editingHands.includes(hand)) editingHands.push(hand);
        setCellColor(cell, currentColor);
    } else {
        currentHands = currentHands.filter(h => h !== hand);
        editingHands = editingHands.filter(h => h !== hand);
        renderCell(cell);
    }
    updateControls();
}

function sameHands(a, b) {
    return a.length === b.length && a.every(hand => b.includes(hand));
}

// Show only the controls that make sense right now:
//  - the matrix accepts input only while a subrange is being edited (it is
//    dimmed when none is picked, frozen without dimming once the result shows)
//  - "clear selection" needs a picked subrange with hands selected
//  - "cancel changes" needs the selection to differ from the saved subrange
//  - "show correct range" belongs to a wrong result
function updateControls() {
    const sub = tempSubranges.find(s => s.id === editingId);
    const editing = !locked && sub !== undefined;
    dom.matrix.classList.toggle('cr-matrix--locked', !locked && !editing);
    dom.matrix.classList.toggle('dt-matrix--locked', locked);
    dom.editTools.hidden = !editing;
    dom.clearBtn.style.display = editing && currentHands.length > 0 ? '' : 'none';
    dom.cancelEditBtn.style.display = editing && !sameHands(currentHands, sub.hands) ? '' : 'none';
    dom.toggleCorrectBtn.style.display = locked && canCompare ? '' : 'none';
    // the result panel takes the check button's place
    dom.checkBtn.style.display = locked ? 'none' : '';
}

function clearSelection() {
    matrixCells.forEach(cell => { cell.dataset.selected = 'false'; });
    currentHands = [];
    editingHands = [];
    resetQuickSelect();
    renderAllCells();
    updateControls();
}

// -------------------------------------------------------------------
// Subrange list and editing
// -------------------------------------------------------------------
function renderSubrangeList() {
    dom.subrangeList.innerHTML = '';
    tempSubranges.forEach(sub => {
        const li = document.createElement('li');
        if (sub.id === editingId) li.classList.add('editing-subrange');

        const dot = document.createElement('span');
        dot.className = 'color-dot';
        dot.style.backgroundColor = sub.color;
        li.appendChild(dot);

        const name = document.createElement('span');
        name.className = 'sub-name';
        name.textContent = sub.name;
        li.appendChild(name);

        if (!locked) {
            li.classList.add('dt-clickable');
            li.title = 'Редактировать (добавить руки)';
            li.addEventListener('click', () => {
                if (editingId !== null) saveEdit();
                startEditing(sub.id);
            });
        }
        dom.subrangeList.appendChild(li);
    });
}

function resetQuickSelect() {
    dom.quickBtns.forEach(btn => btn.classList.remove('active'));
}

function startEditing(id) {
    const sub = tempSubranges.find(s => s.id === id);
    if (!sub) return;
    editingId = id;
    editingHands = sub.hands.slice();
    currentHands = sub.hands.slice();
    currentColor = sub.color;

    matrixCells.forEach(cell => {
        cell.dataset.selected = String(editingHands.includes(cell.dataset.hand));
    });
    renderAllCells();
    renderSubrangeList();
    resetQuickSelect();
    updateControls();
}

function cancelEditing() {
    editingId = null;
    editingHands = [];
    currentHands = [];
    currentColor = DEFAULT_COLOR;

    matrixCells.forEach(cell => { cell.dataset.selected = 'false'; });
    renderAllCells();
    renderSubrangeList();
    resetQuickSelect();
    updateControls();
}

// Commit the working selection to the edited subrange. A hand lives in one
// subrange only, so it is taken away from every other subrange.
function saveEdit() {
    const sub = tempSubranges.find(s => s.id === editingId);
    if (!sub) return;
    const taken = new Set(currentHands);
    tempSubranges.forEach(other => {
        if (other !== sub) other.hands = other.hands.filter(h => !taken.has(h));
    });
    sub.hands = currentHands.slice();
    cancelEditing();
}

function toggleQuickSelect(btn) {
    if (editingId === null) return;
    const group = new Set(handsByCategory(btn.dataset.type));
    const turnOn = !btn.classList.contains('active');
    matrixCells.forEach(cell => {
        if (group.has(cell.dataset.hand)) setHandSelected(cell, turnOn);
    });
    btn.classList.toggle('active', turnOn);
}

// -------------------------------------------------------------------
// Checking and result
// -------------------------------------------------------------------
async function checkAnswer() {
    if (checking || locked) return;
    const editedId = editingId;
    if (editingId !== null) saveEdit();
    if (tempSubranges.length === 0) {
        notify('Нет поддиапазонов для проверки', 'error');
        return;
    }

    checking = true;
    dom.checkBtn.disabled = true;
    try {
        const response = await fetch(window.location.pathname, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                question_id: drawData.questionId,
                subranges: tempSubranges.map(sub => ({ name: sub.name, hands: sub.hands }))
            })
        });
        const result = await response.json();
        if (result.status === 'ok') {
            renderStats(result.stats);
            showResult(result);
        } else {
            notify('Ошибка: ' + result.message, 'error');
            resumeAfterFailedCheck(editedId);
        }
    } catch (err) {
        notify('Ошибка сети: ' + err, 'error');
        resumeAfterFailedCheck(editedId);
    } finally {
        checking = false;
    }
}

// The check didn't go through: let the user keep drawing where they were
function resumeAfterFailedCheck(editedId) {
    dom.checkBtn.disabled = false;
    if (editedId !== null) startEditing(editedId);
}

// The expected range in the order and colors of the user's subranges. A
// subrange the drawing doesn't have (the range changed in another tab since
// the page was opened) is appended so the comparison still shows it.
function buildCorrectSubranges(expectedHands) {
    const expected = new Map(expectedHands.map(item => [item.name, item.hands]));
    const correct = tempSubranges.map(sub => ({
        ...sub,
        hands: (expected.get(sub.name) || []).slice()
    }));
    const known = new Set(tempSubranges.map(sub => sub.name));
    expectedHands.forEach(item => {
        if (!known.has(item.name)) {
            correct.push({ id: 'extra-' + item.name, name: item.name, color: DEFAULT_COLOR, hands: item.hands.slice() });
        }
    });
    return correct;
}

function showResult(result) {
    const wrong = result.missing.length > 0 || result.extra_hands.length > 0 || result.wrong_names.length > 0;

    locked = true;
    canCompare = wrong;
    renderSubrangeList();

    userSubranges = copySubranges(tempSubranges);
    correctSubranges = buildCorrectSubranges(result.expected_hands);
    showingCorrect = false;

    dom.resultBlock.classList.toggle('dt-result--wrong', wrong);
    dom.verdictIcon.innerHTML = wrong ? ICON_CROSS : ICON_CHECK;
    dom.verdictTitle.textContent = wrong ? 'Неверно' : 'Верно';
    dom.verdictText.textContent = wrong
        ? 'Нажмите «' + LABEL_SHOW_CORRECT + '», чтобы увидеть ошибки'
        : 'Отлично! Все поддиапазоны нарисованы верно';
    dom.toggleCorrectBtn.textContent = LABEL_SHOW_CORRECT;
    dom.resultBlock.hidden = false;
    updateControls();
}

function toggleCorrectView() {
    if (!correctSubranges || !userSubranges) return;
    showingCorrect = !showingCorrect;
    tempSubranges = copySubranges(showingCorrect ? correctSubranges : userSubranges);
    dom.toggleCorrectBtn.textContent = showingCorrect ? LABEL_SHOW_MINE : LABEL_SHOW_CORRECT;
    renderSubrangeList();
    clearSelection();
}

// Start the same question over with an empty drawing
function retry() {
    tempSubranges = copySubranges(userSubranges || tempSubranges);
    tempSubranges.forEach(sub => { sub.hands = []; });
    userSubranges = null;
    correctSubranges = null;
    showingCorrect = false;
    locked = false;
    canCompare = false;

    dom.resultBlock.hidden = true;
    dom.checkBtn.disabled = false;

    cancelEditing();
    if (tempSubranges.length > 0) startEditing(tempSubranges[0].id);
}

// -------------------------------------------------------------------
// Stats
// -------------------------------------------------------------------

// The stats card normally sits under the subrange card. When that would make
// the right column taller than the left one (a long subrange list, or the
// result panel), it goes under the matrix instead. The decision uses the two
// cards' own heights, which don't depend on where the stats card is, so
// moving it can't flip the decision back. Stacked columns (narrow screens)
// keep it in the right column, which is then simply the end of the page.
function placeStats() {
    const stacked = dom.subrangesCol.getBoundingClientRect().top > dom.matrixCol.getBoundingClientRect().top + 1;
    const gap = parseFloat(getComputedStyle(dom.statsCard).marginTop) || 0;
    const rightHeight = dom.subrangesCard.offsetHeight + gap + dom.statsCard.offsetHeight;
    const underMatrix = !stacked && rightHeight > dom.matrixCard.offsetHeight;
    const target = underMatrix ? dom.matrixCol : dom.subrangesCol;
    if (dom.statsCard.parentElement !== target) target.appendChild(dom.statsCard);
}

function renderStats(stats) {
    const percent = count => (stats.total > 0 ? (count / stats.total * 100).toFixed(1) : '0.0');
    document.getElementById('stats-total').textContent = stats.total;
    document.getElementById('stats-correct').textContent = stats.correct;
    document.getElementById('stats-wrong').textContent = stats.wrong;
    document.getElementById('stats-correct-pct').textContent = percent(stats.correct);
    document.getElementById('stats-wrong-pct').textContent = percent(stats.wrong);
}

// -------------------------------------------------------------------
// Init
// -------------------------------------------------------------------
function init() {
    matrixCells = buildMatrix(dom.matrix);
    enableDragSelect(dom.matrix, matrixCells, {
        onTap: cell => setHandSelected(cell, cell.dataset.selected !== 'true'),
        onDrag: (cell, mode) => setHandSelected(cell, mode === 'select')
    });

    tempSubranges = drawData.subranges.map((sub, index) => ({
        id: 'sub-' + index,
        name: sub.name,
        color: sub.color || DEFAULT_COLOR,
        hands: []
    }));
    renderStats(drawData.stats);
    renderAllCells();
    renderSubrangeList();
    if (tempSubranges.length > 0) startEditing(tempSubranges[0].id);
    updateControls();

    placeStats();
    const sizeWatcher = new ResizeObserver(placeStats);
    sizeWatcher.observe(dom.matrixCard);
    sizeWatcher.observe(dom.subrangesCard);

    dom.clearBtn.addEventListener('click', clearSelection);
    dom.cancelEditBtn.addEventListener('click', cancelEditing);
    dom.quickBtns.forEach(btn => btn.addEventListener('click', () => toggleQuickSelect(btn)));
    dom.checkBtn.addEventListener('click', checkAnswer);
    dom.toggleCorrectBtn.addEventListener('click', toggleCorrectView);
    dom.retryBtn.addEventListener('click', retry);
    dom.newBtn.addEventListener('click', () => window.location.assign(window.location.pathname));
}

init();
