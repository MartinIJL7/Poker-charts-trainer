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
subranges = {
    # ---------- RFI ----------
    '100% RFI': {
        'RFI_UTG': set(
            {
    'AA', 'KK', 'QQ', 'JJ', 'TT', '99', '88', '77', '66',
    'AKs', 'AQs', 'AJs', 'ATs',
    'KQs', 'KJs', 'KTs',
    'QJs', 'QTs',
    'JTs',
    'AKo', 'AQo', 'AJo',
    'KQo'
}
        ),
        'RFI_MP': set(
            {
    'AA', 'KK', 'QQ', 'JJ', 'TT', '99', '88', '77', '66',
    'AKs', 'AQs', 'AJs', 'ATs', 'A9s', 'A8s', 'A7s', 'A6s', 'A5s', 'A4s', 'A3s', 'A2s',
    'KQs', 'KJs', 'KTs',
    'QJs', 'QTs',
    'JTs',
    'AKo', 'AQo', 'AJo', 'ATo',
    'KQo'
}
        ),
        'RFI_CO': set(
            {
    'AA', 'KK', 'QQ', 'JJ', 'TT', '99', '88', '77', '66', '55', '44',
    'AKs', 'AQs', 'AJs', 'ATs', 'A9s', 'A8s', 'A7s', 'A6s', 'A5s', 'A4s', 'A3s', 'A2s',
    'KQs', 'KJs', 'KTs', 'K9s', 'K8s', 'K7s',
    'QJs', 'QTs', 'Q9s', 'Q8s',
    'JTs', 'J9s', 'J8s',
    'T9s', 'T8s',
    '98s',
    '87s',
    '76s',
    '65s',
    'AKo', 'AQo', 'AJo', 'ATo',
    'KQo', 'KJo', 'KTo',
    'QJo', 'QTo',
    'JTo'
}
        ),
        'RFI_BTN': set(
            {
    'AA', 'KK', 'QQ', 'JJ', 'TT', '99', '88', '77', '66', '55', '44',
    'AKs', 'AQs', 'AJs', 'ATs', 'A9s', 'A8s', 'A7s', 'A6s', 'A5s', 'A4s', 'A3s', 'A2s',
    'KQs', 'KJs', 'KTs', 'K9s', 'K8s', 'K7s', 'K6s', 'K5s', 'K4s', 'K3s', 'K2s',
    'QJs', 'QTs', 'Q9s', 'Q8s', 'Q7s', 'Q6s',
    'JTs', 'J9s', 'J8s', 'J7s',
    'T9s', 'T8s', 'T7s',
    '98s', '97s',
    '87s',
    '76s',
    '65s',
    '54s',
    'AKo', 'AQo', 'AJo', 'ATo', 'A9o', 'A8o', 'A7o',
    'A5o', 'A4o',
    'KQo', 'KJo', 'KTo', 'K9o', 'K8o',
    'QJo', 'QTo', 'Q9o',
    'JTo', 'J9o',
    'T9o'
}
        ),
        'RFI_SB': set(
            {
    'AA', 'KK', 'QQ', 'JJ', 'TT', '99', '88', '77', '66', '55', '44', '33', '22',

    'AKs', 'AQs', 'AJs', 'ATs', 'A9s', 'A8s', 'A7s', 'A6s', 'A5s', 'A4s', 'A3s', 'A2s',
    'KQs', 'KJs', 'KTs', 'K9s', 'K8s', 'K7s', 'K6s', 'K5s', 'K4s', 'K3s', 'K2s',
    'QJs', 'QTs', 'Q9s', 'Q8s', 'Q7s', 'Q6s', 'Q5s', 'Q4s', 'Q3s', 'Q2s',
    'JTs', 'J9s', 'J8s', 'J7s', 'J6s', 'J5s', 'J4s', 'J3s',
    'T9s', 'T8s', 'T7s', 'T6s',
    '98s', '97s', '96s',
    '87s', '86s',
    '76s', '75s',
    '65s', '64s',
    '54s', '32s',

    'AKo', 'AQo', 'AJo', 'ATo', 'A9o', 'A8o', 'A7o', 'A6o', 'A5o', 'A4o', 'A3o',
    'KQo', 'KJo', 'KTo', 'K9o',
    'QJo', 'QTo', 'Q9o',
    'JTo', 'J9o',
    'T9o'
}
        ),
    },
    'RFI if convenient': {
        'RFI_UTG': set(
            {
    '55',
    'A9s', 'A8s', 'A7s', 'A6s', 'A5s', 'A4s', 'A3s',
    'K9s',
    'Q9s',
    'T9s',
    '98s',
    '87s',
    '76s',
    'ATo'
}
        ),
        'RFI_MP': set(
            {
    '55',
    'K9s', 'Q9s', 'J9s', 'T9s', '98s', '87s', '76s',
    'KJo', 'QJo'
}
        ),
        'RFI_CO': set(
            {
    '33', '22',
    'K6s', 'K5s', 'K4s',
    'Q7s',
    'J7s',
    'T7s',
    '97s',
    '54s'
}
        ),
        'RFI_BTN': set(
            {
    '33', '22',
    'Q5s', 'Q4s', 'Q3s', 'Q2s',
    'J6s', 'J5s', 'J4s', 'J3s', 'J2s',
    'T6s',
    '96s',
    '86s', '85s',
    '75s', '74s',
    '64s', '63s',
    '53s',
    '43s',
    'A6o',
    'A3o', 'A2o',
    'Q8o',
    'J8o',
    'T8o',
    '98o'
}
        ),
        'RFI_SB': set(
            {
    'J2s', 'T5s', '95s', '85s', '74s', '53s', '43s',
    'A2o', 'K8o', 'K7o', 'Q8o', 'J8o', 'T8o', '98o', '87o', '76o'
}
        ),
    },
    'RFI if extremely convenient': {
        'RFI_UTG': set(
            {
    '44', '33', '22',
    'A2s',
    'J9s',
    '65s',
    'KJo',
    'QJo'
}
        ),
        'RFI_MP': set(
            {
    '44', '33', '22',
    '65s'
}
        ),
        'RFI_CO': set(
            {
    'K3s', 'K2s',
    'Q6s',
    'J6s',
    '96s',
    '86s', '85s',
    '75s', '74s',
    '64s',
    '53s',
    '43s',
    'A9o'
}
        ),
        'RFI_BTN': set(
            {
    '95s', '84s', '73s', '52s', '42s', '32s',
    'K7o', '87o', '76o'
}
        ),
        'RFI_SB': set(
            {
    # Одномастные
    'T4s', 'T3s', 'T2s',
    '94s', '93s', '92s',
    '84s', '83s', '82s',
    '73s', '72s',
    '63s', '62s',
    '52s', '42s',

    # Разномастные
    'K6o', 'K5o', 'K4o', 'K3o', 'K2o',
    'Q7o', 'Q6o', 'Q5o', 'Q4o', 'Q3o', 'Q2o',
    'J7o', 'J6o', 'J5o', 'J4o', 'J3o', 'J2o',
    'T7o', 'T6o', 'T5o', 'T4o', 'T3o', 'T2o',
    '97o', '96o', '95o', '94o', '93o', '92o',
    '86o', '85o', '84o', '83o', '82o',
    '75o', '74o', '73o', '72o',
    '65o', '64o', '63o', '62o',
    '54o', '53o', '52o',
    '43o', '42o',
    '32o'
}
        ),
    },

    # ---------- ISO ----------
    '100% ISO': {
        'ISO_MP': set({
    'AA', 'KK', 'QQ', 'JJ', 'TT', '99', '88', '77',
    'AKs', 'AQs', 'AJs', 'ATs', 'A9s',
    'KQs', 'KJs', 'KTs',
    'QJs', 'QTs',
    'JTs',
    'AKo', 'AQo', 'AJo',
    'KQo'
}),
        'ISO_CO': set({
    'AA', 'KK', 'QQ', 'JJ', 'TT', '99', '88', '77',
    'AKs', 'AQs', 'AJs', 'ATs', 'A9s', 'A8s', 'A7s', 'A6s', 'A5s',
    'KQs', 'KJs', 'KTs',
    'QJs', 'QTs',
    'JTs',
    'AKo', 'AQo', 'AJo', 'ATo',
    'KQo'
}),
        'ISO_BTN': set({
    'AA', 'KK', 'QQ', 'JJ', 'TT', '99', '88', '77', '66',
    'AKs', 'AQs', 'AJs', 'ATs', 'A9s', 'A8s', 'A7s', 'A6s', 'A5s', 'A4s', 'A3s', 'A2s',
    'KQs', 'KJs', 'KTs', 'K9s',
    'QJs', 'QTs', 'Q9s',
    'JTs', 'J9s',
    'T9s',
    '98s',
    'AKo', 'AQo', 'AJo', 'ATo',
    'KQo', 'KJo',
    'QJo'
}),
        'ISO_SB': set({
    'AA', 'KK', 'QQ', 'JJ', 'TT', '99', '88', '77',
    'AKs', 'AQs', 'AJs', 'ATs', 'A9s',
    'KQs', 'KJs', 'KTs',
    'QJs', 'QTs',
    'JTs',
    'AKo', 'AQo', 'AJo',
    'KQo'
}),
        'ISO_BB': set({
    'AA', 'KK', 'QQ', 'JJ', 'TT', '99', '88', '77',
    'AKs', 'AQs', 'AJs', 'ATs', 'A9s', 'A8s', 'A7s', 'A6s', 'A5s',
    'KQs', 'KJs', 'KTs',
    'QJs', 'QTs',
    'JTs',
    'AKo', 'AQo', 'AJo',
    'KQo'
}),
    },
    '50/50 ISO/fold': {
        'ISO_MP': set({
    'A5s'
}),
        'ISO_CO': set({
    '66',
    'K9s', 'Q9s', 'J9s', 'T9s', '98s',
    'KJo', 'QJo'
}),
        'ISO_BTN': set({
    '55',
    'K8s', 'K7s',
    'Q8s',
    '87s', '76s',
    'A9o',
    'KTo', 'QTo', 'JTo'
}),
    },
    '50/50 ISO/limp': {
        'ISO_SB': set({
    'A8s', 'A5s', 'A4s',
    'K9s',
    'ATo',
    'KJo'
}),
    },
    'limp': {
        'ISO_SB': set({
    '66', '55', '44', '33', '22',
    'A7s', 'A6s', 'A3s', 'A2s',
    'K8s', 'K7s', 'K6s', 'K5s', 'K4s', 'K3s', 'K2s',
    'Q9s', 'Q8s', 'Q7s', 'Q6s', 'Q5s',
    'J9s', 'J8s', 'J7s',
    'T9s', 'T8s', 'T7s',
    '98s', '97s',
    '87s', '86s',
    '76s', '65s', '54s',
    'A9o', 'A8o',
    'KTo',
    'QJo', 'QTo',
    'JTo'
}),
    },
    '50/50 ISO/check': {
        'ISO_BB': set({
    'A4s', 'A3s', 'A2s',
    'K9s',
    'ATo',
    'KJo',
    'QJo'
}),
    },
    'check': {
        'ISO_BB': set({
    '66', '55', '44', '33', '22',
    'K8s', 'K7s', 'K6s', 'K5s', 'K4s', 'K3s', 'K2s',
    'Q9s', 'Q8s', 'Q7s', 'Q6s', 'Q5s', 'Q4s', 'Q3s', 'Q2s',
    'J9s', 'J8s', 'J7s', 'J6s', 'J5s', 'J4s', 'J3s', 'J2s',
    'T9s', 'T8s', 'T7s', 'T6s', 'T5s', 'T4s', 'T3s', 'T2s',
    '98s', '97s', '96s', '95s', '94s', '93s', '92s',
    '87s', '86s', '85s', '84s', '83s', '82s',
    '76s', '75s', '74s', '73s', '72s',
    '65s', '64s', '63s', '62s',
    '54s', '53s', '52s',
    '43s', '42s',
    '32s',
    'A9o', 'A8o', 'A7o', 'A6o', 'A5o', 'A4o', 'A3o', 'A2o',
    'KTo', 'K9o', 'K8o', 'K7o', 'K6o', 'K5o', 'K4o', 'K3o', 'K2o',
    'QTo', 'Q9o', 'Q8o', 'Q7o', 'Q6o', 'Q5o', 'Q4o', 'Q3o', 'Q2o',
    'JTo', 'J9o', 'J8o', 'J7o', 'J6o', 'J5o', 'J4o', 'J3o', 'J2o',
    'T9o', 'T8o', 'T7o', 'T6o', 'T5o', 'T4o', 'T3o', 'T2o',
    '98o', '97o', '96o', '95o', '94o', '93o', '92o',
    '87o', '86o', '85o', '84o', '83o', '82o',
    '76o', '75o', '74o', '73o', '72o',
    '65o', '64o', '63o', '62o',
    '54o', '53o', '52o',
    '43o', '42o',
    '32o'
}),
    },

    # ---------- BB defend ----------
    '3bet': {
        'BB_defend_vs_EP': set({
    'AA', 'KK', 'QQ',
    'AKs', 'KQs', 'KJs', 'QJs'
}),
        'BB_defend_vs_MP': set({
    'AA', 'KK', 'QQ', 'JJ',
    'AKs', 'AQs',
    'KQs', 'KJs',
    'QJs',
    'AKo'
}),
        'BB_defend_vs_CO': set({
    'AA', 'KK', 'QQ', 'JJ', 'TT',
    'AKs', 'AQs', 'AJs',
    'KQs', 'KJs', 'KTs',
    'QJs', 'QTs',
    'JTs',
    'AKo'
}),
        'BB_defend_vs_BTN': set({
    'AA', 'KK', 'QQ', 'JJ', 'TT', '99',
    'AKs', 'AQs', 'AJs', 'ATs',
    'KQs', 'KJs', 'KTs',
    'QJs', 'QTs',
    'JTs',
    'AKo'
}),
        'BB_defend_vs_SB': set({
    'AA', 'KK', 'QQ', 'JJ', 'TT', '99',
    'AKs', 'AQs', 'AJs', 'ATs', 'A5s', 'A4s',
    'KQs', 'KJs', 'KTs',
    'QJs',
    'JTs', 'T9s', '98s', '87s', '76s', '65s', '54s',
    'AKo', 'AQo'
}),
    },
    '50/50 3bet/call': {
        'BB_defend_vs_EP': set({
    'JJ', 'TT',
    'AQs', 'AJs', 'ATs',
    'A5s', 'A4s',
    'KTs', 'QTs', 'JTs',
    'AKo'
}),
        'BB_defend_vs_MP': set({
    'TT', '99',
    'AJs', 'ATs', 'A5s', 'A4s',
    'KTs', 'QTs', 'JTs'
}),
        'BB_defend_vs_CO': set({
    '99',
    'ATs', 'A9s', 'A5s', 'A4s',
    'K9s', 'Q9s', 'J9s', 'T9s',
    'AQo'
}),
        'BB_defend_vs_BTN': set({
    '88', '77',
    'A5s', 'A4s',
    'T9s',
    'AQo', 'AJo', 'ATo',
    'KQo', 'KJo'
}),
        'BB_defend_vs_SB': set({
    '88', '77',
    'A9s', 'A3s', 'K9s', 'K7s', 'K6s', 'QTs', 'J9s', 'J4s', 'J3s',
    'T8s', 'T5s', 'T4s', 'T3s', 'T2s', '97s',
    'AJo', 'A5o', 'A4o', 'A3o', 'A2o',
    'KQo', 'K8o', 'K7o', 'K6o', 'K5o',
    'Q8o', 'J8o', 'T8o'
}),
    },
    'call': {
        'BB_defend_vs_EP': set({
    '99', '88', '77', '66', '55', '44', '33', '22',
    'A9s', 'A8s', 'A7s', 'A6s', 'A3s', 'A2s', 'K9s', 'T9s', '98s', '87s', '76s', '65s', '54s',
    'AQo', 'KQo'
}),
        'BB_defend_vs_MP': set({
    '88', '77', '66', '55', '44', '33', '22',
    'A9s', 'A8s', 'A7s', 'A6s', 'A3s', 'A2s',
    'K9s', 'Q9s', 'T9s', '98s', '87s', '76s', '65s', '54s',
    'AQo', 'AJo', 'KQo'
}),
        'BB_defend_vs_CO': set({
    '88', '77', '66', '55', '44', '33', '22',
    'A8s', 'A7s', 'A6s', 'A3s', 'A2s',
    'K8s', 'K7s', 'K6s',
    'Q8s', 'Q7s',
    'J8s', 'T8s', '98s', '87s', '76s', '65s', '54s',
    'AJo', 'ATo', 'KQo', 'KJo', 'QJo'
}),
        'BB_defend_vs_BTN': set({
    '66', '55', '44', '33', '22',
    'A9s', 'A8s', 'A7s', 'A6s', 'A3s', 'A2s',
    'K9s', 'K8s', 'K7s', 'K6s', 'K5s', 'K4s',
    'Q9s', 'Q8s',
    'J9s',
    '98s', '97s',
    '87s', '76s', '65s', '54s',
    'A9o',
    'KTo',
    'QJo', 'QTo',
    'JTo'
}),
        'BB_defend_vs_SB': set({
    '66', '55', '44', '33', '22',
    'A8s', 'A7s', 'A6s', 'A2s',
    'K8s', 'K5s', 'K4s', 'K3s', 'K2s',
    'Q9s', 'Q8s', 'Q7s', 'Q6s', 'Q5s', 'Q4s', 'Q3s', 'Q2s',
    'J8s', 'J7s', 'J6s', 'J5s', 'J2s',
    'T7s', 'T6s',
    '96s', '95s', '94s', '93s',
    '86s', '85s', '84s',
    '75s', '74s', '73s',
    '64s', '63s',
    '53s', '52s',
    '43s', '42s',
    '32s',
    'ATo', 'A9o', 'A8o', 'A7o', 'A6o',
    'KJo', 'KTo', 'K9o',
    'QJo', 'QTo', 'Q9o',
    'JTo', 'J9o',
    'T9o', '98o', '87o', '76o', '65o'
}),
    },
    '50/50 call/fold': {
        'BB_defend_vs_EP': set({
    'Q9s',
    'AJo'
}),
        'BB_defend_vs_MP': set({
    'J9s', 'ATo', 'KJo'
}),
        'BB_defend_vs_CO': set(),
        'BB_defend_vs_BTN': set({
    'J8s',
    'T8s'
}),
        'BB_defend_vs_SB': set(),
    },

    # ---------- 3bet ----------
    '3bet not bb defend': {
        'IP_vs_EP': set(),
        'IP_vs_MP': set(),
        'IP_vs_CO': set(),
        'SB_vs_EP': set(),
        'SB_vs_MP': set(),
        'SB_vs_CO': set(),
        'SB_vs_BTN': set(),
    },
    '50/50 3bet/fold': {
        'IP_vs_EP': set(),
        'IP_vs_MP': set(),
        'IP_vs_CO': set(),
        'SB_vs_EP': set(),
        'SB_vs_MP': set(),
        'SB_vs_CO': set(),
        'SB_vs_BTN': set(),
    },
    '3bet if convenient': {
        'SB_vs_EP': set(),
        'SB_vs_MP': set(),
        'SB_vs_CO': set(),
        'SB_vs_BTN': set(),
    },
    '3bet if extremely convenient': {
        'SB_vs_EP': set(),
        'SB_vs_MP': set(),
        'SB_vs_CO': set(),
        'SB_vs_BTN': set(),
    },
}

