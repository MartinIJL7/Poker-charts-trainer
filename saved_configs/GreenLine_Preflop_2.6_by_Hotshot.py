# config.py
# ============================================================
#  НАСТРОЙКА ДИАПАЗОНОВ И РЕЖИМОВ – АВТОМАТИЧЕСКИ СОЗДАНО
# ============================================================

subranges = {
    '100% RFI': {
        'RFI_UTG': {'66', '77', '88', '99', 'AA', 'AJo', 'AJs', 'AKo', 'AKs', 'AQo', 'AQs', 'ATs', 'JJ', 'JTs', 'KJs', 'KK', 'KQo', 'KQs', 'KTs', 'QJs', 'QQ', 'QTs', 'TT'},
        'RFI_MP': {'66', '77', '88', '99', 'A2s', 'A3s', 'A4s', 'A5s', 'A6s', 'A7s', 'A8s', 'A9s', 'AA', 'AJo', 'AJs', 'AKo', 'AKs', 'AQo', 'AQs', 'ATo', 'ATs', 'JJ', 'JTs', 'KJs', 'KK', 'KQo', 'KQs', 'KTs', 'QJs', 'QQ', 'QTs', 'TT'},
        'RFI_CO': {'44', '55', '65s', '66', '76s', '77', '87s', '88', '98s', '99', 'A2s', 'A3s', 'A4s', 'A5s', 'A6s', 'A7s', 'A8s', 'A9s', 'AA', 'AJo', 'AJs', 'AKo', 'AKs', 'AQo', 'AQs', 'ATo', 'ATs', 'J8s', 'J9s', 'JJ', 'JTo', 'JTs', 'K7s', 'K8s', 'K9s', 'KJo', 'KJs', 'KK', 'KQo', 'KQs', 'KTo', 'KTs', 'Q8s', 'Q9s', 'QJo', 'QJs', 'QQ', 'QTo', 'QTs', 'T8s', 'T9s', 'TT'},
        'RFI_BTN': {'44', '54s', '55', '65s', '66', '76s', '77', '87s', '88', '97s', '98s', '99', 'A2s', 'A3s', 'A4o', 'A4s', 'A5o', 'A5s', 'A6s', 'A7o', 'A7s', 'A8o', 'A8s', 'A9o', 'A9s', 'AA', 'AJo', 'AJs', 'AKo', 'AKs', 'AQo', 'AQs', 'ATo', 'ATs', 'J7s', 'J8s', 'J9o', 'J9s', 'JJ', 'JTo', 'JTs', 'K2s', 'K3s', 'K4s', 'K5s', 'K6s', 'K7s', 'K8o', 'K8s', 'K9o', 'K9s', 'KJo', 'KJs', 'KK', 'KQo', 'KQs', 'KTo', 'KTs', 'Q6s', 'Q7s', 'Q8s', 'Q9o', 'Q9s', 'QJo', 'QJs', 'QQ', 'QTo', 'QTs', 'T7s', 'T8s', 'T9o', 'T9s', 'TT'},
        'RFI_SB': {'22', '32s', '33', '44', '54s', '55', '64s', '65s', '66', '75s', '76s', '77', '86s', '87s', '88', '96s', '97s', '98s', '99', 'A2s', 'A3o', 'A3s', 'A4o', 'A4s', 'A5o', 'A5s', 'A6o', 'A6s', 'A7o', 'A7s', 'A8o', 'A8s', 'A9o', 'A9s', 'AA', 'AJo', 'AJs', 'AKo', 'AKs', 'AQo', 'AQs', 'ATo', 'ATs', 'J3s', 'J4s', 'J5s', 'J6s', 'J7s', 'J8s', 'J9o', 'J9s', 'JJ', 'JTo', 'JTs', 'K2s', 'K3s', 'K4s', 'K5s', 'K6s', 'K7s', 'K8s', 'K9o', 'K9s', 'KJo', 'KJs', 'KK', 'KQo', 'KQs', 'KTo', 'KTs', 'Q2s', 'Q3s', 'Q4s', 'Q5s', 'Q6s', 'Q7s', 'Q8s', 'Q9o', 'Q9s', 'QJo', 'QJs', 'QQ', 'QTo', 'QTs', 'T6s', 'T7s', 'T8s', 'T9o', 'T9s', 'TT'}
    },

    'RFI if convenient': {
        'RFI_UTG': {'55', '76s', '87s', '98s', 'A3s', 'A4s', 'A5s', 'A6s', 'A7s', 'A8s', 'A9s', 'ATo', 'K9s', 'Q9s', 'T9s'},
        'RFI_MP': {'55', '76s', '87s', '98s', 'J9s', 'K9s', 'KJo', 'Q9s', 'QJo', 'T9s'},
        'RFI_CO': {'22', '33', '54s', '97s', 'J7s', 'K4s', 'K5s', 'K6s', 'Q7s', 'T7s'},
        'RFI_BTN': {'22', '33', '43s', '53s', '63s', '64s', '74s', '75s', '85s', '86s', '96s', '98o', 'A2o', 'A3o', 'A6o', 'J2s', 'J3s', 'J4s', 'J5s', 'J6s', 'J8o', 'Q2s', 'Q3s', 'Q4s', 'Q5s', 'Q8o', 'T6s', 'T8o'},
        'RFI_SB': {'43s', '53s', '74s', '76o', '85s', '87o', '95s', '98o', 'A2o', 'J2s', 'J8o', 'K7o', 'K8o', 'Q8o', 'T5s', 'T8o'}
    },

    'RFI if extremely convenient': {
        'RFI_UTG': {'22', '33', '44', '65s', 'A2s', 'J9s', 'KJo', 'QJo'},
        'RFI_MP': {'22', '33', '44', '65s'},
        'RFI_CO': {'43s', '53s', '64s', '74s', '75s', '85s', '86s', '96s', 'A9o', 'J6s', 'K2s', 'K3s', 'Q6s'},
        'RFI_BTN': {'32s', '42s', '52s', '73s', '76o', '84s', '87o', '95s', 'K7o'},
        'RFI_SB': {'32o', '42o', '42s', '43o', '52o', '52s', '53o', '54o', '62o', '62s', '63o', '63s', '64o', '65o', '72o', '72s', '73o', '73s', '74o', '75o', '82o', '82s', '83o', '83s', '84o', '84s', '85o', '86o', '92o', '92s', '93o', '93s', '94o', '94s', '95o', '96o', '97o', 'J2o', 'J3o', 'J4o', 'J5o', 'J6o', 'J7o', 'K2o', 'K3o', 'K4o', 'K5o', 'K6o', 'Q2o', 'Q3o', 'Q4o', 'Q5o', 'Q6o', 'Q7o', 'T2o', 'T2s', 'T3o', 'T3s', 'T4o', 'T4s', 'T5o', 'T6o', 'T7o'}
    },

    '100% ISO': {
        'ISO_MP': {'77', '88', '99', 'A9s', 'AA', 'AJo', 'AJs', 'AKo', 'AKs', 'AQo', 'AQs', 'ATs', 'JJ', 'JTs', 'KJs', 'KK', 'KQo', 'KQs', 'KTs', 'QJs', 'QQ', 'QTs', 'TT'},
        'ISO_CO': {'77', '88', '99', 'A5s', 'A6s', 'A7s', 'A8s', 'A9s', 'AA', 'AJo', 'AJs', 'AKo', 'AKs', 'AQo', 'AQs', 'ATo', 'ATs', 'JJ', 'JTs', 'KJs', 'KK', 'KQo', 'KQs', 'KTs', 'QJs', 'QQ', 'QTs', 'TT'},
        'ISO_BTN': {'66', '77', '88', '98s', '99', 'A2s', 'A3s', 'A4s', 'A5s', 'A6s', 'A7s', 'A8s', 'A9s', 'AA', 'AJo', 'AJs', 'AKo', 'AKs', 'AQo', 'AQs', 'ATo', 'ATs', 'J9s', 'JJ', 'JTs', 'K9s', 'KJo', 'KJs', 'KK', 'KQo', 'KQs', 'KTs', 'Q9s', 'QJo', 'QJs', 'QQ', 'QTs', 'T9s', 'TT'},
        'ISO_SB': {'77', '88', '99', 'A9s', 'AA', 'AJo', 'AJs', 'AKo', 'AKs', 'AQo', 'AQs', 'ATs', 'JJ', 'JTs', 'KJs', 'KK', 'KQo', 'KQs', 'KTs', 'QJs', 'QQ', 'QTs', 'TT'},
        'ISO_BB': {'77', '88', '99', 'A5s', 'A6s', 'A7s', 'A8s', 'A9s', 'AA', 'AJo', 'AJs', 'AKo', 'AKs', 'AQo', 'AQs', 'ATs', 'JJ', 'JTs', 'KJs', 'KK', 'KQo', 'KQs', 'KTs', 'QJs', 'QQ', 'QTs', 'TT'}
    },

    '50/50 ISO/fold': {
        'ISO_MP': {'A5s'},
        'ISO_CO': {'66', '98s', 'J9s', 'K9s', 'KJo', 'Q9s', 'QJo', 'T9s'},
        'ISO_BTN': {'55', '76s', '87s', 'A9o', 'JTo', 'K7s', 'K8s', 'KTo', 'Q8s', 'QTo'}
    },

    '50/50 ISO/limp': {
        'ISO_SB': {'A4s', 'A5s', 'A8s', 'ATo', 'K9s', 'KJo'}
    },

    'limp': {
        'ISO_SB': {'22', '33', '44', '54s', '55', '65s', '66', '76s', '86s', '87s', '97s', '98s', 'A2s', 'A3s', 'A6s', 'A7s', 'A8o', 'A9o', 'J7s', 'J8s', 'J9s', 'JTo', 'K2s', 'K3s', 'K4s', 'K5s', 'K6s', 'K7s', 'K8s', 'KTo', 'Q5s', 'Q6s', 'Q7s', 'Q8s', 'Q9s', 'QJo', 'QTo', 'T7s', 'T8s', 'T9s'}
    },

    '50/50 ISO/check': {
        'ISO_BB': {'A2s', 'A3s', 'A4s', 'ATo', 'K9s', 'KJo', 'QJo'}
    },

    'check': {
        'ISO_BB': {'22', '32o', '32s', '33', '42o', '42s', '43o', '43s', '44', '52o', '52s', '53o', '53s', '54o', '54s', '55', '62o', '62s', '63o', '63s', '64o', '64s', '65o', '65s', '66', '72o', '72s', '73o', '73s', '74o', '74s', '75o', '75s', '76o', '76s', '82o', '82s', '83o', '83s', '84o', '84s', '85o', '85s', '86o', '86s', '87o', '87s', '92o', '92s', '93o', '93s', '94o', '94s', '95o', '95s', '96o', '96s', '97o', '97s', '98o', '98s', 'A2o', 'A3o', 'A4o', 'A5o', 'A6o', 'A7o', 'A8o', 'A9o', 'J2o', 'J2s', 'J3o', 'J3s', 'J4o', 'J4s', 'J5o', 'J5s', 'J6o', 'J6s', 'J7o', 'J7s', 'J8o', 'J8s', 'J9o', 'J9s', 'JTo', 'K2o', 'K2s', 'K3o', 'K3s', 'K4o', 'K4s', 'K5o', 'K5s', 'K6o', 'K6s', 'K7o', 'K7s', 'K8o', 'K8s', 'K9o', 'KTo', 'Q2o', 'Q2s', 'Q3o', 'Q3s', 'Q4o', 'Q4s', 'Q5o', 'Q5s', 'Q6o', 'Q6s', 'Q7o', 'Q7s', 'Q8o', 'Q8s', 'Q9o', 'Q9s', 'QTo', 'T2o', 'T2s', 'T3o', 'T3s', 'T4o', 'T4s', 'T5o', 'T5s', 'T6o', 'T6s', 'T7o', 'T7s', 'T8o', 'T8s', 'T9o', 'T9s'}
    },

    '3bet': {
        'BB_defend_vs_EP': {'AA', 'AKs', 'KJs', 'KK', 'KQs', 'QJs', 'QQ'},
        'BB_defend_vs_MP': {'AA', 'AKo', 'AKs', 'AQs', 'JJ', 'KJs', 'KK', 'KQs', 'QJs', 'QQ'},
        'BB_defend_vs_CO': {'AA', 'AJs', 'AKo', 'AKs', 'AQs', 'JJ', 'JTs', 'KJs', 'KK', 'KQs', 'KTs', 'QJs', 'QQ', 'QTs', 'TT'},
        'BB_defend_vs_BTN': {'99', 'AA', 'AJs', 'AKo', 'AKs', 'AQs', 'ATs', 'JJ', 'JTs', 'KJs', 'KK', 'KQs', 'KTs', 'QJs', 'QQ', 'QTs', 'TT'},
        'BB_defend_vs_SB': {'54s', '65s', '76s', '87s', '98s', '99', 'A4s', 'A5s', 'AA', 'AJs', 'AKo', 'AKs', 'AQo', 'AQs', 'ATs', 'JJ', 'JTs', 'KJs', 'KK', 'KQs', 'KTs', 'QJs', 'QQ', 'T9s', 'TT'}
    },

    '50/50 3bet/call': {
        'BB_defend_vs_EP': {'A4s', 'A5s', 'AJs', 'AKo', 'AQs', 'ATs', 'JJ', 'JTs', 'KTs', 'QTs', 'TT'},
        'BB_defend_vs_MP': {'99', 'A4s', 'A5s', 'AJs', 'ATs', 'JTs', 'KTs', 'QTs', 'TT'},
        'BB_defend_vs_CO': {'99', 'A4s', 'A5s', 'A9s', 'AQo', 'ATs', 'J9s', 'K9s', 'Q9s', 'T9s'},
        'BB_defend_vs_BTN': {'77', '88', 'A4s', 'A5s', 'AJo', 'AQo', 'ATo', 'KJo', 'KQo', 'T9s'},
        'BB_defend_vs_SB': {'77', '88', '97s', 'A2o', 'A3o', 'A3s', 'A4o', 'A5o', 'A9s', 'AJo', 'J3s', 'J4s', 'J8o', 'J9s', 'K5o', 'K6o', 'K6s', 'K7o', 'K7s', 'K8o', 'K9s', 'KQo', 'Q8o', 'QTs', 'T2s', 'T3s', 'T4s', 'T5s', 'T8o', 'T8s'}
    },

    'call': {
        'BB_defend_vs_EP': {'22', '33', '44', '54s', '55', '65s', '66', '76s', '77', '87s', '88', '98s', '99', 'A2s', 'A3s', 'A6s', 'A7s', 'A8s', 'A9s', 'AQo', 'K9s', 'KQo', 'T9s'},
        'BB_defend_vs_MP': {'22', '33', '44', '54s', '55', '65s', '66', '76s', '77', '87s', '88', '98s', 'A2s', 'A3s', 'A6s', 'A7s', 'A8s', 'A9s', 'AJo', 'AQo', 'K9s', 'KQo', 'Q9s', 'T9s'},
        'BB_defend_vs_CO': {'22', '33', '44', '54s', '55', '65s', '66', '76s', '77', '87s', '88', '98s', 'A2s', 'A3s', 'A6s', 'A7s', 'A8s', 'AJo', 'ATo', 'J8s', 'K6s', 'K7s', 'K8s', 'KJo', 'KQo', 'Q7s', 'Q8s', 'QJo', 'T8s'},
        'BB_defend_vs_BTN': {'22', '33', '44', '54s', '55', '65s', '66', '76s', '87s', '97s', '98s', 'A2s', 'A3s', 'A6s', 'A7s', 'A8s', 'A9o', 'A9s', 'J9s', 'JTo', 'K4s', 'K5s', 'K6s', 'K7s', 'K8s', 'K9s', 'KTo', 'Q8s', 'Q9s', 'QJo', 'QTo'},
        'BB_defend_vs_SB': {'22', '32s', '33', '42s', '43s', '44', '52s', '53s', '55', '63s', '64s', '65o', '66', '73s', '74s', '75s', '76o', '84s', '85s', '86s', '87o', '93s', '94s', '95s', '96s', '98o', 'A2s', 'A6o', 'A6s', 'A7o', 'A7s', 'A8o', 'A8s', 'A9o', 'ATo', 'J2s', 'J5s', 'J6s', 'J7s', 'J8s', 'J9o', 'JTo', 'K2s', 'K3s', 'K4s', 'K5s', 'K8s', 'K9o', 'KJo', 'KTo', 'Q2s', 'Q3s', 'Q4s', 'Q5s', 'Q6s', 'Q7s', 'Q8s', 'Q9o', 'Q9s', 'QJo', 'QTo', 'T6s', 'T7s', 'T9o'}
    },

    '50/50 call/fold': {
        'BB_defend_vs_EP': {'AJo', 'Q9s'},
        'BB_defend_vs_MP': {'ATo', 'J9s', 'KJo'},
        'BB_defend_vs_BTN': {'J8s', 'T8s'}
    },

    '3bet not bb defend': {
        '3bet_IP_vs_EP': {'99', 'AA', 'AJs', 'AKo', 'AKs', 'AQs', 'JJ', 'KJs', 'KK', 'KQs', 'QJs', 'QQ', 'TT'},
        '3bet_IP_vs_MP': {'88', '99', 'AA', 'AJs', 'AKo', 'AKs', 'AQo', 'AQs', 'ATs', 'JJ', 'JTs', 'KJs', 'KK', 'KQs', 'KTs', 'QJs', 'QQ', 'QTs', 'TT'},
        '3bet_IP_vs_CO': {'88', '99', 'A4s', 'A5s', 'A9s', 'AA', 'AJs', 'AKo', 'AKs', 'AQo', 'AQs', 'ATs', 'JJ', 'JTs', 'KJs', 'KK', 'KQs', 'KTs', 'QJs', 'QQ', 'QTs', 'TT'},
        '3bet_SB_vs_EP': {'AA', 'AJs', 'AKo', 'AKs', 'AQs', 'JJ', 'KK', 'KQs', 'QQ', 'TT'},
        '3bet_SB_vs_MP': {'AA', 'AJs', 'AKo', 'AKs', 'AQs', 'ATs', 'JJ', 'KJs', 'KK', 'KQs', 'QJs', 'QQ', 'TT'},
        '3bet_SB_vs_CO': {'99', 'AA', 'AJs', 'AKo', 'AKs', 'AQo', 'AQs', 'ATs', 'JJ', 'JTs', 'KJs', 'KK', 'KQs', 'KTs', 'QJs', 'QQ', 'QTs', 'TT'},
        '3bet_SB_vs_BTN': {'88', '99', 'A4s', 'A5s', 'A9s', 'AA', 'AJo', 'AJs', 'AKo', 'AKs', 'AQo', 'AQs', 'ATs', 'JJ', 'JTs', 'KJs', 'KK', 'KQo', 'KQs', 'KTs', 'QJs', 'QQ', 'QTs', 'TT'}
    },

    '50/50 3bet/fold': {
        '3bet_IP_vs_EP': {'AQo', 'ATs', 'JTs', 'KTs', 'QTs'},
        '3bet_IP_vs_CO': {'76s', '77', '87s', '98s', 'AJo', 'J9s', 'K9s', 'KQo', 'Q9s', 'T9s'},
        '3bet_SB_vs_EP': {'KJs', 'QJs'},
        '3bet_SB_vs_MP': {'AQo'},
        '3bet_SB_vs_CO': {'AJo', 'KQo'},
        '3bet_SB_vs_BTN': {'66', '77', 'A3s', 'K9s', 'Q9s'}
    },

    '3bet if convenient': {
        '3bet_SB_vs_EP': {'99', 'AQo', 'ATs', 'KTs'},
        '3bet_SB_vs_MP': {'88', '99', 'A5s', 'KTs', 'QTs'},
        '3bet_SB_vs_CO': {'77', '88', 'A3s', 'A4s', 'A5s', 'A9s', 'K9s', 'KJo'},
        '3bet_SB_vs_BTN': {'A2s', 'A6s', 'A7s', 'A8s', 'ATo', 'J9s', 'KJo', 'T9s'}
    },

    '3bet if extremely convenient': {
        '3bet_SB_vs_EP': {'A4s', 'A5s', 'JTs', 'QTs'},
        '3bet_SB_vs_MP': {'A3s', 'A4s', 'JTs'},
        '3bet_SB_vs_CO': {'76s', '87s', '98s', 'T9s'},
        '3bet_SB_vs_BTN': {'76s', '87s', '97s', '98s', 'KTo', 'QJo', 'T8s'}
    }
}

