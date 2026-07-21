from flask import Flask, render_template, request, redirect, url_for, session, jsonify, flash
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager, UserMixin, login_user, logout_user, login_required, current_user
from werkzeug.security import generate_password_hash, check_password_hash
import random
import os
import json
import uuid
import importlib
import glob
from datetime import datetime

# ============================================================
#  НАСТРОЙКА БАЗЫ ДАННЫХ
# ============================================================
app = Flask(__name__)
app.secret_key = 'замените-на-случайную-строку'  # обязательно измените в продакшене
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///users.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'
login_manager.login_message = 'Пожалуйста, войдите для доступа.'

# ============================================================
#  МОДЕЛЬ ПОЛЬЗОВАТЕЛЯ
# ============================================================
class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(200), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

# Создаём таблицы при первом запуске
with app.app_context():
    db.create_all()

# ============================================================
#  ИМПОРТ НАСТРОЕК ИЗ config.py (или создание файла, если его нет)
# ============================================================
if not os.path.exists('config.py'):
    with open('config.py', 'w', encoding='utf-8') as f:
        f.write("""# config.py
# ============================================================
#  НАСТРОЙКА ДИАПАЗОНОВ И РЕЖИМОВ
# ============================================================

subranges = {}
subrange_order = []
modes = {}
subrange_colors = {}   # <-- добавлено
""")

if not os.path.exists('saved_configs'):
    os.makedirs('saved_configs')

from config import subranges, subrange_order, modes, subrange_colors

# ============================================================
#  ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ (оригинальные)
# ============================================================

def reload_config():
    global subranges, subrange_order, modes, subrange_colors
    import config
    importlib.reload(config)
    subranges = config.subranges
    subrange_order = config.subrange_order
    modes = config.modes
    subrange_colors = config.subrange_colors

def get_backup_files():
    """Возвращает список имён файлов бэкапов (без пути)."""
    files = glob.glob('saved_configs/*.py')
    return sorted([os.path.basename(f) for f in files])

def get_all_positions():
    positions = set()
    for sub_dict in subranges.values():
        positions.update(sub_dict.keys())
    return sorted(positions)

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
    return 'not in a range'

def get_correct_answer_text(status):
    if status == 'not in a range':
        return 'fold'
    return status

def is_answer_correct(status, answer):
    return answer == get_correct_answer_text(status).lower()

def get_possible_statuses(pos):
    statuses = set()
    for subname in subrange_order:
        if subranges.get(subname, {}).get(pos, set()):
            statuses.add(subname)
    statuses.add('not in a range')
    return sorted(statuses)

# ============================================================
#  ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ДЛЯ ФОРМАТИРОВАНИЯ CONFIG.PY
# ============================================================

def format_dict(d, indent=0, extra_newline_between_keys=False):
    """Форматирует словарь с отступами и запятыми между элементами."""
    if not d:
        return "{}"
    lines = []
    keys = list(d.keys())
    for idx, key in enumerate(keys):
        value = d[key]
        if isinstance(value, dict):
            val_str = format_dict(value, indent + 4, extra_newline_between_keys=False)
        elif isinstance(value, set):
            val_str = format_set(value)
        elif isinstance(value, list):
            val_str = format_list(value)
        else:
            val_str = repr(value)
        comma = "," if idx < len(keys) - 1 else ""
        lines.append(" " * (indent + 4) + repr(key) + ": " + val_str + comma)
        if extra_newline_between_keys and idx < len(keys) - 1:
            lines.append("")
    result = "{\n" + "\n".join(lines) + "\n" + " " * indent + "}"
    return result

def format_set(s):
    if not s:
        return "set()"
    items = sorted(s)
    return "{" + ", ".join(repr(item) for item in items) + "}"

def format_list(lst):
    if not lst:
        return "[]"
    return "[" + ", ".join(repr(item) for item in lst) + "]"

def format_config():
    content = """# config.py
# ============================================================
#  НАСТРОЙКА ДИАПАЗОНОВ И РЕЖИМОВ – АВТОМАТИЧЕСКИ СОЗДАНО
# ============================================================

"""
    content += "subranges = " + format_dict(subranges, extra_newline_between_keys=True) + "\n\n"
    content += "subrange_order = " + format_list(subrange_order) + "\n\n"
    content += "modes = " + format_dict(modes) + "\n\n"
    content += "subrange_colors = " + format_dict(subrange_colors) + "\n"
    return content

