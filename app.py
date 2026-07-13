from flask import Flask, render_template, request, redirect, url_for, session, jsonify
import random
import os
import json
import uuid

# ============================================================
#  ИМПОРТ НАСТРОЕК ИЗ config.py (или создание файла, если его нет)
# ============================================================

# Проверяем существование config.py, если нет – создаём с пустыми данными
if not os.path.exists('config.py'):
    with open('config.py', 'w', encoding='utf-8') as f:
        f.write("""# config.py
# ============================================================
#  НАСТРОЙКА ДИАПАЗОНОВ И РЕЖИМОВ
# ============================================================

ranges = {}
subranges = {}
subrange_order = []
subrange_answer_text = {}
modes = {}
subrange_colors = {}   # <-- добавлено
""")

from config import ranges, subranges, subrange_order, subrange_answer_text, modes, subrange_colors

app = Flask(__name__)
app.secret_key = 'замените-на-случайную-строку'

# ============================================================
#  ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ (оригинальные)
# ============================================================

def generate_all_hands():
    ranks = ['A','K','Q','J','T','9','8','7','6','5','4','3','2']
    hands = [f"{r}{r}" for r in ranks]
    for i in range(len(ranks)):
        for j in range(i+1, len(ranks)):
            hands.append(f"{ranks[i]}{ranks[j]}s")
            hands.append(f"{ranks[i]}{ranks[j]}o")
    return hands

ALL_HANDS = generate_all_hands()

def get_hand_status(hand, pos):
    for subname in subrange_order:
        if hand in subranges.get(subname, {}).get(pos, set()):
            return subname
    if hand in ranges.get(pos, set()):
        return 'in a range'
    return 'not in a range'

def get_correct_answer_text(status):
    if status == 'in a range':
        return 'yes'
    if status == 'not in a range':
        return 'fold'
    return subrange_answer_text.get(status, '')

def is_answer_correct(status, answer):
    return answer == get_correct_answer_text(status).lower()

def get_possible_statuses(pos):
    statuses = set()
    for subname in subrange_order:
        if subranges.get(subname, {}).get(pos, set()):
            statuses.add(subname)
    if ranges.get(pos, set()):
        statuses.add('in a range')
    statuses.add('not in a range')
    return sorted(statuses)

# ============================================================
#  ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ДЛЯ ФОРМАТИРОВАНИЯ CONFIG.PY
# ============================================================

def format_dict(d, indent=0, extra_newline_between_keys=False):
    """
    Форматирует словарь с отступами и запятыми между элементами.
    Если extra_newline_between_keys=True, между ключами вставляется пустая строка.
    """
    if not d:
        return "{}"
    lines = []
    keys = list(d.keys())
    for idx, key in enumerate(keys):
        value = d[key]
        # Форматируем значение
        if isinstance(value, dict):
            val_str = format_dict(value, indent + 4, extra_newline_between_keys=False)
        elif isinstance(value, set):
            val_str = format_set(value)
        elif isinstance(value, list):
            val_str = format_list(value)
        else:
            val_str = repr(value)
        # Добавляем запятую после каждого элемента, кроме последнего
        comma = "," if idx < len(keys) - 1 else ""
        lines.append(" " * (indent + 4) + repr(key) + ": " + val_str + comma)
        # Если нужно разделять пустой строкой и это не последний элемент
        if extra_newline_between_keys and idx < len(keys) - 1:
            lines.append("")
    result = "{\n" + "\n".join(lines) + "\n" + " " * indent + "}"
    return result

def format_set(s):
    """Форматирует множество в одну строку с запятыми."""
    if not s:
        return "set()"
    items = sorted(s)
    # Добавляем запятые между элементами
    return "{" + ", ".join(repr(item) for item in items) + "}"

def format_list(lst):
    """Форматирует список в одну строку с запятыми."""
    if not lst:
        return "[]"
    return "[" + ", ".join(repr(item) for item in lst) + "]"

def format_config():
    content = """# config.py
# ============================================================
#  НАСТРОЙКА ДИАПАЗОНОВ И РЕЖИМОВ – АВТОМАТИЧЕСКИ СОЗДАНО
# ============================================================

"""
    content += "ranges = " + format_dict(ranges) + "\n\n"
    content += "subranges = " + format_dict(subranges, extra_newline_between_keys=True) + "\n\n"
    content += "subrange_order = " + format_list(subrange_order) + "\n\n"
    content += "subrange_answer_text = " + format_dict(subrange_answer_text) + "\n\n"
    content += "modes = " + format_dict(modes) + "\n\n"
    content += "subrange_colors = " + format_dict(subrange_colors) + "\n"
    return content

