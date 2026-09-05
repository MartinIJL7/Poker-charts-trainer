# app.py
import json
import logging
import os
import random
import uuid
import glob
from datetime import datetime
from flask import abort

from flask import Flask, render_template, request, redirect, url_for, session, jsonify, flash
from flask import current_app
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

class HandStats(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    position = db.Column(db.String(50), nullable=False)
    hand = db.Column(db.String(10), nullable=False)
    attempts = db.Column(db.Integer, default=0)
    errors = db.Column(db.Integer, default=0)
    total_time_ms = db.Column(db.Integer, default=0)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_results = db.Column(db.JSON, default=list)
    review_interval_days = db.Column(db.Integer, default=0)   # 0 = not in interval mode, >0 = learned, waiting for review
    penalty_active = db.Column(db.Boolean, default=False)     # penalty bonus after mistake on a learned hand
    # NEW: store up to 3 most recent response times (milliseconds)
    last_times = db.Column(db.JSON, default=list)

    __table_args__ = (db.UniqueConstraint('user_id', 'position', 'hand', name='_user_pos_hand_uc'),)

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
@app.context_processor
def utility_processor():
    def static_version(filename):
        filepath = os.path.join(app.static_folder, filename)
        if os.path.exists(filepath):
            return int(os.path.getmtime(filepath))
        return ''
    return dict(static_version=static_version)

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

def get_or_create_hand_stats(user_id, position, hand):
    """Return HandStats record, create if missing."""
    stats = HandStats.query.filter_by(user_id=user_id, position=position, hand=hand).first()
    if not stats:
        stats = HandStats(user_id=user_id, position=position, hand=hand)
        db.session.add(stats)
        db.session.commit()
    return stats

FIBONACCI = [1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377]   # days

def next_fibonacci(current):
    """Return the next Fibonacci number after current, or last if current is at max."""
    for i, val in enumerate(FIBONACCI):
        if val == current:
            return FIBONACCI[i + 1] if i + 1 < len(FIBONACCI) else FIBONACCI[-1]
    # if not found (shouldn't happen), return first
    return FIBONACCI[0]

def update_hand_stats(user_id, position, hand, is_correct, time_ms):
    stats = get_or_create_hand_stats(user_id, position, hand)
    stats.attempts += 1
    if not is_correct:
        stats.errors += 1
    stats.total_time_ms += time_ms
    stats.last_results.append(1 if is_correct else 0)
    if len(stats.last_results) > 3:
        stats.last_results.pop(0)
    flag_modified(stats, 'last_results')

    stats.last_times.append(time_ms)
    if len(stats.last_times) > 3:
        stats.last_times.pop(0)
    flag_modified(stats, 'last_times')   # required for SQLAlchemy to detect JSON changes

    # --- Learning status check ---
    avg_time_hand = get_avg_hand_time(stats)

    # Calculate current weight for this hand (for additional condition)
    avg_pos_time = get_avg_time_for_position(user_id, position)
    weight = calculate_weight(stats, avg_pos_time)

    # A hand is learned if:
    #   1. It has >=3 attempts, no errors in last 3, and avg time <= 3s
    #   2. OR its weight is <= 0.25 (very light hand, even with fewer attempts)
    is_learned = (
        (stats.attempts >= 3 and
         all(res == 1 for res in stats.last_results) and
         avg_time_hand <= 3000)
        or
        (weight <= 0.25)
    )

    # If hand was in interval mode and now fails learning criteria -> penalty
    if stats.review_interval_days > 0 and not is_learned:
        stats.penalty_active = True
        stats.review_interval_days = 0
    # If hand becomes learned -> start interval mode
    elif is_learned and stats.review_interval_days == 0:
        stats.review_interval_days = 1
        stats.penalty_active = False   # clear any penalty
    # If already in interval mode and correctly answered after scheduled review
    elif is_learned and stats.review_interval_days > 0 and is_correct:
        updated_naive = stats.updated_at.replace(tzinfo=None) if stats.updated_at.tzinfo else stats.updated_at
        days_since = (datetime.utcnow() - updated_naive).days
        if days_since >= stats.review_interval_days:
            # scheduled review – increase interval using Fibonacci
            stats.review_interval_days = next_fibonacci(stats.review_interval_days)
            stats.penalty_active = False
        else:
            # random early show, do not change interval, just clear penalty
            stats.penalty_active = False

    # If incorrect and hand was in interval mode -> penalty + drop from interval
    if not is_correct and stats.review_interval_days > 0:
        stats.penalty_active = True
        stats.review_interval_days = 0

    # Ensure we don't lose the penalty if already set and hand not learned
    if stats.penalty_active and is_learned:
        stats.penalty_active = False

    db.session.commit()

def get_avg_hand_time(stats):
    """
    Return the average response time for a hand.
    Prefers the average of the last 3 attempts if available,
    otherwise falls back to the overall average.
    For hands with zero attempts, returns 1000 ms (default).
    """
    # Safety: handle None from JSON column
    times = stats.last_times or []
    if len(times) >= 3:
        return sum(times) / 3.0
    elif stats.attempts > 0:
        return stats.total_time_ms / stats.attempts
    else:
        return 1000.0   # default for untouched hands

def get_avg_time_for_position(user_id, position):
    """Return average response time for the position (average of hand averages).
    Only hands with at least one attempt are included."""
    stats_list = HandStats.query.filter_by(user_id=user_id, position=position).all()
    # Filter to hands that have been played at least once
    played = [s for s in stats_list if s.attempts > 0]
    if not played:
        return None
    total = 0.0
    for stats in played:
        total += get_avg_hand_time(stats)
    return total / len(played)

def get_position_learning_status(user_id, position):
    """
    Return learning status for a position.
    Position is learned if ALL hands have review_interval_days > 0
    (i.e., they are either learned or due for review).
    """
    for hand in ALL_HANDS:
        stats = get_or_create_hand_stats(user_id, position, hand)
        if stats.review_interval_days <= 0:
            return {'learned': False}
    return {'learned': True}

def calculate_weight(stats, avg_pos_time):
    if stats.attempts == 0:
        error_score = 0.5
        # Use position average if available, otherwise fallback to 1000 ms
        avg_hand_time = avg_pos_time if avg_pos_time is not None else 1000
    else:
        error_score = stats.errors / stats.attempts
        # Use the new sliding average (last 3 or overall)
        avg_hand_time = get_avg_hand_time(stats)

    if avg_pos_time is not None and avg_pos_time > 0:
        speed_ratio = avg_hand_time / avg_pos_time
    else:
        speed_ratio = 1.0

    if speed_ratio <= 0.5:
        speed_score = 0.0
    elif speed_ratio >= 2.0:
        speed_score = 1.0
    else:
        speed_score = (speed_ratio - 0.5) / 1.5

    weight = error_score + speed_score
    weight = max(0.1, min(2.0, weight))   # base weight clamped

    # Penalty bonus
    if stats.penalty_active:
        weight = min(2.0, weight + 1.2)

    # Interval review bonus (max out weight if review is due)
    if stats.review_interval_days > 0:
        updated_naive = stats.updated_at.replace(tzinfo=None) if stats.updated_at.tzinfo else stats.updated_at
        days_since = (datetime.utcnow() - updated_naive).days
        if days_since >= stats.review_interval_days:
            weight = 2.0

    return weight

def select_weighted_hand(user_id, position):
    """Select a hand using weighted random choice based on difficulty."""
    avg_pos_time = get_avg_time_for_position(user_id, position)
    hands = []
    weights = []
    for hand in ALL_HANDS:
        stats = get_or_create_hand_stats(user_id, position, hand)
        w = calculate_weight(stats, avg_pos_time)
        hands.append(hand)
        weights.append(w)

    total_weight = sum(weights)
    if total_weight <= 0:
        return random.choice(ALL_HANDS)

    r = random.random() * total_weight
    cum = 0.0
    for i, w in enumerate(weights):
        cum += w
        if cum >= r:
            return hands[i]
    return hands[-1]

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
    session.pop('training_started', None)   # reset start flag
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

    # ---- POST: answer submission ----
    if request.method == 'POST':
        # --- Get client-side measured time ---
        # The browser sends response_time_ms in the POST data (if available)
        elapsed_ms = request.form.get('response_time_ms', type=int)
        
        # Fallback for older clients or direct API calls (server-side measurement)
        if elapsed_ms is None:
            start_time = session.pop('question_start_time', None)
            if start_time:
                elapsed_ms = int((datetime.utcnow().timestamp() - start_time) * 1000)
            else:
                elapsed_ms = 0
        
        # Use elapsed_ms for statistics update later

        answer = request.form.get('answer', '').strip().lower()
        pos = session.get('pos')
        hand = session.get('hand')
        status = session.get('status')
        correct_text = session.get('correct_text')

        if pos and hand and status:
            stats = session['stats']
            stats['total'] += 1
            is_correct = (answer == correct_text.lower())
            if is_correct:
                stats['correct'] += 1
            else:
                stats['wrong'] += 1
            session['stats'] = stats

            # Get stats before update to detect penalty change
            stats_before = get_or_create_hand_stats(current_user.id, pos, hand)
            old_penalty = stats_before.penalty_active

            # Update persistent hand statistics
            update_hand_stats(current_user.id, pos, hand, is_correct, elapsed_ms)

            # Get updated stats
            stats = get_or_create_hand_stats(current_user.id, pos, hand)
            just_became_penalty = (not old_penalty and stats.penalty_active)

            attempts = stats.attempts
            errors = stats.errors
            correct_count = attempts - errors
            avg_time_sec = round(get_avg_hand_time(stats) / 1000, 2) if attempts > 0 else 0
            current_time_sec = round(elapsed_ms / 1000, 2)

            avg_pos_time = get_avg_time_for_position(current_user.id, pos)
            weight = calculate_weight(stats, avg_pos_time) if avg_pos_time is not None else 0
            weight = round(weight, 2)

            # Compute hand status fields
            review_interval_days = stats.review_interval_days
            penalty_active = stats.penalty_active
            days_since = (datetime.utcnow() - stats.updated_at).days if stats.updated_at else 0
            is_due = (review_interval_days > 0 and not penalty_active and days_since >= review_interval_days)
            errors_last_3 = sum(1 for res in stats.last_results if res == 0)
            last_results_display = ' '.join('✔' if res == 1 else '✘' for res in stats.last_results)
            last_times_display = ', '.join(f'{t/1000:.2f}' for t in stats.last_times) if stats.last_times else ''

            session['last_result'] = {
                'weight': weight,
                'user_answer': answer,
                'correct_answer': correct_text,
                'was_correct': is_correct,
                'hand': hand,
                'pos': pos,
                'attempts': attempts,
                'errors': errors,
                'correct_count': correct_count,
                'avg_time_sec': avg_time_sec,
                'current_time_sec': current_time_sec,
                'just_became_penalty': just_became_penalty,
                'review_interval_days': review_interval_days,
                'penalty_active': penalty_active,
                'days_since_last_shown': days_since,
                'is_due_for_review': is_due,
                'errors_last_3': errors_last_3,
                'last_results_display': last_results_display,
                'last_times_display': last_times_display,
            }
            return redirect(url_for('training', mode=mode, show_result=1))
        return redirect(url_for('training', mode=mode))

    # ---- GET: show result or new question ----
    
    # If user wants to reset start screen (from heatmap, etc.)
    if request.args.get('reset_start') == '1':
        session.pop('training_started', None)
        return redirect(url_for('training', mode=mode))

    # If user clicked "Start", set flag and redirect
    if request.args.get('start') == '1':
        session['training_started'] = True
        return redirect(url_for('training', mode=mode))

    # If training not started yet, show start screen
    if not session.get('training_started', False):
        stats = session['stats']
        return render_template('training.html', mode=mode, show_start=True, stats=stats)
    
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
    hand = select_weighted_hand(current_user.id, pos)   # <-- adaptive selection
    status = get_hand_status(hand, pos, config)
    correct_text = get_correct_answer_text(status)

    possible_statuses = get_possible_statuses(pos, config)
    possible_answers = sorted(set(
        get_correct_answer_text(st) for st in possible_statuses if get_correct_answer_text(st)
    ))

    # Store question start time for response time measurement
    session['question_start_time'] = datetime.utcnow().timestamp()
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


@app.route('/api/range/<position>', methods=['GET'])
@login_required
def api_get_range(position):
    config = get_user_config(current_user.id)
    all_positions = get_all_positions(config)
    if position not in all_positions:
        return jsonify({'status': 'error', 'message': 'Position not found'}), 404

    subranges = {}
    colors = {}
    for subname, sub_dict in config.subranges.items():
        if position in sub_dict:
            subranges[subname] = list(sub_dict[position])
            colors[subname] = config.subrange_colors.get(subname, '#3498db')

    return jsonify({'status': 'ok', 'subranges': subranges, 'colors': colors})


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
    overwrite = data.get('overwrite', False)

    if not name or not hands:
        return jsonify({'status': 'error', 'message': 'Name or hands missing'}), 400

    for h in hands:
        if h not in ALL_HANDS:
            return jsonify({'status': 'error', 'message': f'Invalid hand: {h}'}), 400

    temp = session.get('temp_subranges', [])

    existing = None
    for sub in temp:
        if sub['name'].lower() == name.lower():
            existing = sub
            break

    if existing and not overwrite:
        return jsonify({
            'status': 'exists',
            'message': f'Поддиапазон "{name}" уже существует. Перезаписать?'
        }), 409

    if existing and overwrite:
        temp = [sub for sub in temp if sub['name'].lower() != name.lower()]

    hands_set = set(hands)
    for sub in temp:
        sub['hands'] = [h for h in sub['hands'] if h not in hands_set]

    new_id = str(uuid.uuid4())
    temp.append({
        'id': new_id,
        'name': name,
        'hands': hands,
        'color': color
    })
    session['temp_subranges'] = temp
    session.modified = True
    return jsonify({'status': 'ok', 'subranges': session['temp_subranges']})


@app.route('/create/save_range', methods=['POST'])
@login_required
def save_range():
    config = get_user_config(current_user.id)
    data = request.get_json()
    position = data.get('position', '').strip().replace(' ', '_')
    overwrite = data.get('overwrite', False)
    if not position:
        return jsonify({'status': 'error', 'message': 'Position name required'}), 400

    temp_subranges = session.get('temp_subranges', [])
    if not temp_subranges:
        return jsonify({'status': 'error', 'message': 'No subranges added'}), 400

    editing_pos = session.get('editing_position')
    existing_positions = get_all_positions(config)

    if position in existing_positions and editing_pos != position and not overwrite:
        return jsonify({
            'status': 'exists',
            'message': f'Диапазон "{position}" уже существует. Перезаписать?'
        }), 409

    if editing_pos:
        for subname in list(config.subranges.keys()):
            if editing_pos in config.subranges[subname]:
                del config.subranges[subname][editing_pos]
                if not config.subranges[subname]:
                    del config.subranges[subname]
        if editing_pos != position:
            for mode_name, positions in config.modes.items():
                if editing_pos in positions:
                    idx = positions.index(editing_pos)
                    positions[idx] = position
            flag_modified(config, 'modes')
        session.pop('editing_position', None)
    elif overwrite and position in existing_positions:
        for subname in list(config.subranges.keys()):
            if position in config.subranges[subname]:
                del config.subranges[subname][position]
                if not config.subranges[subname]:
                    del config.subranges[subname]
        for mode_name in list(config.modes.keys()):
            if position in config.modes[mode_name]:
                config.modes[mode_name].remove(position)
                if not config.modes[mode_name]:
                    del config.modes[mode_name]
        flag_modified(config, 'modes')

    for sub in temp_subranges:
        name = sub['name']
        hands = sub['hands']
        if name not in config.subranges:
            config.subranges[name] = {}
        config.subranges[name][position] = hands
        if name not in config.subrange_order:
            config.subrange_order.append(name)
        config.subrange_colors[name] = sub.get('color', '#3498db')

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
    overwrite = data.get('overwrite', False)

    if not sub_id:
        return jsonify({'status': 'error', 'message': 'ID required'}), 400
    if not name:
        return jsonify({'status': 'error', 'message': 'Name required'}), 400
    if not hands:
        return jsonify({'status': 'error', 'message': 'At least one hand required'}), 400

    temp = session.get('temp_subranges', [])
    found = None
    existing = None
    for sub in temp:
        if sub['id'] == sub_id:
            found = sub
        if sub['name'].lower() == name.lower() and sub['id'] != sub_id:
            existing = sub

    if existing and not overwrite:
        return jsonify({
            'status': 'exists',
            'message': f'Поддиапазон с именем "{name}" уже существует. Перезаписать?'
        }), 409

    if not found:
        return jsonify({'status': 'error', 'message': 'Subrange not found'}), 404

    if existing and overwrite:
        temp = [sub for sub in temp if sub['id'] != existing['id']]

    found['name'] = name
    found['hands'] = hands
    found['color'] = color

    hands_set = set(hands)
    for sub in temp:
        if sub['id'] != sub_id:
            sub['hands'] = [h for h in sub['hands'] if h not in hands_set]

    session['temp_subranges'] = temp
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
    if current_user.username != 'MartinIJL':
        abort(403)
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
# Drawing mode
# -------------------------------------------------------------------
@app.route('/draw_training/<mode>', methods=['GET', 'POST'])
@login_required
def draw_training(mode):
    config = get_user_config(current_user.id)
    if mode not in config.modes:
        return "Mode not found", 404

    if 'draw_stats' not in session:
        session['draw_stats'] = {'total': 0, 'correct': 0, 'wrong': 0}

    if request.method == 'POST':
        data = request.get_json()
        user_subranges = data.get('subranges', [])
        expected_serialized = session.get('draw_expected')
        position = session.get('draw_position')
        if not expected_serialized or not position:
            return jsonify({'status': 'error', 'message': 'Сессия истекла, начните заново'}), 400

        expected = {name: set(hands) for name, hands in expected_serialized.items()}

        user_dict = {}
        for sub in user_subranges:
            name = sub.get('name', '').strip()
            hands = set(sub.get('hands', []))
            if name and hands:
                if name in user_dict:
                    user_dict[name].update(hands)
                else:
                    user_dict[name] = hands

        missing = []
        extra_hands = []
        wrong_names = []

        for exp_name, exp_hands in expected.items():
            if exp_name not in user_dict:
                missing.append({'name': exp_name, 'hands': list(exp_hands)})
            else:
                user_hands = user_dict[exp_name]
                miss = exp_hands - user_hands
                if miss:
                    missing.append({'name': exp_name, 'hands': list(miss)})
                extra = user_hands - exp_hands
                if extra:
                    extra_hands.append({'name': exp_name, 'hands': list(extra)})

        for user_name in user_dict.keys():
            if user_name not in expected:
                wrong_names.append(user_name)

        stats = session['draw_stats']
        stats['total'] += 1
        if not missing and not extra_hands and not wrong_names:
            stats['correct'] += 1
        else:
            stats['wrong'] += 1
        session['draw_stats'] = stats

        expected_hands = [{'name': name, 'hands': list(hands)} for name, hands in expected.items()]
        return jsonify({
            'status': 'ok',
            'missing': missing,
            'extra_hands': extra_hands,
            'wrong_names': wrong_names,
            'position': position,
            'mode': mode,
            'stats': stats,
            'expected_hands': expected_hands
        })

    # ---- GET ----
    positions = config.modes[mode]
    if not positions:
        return "No positions in this mode", 400

    queue_key = f'draw_queue_{mode}'
    if queue_key not in session or not session[queue_key]:
        shuffled = positions[:]
        random.shuffle(shuffled)
        session[queue_key] = shuffled

    pos = session[queue_key].pop(0)
    if not session[queue_key]:
        del session[queue_key]

    session['draw_position'] = pos

    expected = {}
    for subname, sub_dict in config.subranges.items():
        if pos in sub_dict:
            expected[subname] = list(sub_dict[pos])

    session['draw_expected'] = expected

    initial_subranges = []
    for subname in expected.keys():
        color = config.subrange_colors.get(subname, '#3498db')
        initial_subranges.append({
            'id': str(uuid.uuid4()),
            'name': subname,
            'hands': [],
            'color': color
        })

    return render_template(
        'draw_training.html',
        mode=mode,
        position=pos,
        stats=session['draw_stats'],
        initial_subranges=initial_subranges
    )


@app.route('/reset_draw_stats')
@login_required
def reset_draw_stats():
    session['draw_stats'] = {'total': 0, 'correct': 0, 'wrong': 0}
    next_url = request.args.get('next')
    return redirect(next_url or url_for('index'))


# -------------------------------------------------------------------
# Heatmap
# -------------------------------------------------------------------
@app.route('/heatmap/<mode>')
@login_required
def heatmap(mode):
    config = get_user_config(current_user.id)
    if mode not in config.modes:
        return "Mode not found", 404
    positions = config.modes[mode]
    if not positions:
        return "No positions in this mode", 400
    return render_template('heatmap.html', mode=mode, positions=positions)


@app.route('/api/heatmap/<mode>/<position>')
@login_required
def api_heatmap(mode, position):
    config = get_user_config(current_user.id)
    if mode not in config.modes or position not in config.modes[mode]:
        return jsonify({'error': 'Invalid mode or position'}), 400

    avg_pos_time = get_avg_time_for_position(current_user.id, position)
    weights = {}
    for hand in ALL_HANDS:
        stats = get_or_create_hand_stats(current_user.id, position, hand)
        subrange = get_hand_status(hand, position, config)
        w = calculate_weight(stats, avg_pos_time)
        avg_time = round(get_avg_hand_time(stats) / 1000, 2) if stats.attempts > 0 else None
        errors_last_3 = sum(1 for res in stats.last_results if res == 0)
        last_results_display = ' '.join('✔' if res == 1 else '✘' for res in stats.last_results)
        last_times_display = ', '.join(f'{t/1000:.2f}' for t in stats.last_times) if stats.last_times else ''
        subrange = get_hand_status(hand, position, config)
        subrange_color = config.subrange_colors.get(subrange, '#d5d8dc')
        if stats.updated_at:
            updated_naive = stats.updated_at.replace(tzinfo=None) if stats.updated_at.tzinfo else stats.updated_at
            days_since = (datetime.utcnow() - updated_naive).days
        else:
            days_since = 0
        is_due = (stats.review_interval_days > 0 and not stats.penalty_active and days_since >= stats.review_interval_days)

        weights[hand] = {
            'weight': w,
            'attempts': stats.attempts,
            'errors': stats.errors,
            'correct': stats.attempts - stats.errors,
            'avg_time_sec': avg_time,
            'review_interval_days': stats.review_interval_days,
            'penalty_active': stats.penalty_active,
            'days_since_last_shown': days_since,
            'is_due_for_review': is_due,
            'errors_last_3': errors_last_3,
            'last_results_display': last_results_display,
            'last_times_display': last_times_display,
            'subrange': subrange,
            'subrange_color': subrange_color,
        }
    status = get_position_learning_status(current_user.id, position)

    # Calculate total time spent on this position (all hands)
    total_time_ms = db.session.query(db.func.sum(HandStats.total_time_ms))\
        .filter(HandStats.user_id == current_user.id, HandStats.position == position)\
        .scalar() or 0
    total_time_sec = total_time_ms / 1000

    return jsonify({
        'position': position,
        'weights': weights,
        'avg_time': avg_pos_time,
        'learned': status['learned'],
        'total_time_sec': round(total_time_sec, 0)
    })


# -------------------------------------------------------------------
# Stats
# -------------------------------------------------------------------
@app.route('/all_stats')
@login_required
def all_stats():
    """Page showing heatmap for all positions (no mode)."""
    config = get_user_config(current_user.id)
    positions = get_all_positions(config)
    return render_template('all_stats.html', positions=positions)


@app.route('/api/all_heatmap/<position>')
@login_required
def api_all_heatmap(position):
    """API endpoint for heatmap data for a specific position (no mode)."""
    config = get_user_config(current_user.id)
    if position not in get_all_positions(config):
        return jsonify({'error': 'Position not found'}), 400

    avg_pos_time = get_avg_time_for_position(current_user.id, position)
    weights = {}
    for hand in ALL_HANDS:
        stats = get_or_create_hand_stats(current_user.id, position, hand)
        subrange = get_hand_status(hand, position, config)
        w = calculate_weight(stats, avg_pos_time)
        avg_time = round(get_avg_hand_time(stats) / 1000, 2) if stats.attempts > 0 else None
        errors_last_3 = sum(1 for res in stats.last_results if res == 0)
        last_results_display = ' '.join('✔' if res == 1 else '✘' for res in stats.last_results)
        last_times_display = ', '.join(f'{t/1000:.2f}' for t in stats.last_times) if stats.last_times else ''
        subrange = get_hand_status(hand, position, config)
        subrange_color = config.subrange_colors.get(subrange, '#d5d8dc')
        if stats.updated_at:
            updated_naive = stats.updated_at.replace(tzinfo=None) if stats.updated_at.tzinfo else stats.updated_at
            days_since = (datetime.utcnow() - updated_naive).days
        else:
            days_since = 0
        is_due = (stats.review_interval_days > 0 and not stats.penalty_active and days_since >= stats.review_interval_days)

        weights[hand] = {
            'weight': w,
            'attempts': stats.attempts,
            'errors': stats.errors,
            'correct': stats.attempts - stats.errors,
            'avg_time_sec': avg_time,
            'review_interval_days': stats.review_interval_days,
            'penalty_active': stats.penalty_active,
            'days_since_last_shown': days_since,
            'is_due_for_review': is_due,
            'errors_last_3': errors_last_3,
            'last_results_display': last_results_display,
            'last_times_display': last_times_display,
            'subrange': subrange,
            'subrange_color': subrange_color,
        }
    status = get_position_learning_status(current_user.id, position)

    # Calculate total time spent on this position (all hands)
    total_time_ms = db.session.query(db.func.sum(HandStats.total_time_ms))\
        .filter(HandStats.user_id == current_user.id, HandStats.position == position)\
        .scalar() or 0
    total_time_sec = total_time_ms / 1000

    return jsonify({
        'position': position,
        'weights': weights,
        'avg_time': avg_pos_time,
        'learned': status['learned'],
        'total_time_sec': round(total_time_sec, 0)
    })


@app.route('/api/delete_position_stats/<position>', methods=['POST'])
@login_required
def delete_position_stats(position):
    """Delete all HandStats records for the current user and given position."""
    try:
        deleted = HandStats.query.filter_by(user_id=current_user.id, position=position).delete()
        db.session.commit()
        return jsonify({'status': 'ok', 'message': f'Удалено {deleted} записей для позиции "{position}"'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'status': 'error', 'message': str(e)}), 500


@app.route('/api/delete_all_stats', methods=['POST'])
@login_required
def delete_all_stats():
    """Delete all HandStats records for the current user."""
    try:
        deleted = HandStats.query.filter_by(user_id=current_user.id).delete()
        db.session.commit()
        return jsonify({'status': 'ok', 'message': f'Удалено {deleted} записей'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'status': 'error', 'message': str(e)}), 500


# -------------------------------------------------------------------
# Application entry point
# -------------------------------------------------------------------
if __name__ == '__main__':
    app.run(debug=False)