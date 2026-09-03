# migrate_add_last_times.py
import sqlite3
import os

DB_PATH = 'instance/users.db'

def migrate():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute("PRAGMA table_info(hand_stats)")
    columns = [col[1] for col in cursor.fetchall()]
    if 'last_times' in columns:
        print("Колонка last_times уже существует. Миграция не требуется.")
        conn.close()
        return

    cursor.execute("ALTER TABLE hand_stats ADD COLUMN last_times TEXT DEFAULT '[]'")
    conn.commit()
    print("Колонка last_times успешно добавлена.")
    conn.close()

if __name__ == '__main__':
    migrate()