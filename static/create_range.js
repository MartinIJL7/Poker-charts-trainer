// create_range.js

// Глобальные переменные
let currentColor = '#3498db';
let currentHands = [];          // список рук, выбранных для текущего поддиапазона
let tempSubranges = [];         // массив объектов { name, color, hands: [] }

// Список рангов (порядок важен)
const ranks = ['A','K','Q','J','T','9','8','7','6','5','4','3','2'];

// Генерация всех рук для матрицы
function generateHandMatrix() {
    const container = document.getElementById('hand-matrix');
    container.innerHTML = '';
    // Добавляем пустую ячейку в левом верхнем углу
    const emptyHeader = document.createElement('div');
    emptyHeader.className = 'matrix-cell matrix-header';
    emptyHeader.textContent = '';
    container.appendChild(emptyHeader);

    // Заголовки столбцов (ранги)
    ranks.forEach(r => {
        const header = document.createElement('div');
        header.className = 'matrix-cell matrix-header';
        header.textContent = r;
        container.appendChild(header);
    });

    // Строки
    ranks.forEach((rowRank, i) => {
        // Заголовок строки
        const rowHeader = document.createElement('div');
        rowHeader.className = 'matrix-cell matrix-header';
        rowHeader.textContent = rowRank;
        container.appendChild(rowHeader);

        // Ячейки
        ranks.forEach((colRank, j) => {
            const cell = document.createElement('div');
            cell.className = 'matrix-cell';
            let hand = '';
            let isPair = false;
            if (i === j) {
                hand = rowRank + colRank;  // пара
                isPair = true;
                cell.classList.add('pair');
            } else if (i < j) {
                hand = rowRank + colRank + 's';  // одномастные (выше диагонали)
                cell.classList.add('suited');
            } else {
                hand = colRank + rowRank + 'o';  // разномастные (ниже диагонали)
                cell.classList.add('offsuit');
            }
            cell.textContent = hand;
            cell.dataset.hand = hand;
            cell.dataset.selected = 'false';
            cell.dataset.color = ''; // цвет, если рука уже принадлежит другому поддиапазону

            // Обработчик клика
            cell.addEventListener('click', function() {
                toggleCell(this);
            });

            container.appendChild(cell);
        });
    });

    // После создания обновляем отображение всех поддиапазонов
    renderAllSubranges();
}

// Переключение ячейки (добавление/удаление из текущего поддиапазона)
function toggleCell(cell) {
    const hand = cell.dataset.hand;
    const isSelected = cell.dataset.selected === 'true';
    if (isSelected) {
        // Снять выделение
        cell.dataset.selected = 'false';
        // Убираем из currentHands
        const index = currentHands.indexOf(hand);
        if (index > -1) {
            currentHands.splice(index, 1);
        }
        // Перерисовываем ячейку (она может принадлежать другому поддиапазону)
        renderCell(cell);
    } else {
        // Добавить выделение
        cell.dataset.selected = 'true';
        if (!currentHands.includes(hand)) {
            currentHands.push(hand);
        }
        // Окрашиваем цветом текущего поддиапазона (поверх всего)
        cell.style.backgroundColor = currentColor;
    }
    updateSelectedCount();
}

// Отрисовка отдельной ячейки с учётом всех поддиапазонов
function renderCell(cell) {
    const hand = cell.dataset.hand;
    // Проверяем, принадлежит ли рука какому-либо поддиапазону (кроме текущего)
    let foundColor = null;
    for (let sub of tempSubranges) {
        if (sub.hands.includes(hand)) {
            foundColor = sub.color;
            break;
        }
    }
    // Если рука выбрана в текущем поддиапазоне – показываем текущий цвет
    if (cell.dataset.selected === 'true') {
        cell.style.backgroundColor = currentColor;
    } else if (foundColor) {
        cell.style.backgroundColor = foundColor;
    } else {
        // Сброс к исходному (определяется классами)
        cell.style.backgroundColor = '';
        // Заново применяем класс (чтобы восстановить фоновый цвет)
        cell.className = 'matrix-cell';
        if (hand.length === 2 && hand[0] === hand[1]) {
            cell.classList.add('pair');
        } else if (hand.includes('s')) {
            cell.classList.add('suited');
        } else if (hand.includes('o')) {
            cell.classList.add('offsuit');
        }
    }
}

// Обновление всей матрицы на основе tempSubranges и currentHands
function renderAllSubranges() {
    const cells = document.querySelectorAll('#hand-matrix .matrix-cell:not(.matrix-header)');
    cells.forEach(cell => {
        // Сначала сбрасываем выделение (но не сбрасываем dataset.selected)
        // Мы будем использовать dataset.selected только для текущего поддиапазона
        // При открытии модалки currentHands пуст, поэтому все ячейки будут отображать цвета поддиапазонов
        renderCell(cell);
    });
    updateSelectedCount();
}

// Обновление счётчика выбранных рук для текущего поддиапазона
function updateSelectedCount() {
    const counter = document.getElementById('selected-count');
    if (counter) counter.textContent = currentHands.length;
}

// Сброс выделения текущего поддиапазона (очистка currentHands, но не удаление поддиапазонов)
function clearCurrentSelection() {
    // Убираем выделение со всех ячеек
    const cells = document.querySelectorAll('#hand-matrix .matrix-cell:not(.matrix-header)');
    cells.forEach(cell => {
        cell.dataset.selected = 'false';
    });
    currentHands = [];
    // Перерисовываем, чтобы вернуть цвета поддиапазонов
    renderAllSubranges();
}

