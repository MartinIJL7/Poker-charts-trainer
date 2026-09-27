// training.js
// Drives the question and result screens of /training/<mode>, off a single
// window.__trainingData blob the server renders inline. Start screen needs
// no script beyond what base.html already loads.
import { renderSituationTable } from './situation_table.js';
import { handToCards } from './cards.js';
import { showToast } from './toast.js';

const data = window.__trainingData || {};
const toastContainer = document.getElementById('toast-container');

function now() {
    return (window.performance && performance.now) ? performance.now() : Date.now();
}

function renderTable(situation, heroCards) {
    const svg = document.getElementById('tr-table-svg');
    if (svg) renderSituationTable(svg, situation, { heroCards: heroCards || null });
}

// Timer toggle persists across visits (localStorage), same key the old
// inline script used, so an existing preference carries over untouched.
function setupTimerToggle(onChange) {
    const toggle = document.getElementById('timer-toggle');
    if (!toggle) return;
    let show = true;
    try {
        const stored = localStorage.getItem('showTimer');
        if (stored !== null) show = stored === 'true';
    } catch (e) { /* private mode / storage blocked - keep the default */ }
    toggle.checked = show;
    onChange(show);
    toggle.addEventListener('change', function() {
        const value = this.checked;
        try { localStorage.setItem('showTimer', String(value)); } catch (e) { /* ignore */ }
        onChange(value);
    });
}

// -------------------------------------------------------------------
// Question screen
// -------------------------------------------------------------------
function initQuestionScreen() {
    const heroCards = handToCards(data.hand);
    renderTable(data.situation, heroCards);

    // Suits are only decided here on the client - carry them through the
    // POST as hidden fields so the result screen can show the exact same
    // cards without the server needing to know anything about dealing.
    const fieldIds = [
        ['hero-card-0-rank', 'hero-card-0-suit'],
        ['hero-card-1-rank', 'hero-card-1-suit'],
    ];
    heroCards.forEach(function(card, i) {
        const rankInput = document.getElementById(fieldIds[i][0]);
        const suitInput = document.getElementById(fieldIds[i][1]);
        if (rankInput) rankInput.value = card.rank;
        if (suitInput) suitInput.value = card.suit;
    });

    const form = document.getElementById('answer-form');
    const timerFill = document.getElementById('tr-timer-fill');
    const timerValue = document.getElementById('tr-timer-value');
    const timerWrap = document.querySelector('.tr-timer-bar-wrap');
    const TIMER_BAR_MAX_MS = 15000;

    let answerSubmitted = false;
    const startTime = now();
    let timerInterval = null;

    function updateTimer() {
        const elapsed = now() - startTime;
        if (timerFill) {
            const pct = Math.min(100, (elapsed / TIMER_BAR_MAX_MS) * 100);
            timerFill.style.width = pct + '%';
            timerFill.classList.toggle('tr-timer-fill--green', elapsed < 3000);
            timerFill.classList.toggle('tr-timer-fill--yellow', elapsed >= 3000 && elapsed < 10000);
            timerFill.classList.toggle('tr-timer-fill--red', elapsed >= 10000);
        }
        if (timerValue) {
            timerValue.textContent = (elapsed / 1000).toFixed(1);
        }
    }

    function startTimerDisplay() {
        if (timerInterval) return;
        updateTimer();
        timerInterval = setInterval(updateTimer, 50);
    }

    function stopTimerDisplay() {
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
    }

    // Hiding the bar only stops the display; response time is still
    // measured from startTime regardless of the toggle.
    setupTimerToggle(function(show) {
        if (timerWrap) timerWrap.style.display = show ? '' : 'none';
        if (show) startTimerDisplay(); else stopTimerDisplay();
    });

    if (form) {
        form.addEventListener('submit', function(e) {
            if (answerSubmitted) {
                e.preventDefault();
                return;
            }
            answerSubmitted = true;

            // Visually disable all answer buttons. We avoid the `disabled`
            // attribute because a disabled submit button would not send
            // its name/value to the server.
            form.querySelectorAll('.tr-answer-btn').forEach(function(btn) {
                btn.style.pointerEvents = 'none';
                btn.style.opacity = '0.5';
                btn.style.cursor = 'default';
            });

            stopTimerDisplay();
            const elapsedMs = Math.round(now() - startTime);
            const respInput = document.getElementById('response_time_ms');
            if (respInput) respInput.value = elapsedMs;
        });
    }

    document.addEventListener('keydown', function(e) {
        if (answerSubmitted) return;
        const key = parseInt(e.key, 10);
        if (key >= 1 && key <= 9) {
            const btn = document.querySelector('.tr-answer-btn[data-key="' + key + '"]');
            if (btn) {
                e.preventDefault();
                btn.click();
            }
        }
    });
}