subrange_order = ['100% RFI', 'RFI if convenient', 'RFI if extremely convenient', '100% ISO', '50/50 ISO/fold', '50/50 ISO/limp', 'limp', '50/50 ISO/check', 'check', '3bet', '50/50 3bet/call', 'call', '50/50 call/fold', '3bet not bb defend', '50/50 3bet/fold', '3bet if convenient', '3bet if extremely convenient']

modes = {
    'RFI': ['RFI_UTG', 'RFI_MP', 'RFI_CO', 'RFI_BTN', 'RFI_SB'],
    'ISO': ['ISO_MP', 'ISO_CO', 'ISO_BTN', 'ISO_SB', 'ISO_BB'],
    'BB defend': ['BB_defend_vs_EP', 'BB_defend_vs_MP', 'BB_defend_vs_CO', 'BB_defend_vs_BTN', 'BB_defend_vs_SB'],
    '3bet': ['3bet_IP_vs_EP', '3bet_IP_vs_MP', '3bet_IP_vs_CO', '3bet_SB_vs_EP', '3bet_SB_vs_MP', '3bet_SB_vs_CO', '3bet_SB_vs_BTN'],
    'All': ['3bet_IP_vs_CO', '3bet_IP_vs_EP', '3bet_IP_vs_MP', '3bet_SB_vs_BTN', '3bet_SB_vs_CO', '3bet_SB_vs_EP', '3bet_SB_vs_MP', 'BB_defend_vs_BTN', 'BB_defend_vs_CO', 'BB_defend_vs_EP', 'BB_defend_vs_MP', 'BB_defend_vs_SB', 'ISO_BB', 'ISO_BTN', 'ISO_CO', 'ISO_MP', 'ISO_SB', 'RFI_BTN', 'RFI_CO', 'RFI_MP', 'RFI_SB', 'RFI_UTG']
}

subrange_colors = {
    '100% RFI': '#E14444',
    'RFI if convenient': '#FFB747',
    'RFI if extremely convenient': '#72BF44',
    '100% ISO': '#E14444',
    '50/50 ISO/fold': '#8B3A3A',
    '50/50 ISO/limp': '#FF4500',
    'limp': '#FFB747',
    '50/50 ISO/check': '#8B3A3A',
    'check': '#708090',
    '3bet': '#E14444',
    '50/50 3bet/call': '#FF4500',
    'call': '#FFB747',
    '50/50 call/fold': '#9ACD32',
    '3bet not bb defend': '#E14444',
    '50/50 3bet/fold': '#8B3A3A',
    '3bet if convenient': '#FFB747',
    '3bet if extremely convenient': '#72BF44'
}
