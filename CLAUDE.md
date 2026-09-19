# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Flask web app for poker strategy training. Users build hand ranges, train across positions, and track learning progress with spaced repetition intervals.

## Tech Stack

- **Backend**: Flask + SQLAlchemy ORM
- **Database**: SQLite (WAL mode, stored in `instance/users.db`)
- **Frontend**: Vanilla JavaScript, HTML, CSS (no framework)
- **Auth**: Flask-Login with password hashing

## Running Locally

```bash
pip install -r requirements.txt
python app.py
```

Runs on `http://localhost:5000`. Database and logs created automatically.

Set `SECRET_KEY` environment variable for production (sessions won't work without it).

## Database Schema

**User** — username + password hash

**UserConfig** — per-user config:
- `subranges`: hand groups (dict of dicts: subrange_name → position → list of hands)
- `subrange_order`: list to maintain subrange creation order
- `modes`: training modes (dict: mode_name → list of positions)
- `subrange_colors`: color labels for subranges

**HandStats** — per-hand tracking:
- `attempts`, `errors`, `total_time_ms` — cumulative stats
- `last_results`: last 3 pass/fail outcomes (list of 0s and 1s)
- `last_times`: last 3 response times (ms) for rolling average
- `review_interval_days`: spaced repetition interval
  - 0 = not learned
  - >0 = learned, waiting for review
- `penalty_active`: true if hand needs penalty bonus (flagged after mistake on learned hand)
- `updated_at`: timestamp of last answer submission

## Learning System (Core Logic)

**Learned Condition** (either qualifies):
1. **Strict**: ≥3 attempts AND all last 3 results correct AND avg time ≤ 3000ms
2. **Weight-based**: weight_for_learning ≤ 0.25 AND current answer is correct

Weight calculation in `calculate_weight()`:
- Error rate: `errors / attempts` (0–1)
- Speed score: ratio of hand avg time vs position avg time (0–1, clamped)
- Base weight = error_rate + speed_score (0.1–2.0 after clamping)
- If penalty_active: add 1.2 (up to 2.0 max)
- If review due: set to 2.0

**On Correct Answer**:
- If hand now meets learned condition and not in interval: set interval = 1, clear penalty
- If in interval and review due: bump to next Fibonacci number, clear penalty
- If in interval and answer early: do nothing (keep interval, clear penalty)

**On Wrong Answer**:
- Increment error count
- If hand was in interval (learned): set penalty_active = True, reset interval to 0
- Otherwise: no change to interval

**Position Learned**: ALL hands in position have `review_interval_days > 0`

**Fibonacci Sequence**: [1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377] days

## Training Flow

1. **GET /training/<mode>** — Load training session
   - First visit shows start screen (with session stats)
   - Selecting "Start" generates first question
   - Question stored in session; response time measured client-side
2. **POST /training/<mode>** — Submit answer
   - Update HandStats (attempts, errors, times, learning status)
   - Redirect to result display
3. Result shows: correct/wrong, hand history, interval status, weight
4. Clicking "Next" generates new question via GET

## Main Routes

- `/training/<mode>` — training UI (GET load question, POST submit answer)
- `/create` — range editor (subrange CRUD, position mapping)
- `/create_mode` — mode management (position grouping)
- `/heatmap` — visual hand difficulty (color-coded by weight)
- `/all_stats` — aggregate stats across positions
- `/api/range/<position>` — JSON endpoint for hand data
- `/config_management` — backup/restore, debug tools

## Frontend

- No build step; templates use Jinja2
- Response times captured client-side via JavaScript
- Session-based stats tracking (`session['stats']`)
- Mobile-responsive with breakpoints at 400px, 800px
- Training result cards collapse by default

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

- **Toasts over alert()**: When redesigning a page's UI, replace one-way informational `alert()` calls (errors, success messages, validation nudges) with a small auto-dismissing toast instead of the blocking native dialog. A working implementation exists in `static/create_range.js` (`showToast(message, type)`, types `'success'`/`'error'`) and `static/create_range.css` (`.cr-toast*` classes) — adapt the same pattern rather than reinventing it.
- **Keep confirm() native**: Do not try to replace `confirm()` (yes/no decisions) with a toast — a toast can't pause and wait for an answer. Destructive/blocking confirmations stay as native `confirm()`.

## File Organization

- `app.py` — All routes, models, business logic (single file, ~1500 lines)
- `templates/` — Jinja2 HTML templates
- `static/` — CSS and vanilla JS
- `instance/` — SQLite database and runtime files
- `saved_configs/` — User backup files (JSON)
- `different_scripts/` — Utility/maintenance scripts (not core)

## Quick Development Tips

- Response times measured client-side to avoid network latency
- Config stored as JSON in database + JSON backups
- Hand matrix verification in draw training compares user-selected range vs correct range
- Position weights roll up from hand weights for heatmap display
- Static cache busting via `static_version()` filter using file mtime