// -------------------------------------------------------------------
// Result screen
// -------------------------------------------------------------------
function criterionMarkHTML(ok) {
    return '<span class="' + (ok ? 'tr-mark-ok' : 'tr-mark-no') + '">' + (ok ? '✅' : '❌') + '</span>';
}

// Checklist of the two "learned" conditions (strict OR weight-based),
// shown for hands that are not learned or were forgotten.
function learningCriteriaHTML(attempts, errorsLast3, avgTime, result) {
    let html = '<div class="tr-criteria">';
    html += criterionMarkHTML(attempts >= 3) + ' Попыток >= 3<br>';
    html += criterionMarkHTML(errorsLast3 === 0) + ' Ноль ошибок за последние 3 попытки &nbsp; (' + (result.last_results_display || '') + ')<br>';
    html += criterionMarkHTML(avgTime <= 3) + ' Среднее время руки за последние 3 попытки <= 3 с';
    html += '<hr class="tr-criteria-sep">';
    html += '<div class="tr-criteria-or">ИЛИ</div>';
    html += criterionMarkHTML(result.weight <= 0.25) + ' вес индивидуальной сложности ≤ 0.25 (текущий: ' + result.weight.toFixed(3) + ')<br>';
    html += '</div>';
    return html;
}

function buildStatusHTML(result) {
    const attempts = result.attempts || 0;
    const avgTime = (result.avg_time_sec !== null && result.avg_time_sec !== undefined) ? result.avg_time_sec : 0;
    const errorsLast3 = result.errors_last_3 !== undefined ? result.errors_last_3 : 0;
    const reviewInterval = result.review_interval_days || 0;
    const penaltyActive = result.penalty_active || false;
    const daysSince = result.days_since_last_shown || 0;
    const isDue = result.is_due_for_review || false;

    let html = '';
    if (penaltyActive) {
        html += '<div class="tr-status tr-status--forgotten">🔴 Забыта</div>';
        html += '<div class="tr-status-note">Рука была выучена, но затем была допущена ошибка, или среднее время руки за последние 3 попытки превысило 3 секунды, или вес стал более 0.25</div>';
        html += '<div class="tr-status-note">Поэтому к весу добавлен бонус 1.2</div>';
        html += learningCriteriaHTML(attempts, errorsLast3, avgTime, result);
    } else if (reviewInterval > 0 && isDue) {
        html += '<div class="tr-status tr-status--due">🟠 Выучена, пора повторять</div>';
        html += '<div class="tr-status-note">Вес повышен до максимума для планового повторения</div>';
        html += '<div class="tr-status-meta">Интервал: ' + reviewInterval + ' дн. &nbsp;|&nbsp; Прошло: ' + daysSince + ' дн.</div>';
    } else if (reviewInterval > 0) {
        html += '<div class="tr-status tr-status--learned">🟢 Выучена</div>';
        html += '<div class="tr-status-meta">Время до следующего повторения: ' + reviewInterval + ' дн.</div>';
    } else {
        html += '<div class="tr-status tr-status--unlearned">⚪ Не выучена</div>';
        html += learningCriteriaHTML(attempts, errorsLast3, avgTime, result);
    }
    return html;
}

// After a mistake, a slow answer or a fresh penalty, hold "next" for 3s
// (with a fill animation) so the result actually gets read.
function blockNextButton(btn) {
    btn.disabled = true;
    btn.classList.add('tr-next-blocked');
    void btn.offsetWidth; // force reflow so the fill transition starts from 0
    btn.classList.add('tr-next-blocked--animating');
    setTimeout(function() {
        btn.disabled = false;
        btn.classList.remove('tr-next-blocked', 'tr-next-blocked--animating');
    }, 3000);
}

const RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];
const NOT_IN_RANGE_COLOR = '#d5d8dc';
const DEFAULT_SUBRANGE_COLOR = '#3498db';

// Standard 13x13 layout: pairs on the diagonal, suited above it, offsuit below.
function handAt(rowIdx, colIdx) {
    const rowRank = RANKS[rowIdx];
    const colRank = RANKS[colIdx];
    if (rowIdx === colIdx) return rowRank + colRank;
    if (rowIdx < colIdx) return rowRank + colRank + 's';
    return colRank + rowRank + 'o';
}