// Загрузка временных поддиапазонов из сессии при открытии модалки
function loadTempSubranges() {
    fetch('/create/get_temp')
        .then(response => response.json())
        .then(data => {
            if (data.subranges) {
                tempSubranges = data.subranges.map(sub => ({
                    name: sub.name,
                    color: sub.color || '#3498db',
                    hands: sub.hands || []
                }));
                // Обновить список на странице
                updateSubrangeListUI();
                // Перерисовать матрицу
                renderAllSubranges();
            }
        })
        .catch(err => console.error('Ошибка загрузки поддиапазонов:', err));
}

// Обновление UI списка поддиапазонов
function updateSubrangeListUI() {
    const ul = document.getElementById('subrange-list-ul');
    ul.innerHTML = '';
    tempSubranges.forEach(sub => {
        const li = document.createElement('li');
        li.textContent = sub.name;
        li.style.borderLeftColor = sub.color;
        li.dataset.name = sub.name;
        ul.appendChild(li);
    });
    const emptyMsg = document.getElementById('empty-message');
    emptyMsg.style.display = tempSubranges.length === 0 ? 'block' : 'none';
}

// Добавление нового поддиапазона (после сохранения)
function addSubrangeToList(sub) {
    tempSubranges.push(sub);
    updateSubrangeListUI();
    // Перерисовать матрицу, чтобы новый поддиапазон отобразился
    renderAllSubranges();
}

// Инициализация модального окна
const modal = document.getElementById('subrange-modal');
const addBtn = document.getElementById('add-subrange-btn');
const closeBtn = document.querySelector('.close');
const cancelBtn = document.getElementById('cancel-subrange-btn');
const saveSubrangeBtn = document.getElementById('save-subrange-btn');
const colorPicker = document.getElementById('color-picker');

// Открытие модального окна
addBtn.addEventListener('click', function() {
    modal.style.display = 'block';
    // Загружаем существующие поддиапазоны
    loadTempSubranges();
    // Очищаем текущее выделение
    clearCurrentSelection();
    // Заполняем имя поддиапазона предложением
    const count = tempSubranges.length + 1;
    document.getElementById('subname').value = `Поддиапазон ${count}`;
    // Устанавливаем цвет из пикера
    currentColor = colorPicker.value;
});

// Закрытие модального окна
function closeModal() {
    modal.style.display = 'none';
    // Очищаем выделение, чтобы при следующем открытии всё было чисто
    clearCurrentSelection();
}
closeBtn.addEventListener('click', closeModal);
cancelBtn.addEventListener('click', closeModal);
window.addEventListener('click', function(event) {
    if (event.target == modal) {
        closeModal();
    }
});

// Изменение цвета – обновляем текущий цвет и перерисовываем выделенные ячейки
colorPicker.addEventListener('input', function() {
    currentColor = this.value;
    // Перекрашиваем ячейки, которые выбраны в текущем поддиапазоне
    const cells = document.querySelectorAll('#hand-matrix .matrix-cell:not(.matrix-header)');
    cells.forEach(cell => {
        if (cell.dataset.selected === 'true') {
            cell.style.backgroundColor = currentColor;
        }
    });
});

// Сохранение поддиапазона
saveSubrangeBtn.addEventListener('click', function() {
    const name = document.getElementById('subname').value.trim();
    if (!name) {
        alert('Введите название поддиапазона');
        return;
    }
    if (currentHands.length === 0) {
        alert('Выберите хотя бы одну руку');
        return;
    }

    // Отправляем на сервер
    fetch('/create/add_subrange', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            name: name,
            hands: currentHands,
            color: currentColor   // передаём цвет
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'ok') {
            // Добавляем поддиапазон в локальный список
            addSubrangeToList({
                name: name,
                color: currentColor,
                hands: currentHands.slice() // копия
            });
            // Очищаем текущее выделение, чтобы начать новый поддиапазон
            clearCurrentSelection();
            // Обновляем предложение имени
            const count = tempSubranges.length + 1;
            document.getElementById('subname').value = `Поддиапазон ${count}`;
            // Модалка остаётся открытой – можно продолжать
            alert('Поддиапазон сохранён! Можете создать следующий.');
        } else {
            alert('Ошибка: ' + data.message);
        }
    })
    .catch(err => {
        alert('Ошибка сети: ' + err);
    });
});

// Очистка всех поддиапазонов (кнопка)
document.getElementById('clear-all-btn').addEventListener('click', function() {
    if (confirm('Удалить все добавленные поддиапазоны?')) {
        fetch('/create/clear_temp', { method: 'POST' })
        .then(() => {
            tempSubranges = [];
            updateSubrangeListUI();
            renderAllSubranges();
            clearCurrentSelection();
        });
    }
});

// Сохранение диапазона (позиция + все поддиапазоны)
document.getElementById('save-range-btn').addEventListener('click', function() {
    const position = document.getElementById('position').value.trim();
    if (!position) {
        alert('Введите название позиции');
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
        body: JSON.stringify({ position: position })
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'ok') {
            alert('Диапазон успешно сохранён в config.py!');
            // Очищаем локальные данные
            tempSubranges = [];
            updateSubrangeListUI();
            renderAllSubranges();
            clearCurrentSelection();
            // Очищаем сессию на сервере
            fetch('/create/clear_temp', { method: 'POST' });
        } else {
            alert('Ошибка: ' + data.message);
        }
    })
    .catch(err => {
        alert('Ошибка сети: ' + err);
    });
});

// При загрузке страницы – генерируем матрицу и загружаем существующие поддиапазоны из сессии
window.onload = function() {
    generateHandMatrix();
    // Загружаем временные поддиапазоны (если есть)
    loadTempSubranges();
};