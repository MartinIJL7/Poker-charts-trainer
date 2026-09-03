# migrate_learned_status.py
import sys
import os

# Add project root to sys.path so we can import 'app'
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, project_root)

from app import app, db, HandStats, get_avg_time_for_position, get_avg_hand_time, calculate_weight

def is_hand_learned(stats, avg_pos_time):
    """
    Локальная копия логики из app.py (чтобы не зависеть от её наличия).
    Возвращает True, если рука соответствует критериям выучки.
    """
    avg_time_hand = get_avg_hand_time(stats)
    weight = calculate_weight(stats, avg_pos_time)
    return (
        (stats.attempts >= 3 and
         all(res == 1 for res in stats.last_results) and
         avg_time_hand <= 3000)
        or
        (weight <= 0.25)
    )

def migrate():
    with app.app_context():
        all_stats = HandStats.query.filter_by(review_interval_days=0).all()
        updated = 0
        skipped = 0

        for stats in all_stats:
            avg_pos_time = get_avg_time_for_position(stats.user_id, stats.position)
            if avg_pos_time is None:
                skipped += 1
                continue

            if is_hand_learned(stats, avg_pos_time):
                stats.review_interval_days = 1
                stats.penalty_active = False
                updated += 1

        db.session.commit()
        print(f"Обновлено {updated} записей (теперь выучены). Пропущено (нет данных по позиции): {skipped}")

if __name__ == '__main__':
    migrate()