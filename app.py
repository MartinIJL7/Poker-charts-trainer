# app.py
import json
import logging
import os
import random
import uuid
import glob
from datetime import datetime

from flask import Flask, render_template, request, redirect, url_for, session, jsonify, flash
from flask_login import LoginManager, UserMixin, login_user, logout_user, login_required, current_user
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.orm.attributes import flag_modified
from sqlalchemy.sql import text
from werkzeug.security import generate_password_hash, check_password_hash

# -------------------------------------------------------------------
# Logging setup
# -------------------------------------------------------------------
logging.basicConfig(
    level=logging.WARNING,
    format='%(asctime)s %(levelname)s: %(message)s',
    handlers=[
        logging.FileHandler('app.log'),
        logging.StreamHandler()
    ]
)

# -------------------------------------------------------------------
# Application configuration
# -------------------------------------------------------------------
app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY')
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL', 'sqlite:///users.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'
login_manager.login_message = 'Пожалуйста, войдите, чтобы получить доступ к этой странице'


# -------------------------------------------------------------------
# Database models
# -------------------------------------------------------------------
class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(200), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)


class UserConfig(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), unique=True, nullable=False)
    subranges = db.Column(db.JSON, default=dict)
    subrange_order = db.Column(db.JSON, default=list)
    modes = db.Column(db.JSON, default=dict)
    subrange_colors = db.Column(db.JSON, default=dict)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = db.relationship('User', backref=db.backref('config', uselist=False))


@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))


with app.app_context():
    db.create_all()
    with db.engine.connect() as conn:
        conn.execute(text('PRAGMA journal_mode=WAL;'))


# -------------------------------------------------------------------
# Helper functions
# -------------------------------------------------------------------
def get_user_config(user_id):
    """Get or create a UserConfig for the given user."""
    config = UserConfig.query.filter_by(user_id=user_id).first()
    if not config:
        config = UserConfig(
            user_id=user_id,
            subranges={},
            subrange_order=[],
            modes={},
            subrange_colors={}
        )
        db.session.add(config)
        db.session.commit()
    return config


def ensure_lists_in_subranges(config):
    """Recursively convert any sets inside subranges to lists."""
    for subname, sub_dict in config.subranges.items():
        for pos, hands in sub_dict.items():
            if isinstance(hands, set):
                sub_dict[pos] = list(hands)
            elif not isinstance(hands, list):
                sub_dict[pos] = list(hands)  # fallback


def get_all_positions(config):
    """Return a sorted list of all position names present in the config."""
    positions = set()
    for sub_dict in config.subranges.values():
        positions.update(sub_dict.keys())
    return sorted(positions)


def generate_all_hands():
    """Return a list of all 169 possible poker hands (e.g. 'AKs', '72o')."""
    ranks = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2']
    hands = [f"{r}{r}" for r in ranks]
    for i in range(len(ranks)):
        for j in range(i + 1, len(ranks)):
            hands.append(f"{ranks[i]}{ranks[j]}s")
            hands.append(f"{ranks[i]}{ranks[j]}o")
    return hands


ALL_HANDS = generate_all_hands()


def get_hand_status(hand, pos, config):
    """Return the subrange name (or 'not in a range') for a hand at a position."""
    for subname in config.subrange_order:
        if hand in config.subranges.get(subname, {}).get(pos, []):
            return subname
    return 'not in a range'


def get_correct_answer_text(status):
    """Convert status to the text that should be shown as the correct answer."""
    return 'fold' if status == 'not in a range' else status


def get_possible_statuses(pos, config):
    """Return a sorted list of all statuses (including 'not in a range') for a position."""
    statuses = set()
    for subname in config.subrange_order:
        if config.subranges.get(subname, {}).get(pos, []):
            statuses.add(subname)
    statuses.add('not in a range')
    return sorted(statuses)