def write_config():
    """Перезаписывает файл config.py с отформатированным содержимым."""
    content = format_config()
    with open('config.py', 'w', encoding='utf-8') as f:
        f.write(content)

# ============================================================
#  ДОБАВЛЕНИЕ РЕЖИМА "All" (как раньше)
# ============================================================

if modes:
    all_positions = set()
    for situs in modes.values():
        all_positions.update(situs)
    if 'All' not in modes:
        modes['All'] = sorted(all_positions)

# ============================================================
#  МАРШРУТЫ
# ============================================================

@app.route('/')
def index():
    if not modes:
        return render_template('index.html', modes={}, no_modes=True)
    return render_template('index.html', modes=modes, no_modes=False)

@app.route('/reset')
def reset_stats():
    session['stats'] = {'total': 0, 'correct': 0, 'wrong': 0}
    session.pop('last_result', None)
    return redirect(url_for('index'))

@app.route('/training/<mode>', methods=['GET', 'POST'])
def training(mode):
    if mode not in modes:
        return "Режим не найден", 404

    if 'stats' not in session:
        session['stats'] = {'total': 0, 'correct': 0, 'wrong': 0}

    if request.method == 'POST':
        answer = request.form.get('answer', '').strip().lower()
        pos = session.get('pos')
        hand = session.get('hand')
        status = session.get('status')
        correct_text = session.get('correct_text')
        if pos and hand and status:
            stats = session['stats']
            stats['total'] += 1
            user_correct = (answer == correct_text.lower())
            if user_correct:
                stats['correct'] += 1
            else:
                stats['wrong'] += 1
            session['stats'] = stats

            session['last_result'] = {
                'user_answer': answer,
                'correct_answer': correct_text,
                'was_correct': user_correct,
                'hand': hand,
                'pos': pos
            }
            return redirect(url_for('training', mode=mode, show_result=1))
        else:
            return redirect(url_for('training', mode=mode))

    show_result = request.args.get('show_result') == '1'
    if show_result and 'last_result' in session:
        result = session['last_result']
        stats = session['stats']
        return render_template(
            'training.html',
            mode=mode,
            show_result=True,
            result=result,
            stats=stats,
            next_url=url_for('training', mode=mode)
        )
    else:
        session.pop('last_result', None)
        positions = modes[mode]
        if not positions:
            return "В этом режиме нет позиций", 400

        pos = random.choice(positions)
        hand = random.choice(ALL_HANDS)
        status = get_hand_status(hand, pos)
        correct_text = get_correct_answer_text(status)

        possible_statuses = get_possible_statuses(pos)
        possible_answers = sorted(set(
            get_correct_answer_text(st) for st in possible_statuses if get_correct_answer_text(st)
        ))

        session['pos'] = pos
        session['hand'] = hand
        session['status'] = status
        session['correct_text'] = correct_text

        stats = session['stats']
        return render_template(
            'training.html',
            mode=mode,
            pos=pos,
            hand=hand,
            possible_answers=possible_answers,
            stats=stats,
            show_result=False
        )

# ============================================================
#  НОВЫЕ МАРШРУТЫ ДЛЯ СОЗДАНИЯ ДИАПАЗОНОВ
# ============================================================

@app.route('/create', methods=['GET'])
def create_range():
    """Страница создания диапазона."""
    # Инициализируем список поддиапазонов в сессии, если его нет
    if 'temp_subranges' not in session:
        session['temp_subranges'] = []
    return render_template('create_range.html')

@app.route('/create/add_subrange', methods=['POST'])
def add_subrange():
    data = request.get_json()
    name = data.get('name', '').strip()
    hands = data.get('hands', [])
    color = data.get('color', '#3498db')
    if not name or not hands:
        return jsonify({'status': 'error', 'message': 'Не указано имя или список рук'}), 400

    for h in hands:
        if h not in ALL_HANDS:
            return jsonify({'status': 'error', 'message': f'Некорректная рука: {h}'}), 400

    if 'temp_subranges' not in session:
        session['temp_subranges'] = []
    
    # Удаляем выбранные руки из всех существующих поддиапазонов
    hands_set = set(hands)
    for sub in session['temp_subranges']:
        sub['hands'] = [h for h in sub['hands'] if h not in hands_set]

    new_id = str(uuid.uuid4())
    session['temp_subranges'].append({
        'id': new_id,
        'name': name,
        'hands': hands,
        'color': color
    })
    session.modified = True
    return jsonify({'status': 'ok', 'subranges': session['temp_subranges']})

