# migrate_add_situations.py
import sqlite3

DB_PATH = 'instance/users.db'

def migrate():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute("PRAGMA table_info(user_config)")
    columns = [col[1] for col in cursor.fetchall()]
    if 'situations' in columns:
        print("Колонка situations уже существует. Миграция не требуется.")
        conn.close()
        return

    cursor.execute("ALTER TABLE user_config ADD COLUMN situations TEXT DEFAULT '{}'")
    conn.commit()
    print("Колонка situations успешно добавлена.")
    conn.close()

if __name__ == '__main__':
    migrate()