# 3. Порядок проверки поддиапазонов (список имён)
subrange_order = [
    # ---------- RFI ----------
    '100% RFI',
    'RFI if convenient',
    'RFI if extremely convenient',

    # ---------- ISO ----------
    '100% ISO',
    '50/50 ISO/fold',
    '50/50 ISO/limp',
    'limp',
    '50/50 ISO/check',
    'check',

    # ---------- BB defend ----------
    '3bet',
    '50/50 3bet/call',
    'call',
    '50/50 call/fold',

    # ---------- 3bet ----------
    '3bet not bb defend',
    '50/50 3bet/fold',
    '3bet if convenient',
    '3bet if extremely convenient',
    ]

# 4. Текст правильного ответа для каждого поддиапазона
subrange_answer_text = {
    # ---------- RFI ----------
    '100% RFI': 'rfi',
    'RFI if convenient': 'rfi conv',
    'RFI if extremely convenient': 'rfi xconv',

    # ---------- ISO ----------
    '100% ISO': 'iso',
    '50/50 ISO/fold': '50/50 iso/fold',
    '50/50 ISO/limp': '50/50 iso/limp',
    'limp': 'limp',
    '50/50 ISO/check': '50/50 iso/check',
    'check': 'check',

    # ---------- BB defend ----------
    '3bet': '3bet',
    '50/50 3bet/call': '50/50 3bet/call',
    'call': 'call',
    '50/50 call/fold': '50/50 call/fold',

    # ---------- 3bet ----------
    '3bet not bb defend': '3bet',
    '50/50 3bet/fold': '50/50 3bet/fold',
    '3bet if convenient': '3bet conv',
    '3bet if extremely convenient': '3bet xconv',
}