def config_to_python_string(config):
    """Export the user config as a Python source code string."""
    def format_dict(d, indent=0, extra_newline_between_keys=False):
        if not d:
            return "{}"
        lines = []
        keys = list(d.keys())
        for idx, key in enumerate(keys):
            value = d[key]
            if isinstance(value, dict):
                val_str = format_dict(value, indent + 4, False)
            elif isinstance(value, list):
                val_str = format_list(value)
            elif isinstance(value, set):
                val_str = format_set(value)
            else:
                val_str = repr(value)
            comma = "," if idx < len(keys) - 1 else ""
            lines.append(" " * (indent + 4) + repr(key) + ": " + val_str + comma)
            if extra_newline_between_keys and idx < len(keys) - 1:
                lines.append("")
        return "{\n" + "\n".join(lines) + "\n" + " " * indent + "}"

    def format_set(s):
        if not s:
            return "set()"
        return "{" + ", ".join(repr(item) for item in sorted(s)) + "}"

    def format_list(lst):
        if not lst:
            return "[]"
        return "[" + ", ".join(repr(item) for item in lst) + "]"

    content = """# config.py – automatically generated from user config
# ============================================================
#  RANGE AND MODE CONFIGURATION
# ============================================================

"""
    content += "subranges = " + format_dict(config.subranges, extra_newline_between_keys=True) + "\n\n"
    content += "subrange_order = " + format_list(config.subrange_order) + "\n\n"
    content += "modes = " + format_dict(config.modes) + "\n\n"
    content += "subrange_colors = " + format_dict(config.subrange_colors) + "\n"
    return content


def get_backup_files(user_id):
    """Return a list of backup filenames belonging to the user."""
    prefix = f'user_{user_id}_'
    files = glob.glob(os.path.join('saved_configs', prefix + '*.py'))
    return sorted([os.path.basename(f) for f in files])


def get_public_backup_files():
    """Return a list of public backup filenames (without user_ prefix)."""
    files = glob.glob(os.path.join('saved_configs', '*.py'))
    public = [os.path.basename(f) for f in files if not os.path.basename(f).startswith('user_')]
    return sorted(public)


# -------------------------------------------------------------------
# Authentication routes
# -------------------------------------------------------------------
@app.route('/register', methods=['GET', 'POST'])
def register():
    if current_user.is_authenticated:
        return redirect(url_for('index'))

    if request.method == 'POST':
        username = request.form.get('username', '').strip()
        password = request.form.get('password', '').strip()
        if not username or not password:
            return render_template('register.html', error='Пожалуйста, заполните все поля')
        if User.query.filter_by(username=username).first():
            return render_template('register.html', error='Такое имя пользователя уже существует')
        user = User(username=username)
        user.set_password(password)
        db.session.add(user)
        db.session.commit()
        get_user_config(user.id)
        flash('Успешная регистрация! Пожалуйста, войдите', 'success')
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
            flash(f'Добро пожаловать, {username}!', 'success')
            next_page = request.args.get('next')
            return redirect(next_page or url_for('index'))
        return render_template('login.html', error='Неправильные имя пользователя или пароль')
    return render_template('login.html')


@app.route('/logout')
@login_required
def logout():
    logout_user()
    flash('Вы вышли', 'info')
    return redirect(url_for('login'))


# -------------------------------------------------------------------
# Main pages
# -------------------------------------------------------------------
@app.route('/')
@login_required
def index():
    config = get_user_config(current_user.id)
    if not config.modes:
        return render_template('index.html', modes={}, no_modes=True)
    return render_template('index.html', modes=config.modes, no_modes=False)


@app.route('/reset')
@login_required
def reset_stats():
    session['stats'] = {'total': 0, 'correct': 0, 'wrong': 0}
    session.pop('last_result', None)
    next_url = request.args.get('next')
    return redirect(next_url or url_for('index'))


# -------------------------------------------------------------------
# Training route
# -------------------------------------------------------------------
@app.route('/training/<mode>', methods=['GET', 'POST'])
@login_required
def training(mode):
    config = get_user_config(current_user.id)
    if mode not in config.modes:
        return "Mode not found", 404

    if 'stats' not in session:
        session['stats'] = {'total': 0, 'correct': 0, 'wrong': 0}

    # Handle answer submission
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
        return redirect(url_for('training', mode=mode))

    # Show result if requested
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

    # Generate a new question
    session.pop('last_result', None)
    positions = config.modes[mode]
    if not positions:
        return "No positions in this mode", 400

    pos = random.choice(positions)
    hand = random.choice(ALL_HANDS)
    status = get_hand_status(hand, pos, config)
    correct_text = get_correct_answer_text(status)

    possible_statuses = get_possible_statuses(pos, config)
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


