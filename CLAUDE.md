# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Flask web app for poker strategy training. Users build hand ranges, train across positions, and track learning progress with spaced repetition intervals.

**Terminology**: in code and DB a "position" is really a *range name* chosen by the user (e.g. `BTN RFI`), not only a seat. `HandStats.position`, `modes` values and the `situations` keys all hold range names. A "subrange" is a named hand group inside a range (it doubles as an answer button in training).

## Tech Stack

- **Backend**: Flask + SQLAlchemy ORM
- **Database**: SQLite (WAL mode, stored in `instance/users.db`; override with `DATABASE_URL`)
- **Frontend**: Vanilla JavaScript (ES modules), HTML, CSS (no framework)
- **Auth**: Flask-Login with password hashing

## Running Locally

```bash
pip install -r requirements.txt
python app.py
```

Runs on `http://localhost:5000` (`debug=False`, so restart after editing `app.py` or a template — Jinja caches templates when debug is off; static files are served from disk). Database and logs created automatically; `app.log` collects WARNING and above and is gitignored.

Set `SECRET_KEY` environment variable for production (sessions won't work without it).

## Database Schema

**User** — username + password hash + `created_at`

**UserConfig** — per-user config (one row per user):
- `subranges`: hand groups (dict of dicts: subrange_name → position → list of hands)
- `subrange_order`: list to maintain subrange creation order (also decides which subrange wins if a hand appears in several)
- `modes`: training modes (dict: mode_name → list of positions)
- `subrange_colors`: color labels for subranges
- `situations`: table situation per position (dict: position → `{num_players, hero_position, seats}`); a missing entry renders the client-side default (6 players, hero BTN) and the training page then shows an empty "no table" view. Included in config backups; old backups without it load fine
- `deck_style`: card artwork on the training table (`default`, `minimal`, `minimal4`; legacy `classic`/`fourcolor` are mapped by `get_deck_style()`)
- `show_timer`: answer timer bar on the training page (`None` = never chosen yet)
- `seen_tables_notice`: the "ranges can have tables" card on the home page was dismissed
- These four display/UI fields (`deck_style`, `show_timer`, `seen_tables_notice`, `updated_at`) are NOT part of config backups (`CONFIG_FIELDS` is only the five range fields above)

**HandStats** — per-hand tracking (unique per `user_id, position, hand`):
- `attempts`, `errors`, `total_time_ms` — cumulative stats
- `last_results`: last 3 pass/fail outcomes (list of 0s and 1s)
- `last_times`: last 3 response times (ms) for rolling average
- `review_interval_days`: spaced repetition interval
  - 0 = not learned
  - >0 = learned, waiting for review
- `penalty_active`: true if hand needs penalty bonus (flagged after failing the learned condition on a learned hand)
- `updated_at`: timestamp of last answer submission (also the reference point for "review due")

**Adding a column**: `db.create_all()` never alters existing tables. New columns on `UserConfig` must also be added to the idempotent `PRAGMA table_info` / `ALTER TABLE` block next to `db.create_all()` in `app.py`, otherwise existing databases break. For other tables write a script in `different_scripts/` (see `migrate_*.py`).

## Learning System (Core Logic)

All of it lives in `app.py`: `update_hand_stats()`, `calculate_weight()`, `get_avg_hand_time()`, `get_avg_time_for_position()`, `select_weighted_hand()`.

**Learned Condition** (either qualifies, evaluated after every answer):
1. **Strict**: ≥3 attempts AND all last 3 results correct AND avg time ≤ 3000ms
2. **Weight-based**: weight_for_learning ≤ 0.25 AND current answer is correct

**Average time of a hand**: mean of `last_times` once it holds 3 values, otherwise `total_time_ms / attempts`, 1000ms for untouched hands. Position average = mean of hand averages over hands with ≥1 attempt.

Weight calculation in `calculate_weight()`:
- Error score: `errors / attempts` (0.5 for a hand never shown)
- Speed score: hand avg time / position avg time; ratio ≤0.5 → 0, ≥2.0 → 1, linear in between
- Base weight = error score + speed score, clamped to 0.1–2.0
- If penalty_active: add 1.2 (capped at 2.0)
- If review due (`review_interval_days > 0` and days since `updated_at` ≥ interval): set to 2.0. Skipped with `for_learning=True`, so a due hand can still count as learned
- `select_weighted_hand()` picks a random hand of the position proportionally to weight

**After every answer** (`update_hand_stats()`), using the learned condition above:
- Hand in interval but NOT learned now: `penalty_active = True`, interval reset to 0. This is triggered by any answer that fails the condition, not only by a wrong answer — a correct answer can demote a hand too (e.g. an earlier error still sits in `last_results`)
- Hand learned and not in interval: interval = 1, clear penalty
- Hand learned and in interval, review due: bump to next Fibonacci number, clear penalty
- Hand learned and in interval, answered early: keep interval, clear penalty
- Not learned and not in interval: nothing changes except the counters

**Position Learned**: ALL 169 hands in position have `review_interval_days > 0`

**Fibonacci Sequence**: [1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377] days

## Training Flow

1. **GET /training/<mode>** — Load training session
   - Query flags: `?start=1` passes the start screen, `?reset_start=1` shows it again (used by other pages), `?show_result=1` shows the stored result
   - First visit shows start screen (with session stats)
   - Without flags a new question is generated: random position of the mode, hand picked by weight; the question is stored in the session
   - Response time is measured client-side (`response_time_ms` form field); a server-side timer is only a fallback
2. **POST /training/<mode>** — Submit answer
   - Grades the answer, updates session counter and HandStats
   - Builds `session['last_result']` (every key is read by `training.html`/`training.js`, keep names stable) and redirects to `?show_result=1`
3. Result shows: correct/wrong, hand history, interval status, weight, plus the table with the situation, hero cards (dealt client-side by `cards.js`, sent back in hidden fields) and opponent nicknames (other users' names or fillers, kept in `session['seat_names']` so the result matches the question)
4. Clicking "Next" generates new question via GET

**Draw training** (`/draw_training/<mode>`): user paints the hands of each subrange of a position on a hand matrix, then sees a verdict and can toggle a visual comparison with the correct range (no text list of mistakes). No HandStats are updated.
- GET picks the next position and gives the question an id; the session keeps only `draw_questions` (newest-last list of `{id, mode, position}`, last 5), so several tabs can be graded independently. The expected range is rebuilt from the live config via `get_position_subranges()` when the answer arrives, never stored in the cookie
- POST (JSON `{question_id, subranges: [{name, hands}]}`) is graded by the pure `grade_drawn_range()`; response fields `missing`, `extra_hands`, `wrong_names`, `expected_hands`, `position`, `mode`, `stats`. Every check counts in `draw_stats`, including a retry of the same question; the front end blocks only a second click while the request is pending. Malformed payloads and unknown ids return 400 with a Russian message
- `draw_queue_<mode>` is the shuffled list of positions not shown yet; positions that left the mode or lost their subranges are skipped on the next GET
- Layout: the result panel replaces the "Проверить" button inside the subrange card, and the stats card sits under that card; `placeStats()` in `draw_training.js` moves it under the matrix when the right column would end up taller than the left (stacked narrow layout keeps it at the end of the right column)

**Session keys** (Flask session, cookie-based): `stats`, `training_started`, `pos`, `hand`, `status`, `correct_text`, `question_start_time`, `last_result`, `seat_names`, `draw_stats`, `draw_questions`, `draw_queue_<mode>`, and the range editor draft `temp_subranges` / `editing_position`.

## Main Routes

All routes except register/login require login.

- `/` — home page: tiles and mode picker dialog
- `/register`, `/login`, `/logout`
- `/training/<mode>` — training UI (GET load question, POST submit answer); `/reset` resets session counters (`?next=` is reduced to a local path by `safe_next_url()`)
- `/draw_training/<mode>` — draw-the-range training; `/reset_draw_stats`
- `/create` — range editor; `/create/*` (add/update/remove subrange, save/load/delete range, temp draft, positions)
- `/create_mode`, `/create_mode/save|update`, `/get_modes`, `/get_mode/<name>`, `/delete_mode/<name>` — mode management (position grouping)
- `/heatmap/<mode>` — visual hand difficulty for one mode (color-coded by weight); data from `/api/heatmap/<mode>/<position>`
- `/all_stats` — same heatmap across all positions, plus the statistics deletion buttons; data from `/api/all_heatmap/<position>`
- `/api/delete_position_stats/<position>`, `/api/delete_all_stats` — wipe HandStats
- `/api/range/<position>` — JSON endpoint for hand data
- `/api/deck_style`, `/api/show_timer`, `/api/dismiss_tables_notice` — per-user UI settings (JSON POST)
- `/config_management` and `/config_management/save|load/<file>|delete/<file>|clear` — backup/restore

Both heatmap pages render the one `templates/heatmap.html` (`mode` is `None` on `/all_stats`, which also shows the delete buttons), and both API endpoints return `build_heatmap_payload()`; only their validation differs.

## Config Backups

- Stored as Python files in `saved_configs/`, written by `config_to_python_string()` and loaded with `exec()`
- `user_<id>_<name>.py` — private, owner only; gitignored (`saved_configs/user_*.py`)
- `<name>.py` — public, loadable by everyone, read-only (committed)
- Loading replaces the live config but never touches statistics; loaded `situations` are validated and filtered to existing positions

## Frontend

- No build step; templates use Jinja2
- Response times captured client-side via JavaScript
- Session-based stats tracking (`session['stats']`)
- Mobile-responsive with breakpoints at 400px, 800px
- Training result cards collapse by default
- `base.html` loads `style.css` and the shared design system `cr_design.css` (tokens, `.cr-shell` wrapper, cards, buttons, inputs, `.cr-toast*`, the session stats card `.cr-stats*` used by both training pages), and renders Flask flashes as toasts via `toast.js`

**Pages on the new design (`.cr-shell`)**: home (`index`), login/register (`auth.*`), `training`, `draw_training`, `create_range`, `config_management`, `heatmap` (also serves `/all_stats`).
**Legacy-styled pages** (not yet redesigned): `create_mode`.
`create_range.css` holds the range editor styles and the matrix rules (`.cr-shell #hand-matrix`, `.matrix-cell` and their responsive tiers) that `draw_training` and `heatmap` reuse, so check all three pages after editing it.

Static file ↔ page map:
- `index.css/js`, `auth.css/js`, `training.css/js`, `config_management.css/js`, `create_mode.css/js`, `draw_training.css/js`, `create_range.css/js`, `heatmap.css/js`
- Shared: `hand_matrix.js` (13x13 matrix builder, drag-select, cell colouring and quick-select groups; used by `create_range.js` and `draw_training.js`, each keeps its own selection state; `heatmap.js` only takes `RANKS` and fills the matrix with its own cell code), `toast.js` (toast), `cards.js` (deck artwork and hero card dealing), `situation_table.js` (table/seat renderer used by the range editor and training page; its defaults are mirrored server-side in `get_default_situation()` — keep both in sync)

## Conventions

- **Comments**: Write in English only
- **Commits**: Conventional commits (feat/fix/style/chore/refactor)
  - Include 2–3 sentence description of what changed and why
  - Example: `fix(training): prevent double submission of answer. Lock submit button during request. Fixes race condition on slow networks.`
  - Do not add "Co-Authored-By: Claude" or similar attribution lines
- **Static files**: Any new or modified CSS/JS file must be referenced via the `static_version()` filter in templates (cache busting based on file mtime)
- **JSON columns**: After mutating a JSON column in place (e.g. `stats.last_results.append(...)`), call `flag_modified(obj, 'field_name')` — SQLAlchemy won't detect the change otherwise and it won't persist
- **UI text**: All user-facing text (labels, buttons, messages, alerts, placeholders) must be in Russian — no exceptions
- **UI text**: Do not end the last sentence of a UI text block with a period ("."). Mid-block sentences still get periods; only the trailing one is dropped

## Redesign Notes

- **Toasts over alert()**: When redesigning a page's UI, replace one-way informational `alert()` calls (errors, success messages, validation nudges) with a small auto-dismissing toast instead of the blocking native dialog. The shared implementation is `showToast(container, message, type)` in `static/toast.js` (types `'success'`/`'error'`, flashes also use `'info'`), styled by the `.cr-toast*` classes in `static/cr_design.css`. `static/create_range.js` and `static/config_management.js` wrap it with their own container — follow that pattern. `draw_training.js` and `heatmap.js` use `showToast` with the base template's `#flash-toast-container`. `alert()` is still used in `create_mode.js`, to be replaced when that page is redesigned
- **Keep confirm() native**: Do not try to replace `confirm()` (yes/no decisions) with a toast — a toast can't pause and wait for an answer. Destructive/blocking confirmations stay as native `confirm()`
- **New design**: build redesigned pages inside the `.cr-shell` wrapper and reuse the `cr_design.css` building blocks instead of adding page-local copies

## File Organization

- `app.py` — All routes, models, business logic (single file, ~2000 lines)
- `templates/` — Jinja2 HTML templates
- `static/` — CSS and vanilla JS
- `instance/` — SQLite database and runtime files (gitignored)
- `saved_configs/` — Config backups (Python files, see "Config Backups")
- `different_scripts/` — Utility/maintenance scripts (migrations, one-off fixes; not core)
- `console_version/` — Legacy standalone console trainer, unrelated to the web app

## Quick Development Tips

- Response times measured client-side to avoid network latency
- Config stored as JSON in database + Python-file backups
- Draw training grading is `grade_drawn_range()` in `app.py` (pure function, easy to test); the matrix code is shared via `static/hand_matrix.js`
- Position weights roll up from hand weights for heatmap display
- Static cache busting via `static_version()` filter using file mtime
- There is no test suite; verify UI changes in a real browser, and re-check the table geometry on `/create` after touching the situation builder
