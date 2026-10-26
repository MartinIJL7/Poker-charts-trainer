// Heatmap page logic, shared by /heatmap/<mode> and /all_stats.
// The API URL comes from data-api-url on .hmap-shell (with a __POSITION__ placeholder).
// The delete-statistics buttons exist only on the all-ranges page.
import { RANKS, setCellColor } from './hand_matrix.js';
import { showToast } from './toast.js';

const isTouchDevice = window.matchMedia('(pointer: coarse)').matches;
const apiUrl = document.querySelector('.hmap-shell').dataset.apiUrl;
const toastContainer = document.getElementById('flash-toast-container');
const positionSelect = document.getElementById('position-select');
let useSubrangeColors = false;
let currentWeights = null;

// Track currently highlighted category (null = none)
let currentHighlightedCategory = null;

function toast(message, type) {
    showToast(toastContainer, message, type);
}

function updateGrayHint() {
    const grayHint = document.getElementById('gray-hint');
    if (!grayHint) return;
    if (useSubrangeColors) {
        grayHint.classList.add('subrange-hidden');
    } else {
        const hasNoData = document.querySelector('#hand-matrix .no-data');
        if (hasNoData) {
            grayHint.classList.remove('subrange-hidden');
        } else {
            grayHint.classList.add('subrange-hidden');
        }
    }
}

function updateLegend(useSubrange, weights) {
    const mainLegend = document.getElementById('main-legend');
    const colorHint = document.getElementById('color-hint');
    const subrangeLegend = document.getElementById('subrange-legend');

    if (useSubrange) {
        if (mainLegend) mainLegend.classList.add('subrange-hidden');
        if (colorHint) colorHint.classList.add('subrange-hidden');
        subrangeLegend.classList.add('visible');

        const subrangeMap = {};
        for (const hand in weights) {
            const data = weights[hand];
            if (data.subrange && data.subrange !== 'not in a range') {
                subrangeMap[data.subrange] = data.subrange_color;
            }
        }
        subrangeLegend.innerHTML = '';
        for (const [name, color] of Object.entries(subrangeMap)) {
            const chip = document.createElement('span');
            chip.className = 'hmap-chip';
            const dot = document.createElement('span');
            dot.className = 'hmap-chip-dot';
            dot.style.background = color;
            chip.append(dot, name);
            subrangeLegend.appendChild(chip);
        }
        if (!subrangeLegend.firstChild) subrangeLegend.textContent = 'Нет поддиапазонов для отображения';
    } else {
        if (mainLegend) mainLegend.classList.remove('subrange-hidden');
        if (colorHint) colorHint.classList.remove('subrange-hidden');
        subrangeLegend.classList.remove('visible');
        subrangeLegend.innerHTML = '';
    }
}

function highlightCategory(category) {
    const cells = document.querySelectorAll('#hand-matrix .matrix-cell');
    // If clicking the same category, toggle off
    if (currentHighlightedCategory === category) {
        cells.forEach(cell => cell.classList.remove('highlighted-category'));
        currentHighlightedCategory = null;
        return;
    }
    // Otherwise clear previous highlight and highlight new category
    cells.forEach(cell => {
        cell.classList.remove('highlighted-category');
        if (cell.dataset.category === category) {
            cell.classList.add('highlighted-category');
        }
    });
    currentHighlightedCategory = category;
}

function categoryClickHandler(e) {
    const item = e.target.closest('.hmap-category');
    if (!item) return;
    highlightCategory(item.dataset.category);
}

// Checklist of the two ways a hand becomes learned (strict condition OR weight)
function learnedChecklistHTML(data, attempts, errorsLast3, avgTime) {
    const mark = ok => ok ? '✅' : '❌';
    let html = `<div class="hmap-checklist">`;
    html += `${mark(attempts >= 3)} Попыток >= 3<br>`;
    html += `${mark(errorsLast3 === 0)} Ноль ошибок за последние 3 попытки &nbsp; (${data.last_results_display})<br>`;
    html += `${mark(avgTime <= 3)} Среднее время руки за последние 3 попытки <= 3 с`;
    html += `<hr>`;
    html += `<div class="hmap-or">ИЛИ</div>`;
    html += `${mark(data.weight <= 0.25)} вес индивидуальной сложности ≤ 0.25<br>`;
    html += `</div>`;
    return html;
}

// Learning status of a hand: forgotten, due (review), learned or not-learned
function handCategory(data) {
    if (data.penalty_active) return 'forgotten';
    if (data.review_interval_days > 0) return data.is_due_for_review ? 'due' : 'learned';
    return 'not-learned';
}