def write_config():
    all_positions = get_all_positions()
    if all_positions:
        modes['All'] = all_positions
    else:
        modes.pop('All', None)
    content = format_config()
    with open('config.py', 'w', encoding='utf-8') as f:
        f.write(content)

# ============================================================
#  МАРШРУТЫ АВТОРИЗАЦИИ
# ============================================================

@app.route('/register', methods=['GET', 'POST'])
def register():
    if current_user.is_authenticated:
        return redirect(url_for('index'))
    if request.method == 'POST':
        username = request.form.get('username', '').strip()
        password = request.form.get('password', '').strip()
        if not username or not password:
            return render_template('register.html', error='Заполните все поля')
        if User.query.filter_by(username=username).first():
            return render_template('register.html', error='Пользователь с таким именем уже существует')
        user = User(username=username)
        user.set_password(password)
        db.session.add(user)
        db.session.commit()
        flash('Регистрация успешна! Теперь войдите.', 'success')
        return redirect(url_for('login'))
    return render_template('register.html')

@app.route('/login', methods=['GET', 'POST'])
def login():
    if current_user.is_authenticated:
        return redirect(url_for('index'))
    if request.method == 'POST':
        username = request.form.get('username', '').strip()
        password = request.form.get('password', '').strip()
        user = User.query.filter_by(username=username).first()
        if user and user.check_password(password):
            login_user(user)
            flash('Добро пожаловать, {}!'.format(username), 'success')
            next_page = request.args.get('next')
            return redirect(next_page or url_for('index'))
        else:
            return render_template('login.html', error='Неверное имя пользователя или пароль')
    return render_template('login.html')

@app.route('/logout')
@login_required
def logout():
    logout_user()
    flash('Вы вышли из системы.', 'info')
    return redirect(url_for('login'))

# ============================================================
#  ОСНОВНЫЕ МАРШРУТЫ (все защищены @login_required)
# ============================================================

@app.route('/')
@login_required
def index():
    if not modes:
        return render_template('index.html', modes={}, no_modes=True)
    return render_template('index.html', modes=modes, no_modes=False)

@app.route('/reset')
@login_required
def reset_stats():
    session['stats'] = {'total': 0, 'correct': 0, 'wrong': 0}
    session.pop('last_result', None)
    next_url = request.args.get('next')
    if next_url:
        return redirect(next_url)
    return redirect(url_for('index'))

@app.route('/training/<mode>', methods=['GET', 'POST'])
@login_required
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
#  МАРШРУТЫ ДЛЯ СОЗДАНИЯ ДИАПАЗОНОВ (защищены)
# ============================================================

@app.route('/create', methods=['GET'])
@login_required
def create_range():
    positions = get_all_positions()
    if 'temp_subranges' not in session:
        session['temp_subranges'] = []
    return render_template('create_range.html', all_positions=positions)

@app.route('/create/add_subrange', methods=['POST'])
@login_required
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
@login_required
def save_range():
    data = request.get_json()
    position = data.get('position', '').strip().replace(' ', '_')
    if not position:
        return jsonify({'status': 'error', 'message': 'Не указана позиция'}), 400

    temp_subranges = session.get('temp_subranges', [])
    if not temp_subranges:
        return jsonify({'status': 'error', 'message': 'Нет добавленных поддиапазонов'}), 400

    editing_pos = session.pop('editing_position', None)
    if editing_pos:
        for subname in list(subranges.keys()):
            if editing_pos in subranges[subname]:
                del subranges[subname][editing_pos]
                if not subranges[subname]:
                    del subranges[subname]

    for sub in temp_subranges:
        name = sub['name']
        hands = set(sub['hands'])

        if name not in subranges:
            subranges[name] = {}
        subranges[name][position] = hands

        if name not in subrange_order:
            subrange_order.append(name)

        color = sub.get('color', '#3498db')
        subrange_colors[name] = color

    write_config()
    session.pop('editing_position', None)
    return jsonify({'status': 'ok', 'message': f'Диапазон для {position} сохранён'})

@app.route('/create/clear_temp', methods=['POST'])
@login_required
def clear_temp():
    session.pop('temp_subranges', None)
    session.pop('editing_position', None)
    return jsonify({'status': 'ok'})

@app.route('/create/get_temp', methods=['GET'])
@login_required
def get_temp_subranges():
    temp = session.get('temp_subranges', [])
    return jsonify({'subranges': temp})