// First subrange (in API order) that contains the hand wins.
function handColor(hand, subranges, colors) {
    for (const name of Object.keys(subranges)) {
        if (subranges[name].includes(hand)) {
            return colors[name] || DEFAULT_SUBRANGE_COLOR;
        }
    }
    return NOT_IN_RANGE_COLOR;
}

function renderRangeMatrix(subranges, colors, highlightHand) {
    const matrixContainer = document.getElementById('range-matrix');
    const listContainer = document.getElementById('range-subrange-list');
    if (!matrixContainer || !listContainer) return;

    matrixContainer.innerHTML = '';
    const grid = document.createElement('div');
    grid.className = 'tr-range-matrix-grid';
    RANKS.forEach(function(_, rowIdx) {
        RANKS.forEach(function(__, colIdx) {
            const hand = handAt(rowIdx, colIdx);
            const cell = document.createElement('div');
            cell.className = 'tr-range-matrix-cell';
            cell.textContent = hand;
            cell.style.backgroundColor = handColor(hand, subranges, colors);
            if (hand === highlightHand) {
                cell.classList.add('tr-range-matrix-cell--current');
            }
            grid.appendChild(cell);
        });
    });
    matrixContainer.appendChild(grid);

    listContainer.innerHTML = '';
    Object.keys(subranges).forEach(function(name) {
        const li = document.createElement('li');
        const dot = document.createElement('span');
        dot.className = 'tr-range-color-dot';
        dot.style.backgroundColor = colors[name] || DEFAULT_SUBRANGE_COLOR;
        li.appendChild(dot);
        li.appendChild(document.createTextNode(name));
        listContainer.appendChild(li);
    });
}

function initResultScreen() {
    const result = data.result || {};
    renderTable(result.situation, result.hero_cards);

    const statusDiv = document.getElementById('tr-hand-status');
    if (statusDiv) {
        statusDiv.innerHTML = buildStatusHTML(result);
    }

    const nextBtn = document.getElementById('next-question-btn');
    if (nextBtn) {
        const shouldBlock = !result.was_correct || result.current_time_sec > 10 || result.just_became_penalty;
        if (shouldBlock) blockNextButton(nextBtn);
    }

    const showRangeBtn = document.getElementById('show-range-btn');
    const rangeDisplay = document.getElementById('range-display');
    const rangePosSpan = document.getElementById('range-pos');
    let isVisible = false;

    if (showRangeBtn) {
        showRangeBtn.addEventListener('click', function() {
            if (isVisible) {
                rangeDisplay.hidden = true;
                showRangeBtn.innerHTML = 'Показать диапазон <span class="tr-key-hint">(+)</span>';
                isVisible = false;
                return;
            }

            fetch('/api/range/' + encodeURIComponent(result.pos))
                .then(function(response) {
                    if (!response.ok) {
                        throw new Error('HTTP ' + response.status + ': ' + response.statusText);
                    }
                    return response.json();
                })
                .then(function(data) {
                    if (data.status === 'ok') {
                        if (rangePosSpan) rangePosSpan.textContent = result.pos;
                        renderRangeMatrix(data.subranges, data.colors, result.hand);
                        rangeDisplay.hidden = false;
                        showRangeBtn.innerHTML = 'Скрыть диапазон <span class="tr-key-hint">(+)</span>';
                        isVisible = true;
                    } else {
                        showToast(toastContainer, 'Ошибка: ' + data.message, 'error');
                    }
                })
                .catch(function(err) {
                    showToast(toastContainer, 'Ошибка загрузки диапазона: ' + err.message, 'error');
                });
        });
    }

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' || e.key === ' ') {
            if (nextBtn && nextBtn.disabled) {
                e.preventDefault();
                return;
            }
            const nextForm = document.querySelector('.tr-actions form');
            if (nextForm) {
                e.preventDefault();
                nextForm.submit();
            }
            return;
        }
        if (e.key === '+') {
            if (showRangeBtn) {
                e.preventDefault();
                showRangeBtn.click();
            }
        }
    });
}

// -------------------------------------------------------------------
// Entry point
// -------------------------------------------------------------------
if (!data.showStart) {
    if (data.showResult) {
        initResultScreen();
    } else {
        initQuestionScreen();
    }
}