function buildStatusHTML(data) {
    const attempts = data.attempts || 0;
    const avgTime = data.avg_time_sec !== null && data.avg_time_sec !== undefined ? data.avg_time_sec : 0;
    const errorsLast3 = data.errors_last_3 !== undefined ? data.errors_last_3 : 0;
    const reviewInterval = data.review_interval_days || 0;
    const daysSince = data.days_since_last_shown || 0;
    const category = handCategory(data);

    let html = '';

    if (category === 'forgotten') {
        html += `<div class="hmap-status hmap-status--forgotten">🔴 Забыта</div>`;
        html += `<div class="hmap-note">Рука была выучена, но затем была допущена ошибка, или среднее время руки за последние 3 попытки превысило 3 секунды, или вес стал более 0.25</div>`;
        html += `<div class="hmap-note">Поэтому к весу добавлен бонус 1.2</div>`;
        html += learnedChecklistHTML(data, attempts, errorsLast3, avgTime);
    } else if (category === 'due') {
        html += `<div class="hmap-status hmap-status--due">🟠 Выучена, пора повторять!</div>`;
        html += `<div class="hmap-note">Вес повышен до максимума для планового повторения</div>`;
        html += `<div class="hmap-meta">Интервал повторения: ${reviewInterval} дн. &nbsp;|&nbsp; Прошло с последней попытки: ${daysSince} дн.</div>`;
    } else if (category === 'learned') {
        html += `<div class="hmap-status hmap-status--learned">🟢 Выучена</div>`;
        html += `<div class="hmap-meta">Интервал повторения: ${reviewInterval} дн. &nbsp;|&nbsp; Прошло с последней попытки: ${daysSince} дн.</div>`;
    } else {
        html += `<div class="hmap-status hmap-status--unlearned">⚪ Не выучена</div>`;
        html += learnedChecklistHTML(data, attempts, errorsLast3, avgTime);
    }

    return html;
}

// Color of a played hand on the green -> yellow -> red weight scale
function weightColor(weight) {
    const clamped = Math.min(2.0, Math.max(0.1, weight));
    const t = (clamped - 0.1) / 1.9;
    let r, g, b;
    if (t < 0.5) {
        const p = t / 0.5;
        r = Math.round(0 + p * 255);
        g = 200;
        b = 0;
    } else {
        const p = (t - 0.5) / 0.5;
        r = 255;
        g = Math.round(200 - p * 200);
        b = 0;
    }
    return { color: `rgb(${r}, ${g}, ${b})`, textColor: (t > 0.6) ? 'white' : 'black' };
}

// Hand stats + learning status for a cell; used by the hover tooltip and the click panel
function cellDetailsHTML(cell) {
    const d = cell.dataset;
    const attempts = parseInt(d.attempts) || 0;
    const correct = parseInt(d.correct) || 0;
    const pct = attempts > 0 ? (correct / attempts * 100).toFixed(1) : 0;
    const subrangeText = d.subrange === 'not in a range' ? 'fold' : d.subrange;

    const stats = `
        <strong>${d.hand} : ${subrangeText}</strong><br>
        Попыток: ${d.attempts}<br>
        Правильно: ${correct} (${pct}%)<br>
        Ошибок: ${d.errors}<br>
        Среднее время ответа за последние 3 попытки: ${d.avgTime} с
        ${d.lastTimesDisplay ? ' (' + d.lastTimesDisplay + ' с)' : ''}<br>
        Вес индивидуальной сложности: ${d.weight}
    `;
    const status = buildStatusHTML({
        weight: parseFloat(d.weight) || 0,
        attempts: attempts,
        avg_time_sec: parseFloat(d.avgTime) || 0,
        errors_last_3: parseInt(d.errorsLast3) || 0,
        review_interval_days: parseInt(d.reviewInterval) || 0,
        penalty_active: d.penaltyActive === 'true',
        days_since_last_shown: parseInt(d.daysSince) || 0,
        is_due_for_review: d.isDue === 'true',
        last_results_display: d.lastResultsDisplay || '',
    });
    return stats + '<hr>' + status;
}

