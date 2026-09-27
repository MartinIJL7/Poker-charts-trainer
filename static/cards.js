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

// Appends a face-up card centered at (x, y): a suit-tinted rounded rect
// plus the rank alone. The suit is shown only through the fill color,
// which comes entirely from CSS (cr-card-face--<suit>). Returns the
// card's group so the caller can position/rotate it via a transform on
// top of the (x, y) centering.
export function renderCardFace(svg, x, y, w, h, rank, suit) {
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