# -------------------------------------------------------------------
# Range management routes
# -------------------------------------------------------------------
@app.route('/create', methods=['GET'])
@login_required
def create_range():
    config = get_user_config(current_user.id)
    positions = get_all_positions(config)
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
        return jsonify({'status': 'error', 'message': 'Name or hands missing'}), 400

    for h in hands:
        if h not in ALL_HANDS:
            return jsonify({'status': 'error', 'message': f'Invalid hand: {h}'}), 400

    if 'temp_subranges' not in session:
        session['temp_subranges'] = []

    # Remove overlapping hands from other subranges
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
    config = get_user_config(current_user.id)
    data = request.get_json()
    position = data.get('position', '').strip().replace(' ', '_')
    if not position:
        return jsonify({'status': 'error', 'message': 'Position name required'}), 400

    temp_subranges = session.get('temp_subranges', [])
    if not temp_subranges:
        return jsonify({'status': 'error', 'message': 'No subranges added'}), 400

    # If editing an existing position, remove its old entries
    editing_pos = session.pop('editing_position', None)
    if editing_pos:
        for subname in list(config.subranges.keys()):
            if editing_pos in config.subranges[subname]:
                del config.subranges[subname][editing_pos]
                if not config.subranges[subname]:
                    del config.subranges[subname]

        # Update position name in modes if changed
        if editing_pos != position:
            for mode_name, positions in config.modes.items():
                if editing_pos in positions:
                    idx = positions.index(editing_pos)
                    positions[idx] = position
            flag_modified(config, 'modes')

    # Save each subrange
    for sub in temp_subranges:
        name = sub['name']
        hands = sub['hands']  # already a list

        if name not in config.subranges:
            config.subranges[name] = {}
        config.subranges[name][position] = hands

        if name not in config.subrange_order:
            config.subrange_order.append(name)

        color = sub.get('color', '#3498db')
        config.subrange_colors[name] = color

    # Update 'All' mode
    all_positions = get_all_positions(config)
    if all_positions:
        config.modes['All'] = all_positions
    else:
        config.modes.pop('All', None)

    ensure_lists_in_subranges(config)

    flag_modified(config, 'subranges')
    flag_modified(config, 'subrange_order')
    flag_modified(config, 'modes')
    flag_modified(config, 'subrange_colors')

    db.session.commit()
    session.pop('editing_position', None)
    return jsonify({'status': 'ok', 'message': f'Диапазон {position} сохранен'})


@app.route('/create/clear_temp', methods=['POST'])
@login_required
def clear_temp():
    session.pop('temp_subranges', None)
    return jsonify({'status': 'ok'})


@app.route('/create/reset', methods=['POST'])
@login_required
def reset_editor():
    session.pop('temp_subranges', None)
    session.pop('editing_position', None)
    return jsonify({'status': 'ok'})


@app.route('/create/get_temp', methods=['GET'])
@login_required
def get_temp_subranges():
    return jsonify({'subranges': session.get('temp_subranges', [])})


@app.route('/create/load_range', methods=['POST'])
@login_required
def load_range():
    config = get_user_config(current_user.id)
    data = request.get_json()
    position = data.get('position', '').strip()
    if not position:
        return jsonify({'status': 'Ошибка', 'message': 'Требуется диапазон'}), 400

    loaded = []
    for subname, sub_dict in config.subranges.items():
        if position in sub_dict:
            hands = list(sub_dict[position])
            color = config.subrange_colors.get(subname, '#3498db')
            loaded.append({
                'name': subname,
                'hands': hands,
                'color': color
            })

    if not loaded:
        return jsonify({'status': 'Ошибка', 'message': 'Диапазон не найден'}), 404

    temp = []
    for sub in loaded:
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


@app.route('/create/remove_subrange', methods=['POST'])
@login_required
def remove_subrange():
    data = request.get_json()
    sub_id = data.get('id')
    if not sub_id:
        return jsonify({'status': 'error', 'message': 'ID required'}), 400

    temp = session.get('temp_subranges', [])
    new_temp = [sub for sub in temp if sub.get('id') != sub_id]
    if len(new_temp) == len(temp):
        return jsonify({'status': 'error', 'message': 'Subrange not found'}), 404
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
        return jsonify({'status': 'error', 'message': 'ID required'}), 400
    if not name:
        return jsonify({'status': 'error', 'message': 'Name required'}), 400
    if not hands:
        return jsonify({'status': 'error', 'message': 'At least one hand required'}), 400

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
        return jsonify({'status': 'error', 'message': 'Subrange not found'}), 404

    # Remove overlapping hands from other subranges
    hands_set = set(hands)
    for sub in temp:
        if sub.get('id') != sub_id:
            sub['hands'] = [h for h in sub['hands'] if h not in hands_set]

    session.modified = True
    return jsonify({'status': 'ok'})


