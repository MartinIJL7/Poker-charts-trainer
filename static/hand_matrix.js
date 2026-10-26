// hand_matrix.js
// Shared helpers for the 13x13 hand matrix used by the range editor
// (create_range.js) and the draw training page (draw_training.js); the heatmap
// page (heatmap.js) only reuses RANKS. Only the
// DOM building, pointer handling and colour logic live here; each page keeps
// its own selection state and decides what a selected cell means.

export const RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];
export const DEFAULT_COLOR = '#3498db';

// Pointer distance (px) before a press on a cell turns into a drag-select
const DRAG_THRESHOLD = 10;

// Pick black or white text so hand labels stay readable against any
// user-chosen subrange color, from pale pastels to dark saturated hues.
export function getContrastingTextColor(hexColor) {
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
export function setCellColor(cell, color) {
    cell.style.backgroundColor = color;
    cell.style.color = color ? getContrastingTextColor(color) : '';
}

// Fill the container with the 169 hand cells (pairs on the diagonal, suited
// above it, offsuit below it) and return them in row-major order.
export function buildMatrix(container) {
    container.innerHTML = '';
    const cells = [];
    RANKS.forEach((rowRank, i) => {
        RANKS.forEach((colRank, j) => {
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
            cells.push(cell);
        });
    });
    return cells;
}

// Click-to-toggle plus press-and-drag selection over the matrix cells.
//   onTap(cell)               - a press that never became a drag
//   onDrag(cell, mode)        - every cell touched by a drag; mode is 'select'
//                               or 'deselect', decided by whether the cell the
//                               drag started on was selected. The handler is
//                               called for cells that already have that state
//                               too, so it must be idempotent.
export function enableDragSelect(container, cells, { onTap, onDrag }) {
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
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (!dragData.started && distance > DRAG_THRESHOLD) {
            dragData.started = true;
            dragData.dragMode = dragData.initialSelected ? 'deselect' : 'select';
            container.classList.add('cr-matrix--dragging');
            onDrag(cell, dragData.dragMode);
        }

        if (dragData.started) {
            const target = getCellAtPoint(e.clientX, e.clientY);
            if (target && target !== cell) {
                onDrag(target, dragData.dragMode);
            }
        }
        e.preventDefault();
    }

    function handlePointerUp(e) {
        if (!dragData) return;
        const cell = dragData.cell;
        if (!dragData.started) {
            onTap(cell);
        }
        container.classList.remove('cr-matrix--dragging');
        cell.releasePointerCapture(e.pointerId);
        document.removeEventListener('pointermove', handlePointerMove);
        document.removeEventListener('pointerup', handlePointerUp);
        dragData = null;
        e.preventDefault();
    }

    cells.forEach(cell => {
        cell.addEventListener('pointerdown', handlePointerDown);
    });
}

// Hands of a quick-select group: 'pairs', 'suited-broadway' or 'offsuit-broadway'.
export function handsByCategory(type) {
    if (type === 'pairs') {
        return RANKS.map(rank => rank + rank);
    }
    if (type === 'suited-broadway' || type === 'offsuit-broadway') {
        const broadway = RANKS.slice(0, 5);
        const suffix = type === 'suited-broadway' ? 's' : 'o';
        const hands = [];
        for (let i = 0; i < broadway.length; i++) {
            for (let j = i + 1; j < broadway.length; j++) {
                hands.push(broadway[i] + broadway[j] + suffix);
            }
        }
        return hands;
    }
    return [];
}

// Color a hand cell should show, or '' for none. While a subrange is being
// edited its in-progress hands win; otherwise the first subrange (other than
// the edited one) that contains the hand decides.
//   state: { subranges, editingId, editingHands, selected, currentColor }
export function resolveCellColor(hand, state) {
    const { subranges, editingId, editingHands, selected, currentColor } = state;
    if (editingId) {
        if (selected && editingHands.includes(hand)) return currentColor;
        const other = subranges.find(s => s.id !== editingId && s.hands.includes(hand));
        return other ? other.color : '';
    }
    const sub = subranges.find(s => s.hands.includes(hand));
    return sub ? sub.color : '';
}