function buildMatrix(weights) {
    const container = document.getElementById('hand-matrix');
    container.innerHTML = '';

    const tooltip = document.getElementById('tooltip');
    const tooltipContent = document.getElementById('tooltip-content');

    RANKS.forEach(rowRank => {
        RANKS.forEach(colRank => {
            const cell = document.createElement('div');
            cell.className = 'matrix-cell';
            const i = RANKS.indexOf(rowRank);
            const j = RANKS.indexOf(colRank);
            let hand = '';
            if (i === j) hand = rowRank + colRank;
            else if (i < j) hand = rowRank + colRank + 's';
            else hand = colRank + rowRank + 'o';
            cell.textContent = hand;

            const data = weights[hand];

            // ----- Determine color -----
            if (useSubrangeColors) {
                // Mode: color by subrange, same as the range editor; folded hands keep the default cell look
                if (data.subrange && data.subrange !== 'not in a range') setCellColor(cell, data.subrange_color);
            } else if (data.attempts === 0) {
                // Mode: color by weight (only played hands); unplayed hands keep the default cell look
                cell.classList.add('no-data');
            } else {
                const { color, textColor } = weightColor(data.weight);
                cell.style.backgroundColor = color;
                cell.style.color = textColor;
            }

            // ----- Set dataset for all cells (for tooltips and click events) -----
            cell.dataset.attempts = data.attempts || 0;
            cell.dataset.errors = data.errors || 0;
            cell.dataset.correct = data.correct || 0;
            cell.dataset.avgTime = data.avg_time_sec !== null ? data.avg_time_sec.toFixed(2) : '—';
            cell.dataset.weight = data.weight ? data.weight.toFixed(3) : '—';
            cell.dataset.hand = hand;
            cell.dataset.reviewInterval = data.review_interval_days || 0;
            cell.dataset.penaltyActive = data.penalty_active ? 'true' : 'false';
            cell.dataset.daysSince = data.days_since_last_shown || 0;
            cell.dataset.isDue = data.is_due_for_review ? 'true' : 'false';
            cell.dataset.errorsLast3 = data.errors_last_3 !== undefined ? data.errors_last_3 : 0;
            cell.dataset.lastResultsDisplay = data.last_results_display || '';
            cell.dataset.lastTimesDisplay = data.last_times_display || '';
            cell.dataset.subrange = data.subrange || '';
            cell.dataset.category = handCategory(data);

            // ----- Tooltip events (for all cells) -----
            if (!isTouchDevice) {
                cell.addEventListener('mouseenter', function(e) {
                    tooltipContent.innerHTML = cellDetailsHTML(this);
                    tooltip.style.display = 'block';
                    const x = e.clientX + 15;
                    const y = e.clientY - 10;
                    const tw = tooltip.offsetWidth || 200;
                    const th = tooltip.offsetHeight || 120;
                    const left = Math.min(x, window.innerWidth - tw - 10);
                    const top = Math.min(y, window.innerHeight - th - 10);
                    tooltip.style.left = left + 'px';
                    tooltip.style.top = top + 'px';
                });
                cell.addEventListener('mouseleave', function() {
                    tooltip.style.display = 'none';
                });
            }

            // ----- Click event (for all cells) -----
            cell.addEventListener('click', function(e) {
                e.stopPropagation();
                document.getElementById('panel-content').innerHTML = cellDetailsHTML(this);
                document.getElementById('info-panel').style.display = 'block';
            });

            container.appendChild(cell);
        });
    });
}

function updateCategoryStats(weights) {
    const counts = { 'learned': 0, 'due': 0, 'forgotten': 0, 'not-learned': 0 };
    for (const hand in weights) {
        counts[handCategory(weights[hand])]++;
    }
    for (const category in counts) {
        document.getElementById('stat-' + category).textContent = counts[category];
    }

    // Attach click handler (remove old to avoid duplicates)
    const container = document.getElementById('category-stats');
    container.removeEventListener('click', categoryClickHandler);
    container.addEventListener('click', categoryClickHandler);
}

// Empty panels shown when there is nothing to display (no ranges or a failed request)
function clearStatsPanels() {
    document.getElementById('avg-position-time').textContent = '—';
    document.getElementById('total-position-time').textContent = '—';
    const learnedSpan = document.getElementById('learned-status');
    learnedSpan.className = 'hmap-learned';
    learnedSpan.textContent = 'Нет данных';
    document.getElementById('stat-learned').textContent = '0';
    document.getElementById('stat-due').textContent = '0';
    document.getElementById('stat-forgotten').textContent = '0';
    document.getElementById('stat-not-learned').textContent = '0';
}

// Inline error in place of the matrix
function showMatrixError(message) {
    const container = document.getElementById('hand-matrix');
    const p = document.createElement('p');
    p.className = 'hmap-error';
    p.textContent = '❌ ' + message;
    container.replaceChildren(p);
}

