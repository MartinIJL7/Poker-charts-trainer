// situation_table.js
// Render-only SVG poker-table diagram (felt, seats, stacks, bets, dealer
// button, hole cards), shared by the range editor and the training page.
// Editing the situation is the caller's business - this module only
// knows how to build/rotate a situation object and draw it.

import { renderCardFace, isImageDeck } from './cards.js';

// -------------------------------------------------------------------
// Canonical positions + situation helpers
// -------------------------------------------------------------------

// Canonical seat-position labels per player count, in fixed clockwise
// table order (index 0 = earliest to act, last two are always SB/BB).
// This is a wholly separate concept from the free-text #position (range
// name) input in the editor - the two never interact. 5-max/6-max use
// MP/EP for the earliest seats rather than LJ/HJ, since at those sizes
// there isn't room for a genuinely distinct lojack/hijack.
export const CANONICAL_POSITIONS = {
    2: ['BTN', 'BB'],
    3: ['BTN', 'SB', 'BB'],
    4: ['CO', 'BTN', 'SB', 'BB'],
    5: ['MP', 'CO', 'BTN', 'SB', 'BB'],
    6: ['EP', 'MP', 'CO', 'BTN', 'SB', 'BB'],
    7: ['UTG', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'],
    8: ['UTG', 'UTG+1', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'],
    9: ['UTG', 'UTG+1', 'MP', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB']
};

// Builds a fresh canonical-order seat array for numPlayers, carrying over
// stack/bet/folded from `previous` for any position label present at
// both counts (so nudging the player count by +-1 doesn't wipe
// everything). Falls hero back to BTN if the previous hero position
// doesn't exist at the new count. Whoever ends up hero is always
// unfolded.
export function buildSeatsForPlayerCount(numPlayers, previous) {
    const order = CANONICAL_POSITIONS[numPlayers];
    const previousByPosition = {};
    (previous.seats || []).forEach(function(seat) {
        previousByPosition[seat.position] = seat;
    });

    let heroPosition = previous.hero_position;
    if (order.indexOf(heroPosition) === -1) {
        heroPosition = 'BTN';
    }

    const seats = order.map(function(pos) {
        const prevSeat = previousByPosition[pos];
        const isHero = pos === heroPosition;
        return {
            position: pos,
            stack: prevSeat ? prevSeat.stack : 100,
            bet: prevSeat ? prevSeat.bet : 0,
            folded: isHero ? false : (prevSeat ? prevSeat.folded : false)
        };
    });

    return { num_players: numPlayers, hero_position: heroPosition, seats: seats };
}

export function getDefaultSituation() {
    return buildSeatsForPlayerCount(6, { hero_position: 'BTN', seats: [] });
}

export function roundBb(value) {
    return Math.round(value * 100) / 100;
}

export function totalPot(situationObj) {
    return situationObj.seats.reduce(function(sum, seat) { return sum + seat.bet; }, 0);
}

// Reorders seats starting at hero (bottom of the table) going clockwise,
// so the SVG diagram and the editor's seat table always agree on seat
// order. Purely a display concern - seats stay stored in canonical order.
export function rotateForDisplay(situationObj) {
    const order = CANONICAL_POSITIONS[situationObj.num_players];
    const heroIndex = order.indexOf(situationObj.hero_position);
    const seatsByPosition = {};
    situationObj.seats.forEach(function(seat) { seatsByPosition[seat.position] = seat; });
    const n = order.length;
    const display = [];
    for (let i = 0; i < n; i++) {
        display.push(seatsByPosition[order[(heroIndex + i) % n]]);
    }
    return display;
}

// -------------------------------------------------------------------
// SVG helpers
// -------------------------------------------------------------------

export const SVG_NS = 'http://www.w3.org/2000/svg';

export function createSvgEl(tag, attrs) {
    const el = document.createElementNS(SVG_NS, tag);
    for (const key in attrs) {
        el.setAttribute(key, attrs[key]);
    }
    return el;
}

// Greedy denomination breakdown for the chip-stack graphic: a handful of
// higher-value chips instead of one-chip-per-bb, so e.g. 10bb reads as a
// single "10" chip rather than ten "1" chips. Reuses only existing design
// tokens for chip colors (see the cr-chip-d* CSS classes).
export const CHIP_DENOMINATIONS = [
    { value: 100, cls: 'cr-chip-d100' },
    { value: 25, cls: 'cr-chip-d25' },
    { value: 10, cls: 'cr-chip-d10' },
    { value: 5, cls: 'cr-chip-d5' },
    { value: 1, cls: 'cr-chip-d1' },
    { value: 0.5, cls: 'cr-chip-d05' }
];

export function breakIntoChips(amount, maxChips) {
    let remaining = roundBb(amount);
    const chips = [];
    for (let i = 0; i < CHIP_DENOMINATIONS.length && chips.length < maxChips; i++) {
        const denom = CHIP_DENOMINATIONS[i];
        while (remaining >= denom.value - 0.001 && chips.length < maxChips) {
            chips.push(denom);
            remaining = roundBb(remaining - denom.value);
        }
    }
    return chips;
}

// -------------------------------------------------------------------
// Geometry
// -------------------------------------------------------------------

// Geometry constants for the table diagram, verified offline (script,
// not eyeballed): every element stays in-bounds with >=12px clearance
// from every other element, for all player counts 2-9, with every seat
// betting simultaneously, for every possible button seat. Changing any
// of these means re-running that check - the layout has no slack to
// spare at 9 players.
export const TABLE_VIEW_W = 720, TABLE_VIEW_H = 430;
export const TABLE_CX = 360, TABLE_CY = 215;
// The felt is a stadium (a rectangle with semicircular caps), i.e. the
// corner radius equals the half-height - the shape of a real poker
// table, and the reason seatOutlineRadius() below can be exact.
export const FELT_HALF_W = 290, FELT_HALF_H = 148;
export const FELT_CORNER_R = FELT_HALF_H;

// Seat plates are rounded rectangles, not circles: a circle wide enough
// for "UTG+1" plus a stack figure wastes a lot of vertical space, and
// vertical space is what the bet markers need.
export const SEAT_W = 92, SEAT_H = 52, SEAT_CORNER_R = 13;

// Every seat's hole cards sit straight ABOVE its plate (screen-up, not
// "away from the table center"), top and bottom rows alike, tucked a
// couple of pixels behind the plate's top edge. Vertical rather than
// radial keeps the side seats' cards from sticking out sideways.
export const CARD_GAP = 38;
export const CARD_W = 27, CARD_H = 37;
// Side-by-side, barely tilted - a wide fan around a shared center made
// the two cards sit almost on top of each other and read as one blob.
export const CARD_SPREAD = 12, CARD_TILT = 5;

// Hero's two cards are drawn larger: hollow placeholders in the editor,
// the real dealt hand on the training screen (same slot either way), so
// the space above the hero plate is deliberately kept free of everything
// else.
export const HERO_CARD_W = 40, HERO_CARD_H = 54;
export const HERO_CARD_GAP = 61;
export const HERO_CARD_SPREAD = 23, HERO_CARD_TILT = 0;
// Image decks (full pips / face art) are unreadable at 40x54, so they get a
// bigger card. The bottom edge stays where the default cards' is
// (HERO_CARD_GAP - HERO_CARD_H / 2 above the plate center); the extra
// height grows upward, into space nothing else uses.
export const HERO_IMAGE_CARD_W = 50, HERO_IMAGE_CARD_H = 70;
export const HERO_IMAGE_CARD_SPREAD = 27;
export const HERO_IMAGE_CARD_GAP = HERO_CARD_GAP - HERO_CARD_H / 2 + HERO_IMAGE_CARD_H / 2;

export function heroCardGap(deckStyle) {
    return isImageDeck(deckStyle) ? HERO_IMAGE_CARD_GAP : HERO_CARD_GAP;
}

// Hero's bet is placed by hand, not on the ring: to the right of the hero
// plate, like a real client. That needs a wide gap between hero and the
// seat on hero's right, so the two seats next to hero are pushed outward
// to at least this distance from the table's vertical axis (see
// seatAngleFor).
export const HERO_BET_GAP_X = 10, HERO_BET_DY = -14;
export const HERO_NEIGHBOR_MIN_X = 180;

// Bet markers sit on a scaled copy of the seat outline.
export const BET_RING_FACTOR = 0.6;
// A bet marker is laid out HORIZONTALLY - amount text, then the chip
// stack - and centered on its point on that ring. The table is far wider
// than it is tall, so a horizontal footprint is the cheap direction;
// stacking the label above/below/behind the chips (every previous
// attempt) spent the one axis that has no room.
export const BET_FONT_SIZE = 15;
// Deliberately generous per-character width (0.6em vs ~0.55em actual for
// digits) so the clearance check errs toward the label being too wide.
export const BET_CHAR_W = BET_FONT_SIZE * 0.6;
export const BET_TEXT_CHIP_GAP = 4;
export const BET_MAX_CHIPS = 4;

// Thin chips: a low-profile stack reads as chips at this scale without
// claiming the vertical space a chunkier ellipse would.
export const CHIP_RX = 7, CHIP_RY = 4, CHIP_STEP = 3.2;

export const BTN_CHIP_R = 10;
// The button chip is pinned to the corner of its seat plate (inward
// side), overlapping it like a badge. Offsetting it *away* from the seat
// instead - the obvious placement - pushes it into the neighbouring seat
// at 9 players, where seats are only ~60px apart.
export const BTN_CHIP_RADIAL_F = 1.0, BTN_CHIP_TANGENT_F = 0.9;

// Distance from the table center to the felt outline along `theta`.
// Exact for a stadium: either the ray exits through a flat edge, or
// through one of the two end caps.
export function seatOutlineRadius(theta) {
    const c = Math.cos(theta), s = Math.sin(theta);
    const flat = FELT_HALF_W - FELT_CORNER_R;
    if (Math.abs(s) > 1e-9) {
        const t = FELT_HALF_H / Math.abs(s);
        if (Math.abs(t * c) <= flat) return t;
    }
    const cc = c >= 0 ? flat : -flat;
    const disc = (cc * c) * (cc * c) - cc * cc + FELT_CORNER_R * FELT_CORNER_R;
    return cc * c + Math.sqrt(Math.max(disc, 0));
}

// Angle (radians, SVG orientation) of display seat `i` of `n`. Seats are
// evenly spaced starting from hero at the bottom, except that the two
// seats beside hero are moved outward when an even spacing would leave
// no room for hero's bet between them and hero.
export function seatAngleFor(i, n) {
    const base = (Math.PI / 2) + i * (2 * Math.PI / n);
    const nextToHero = (i === 1 || i === n - 1);
    if (!nextToHero || Math.sin(base) < 0.3) return base;
    const flat = FELT_HALF_W - FELT_CORNER_R;
    const baseX = Math.abs(seatOutlineRadius(base) * Math.cos(base));
    if (baseX >= HERO_NEIGHBOR_MIN_X) return base;
    const dxCap = Math.max(HERO_NEIGHBOR_MIN_X - flat, 0);
    const y = dxCap > 0 ? Math.sqrt(FELT_CORNER_R * FELT_CORNER_R - dxCap * dxCap) : FELT_HALF_H;
    const x = Math.cos(base) < 0 ? -HERO_NEIGHBOR_MIN_X : HERO_NEIGHBOR_MIN_X;
    return Math.atan2(y, x);
}

// -------------------------------------------------------------------
// Drawing
// -------------------------------------------------------------------

// Draws a stack of overlapping chip ellipses growing upward from a
// vertical center at (x, y).
export function renderChipStack(svg, x, y, amount, maxChips) {
    if (amount <= 0) return;
    const chips = breakIntoChips(amount, maxChips || BET_MAX_CHIPS);
    const bottomY = y + (chips.length - 1) * CHIP_STEP / 2;
    chips.forEach(function(chip, idx) {
        svg.appendChild(createSvgEl('ellipse', {
            cx: x, cy: bottomY - idx * CHIP_STEP, rx: CHIP_RX, ry: CHIP_RY,
            class: 'cr-situation-chip ' + chip.cls
        }));
    });
}

// Two card backs marking a seat as still in the hand - folded seats get
// none (on top of the opacity fade already applied). The hero variant is
// bigger: hollow placeholders by default, or the real face-up cards when
// heroCards ([{rank, suit}, {rank, suit}]) is given. heroCards is only
// ever passed for the hero seat.
export function renderCardsGlyph(svg, x, y, isHero, heroCards, deckStyle) {
    const showFaces = isHero && heroCards;
    const bigFaces = showFaces && isImageDeck(deckStyle);
    const w = bigFaces ? HERO_IMAGE_CARD_W : (isHero ? HERO_CARD_W : CARD_W);
    const h = bigFaces ? HERO_IMAGE_CARD_H : (isHero ? HERO_CARD_H : CARD_H);
    const spread = bigFaces ? HERO_IMAGE_CARD_SPREAD : (isHero ? HERO_CARD_SPREAD : CARD_SPREAD);
    const tilt = isHero ? HERO_CARD_TILT : CARD_TILT;
    [-1, 1].forEach(function(side, idx) {
        const transform = 'translate(' + (x + side * spread) + ',' + y + ') rotate(' + (side * tilt) + ')';
        if (showFaces) {
            const card = heroCards[idx];
            const face = renderCardFace(svg, 0, 0, w, h, card.rank, card.suit, deckStyle);
            face.setAttribute('transform', transform);
            return;
        }
        svg.appendChild(createSvgEl('rect', {
            x: -w / 2, y: -h / 2, width: w, height: h, rx: 4,
            class: 'cr-situation-card' + (isHero ? ' cr-situation-card--hero' : ''),
            transform: transform
        }));
    });
}

// A range name can be long ("3bet_SB_vs_BTN" and the like); keep it inside
// the felt by shrinking the font, never below a readable size. Needs the text
// to be in the DOM; a hidden svg measures 0 and is left as is.
const RANGE_NAME_MAX_W = 460;
const RANGE_NAME_MIN_FONT_PX = 12;
function fitRangeNameToFelt(textEl) {
    if (!textEl.getComputedTextLength()) return;
    let size = parseFloat(getComputedStyle(textEl).fontSize) || 17;
    while (textEl.getComputedTextLength() > RANGE_NAME_MAX_W && size > RANGE_NAME_MIN_FONT_PX) {
        size -= 1;
        textEl.style.fontSize = size + 'px';
    }
}

// A nickname can be much wider than a position name. Shrink the font until
// the text fits inside the plate (with a little padding), and only then cut
// it with an ellipsis. Needs the label to be in the DOM to be measured; a
// hidden svg measures 0, in which case the label is left as is.
const NICKNAME_MIN_FONT_PX = 11;
function fitLabelToPlate(label) {
    const maxW = SEAT_W - 12;
    const fullText = label.textContent;
    let size = parseFloat(getComputedStyle(label).fontSize) || 16;
    if (!label.getComputedTextLength()) return;
    while (label.getComputedTextLength() > maxW && size > NICKNAME_MIN_FONT_PX) {
        size -= 1;
        label.style.fontSize = size + 'px';
    }
    let text = fullText;
    while (label.getComputedTextLength() > maxW && text.length > 1) {
        text = text.slice(0, -1);
        label.textContent = text.trimEnd() + '…';
    }
}

// Rebuilds the table SVG inside `svg` from scratch. Cheap enough to call
// on every keystroke - a handful of shapes/text nodes, no measurable
// cost. options.heroCards ([{rank, suit}, {rank, suit}]) swaps hero's
// placeholder cards for the real hand; omit it for placeholders.
// options.seatNames ({position: nickname}) replaces the seat labels with
// nicknames, display-only - seat.position stays the logic key.
// options.deckStyle ('default' | 'classic' | 'fourcolor') picks the card
// artwork for heroCards.
export function renderSituationTable(svg, situationObj, options) {
    const heroCards = options && options.heroCards;
    const seatNames = options && options.seatNames;
    const deckStyle = options && options.deckStyle;
    // A string here means "this range has no table": draw an empty table
    // with only the hero's plate and cards, and this text (the range name)
    // in the center instead of the pot.
    const emptyLabel = options && options.emptyLabel;
    const emptyView = typeof emptyLabel === 'string';
    svg.innerHTML = '';

    svg.appendChild(createSvgEl('rect', {
        x: TABLE_CX - FELT_HALF_W, y: TABLE_CY - FELT_HALF_H,
        width: FELT_HALF_W * 2, height: FELT_HALF_H * 2,
        rx: FELT_CORNER_R, ry: FELT_CORNER_R,
        class: 'cr-situation-table-felt'
    }));

    const potText = createSvgEl('text', {
        x: TABLE_CX, y: TABLE_CY, 'text-anchor': 'middle',
        class: emptyView ? 'cr-situation-range-name-svg' : 'cr-situation-pot-label-svg'
    });
    potText.textContent = emptyView ? emptyLabel : 'Банк: ' + roundBb(totalPot(situationObj)) + ' bb';
    svg.appendChild(potText);
    if (emptyView) fitRangeNameToFelt(potText);

    const display = rotateForDisplay(situationObj);
    const n = display.length;

    display.forEach(function(seat, i) {
        if (emptyView && i > 0) return;   // hero is display slot 0; nobody else sits at an empty table
        const angle = seatAngleFor(i, n);
        const ux = Math.cos(angle), uy = Math.sin(angle);
        // Seats sit ON the felt outline itself (not on an inscribed
        // ellipse), so every seat straddles the rail at the same depth
        // whatever direction it's in.
        const outlineR = seatOutlineRadius(angle);
        const sx = TABLE_CX + outlineR * ux;
        const sy = TABLE_CY + outlineR * uy;
        const isHero = seat.position === situationObj.hero_position;

        let seatClass = 'cr-situation-seat';
        if (isHero) seatClass += ' cr-situation-seat--hero';
        if (seat.folded) seatClass += ' cr-situation-seat--folded';

        if (!seat.folded) {
            if (isHero) {
                renderCardsGlyph(svg, sx, sy - (heroCards ? heroCardGap(deckStyle) : HERO_CARD_GAP), true, heroCards, deckStyle);
            } else {
                renderCardsGlyph(svg, sx, sy - CARD_GAP, false);
            }
        }

        const group = createSvgEl('g', { class: seatClass });
        group.appendChild(createSvgEl('rect', {
            x: sx - SEAT_W / 2, y: sy - SEAT_H / 2, width: SEAT_W, height: SEAT_H,
            rx: SEAT_CORNER_R, ry: SEAT_CORNER_R
        }));

        // Without a stack line under it the label sits in the plate's vertical middle
        const label = createSvgEl('text', { x: sx, y: emptyView ? sy + 6 : sy - 7, 'text-anchor': 'middle', class: 'cr-situation-seat-label' });
        const nickname = seatNames && seatNames[seat.position];
        label.textContent = nickname || seat.position;
        group.appendChild(label);

        if (!emptyView) {
            const stackText = createSvgEl('text', { x: sx, y: sy + 17, 'text-anchor': 'middle', class: 'cr-situation-seat-stack' });
            stackText.textContent = roundBb(seat.stack);
            group.appendChild(stackText);
        }

        svg.appendChild(group);
        if (nickname) fitLabelToPlate(label);

        if (!emptyView && seat.bet > 0) {
            const betLabelText = String(roundBb(seat.bet));
            const textW = betLabelText.length * BET_CHAR_W;
            const unitW = textW + BET_TEXT_CHIP_GAP + CHIP_RX * 2;
            let leftX, by;
            if (isHero) {
                leftX = sx + SEAT_W / 2 + HERO_BET_GAP_X;
                by = sy + HERO_BET_DY;
            } else {
                leftX = TABLE_CX + outlineR * BET_RING_FACTOR * ux - unitW / 2;
                by = TABLE_CY + outlineR * BET_RING_FACTOR * uy;
            }

            const betText = createSvgEl('text', {
                x: leftX, y: by + BET_FONT_SIZE * 0.35, 'text-anchor': 'start',
                class: 'cr-situation-bet-chip-label'
            });
            betText.textContent = betLabelText;
            svg.appendChild(betText);

            renderChipStack(svg, leftX + textW + BET_TEXT_CHIP_GAP + CHIP_RX, by, seat.bet, BET_MAX_CHIPS);
        }

        if (!emptyView && seat.position === 'BTN') {
            let btnX, btnY;
            if (uy > -0.3) {
                // Every seat except the top row has its inward side facing the
                // cards' height, so the dealer chip goes on the plate's lower
                // corner facing the table's vertical axis instead.
                const dir = ux < -0.01 ? 1 : -1;
                btnX = sx + dir * (SEAT_W / 2) * BTN_CHIP_TANGENT_F;
                btnY = sy + SEAT_H / 2;
            } else {
                const tx = -uy, ty = ux;
                btnX = sx - ux * (SEAT_H / 2) * BTN_CHIP_RADIAL_F + tx * (SEAT_W / 2) * BTN_CHIP_TANGENT_F;
                btnY = sy - uy * (SEAT_H / 2) * BTN_CHIP_RADIAL_F + ty * (SEAT_W / 2) * BTN_CHIP_TANGENT_F;
            }
            svg.appendChild(createSvgEl('circle', { cx: btnX, cy: btnY, r: BTN_CHIP_R, class: 'cr-situation-button-chip' }));
            const dText = createSvgEl('text', { x: btnX, y: btnY + 4, 'text-anchor': 'middle', class: 'cr-situation-button-chip-label' });
            dText.textContent = 'D';
            svg.appendChild(dText);
        }
    });
}