@app.route('/create/delete_range', methods=['POST'])
@login_required
def delete_range():
    config = get_user_config(current_user.id)
    data = request.get_json()
    position = data.get('position', '').strip()
    if not position:
        return jsonify({'status': 'error', 'message': 'Position required'}), 400

    # Remove from all subranges
    for subname in list(config.subranges.keys()):
        if position in config.subranges[subname]:
            del config.subranges[subname][position]
            if not config.subranges[subname]:
                del config.subranges[subname]
                if subname in config.subrange_order:
                    config.subrange_order.remove(subname)
                if subname in config.subrange_colors:
                    del config.subrange_colors[subname]

    # Remove from modes
    for mode_name in list(config.modes.keys()):
        if position in config.modes[mode_name]:
            config.modes[mode_name].remove(position)
            if not config.modes[mode_name]:
                del config.modes[mode_name]

    if session.get('editing_position') == position:
        session.pop('editing_position', None)

    ensure_lists_in_subranges(config)
    flag_modified(config, 'subranges')
    flag_modified(config, 'subrange_order')
    flag_modified(config, 'modes')
    flag_modified(config, 'subrange_colors')

    db.session.commit()
    return jsonify({'status': 'ok', 'message': f'Диапазон "{position}" удален'})


@app.route('/create/get_positions', methods=['GET'])
@login_required
def get_positions():
    config = get_user_config(current_user.id)
    return jsonify({'positions': get_all_positions(config)})


# -------------------------------------------------------------------
# Mode management routes
# -------------------------------------------------------------------
@app.route('/create_mode', methods=['GET'])
@login_required
def create_mode():
    config = get_user_config(current_user.id)
    positions = get_all_positions(config)
    return render_template('create_mode.html', positions=positions, modes=config.modes)


@app.route('/create_mode/save', methods=['POST'])
@login_required
def save_mode():
    config = get_user_config(current_user.id)
    data = request.get_json()
    mode_name = data.get('name', '').strip().replace(' ', '_')
    selected_positions = data.get('positions', [])

    if not mode_name:
        return jsonify({'status': 'error', 'message': 'Mode name required'}), 400
    if not selected_positions:
        return jsonify({'status': 'error', 'message': 'Select at least one position'}), 400
    if mode_name in config.modes:
        return jsonify({'status': 'error', 'message': f'Mode "{mode_name}" already exists'}), 400

    config.modes[mode_name] = selected_positions
    flag_modified(config, 'modes')
    db.session.commit()
    return jsonify({'status': 'ok', 'message': f'Режим "{mode_name}" сохранен'})


@app.route('/get_modes', methods=['GET'])
@login_required
def get_modes():
    config = get_user_config(current_user.id)
    return jsonify({'modes': config.modes})


@app.route('/get_mode/<mode_name>', methods=['GET'])
@login_required
def get_mode(mode_name):
    config = get_user_config(current_user.id)
    if mode_name not in config.modes:
        return jsonify({'status': 'error', 'message': 'Mode not found'}), 404
    return jsonify({'status': 'ok', 'name': mode_name, 'positions': config.modes[mode_name]})


@app.route('/create_mode/update', methods=['POST'])
@login_required
def update_mode():
    config = get_user_config(current_user.id)
    data = request.get_json()
    old_name = data.get('old_name', '').strip()
    new_name = data.get('new_name', '').strip().replace(' ', '_')
    positions = data.get('positions', [])

    if not old_name or not new_name:
        return jsonify({'status': 'error', 'message': 'Mode name missing'}), 400
    if old_name not in config.modes:
        return jsonify({'status': 'error', 'message': 'Mode not found'}), 404
    if not positions:
        return jsonify({'status': 'error', 'message': 'Select at least one position'}), 400

    if old_name != new_name:
        del config.modes[old_name]
        config.modes[new_name] = positions
    else:
        config.modes[old_name] = positions

    flag_modified(config, 'modes')
    db.session.commit()
    return jsonify({'status': 'ok', 'message': f'Mode "{new_name}" updated'})


@app.route('/delete_mode/<mode_name>', methods=['POST'])
@login_required
def delete_mode(mode_name):
    config = get_user_config(current_user.id)
    if mode_name not in config.modes:
        return jsonify({'status': 'error', 'message': 'Mode not found'}), 404
    del config.modes[mode_name]
    flag_modified(config, 'modes')
    db.session.commit()
    return jsonify({'status': 'ok', 'message': f'Режим "{mode_name}" удален'})