@app.route('/create/save_range', methods=['POST'])
def save_range():
    """
    Сохраняет весь диапазон (позиция + список поддиапазонов) в config.py.
    Ожидает JSON: {"position": "RFI_UTG"}
    """
    data = request.get_json()
    position = data.get('position', '').strip()
    if not position:
        return jsonify({'status': 'error', 'message': 'Не указана позиция'}), 400

    temp_subranges = session.get('temp_subranges', [])
    if not temp_subranges:
        return jsonify({'status': 'error', 'message': 'Нет добавленных поддиапазонов'}), 400

    # Обновляем глобальные словари
    for sub in temp_subranges:
        name = sub['name']
        hands = set(sub['hands'])  # множество для хранения

        # Добавляем в subranges
        if name not in subranges:
            subranges[name] = {}
        subranges[name][position] = hands

        # Добавляем в subrange_answer_text (дублируем имя)
        if name not in subrange_answer_text:
            subrange_answer_text[name] = name

        # Добавляем в subrange_order, если ещё нет
        if name not in subrange_order:
            subrange_order.append(name)

    # Сохраняем цвета для всех поддиапазонов
    for sub in temp_subranges:
        name = sub['name']
        color = sub.get('color', '#3498db')
        subrange_colors[name] = color

    # Записываем config.py
    write_config()

    # Очищаем временные данные
    session.pop('temp_subranges', None)

    return jsonify({'status': 'ok', 'message': f'Диапазон для {position} сохранён'})

@app.route('/create/clear_temp', methods=['POST'])
def clear_temp():
    """Очищает временный список поддиапазонов (при отмене)."""
    session.pop('temp_subranges', None)
    return jsonify({'status': 'ok'})

@app.route('/create/get_temp', methods=['GET'])
def get_temp_subranges():
    """Возвращает список временных поддиапазонов из сессии."""
    temp = session.get('temp_subranges', [])
    return jsonify({'subranges': temp})

@app.route('/create_mode', methods=['GET'])
def create_mode():
    """Страница создания нового режима."""
    # Получаем все уникальные позиции из subranges
    positions = set()
    for sub_dict in subranges.values():
        positions.update(sub_dict.keys())
    positions = sorted(positions)
    return render_template('create_mode.html', positions=positions, modes=modes)

@app.route('/create_mode/save', methods=['POST'])
def save_mode():
    """Сохраняет новый режим."""
    data = request.get_json()
    mode_name = data.get('name', '').strip()
    selected_positions = data.get('positions', [])
    if not mode_name:
        return jsonify({'status': 'error', 'message': 'Введите название режима'}), 400
    if not selected_positions:
        return jsonify({'status': 'error', 'message': 'Выберите хотя бы одну позицию'}), 400
    if mode_name in modes:
        return jsonify({'status': 'error', 'message': 'Режим с таким именем уже существует'}), 400
    # Добавляем в modes
    modes[mode_name] = selected_positions
    # Записываем config
    write_config()
    return jsonify({'status': 'ok', 'message': f'Режим "{mode_name}" сохранён'})

@app.route('/create/remove_subrange', methods=['POST'])
def remove_subrange():
    data = request.get_json()
    sub_id = data.get('id')
    if not sub_id:
        return jsonify({'status': 'error', 'message': 'Не указан ID'}), 400

    temp = session.get('temp_subranges', [])
    # Находим и удаляем
    new_temp = [sub for sub in temp if sub.get('id') != sub_id]
    if len(new_temp) == len(temp):
        return jsonify({'status': 'error', 'message': 'Поддиапазон не найден'}), 404
    session['temp_subranges'] = new_temp
    session.modified = True
    return jsonify({'status': 'ok'})

@app.route('/create/update_subrange', methods=['POST'])
def update_subrange():
    data = request.get_json()
    sub_id = data.get('id')
    name = data.get('name', '').strip()
    hands = data.get('hands', [])
    color = data.get('color', '#3498db')
    if not sub_id:
        return jsonify({'status': 'error', 'message': 'Не указан ID'}), 400
    if not name:
        return jsonify({'status': 'error', 'message': 'Введите название'}), 400
    if not hands:
        return jsonify({'status': 'error', 'message': 'Выберите хотя бы одну руку'}), 400

    temp = session.get('temp_subranges', [])
    found = False
    for sub in temp:
        if sub.get('id') == sub_id:
            sub['name'] = name
            sub['hands'] = hands
            sub['color'] = color
            found = True
            break
    if not found:
        return jsonify({'status': 'error', 'message': 'Поддиапазон не найден'}), 404

    # Удаляем эти руки из всех остальных поддиапазонов
    hands_set = set(hands)
    for sub in temp:
        if sub.get('id') != sub_id:
            sub['hands'] = [h for h in sub['hands'] if h not in hands_set]

    session.modified = True
    return jsonify({'status': 'ok'})

# ============================================================
#  ЗАПУСК
# ============================================================

if __name__ == '__main__':
    app.run(debug=True)