# 5. Режимы тренировки: название режима -> список позиций
modes = {
    'RFI': ['RFI_UTG', 'RFI_MP', 'RFI_CO', 'RFI_BTN', 'RFI_SB'],
    'ISO': ['ISO_MP', 'ISO_CO', 'ISO_BTN', 'ISO_SB', 'ISO_BB'],
    'BB defend': ['BB_defend_vs_EP', 'BB_defend_vs_MP', 'BB_defend_vs_CO', 'BB_defend_vs_BTN', 'BB_defend_vs_SB'],
    '3bet': ['IP_vs_EP', 'IP_vs_MP', 'IP_vs_CO', 'SB_vs_EP', 'SB_vs_MP', 'SB_vs_CO', 'SB_vs_BTN'],
}

# Автоматически добавляем режим All (все ситуации из всех режимов, отсортированные)
all_situations = []
for mode_name, situs in modes.items():
    for s in situs:
        if s not in all_situations:
            all_situations.append(s)
all_situations.sort()
modes['All'] = all_situations

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
        return 'in a range'
    return 'not in a range'

def get_correct_answer_text(status):
    if status == 'in a range':
        return 'yes'
    if status == 'not in a range':
        return 'fold'
    return subrange_answer_text.get(status, '')

def is_answer_correct(status, answer):
    return answer == get_correct_answer_text(status).lower()

