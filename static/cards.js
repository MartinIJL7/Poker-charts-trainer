// cards.js
// Playing-card helpers shared by any page that shows real hole cards:
// turning a hand-class string into two concrete cards, and drawing a
// single face-up card into an SVG.

const SVG_NS = 'http://www.w3.org/2000/svg';

const SUITS = ['s', 'h', 'd', 'c'];

function randomSuit() {
    return SUITS[Math.floor(Math.random() * SUITS.length)];
}

// Two distinct random suits, in random order.
function twoDifferentSuits() {
    const first = randomSuit();
    let second = randomSuit();
    while (second === first) {
        second = randomSuit();
    }
    return [first, second];
}

// Deals a concrete pair of cards for a hand class like 'AA', 'AKs' or
// '72o'. Pairs and offsuit hands get two different suits, suited hands
// share one. Every call re-rolls the suits independently.
export function handToCards(hand) {
    const rank1 = hand[0];
    const rank2 = hand[1];
    const kind = hand[2];

    if (kind === 's') {
        const suit = randomSuit();
        return [{ rank: rank1, suit: suit }, { rank: rank2, suit: suit }];
    }

    // A pair ('AA') and an offsuit hand ('72o') both need different suits.
    const suits = twoDifferentSuits();
    return [{ rank: rank1, suit: suits[0] }, { rank: rank2, suit: suits[1] }];
}

// Deck styles a user can pick. 'default' is a suit-tinted rect with the rank
// alone; 'minimal' and 'minimal4' are white cards with the rank and suit in
// the corner and one big suit symbol, in two colors or four. All are drawn
// in code - no image files.
const MINIMAL_DECKS = { minimal: '2c', minimal4: '4c' };

function isMinimalDeck(deck) {
    return Object.prototype.hasOwnProperty.call(MINIMAL_DECKS, deck);
}

// Suit shapes in a 100x100 box, centered; each entry is [tag, attributes].
const SUIT_SHAPES = {
    s: [['path', { d: 'M50 6C50 6 10 38 10 60C10 74 21 82 33 82C40 82 46 79 48 74C47 84 43 90 36 94L64 94C57 90 53 84 52 74C54 79 60 82 67 82C79 82 90 74 90 60C90 38 50 6 50 6Z' }]],
    h: [['path', { d: 'M50 90C18 64 8 46 8 31C8 17 19 8 31 8C40 8 47 13 50 21C53 13 60 8 69 8C81 8 92 17 92 31C92 46 82 64 50 90Z' }]],
    d: [['path', { d: 'M50 5L83 50L50 95L17 50Z' }]],
    c: [
        ['circle', { cx: 50, cy: 28, r: 21 }],
        ['circle', { cx: 27, cy: 63, r: 21 }],
        ['circle', { cx: 73, cy: 63, r: 21 }],
        ['circle', { cx: 50, cy: 54, r: 13 }],
        ['path', { d: 'M50 52C50 72 46 85 35 95L65 95C54 85 50 72 50 52Z' }]
    ]
};

// Appends one suit symbol of the given size, centered at (cx, cy), to `parent`.
function appendSuitSymbol(parent, suit, cx, cy, size) {
    const symbol = document.createElementNS(SVG_NS, 'g');
    symbol.setAttribute('transform', 'translate(' + (cx - size / 2) + ',' + (cy - size / 2) + ') scale(' + (size / 100) + ')');
    SUIT_SHAPES[suit].forEach(function(shape) {
        const el = document.createElementNS(SVG_NS, shape[0]);
        Object.keys(shape[1]).forEach(function(name) { el.setAttribute(name, shape[1][name]); });
        symbol.appendChild(el);
    });
    parent.appendChild(symbol);
}

// White card, rank + small suit in the top-left corner, one big suit below.
// Everything is laid out in fractions of the card size, so it scales with it.
function renderMinimalFace(svg, x, y, w, h, rank, suit, scheme) {
    const group = document.createElementNS(SVG_NS, 'g');
    // Colors come from CSS: cr-card-min--<2c|4c> + cr-card-min--<suit>
    group.setAttribute('class', 'cr-card-min cr-card-min--' + scheme + ' cr-card-min--' + suit);

    const body = document.createElementNS(SVG_NS, 'g');
    body.setAttribute('transform', 'translate(' + (x - w / 2) + ',' + (y - h / 2) + ')');
    group.appendChild(body);

    const rect = document.createElementNS(SVG_NS, 'rect');
    rect.setAttribute('width', w);
    rect.setAttribute('height', h);
    rect.setAttribute('rx', 4);
    rect.setAttribute('class', 'cr-card-min-face');
    body.appendChild(rect);

    const label = rank === 'T' ? '10' : rank;
    const text = document.createElementNS(SVG_NS, 'text');
    text.setAttribute('x', w * 0.09);
    text.setAttribute('y', h * 0.3);
    text.setAttribute('font-size', h * (label.length > 1 ? 0.25 : 0.31));
    text.setAttribute('class', 'cr-card-min-rank');
    text.textContent = label;
    body.appendChild(text);

    // The corner suit is half the size of the big one
    appendSuitSymbol(body, suit, w * 0.2, h * 0.43, w * 0.3);
    appendSuitSymbol(body, suit, w * 0.62, h * 0.72, w * 0.6);

    svg.appendChild(group);
    return group;
}

// Appends a face-up card centered at (x, y). The minimal decks are drawn by
// renderMinimalFace; the default is a suit-tinted rounded rect plus the rank
// alone, where the suit is shown only through the fill color, which comes
// entirely from CSS (cr-card-face--<suit>). Returns the card's group so the
// caller can position/rotate it via a transform on top of the (x, y) centering.
export function renderCardFace(svg, x, y, w, h, rank, suit, deck) {
    if (isMinimalDeck(deck)) return renderMinimalFace(svg, x, y, w, h, rank, suit, MINIMAL_DECKS[deck]);

    const group = document.createElementNS(SVG_NS, 'g');

    const rect = document.createElementNS(SVG_NS, 'rect');
    rect.setAttribute('x', x - w / 2);
    rect.setAttribute('y', y - h / 2);
    rect.setAttribute('width', w);
    rect.setAttribute('height', h);
    rect.setAttribute('rx', 4);
    rect.setAttribute('class', 'cr-card-face cr-card-face--' + suit);
    group.appendChild(rect);

    const text = document.createElementNS(SVG_NS, 'text');
    text.setAttribute('x', x);
    text.setAttribute('y', y);
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('dominant-baseline', 'central');
    text.setAttribute('class', 'cr-card-face-rank');
    text.textContent = rank;
    group.appendChild(text);

    svg.appendChild(group);
    return group;
}
