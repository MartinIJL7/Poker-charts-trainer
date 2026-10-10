# migrate_add_deck_style.py
# app.py also applies this on startup; the script is kept for manual runs
# against a database file, like the other migrate_* scripts.
import sqlite3

DB_PATH = 'instance/users.db'

def migrate():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute("PRAGMA table_info(user_config)")
    columns = [col[1] for col in cursor.fetchall()]
    if 'deck_style' in columns:
        print("Колонка deck_style уже существует. Миграция не требуется.")
        conn.close()
        return

    cursor.execute("ALTER TABLE user_config ADD COLUMN deck_style VARCHAR(20) DEFAULT 'default'")
    conn.commit()
    print("Колонка deck_style успешно добавлена.")
    conn.close()

if __name__ == '__main__':
    migrate()
