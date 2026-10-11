// config_management.js
// Behaviour of the "Работа с конфигами" page: save the live config as a
// backup, load / delete a backup, and clear the live config. Every action
// is a POST to /config_management/*; results are shown as toasts. Saving and
// deleting update the list in place; load and clear reload the page.

import { showToast as renderToast } from './toast.js';

const RELOAD_DELAY_MS = 800; // long enough to read the success toast
const REMOVE_ANIMATION_MS = 350; // keep in sync with .cfg-item--removing in the CSS
const MOBILE_QUERY = '(max-width: 600px)';

const toastContainer = document.getElementById('toast-container');
const nameInput = document.getElementById('cfg-name');
const saveForm = document.getElementById('cfg-save-form');
const clearBtn = document.getElementById('cfg-clear-btn');
const intro = document.getElementById('cfg-intro');
const myList = document.getElementById('cfg-mine-list');
const emptyHint = document.getElementById('cfg-mine-empty');
const rowTemplate = document.getElementById('cfg-row-template');

let busy = false; // blocks double submits while a request is in flight

function showToast(message, type) {
    renderToast(toastContainer, message, type);
}

// Disable every button while busy so a slow request can't be fired twice
function setBusy(value) {
    busy = value;
    document.querySelectorAll('.cr-shell button').forEach(function(btn) {
        btn.disabled = value;
    });
}

// POST to an endpoint and resolve with its parsed JSON. Network failures
// are toasted here and resolve to null so callers only handle real replies.
async function post(url, body) {
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: body
        });
        return await response.json();
    } catch (err) {
        showToast('Ошибка сети: ' + err, 'error');
        return null;
    }
}

// Run an action and toast its result. On success the page reloads, unless
// the caller passes onSuccess to update the page in place instead.
// Returns the reply so callers can react to non-ok statuses (e.g. "exists").
async function runAction(url, body, onSuccess) {
    if (busy) return null;
    setBusy(true);
    const data = await post(url, body);
    if (data && data.status === 'ok') {
        showToast(data.message, 'success');
        if (!onSuccess) {
            setTimeout(function() { location.reload(); }, RELOAD_DELAY_MS);
            return data; // stay disabled until the reload happens
        }
        onSuccess(data);
    } else if (data && data.status !== 'exists') {
        showToast('Ошибка: ' + data.message, 'error');
    }
    setBusy(false);
    return data;
}

// Add the saved config to "Мои конфиги" with an entrance animation, in
// alphabetical position like the server-rendered list. An overwritten
// config already has a row, so that row is just flashed again.
function showSavedConfig(entry) {
    let row = myList.querySelector('[data-filename="' + CSS.escape(entry.filename) + '"]');
    row = row ? row.closest('.cfg-item') : null;

    if (!row) {
        row = rowTemplate.content.firstElementChild.cloneNode(true);
        row.querySelector('.cfg-item-name').textContent = entry.display_name;
        row.querySelector('.cfg-item-name').title = entry.display_name;
        row.querySelectorAll('[data-filename]').forEach(function(btn) {
            btn.dataset.filename = entry.filename;
            btn.dataset.name = entry.display_name;
        });
        row.querySelector('[data-action=delete]').setAttribute('aria-label', 'Удалить конфиг ' + entry.display_name);

        const key = entry.display_name.toLowerCase();
        const next = Array.from(myList.children).find(function(item) {
            return item.querySelector('.cfg-item-name').textContent.toLowerCase() > key;
        });
        myList.insertBefore(row, next || null);
        emptyHint.hidden = true;
    }

    // Restart the CSS animation (also needed when flashing an existing row)
    row.classList.remove('cfg-item--new');
    void row.offsetWidth;
    row.classList.add('cfg-item--new');
    row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

async function saveConfig(overwrite) {
    const name = nameInput.value.trim();
    if (!name) {
        showToast('Введите имя конфига', 'error');
        nameInput.focus();
        return;
    }
    const body = 'name=' + encodeURIComponent(name) + '&overwrite=' + overwrite;
    const data = await runAction('/config_management/save', body, function(saved) {
        nameInput.value = '';
        showSavedConfig(saved);
    });
    // The name is taken: ask once, then retry with overwrite enabled
    if (data && data.status === 'exists' && confirm(data.message)) {
        saveConfig(true);
    }
}

function loadConfig(filename, displayName) {
    if (!confirm('Загрузить конфиг "' + displayName + '"? Текущий конфиг будет заменен')) return;
    runAction('/config_management/load/' + encodeURIComponent(filename));
}

function deleteConfig(row, filename, displayName) {
    if (!confirm('Удалить конфиг "' + displayName + '"?')) return;
    runAction('/config_management/delete/' + encodeURIComponent(filename), '', function() {
        removeRow(row);
    });
}

// Collapse a row out of the list, then drop it from the DOM. The height is
// pinned first because CSS can't transition from `auto`. A timeout stands in
// for transitionend, which never fires when reduced motion disables the transition.
function removeRow(row) {
    row.style.height = row.offsetHeight + 'px';
    void row.offsetWidth;
    row.classList.add('cfg-item--removing');
    setTimeout(function() {
        row.remove();
        emptyHint.hidden = myList.children.length > 0;
    }, REMOVE_ANIMATION_MS);
}

function clearConfig() {
    if (!confirm('Очистить текущий конфиг? Будут безвозвратно удалены все диапазоны, поддиапазоны, цвета, режимы тренировки и столы. Статистика обучения останется. Рекомендуется сначала сохранить конфиг')) return;
    runAction('/config_management/clear');
}

saveForm.addEventListener('submit', function(e) {
    e.preventDefault();
    saveConfig(false);
});

clearBtn.addEventListener('click', clearConfig);

// One delegated listener for the load / delete buttons in both lists
document.addEventListener('click', function(e) {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const { action, filename, name } = btn.dataset;
    if (action === 'load') loadConfig(filename, name);
    if (action === 'delete') deleteConfig(btn.closest('.cfg-item'), filename, name);
});

// On phones the explainer starts collapsed so the forms and lists are
// reachable without scrolling past it
if (window.matchMedia(MOBILE_QUERY).matches) {
    intro.open = false;
}