@app.route('/create/load_range', methods=['POST'])
@login_required
def load_range():
    data = request.get_json()
    position = data.get('position', '').strip()
    if not position:
        return jsonify({'status': 'error', 'message': 'Не указана позиция'}), 400

    loaded_subranges = []
    for subname, sub_dict in subranges.items():
        if position in sub_dict:
            hands = list(sub_dict[position])
            color = subrange_colors.get(subname, '#3498db')
            loaded_subranges.append({
                'name': subname,
                'hands': hands,
                'color': color
            })

    if not loaded_subranges:
        return jsonify({'status': 'error', 'message': 'Диапазон для этой позиции не найден'}), 404

    temp = []
    for sub in loaded_subranges:
        temp.append({
            'id': str(uuid.uuid4()),
            'name': sub['name'],
            'hands': sub['hands'],
            'color': sub['color']
        })
    session['temp_subranges'] = temp
    session['editing_position'] = position
    session.modified = True

    return jsonify({
        'status': 'ok',
        'position': position,
        'subranges': temp
    })

@app.route('/create_mode', methods=['GET'])
@login_required
def create_mode():
    positions = set()
    for sub_dict in subranges.values():
        positions.update(sub_dict.keys())
    positions = sorted(positions)
    return render_template('create_mode.html', positions=positions, modes=modes)

@app.route('/create_mode/save', methods=['POST'])
@login_required
def save_mode():
    data = request.get_json()
    mode_name = data.get('name', '').strip().replace(' ', '_')
    selected_positions = data.get('positions', [])
    if not mode_name:
        return jsonify({'status': 'error', 'message': 'Введите название режима'}), 400
    if not selected_positions:
        return jsonify({'status': 'error', 'message': 'Выберите хотя бы одну позицию'}), 400
    if mode_name in modes:
        return jsonify({'status': 'error', 'message': 'Режим с таким именем уже существует'}), 400
    modes[mode_name] = selected_positions
    write_config()
    return jsonify({'status': 'ok', 'message': f'Режим "{mode_name}" сохранён'})

@app.route('/create/remove_subrange', methods=['POST'])
@login_required
def remove_subrange():
    data = request.get_json()
    sub_id = data.get('id')
    if not sub_id:
        return jsonify({'status': 'error', 'message': 'Не указан ID'}), 400

    temp = session.get('temp_subranges', [])
    new_temp = [sub for sub in temp if sub.get('id') != sub_id]
    if len(new_temp) == len(temp):
        return jsonify({'status': 'error', 'message': 'Поддиапазон не найден'}), 404
    session['temp_subranges'] = new_temp
    session.modified = True
    return jsonify({'status': 'ok'})

@app.route('/create/update_subrange', methods=['POST'])
@login_required
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

    hands_set = set(hands)
    for sub in temp:
        if sub.get('id') != sub_id:
            sub['hands'] = [h for h in sub['hands'] if h not in hands_set]

    session.modified = True
    return jsonify({'status': 'ok'})

@app.route('/create/delete_range', methods=['POST'])
@login_required
def delete_range():
    data = request.get_json()
    position = data.get('position', '').strip()
    if not position:
        return jsonify({'status': 'error', 'message': 'Не указана позиция'}), 400

    for subname in list(subranges.keys()):
        if position in subranges[subname]:
            del subranges[subname][position]
            if not subranges[subname]:
                del subranges[subname]
                if subname in subrange_order:
                    subrange_order.remove(subname)
                if subname in subrange_colors:
                    del subrange_colors[subname]

    for mode_name in list(modes.keys()):
        if position in modes[mode_name]:
            modes[mode_name].remove(position)
            if not modes[mode_name]:
                del modes[mode_name]

    if session.get('editing_position') == position:
        session.pop('editing_position', None)

    write_config()
    return jsonify({'status': 'ok', 'message': f'Диапазон "{position}" удалён'})

@app.route('/create/get_positions', methods=['GET'])
@login_required
def get_positions():
    return jsonify({'positions': get_all_positions()})

@app.route('/get_modes', methods=['GET'])
@login_required
def get_modes():
    return jsonify({'modes': modes})

@app.route('/get_mode/<mode_name>', methods=['GET'])
@login_required
def get_mode(mode_name):
    if mode_name not in modes:
        return jsonify({'status': 'error', 'message': 'Режим не найден'}), 404
    return jsonify({'status': 'ok', 'name': mode_name, 'positions': modes[mode_name]})