function loadPosition(position) {

    if (!position) {
        toast('Нет доступных диапазонов для отображения статистики', 'error');
        document.getElementById('hand-matrix').innerHTML = '';
        clearStatsPanels();
        return;
    }

    fetch(apiUrl.replace('__POSITION__', encodeURIComponent(position)))
        .then(response => {
            if (!response.ok) throw new Error('Failed to load');
            return response.json();
        })
        .then(data => {
            if (data.error) {
                showMatrixError(data.error);
                return;
            }
            currentWeights = data.weights;
            buildMatrix(currentWeights);
            updateCategoryStats(currentWeights);
            updateLegend(useSubrangeColors, currentWeights);

            updateGrayHint();

            const avgSpan = document.getElementById('avg-position-time');
            if (data.avg_time !== null && data.avg_time !== undefined) {
                avgSpan.textContent = (data.avg_time / 1000).toFixed(2);
            } else {
                avgSpan.textContent = '—';
            }

            const totalSpan = document.getElementById('total-position-time');
            if (data.total_time_sec !== undefined && data.total_time_sec !== null) {
                const totalSec = data.total_time_sec;
                const hours = Math.floor(totalSec / 3600);
                const minutes = Math.floor((totalSec % 3600) / 60);
                const seconds = Math.floor(totalSec % 60);
                let display = '';
                if (hours > 0) display += `${hours} ч `;
                if (minutes > 0) display += `${minutes} мин `;
                display += `${seconds} с`;
                totalSpan.textContent = display;
            } else {
                totalSpan.textContent = '—';
            }

            const learnedSpan = document.getElementById('learned-status');
            if (data.learned) {
                learnedSpan.className = 'hmap-learned hmap-learned--yes';
                learnedSpan.textContent = '✅ Диапазон выучен!';
            } else {
                learnedSpan.className = 'hmap-learned hmap-learned--no';
                learnedSpan.textContent = '🔄 Диапазон ещё не выучен';
            }

        })
        .catch(() => {
            showMatrixError('Ошибка загрузки статистики');
            clearStatsPanels();
        });
}

document.getElementById('toggle-subrange-colors').addEventListener('change', function() {
    useSubrangeColors = this.checked;
    if (currentWeights) {
        buildMatrix(currentWeights);
        updateLegend(useSubrangeColors, currentWeights);
        updateGrayHint();
    }
});

// Delete statistics (all-ranges page only)
const deletePositionBtn = document.getElementById('delete-position-btn');
const deleteAllBtn = document.getElementById('delete-all-btn');

if (deletePositionBtn) {
    // Delete statistics for current position
    deletePositionBtn.addEventListener('click', function() {
        const pos = positionSelect.value;
        if (!pos) return toast('Нет выбранного диапазона', 'error');
        if (!confirm(`Удалить всю статистику по диапазону "${pos}"? Это действие необратимо`)) return;
        fetch(`/api/delete_position_stats/${encodeURIComponent(pos)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'ok') {
                toast(data.message, 'success');
                // Reload current position data
                loadPosition(pos);
            } else {
                toast('Ошибка: ' + data.message, 'error');
            }
        })
        .catch(err => toast('Ошибка сети: ' + err, 'error'));
    });
}

if (deleteAllBtn) {
    // Delete all statistics for user
    deleteAllBtn.addEventListener('click', function() {
        if (!confirm('Удалить ВСЮ вашу статистику по всем диапазонам? Это действие необратимо!')) return;
        fetch('/api/delete_all_stats', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'ok') {
                toast(data.message, 'success');
                // Back to the first range with fresh data (a page reload would drop the toast)
                positionSelect.selectedIndex = 0;
                document.getElementById('info-panel').style.display = 'none';
                currentHighlightedCategory = null;
                loadPosition(positionSelect.value);
            } else {
                toast('Ошибка: ' + data.message, 'error');
            }
        })
        .catch(err => toast('Ошибка сети: ' + err, 'error'));
    });
}

positionSelect.addEventListener('change', function() {
    loadPosition(this.value);
});

document.getElementById('close-panel').addEventListener('click', function(e) {
    e.stopPropagation();
    document.getElementById('info-panel').style.display = 'none';
});

document.addEventListener('click', function(e) {
    const panel = document.getElementById('info-panel');
    if (panel.style.display === 'block') {
        const target = e.target;
        if (!target.closest('.matrix-cell') && !target.closest('#info-panel')) {
            panel.style.display = 'none';
        }
    }
});

// initial load
loadPosition(positionSelect.value);
