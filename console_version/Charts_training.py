import random
import sys

# ============================================================
#  НАСТРОЙКА ДИАПАЗОНОВ И РЕЖИМОВ – ЗАПОЛНИТЕ ЭТУ СЕКЦИЮ
# ============================================================

# 1. Основные диапазоны: позиция -> множество рук
ranges = {
    # Пример: 'UTG': {'AA', 'KK', 'AKs'},
    # Добавляйте свои позиции и руки
}

# 2. Поддиапазоны (дополнительные категории)
# subranges = { 'имя': { позиция: множество_рук, ... }, ... }
subranges = {}

# 3. Порядок проверки поддиапазонов (список имён)
subrange_order = []

# 4. Текст правильного ответа для каждого поддиапазона
subrange_answer_text = {}

# 5. Режимы тренировки: название режима -> список позиций
modes = {
    # Пример: 'RFI': ['UTG', 'MP', 'CO', 'BTN', 'SB'],
    #         '3-BET': ['vs EP', 'vs MP', ...]
}

# ============================================================
#  КОД ПРОГРАММЫ (НЕ МЕНЯТЬ, ЕСЛИ НЕ НАДО)
# ============================================================

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
    if hand in ranges.get(pos, set()):
        return 'in'
    return 'out'

def get_correct_answer_text(status):
    if status == 'in':
        return 'yes'
    if status == 'out':
        return 'no'
    return subrange_answer_text.get(status, '')

def is_answer_correct(status, answer):
    return answer == get_correct_answer_text(status)

def main():
    mode_names = list(modes.keys())
    print("Доступные режимы тренировки:")
    for i, name in enumerate(mode_names, 1):
        print(f"{i} - {name}")
    choice = input("Выберите номер режима (или 'q' для выхода): ").strip()
    if choice.lower() == 'q':
        return
    try:
        idx = int(choice) - 1
        mode_name = mode_names[idx]
    except (ValueError, IndexError):
        print("Неверный выбор.")
        sys.exit(1)

    mode_positions = modes[mode_name]
    print(f"\nРежим: {mode_name}")
    print("Вводите ответы в соответствии с вашими диапазонами.")
    print("'q' - выход\n")

    total = 0
    correct = 0
    wrong = 0

    while True:
        pos = random.choice(mode_positions)
        hand = random.choice(ALL_HANDS)

        status = get_hand_status(hand, pos)
        correct_text = get_correct_answer_text(status)

        answer = input(f"{pos} {hand}: ").strip().lower()
        if answer == 'q':
            break

        total += 1
        ok = is_answer_correct(status, answer)

        if ok:
            correct += 1
            print("✅ ", end="")
        else:
            wrong += 1
            print(f"❌ (правильно: {correct_text}) ", end="")

        print(f"Всего ответов: {total} | ✅ Верных: {correct} ({correct/total*100:.1f}%) | ❌ Ошибок: {wrong} ({wrong/total*100:.1f}%)\n")

main()