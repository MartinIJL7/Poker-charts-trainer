# pos = random.choice(positions)

# # ----- TEST OVERRIDE -----
# test_hand = request.args.get('hand')
# test_pos = request.args.get('pos')
# if test_hand and test_hand in ALL_HANDS:
#     if test_pos and test_pos in positions:
#         pos = test_pos
#     elif test_pos and test_pos not in positions:
#         return f"Position {test_pos} not in this mode", 400
#     hand = test_hand
#     status = get_hand_status(hand, pos, config)
#     correct_text = get_correct_answer_text(status)
#     possible_statuses = get_possible_statuses(pos, config)
#     possible_answers = sorted(set(
#         get_correct_answer_text(st) for st in possible_statuses if get_correct_answer_text(st)
#     ))
#     session['question_start_time'] = datetime.utcnow().timestamp()
#     session['pos'] = pos
#     session['hand'] = hand
#     session['status'] = status
#     session['correct_text'] = correct_text
#     stats = session['stats']
#     return render_template(
#         'training.html',
#         mode=mode,
#         pos=pos,
#         hand=hand,
#         possible_answers=possible_answers,
#         stats=stats,
#         show_result=False
#     )
# # ----- END TEST OVERRIDE -----

# hand = select_weighted_hand(current_user.id, pos)

# url example: http://localhost:5000/training/RFI?hand=K9o&pos=RFI_MP