# -------------------------------------------------------------------
# Debug route
# -------------------------------------------------------------------
@app.route('/debug', methods=['GET', 'POST'])
@login_required
def debug():
    config = get_user_config(current_user.id)
    all_positions = get_all_positions(config)
    result = None

    if request.method == 'POST':
        pos = request.form.get('position', '').strip()
        hand = request.form.get('hand', '').strip()
        if not pos or not hand:
            result = {'error': 'Нужно заполнить оба поля'}
        elif pos not in all_positions:
            result = {'error': f'Неизвестный диапазон: {pos}'}
        elif hand not in ALL_HANDS:
            result = {'error': f'Неизвестная рука: {hand}'}
        else:
            status = get_hand_status(hand, pos, config)
            correct_text = get_correct_answer_text(status)
            possible_statuses = get_possible_statuses(pos, config)
            result = {
                'position': pos,
                'hand': hand,
                'status': status,
                'correct_text': correct_text,
                'possible_statuses': possible_statuses
            }

    return render_template('debug.html', result=result, positions=all_positions)


# -------------------------------------------------------------------
# Configuration backup management
# -------------------------------------------------------------------
@app.route('/config_management', methods=['GET'])
@login_required
def config_management():
    personal = get_backup_files(current_user.id)
    public = get_public_backup_files()
    return render_template('config_management.html',
                           personal_backups=personal,
                           public_backups=public)


@app.route('/config_management/save', methods=['POST'])
@login_required
def save_config_backup():
    name = request.form.get('name', '').strip()
    overwrite = request.form.get('overwrite', 'false').lower() == 'true'
    if not name:
        return jsonify({'status': 'error', 'message': 'Backup name required'}), 400

    filename = f'user_{current_user.id}_{name.replace(" ", "_")}.py'
    filepath = os.path.join('saved_configs', filename)

    if os.path.exists(filepath) and not overwrite:
        return jsonify({'status': 'exists', 'message': f'File {filename} already exists. Overwrite?'}), 409

    config = get_user_config(current_user.id)
    content = config_to_python_string(config)
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    return jsonify({'status': 'ok', 'message': f'Конфиг сохранен как "{filename}"'})


@app.route('/config_management/load/<filename>', methods=['POST'])
@login_required
def load_config_backup(filename):
    filepath = os.path.join('saved_configs', filename)
    if not os.path.exists(filepath):
        return jsonify({'status': 'error', 'message': 'File not found'}), 404

    # Prevent loading another user's private config
    if filename.startswith('user_') and not filename.startswith(f'user_{current_user.id}_'):
        return jsonify({'status': 'error', 'message': 'Access denied'}), 403

    with open(filepath, 'r', encoding='utf-8') as f:
        code = f.read()

    namespace = {}
    try:
        exec(code, namespace)
    except Exception as e:
        return jsonify({'status': 'error', 'message': f'Load error: {str(e)}'}), 400

    config = get_user_config(current_user.id)
    config.subranges = namespace.get('subranges', {})
    config.subrange_order = namespace.get('subrange_order', [])
    config.modes = namespace.get('modes', {})
    config.subrange_colors = namespace.get('subrange_colors', {})

    ensure_lists_in_subranges(config)

    flag_modified(config, 'subranges')
    flag_modified(config, 'subrange_order')
    flag_modified(config, 'modes')
    flag_modified(config, 'subrange_colors')
    db.session.commit()

    return jsonify({'status': 'ok', 'message': f'Конфиг "{filename}" загружен'})


@app.route('/config_management/delete/<filename>', methods=['POST'])
@login_required
def delete_config_backup(filename):
    if not filename.startswith('user_'):
        return jsonify({'status': 'error', 'message': 'Public configs cannot be deleted'}), 403
    if not filename.startswith(f'user_{current_user.id}_'):
        return jsonify({'status': 'error', 'message': 'Access denied'}), 403

    filepath = os.path.join('saved_configs', filename)
    if not os.path.exists(filepath):
        return jsonify({'status': 'error', 'message': 'File not found'}), 404

    os.remove(filepath)
    return jsonify({'status': 'ok', 'message': f'Конфиг "{filename}" удален'})


@app.route('/config_management/clear', methods=['POST'])
@login_required
def clear_config():
    config = get_user_config(current_user.id)
    config.subranges = {}
    config.subrange_order = []
    config.modes = {}
    config.subrange_colors = {}
    flag_modified(config, 'subranges')
    flag_modified(config, 'subrange_order')
    flag_modified(config, 'modes')
    flag_modified(config, 'subrange_colors')
    db.session.commit()
    return jsonify({'status': 'ok', 'message': 'Конфиг успешно очищен'})


# -------------------------------------------------------------------
# Application entry point
# -------------------------------------------------------------------
if __name__ == '__main__':
    app.run(debug=False)