def get_possible_statuses(pos):
    """
    Возвращает список статусов (имён поддиапазонов), которые могут встретиться
    для данной ситуации (т.е. для которых есть хотя бы одна рука в subranges),
    плюс 'in a range', если есть руки в ranges, и всегда 'not in a range'.
    """
    statuses = set()
    for subname in subrange_order:
        if subranges.get(subname, {}).get(pos, set()):
            statuses.add(subname)
    if ranges.get(pos, set()):
        statuses.add('in a range')
    statuses.add('not in a range')
    return sorted(statuses)

def print_hint_for_mode(mode_positions):
    """
    Для каждой ситуации выводит список возможных статусов и соответствующие им ответы.
    """
    print("\nПодсказка по допустимым ответам для каждой ситуации:")
    for pos in mode_positions:
        statuses = get_possible_statuses(pos)
        print(f"\n{pos}:")
        for st in statuses:
            answer_text = get_correct_answer_text(st)
            print(f"  {st} -> вводить: {answer_text}")

def debug_mode():
    print("\n=== РЕЖИМ ОТЛАДКИ ===\n")
    print("Вводите ситуацию и руку (точно как в диапазонах, регистр важен).")
    print("Формат: ситуация рука (например: RFI_UTG A5s)")
    print("'q' - выход из отладки\n")

    all_situs = set()
    for situs in modes.values():
        all_situs.update(situs)

    while True:
        user_input = input("Проверить: ").strip()
        if user_input.lower() == 'q':
            break

        parts = user_input.split()
        if len(parts) != 2:
            print("❌ Неверный формат. Вводите: ситуация рука (например: RFI_UTG A5s)")
            continue

        situ, hand = parts[0], parts[1]  # БЕЗ .upper() – вводим точно как в диапазонах

        if situ not in all_situs:
            print(f"❌ Неизвестная ситуация: {situ}")
            print(f"   Доступные ситуации: {', '.join(sorted(all_situs))}")
            continue

        # Проверяем, есть ли такая рука в ALL_HANDS (но можно и без проверки, просто искать)
        if hand not in ALL_HANDS:
            print(f"❌ Неизвестная рука: {hand}")
            print("   Допустимые форматы: AA, AKs, AKo, 72o, etc. (регистр важен)")
            continue

        status = get_hand_status(hand, situ)
        correct_answer = get_correct_answer_text(status)

        print(f"\n  Ситуация: {situ}")
        print(f"  Рука: {hand}")
        print(f"  Статус: {status}")
        print(f"  Правильный ответ: {correct_answer}\n")

def main():
    print("Доступные режимы:")
    print("1 - Тренировка")
    print("2 - Отладка")
    choice = input("Выберите режим (1/2): ").strip()

    if choice == '2':
        debug_mode()
        return
    elif choice != '1':
        print("Неверный выбор.")
        return

    # ---- Обычный режим тренировки ----
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

 # Выводим подсказку один раз
    print_hint_for_mode(mode_positions)

    print("\nТеперь тренировка. Вводите ответы. 'q' - выход.\n")

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