@app.route('/create_mode/update', methods=['POST'])
@login_required
def update_mode():
    data = request.get_json()
    old_name = data.get('old_name', '').strip()
    new_name = data.get('new_name', '').strip().replace(' ', '_')
    positions = data.get('positions', [])
    if not old_name or not new_name:
        return jsonify({'status': 'error', 'message': 'Не указано имя режима'}), 400
    if old_name not in modes:
        return jsonify({'status': 'error', 'message': 'Режим не найден'}), 404
    if not positions:
        return jsonify({'status': 'error', 'message': 'Выберите хотя бы одну позицию'}), 400
    if old_name != new_name:
        del modes[old_name]
        modes[new_name] = positions
    else:
        modes[old_name] = positions
    write_config()
    return jsonify({'status': 'ok', 'message': f'Режим "{new_name}" обновлён'})

@app.route('/delete_mode/<mode_name>', methods=['POST'])
@login_required
def delete_mode(mode_name):
    if mode_name not in modes:
        return jsonify({'status': 'error', 'message': 'Режим не найден'}), 404
    del modes[mode_name]
    write_config()
    return jsonify({'status': 'ok', 'message': f'Режим "{mode_name}" удалён'})

@app.route('/debug', methods=['GET', 'POST'])
@login_required
def debug():
    all_positions = get_all_positions()
    result = None
    if request.method == 'POST':
        pos = request.form.get('position', '').strip()
        hand = request.form.get('hand', '').strip()
        if not pos or not hand:
            result = {'error': 'Заполните оба поля'}
        elif pos not in all_positions:
            result = {'error': f'Неизвестная позиция: {pos}'}
        elif hand not in ALL_HANDS:
            result = {'error': f'Неизвестная рука: {hand}'}
        else:
            status = get_hand_status(hand, pos)
            correct_text = get_correct_answer_text(status)
            possible_statuses = get_possible_statuses(pos)
            result = {
                'position': pos,
                'hand': hand,
                'status': status,
                'correct_text': correct_text,
                'possible_statuses': possible_statuses
            }
    return render_template('debug.html', result=result, positions=all_positions)

@app.route('/config_management', methods=['GET'])
@login_required
def config_management():
    backups = get_backup_files()
    return render_template('config_management.html', backups=backups)

@app.route('/config_management/save', methods=['POST'])
@login_required
def save_config_backup():
    name = request.form.get('name', '').strip()
    overwrite = request.form.get('overwrite', 'false').lower() == 'true'
    if not name:
        return jsonify({'status': 'error', 'message': 'Введите имя бэкапа'}), 400
    filename = name.replace(' ', '_') + '.py'
    filepath = os.path.join('saved_configs', filename)
    if os.path.exists(filepath) and not overwrite:
        return jsonify({'status': 'exists', 'message': f'Файл {filename} уже существует. Перезаписать?'}), 409
    import shutil
    shutil.copy2('config.py', filepath)
    return jsonify({'status': 'ok', 'message': f'Конфиг сохранён как {filename}'})

@app.route('/config_management/load/<filename>', methods=['POST'])
@login_required
def load_config_backup(filename):
    filepath = os.path.join('saved_configs', filename)
    if not os.path.exists(filepath):
        return jsonify({'status': 'error', 'message': 'Файл не найден'}), 404
    import shutil
    shutil.copy2(filepath, 'config.py')
    reload_config()
    return jsonify({'status': 'ok', 'message': f'Конфиг {filename} загружен'})

@app.route('/config_management/delete/<filename>', methods=['POST'])
@login_required
def delete_config_backup(filename):
    filepath = os.path.join('saved_configs', filename)
    if not os.path.exists(filepath):
        return jsonify({'status': 'error', 'message': 'Файл не найден'}), 404
    os.remove(filepath)
    return jsonify({'status': 'ok', 'message': f'Файл {filename} удалён'})

@app.route('/config_management/clear', methods=['POST'])
@login_required
def clear_config():
    global subranges, subrange_order, modes, subrange_colors
    subranges.clear()
    subrange_order.clear()
    modes.clear()
    subrange_colors.clear()
    write_config()
    reload_config()
    return jsonify({'status': 'ok', 'message': 'Конфиг очищен. Все данные удалены.'})

# ============================================================
#  ЗАПУСК
# ============================================================

if __name__ == '__main__':
    app.run(debug=True)