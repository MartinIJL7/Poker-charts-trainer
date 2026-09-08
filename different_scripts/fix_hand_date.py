# fix_hand_date.py
import argparse
from datetime import datetime, timedelta
import os
import sys

# Add project root to sys.path so we can import 'app'
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, project_root)

from app import app, db, HandStats, User

def main():
    parser = argparse.ArgumentParser(
        description='Update updated_at for a specific hand in HandStats'
    )
    parser.add_argument('username', help='Username')
    parser.add_argument('position', help='Position (e.g., RFI_BTN)')
    parser.add_argument('hand', help='Hand (e.g., AKo)')
    parser.add_argument('--days-ago', type=int,
                        help='Set updated_at to (now - days_ago days)')
    parser.add_argument('--date', help='Set to specific date (YYYY-MM-DD)')
    parser.add_argument('--now', action='store_true',
                        help='Set to current time')
    parser.add_argument('--list', action='store_true',
                        help='List all stats for user/position/hand')

    args = parser.parse_args()

    with app.app_context():
        user = User.query.filter_by(username=args.username).first()
        if not user:
            print(f"User '{args.username}' not found.")
            return

        if args.list:
            stats = HandStats.query.filter_by(user_id=user.id)
            if args.position:
                stats = stats.filter_by(position=args.position)
            if args.hand:
                stats = stats.filter_by(hand=args.hand)
            stats = stats.all()
            if not stats:
                print("No matching records.")
            else:
                for s in stats:
                    print(f"{s.position} {s.hand}: attempts={s.attempts}, "
                          f"interval={s.review_interval_days}, updated_at={s.updated_at}")
            return

        # Find specific record
        stats = HandStats.query.filter_by(
            user_id=user.id,
            position=args.position,
            hand=args.hand
        ).first()
        if not stats:
            print(f"No record for {args.hand} at {args.position} for user {args.username}.")
            return

        new_time = None
        if args.now:
            new_time = datetime.utcnow()
        elif args.days_ago is not None:
            new_time = datetime.utcnow() - timedelta(days=args.days_ago)
        elif args.date:
            try:
                new_time = datetime.strptime(args.date, '%Y-%m-%d')
            except ValueError:
                print("Invalid date format. Use YYYY-MM-DD")
                return
        else:
            print("You must specify one of --now, --days-ago, or --date")
            return

        old_time = stats.updated_at
        stats.updated_at = new_time
        db.session.commit()
        print(f"Updated updated_at for {args.hand} at {args.position}:")
        print(f"  Old: {old_time}")
        print(f"  New: {new_time}")

if __name__ == '__main__':
    main()


# python fix_hand_date.py MartinIJL RFI_BTN AKo --list
# python fix_hand_date.py MartinIJL RFI_BTN AKo --days-ago 3
# python fix_hand_date.py MartinIJL RFI_BTN AKo --now
# python fix_hand_date.py MartinIJL RFI_BTN AKo --date 2026-09-05