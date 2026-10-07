// Training drills ("mini-jogos"): short themed rounds that each practise one skill.
// Definitions + per-device progress (best score, stars, unlocks, today's featured drill).
//
// Types:  pair      - tap 2 numbers that make the target with `op` (+ or ×)
//         one       - tap the single number that answers the question (doubles / halves)
//         filter    - tap every number that passes the rule; the others turn to steel (multiples / primes)
//         fractions - tap pizza pieces that add up exactly to the target
// Each drill has its own background (`bg`) and music track (`music`, see music.js DRILL_TRACKS).
// `demo` drives the animated example shown before the round: pieces, which ones the hand taps.
import { lang } from './i18n.js';
import { todayKey } from './stats.js';
import { settings } from './settings.js';

export const DRILLS = [
    {
        id: 'friends10', type: 'pair', op: '+', color: 0x0ea5e9, icon: '10', base: 80, stars: [600, 1500, 2600],
        bg: 'sky', music: 0,
        demo: { pieces: ['3', '7', '5'], taps: [0, 1], prompt: '? + ? = 10' },
        pt: { title: 'Amigos do 10', how: ['Procura 2 números que juntos dão o número de cima.', 'Exemplo: 3 + 7 = 10'], grade: '1.º e 2.º ano' },
        en: { title: 'Friends of 10', how: ['Find 2 numbers that add up to the number at the top.', 'Example: 3 + 7 = 10'], grade: 'Ages 6-8' }
    },
    {
        id: 'doubles', type: 'one', color: 0x16a34a, icon: '2×', base: 80, stars: [600, 1500, 2600],
        bg: 'mint', music: 1,
        demo: { pieces: ['12', '14', '9'], taps: [1], prompt: 'O DOBRO DE 7', promptEn: 'DOUBLE 7' },
        pt: { title: 'Dobros e metades', how: ['Lê a pergunta e toca no número certo.', 'O dobro de 7 é 14. A metade de 14 é 7.'], grade: '1.º e 2.º ano' },
        en: { title: 'Doubles and halves', how: ['Read the question and tap the right number.', 'Double 7 is 14. Half of 14 is 7.'], grade: 'Ages 6-8' }
    },
    {
        id: 'times', type: 'pair', op: '×', color: 0xea580c, icon: '7×8', base: 100, stars: [700, 1700, 2900],
        bg: 'chalk', music: 2,
        demo: { pieces: ['6', '4', '9'], taps: [0, 1], prompt: '? × ? = 24' },
        pt: { title: 'Tabuada relâmpago', how: ['Procura 2 números que multiplicados dão o número de cima.', 'Exemplo: 6 × 4 = 24'], grade: '2.º a 4.º ano' },
        en: { title: 'Times-table flash', how: ['Find 2 numbers that multiply to the number at the top.', 'Example: 6 × 4 = 24'], grade: 'Ages 7-10' }
    },
    {
        id: 'multiples', type: 'filter', rule: 'multiple', color: 0xa855f7, icon: '×3', base: 60, stars: [500, 1300, 2300],
        bg: 'candy', music: 1,
        demo: { pieces: ['6', '7', '9'], taps: [0, 2], prompt: 'MÚLTIPLOS DE 3', promptEn: 'MULTIPLES OF 3' },
        pt: { title: 'Múltiplos', how: ['Toca só nos números da tabuada pedida.', 'Múltiplos de 3: 3, 6, 9, 12... O 7 não é!'], grade: '3.º e 4.º ano' },
        en: { title: 'Multiples', how: ['Tap only the numbers in the times table shown.', 'Multiples of 3: 3, 6, 9, 12... 7 is not!'], grade: 'Ages 8-10' }
    },
    {
        id: 'pizza', type: 'fractions', color: 0xd97706, icon: '½', base: 150, stars: [600, 1500, 2600],
        bg: 'kitchen', music: 0,
        demo: { pieces: ['1/4', '1/4', '1/2'], taps: [0, 1], prompt: 'FAZ MEIA PIZZA', promptEn: 'MAKE HALF A PIZZA' },
        pt: { title: 'Frações em pizza', how: ['Junta fatias até ficar igual à pizza pedida.', 'Exemplo: 1/4 + 1/4 = meia pizza'], grade: '3.º a 5.º ano' },
        en: { title: 'Pizza fractions', how: ['Add slices until you match the pizza asked for.', 'Example: 1/4 + 1/4 = half a pizza'], grade: 'Ages 8-11' }
    },
    {
        id: 'primes', type: 'filter', rule: 'prime', color: 0x0d9488, icon: '7', base: 60, stars: [500, 1300, 2300],
        bg: 'ocean', music: 2,
        demo: { pieces: ['5', '9', '7'], taps: [0, 2], prompt: 'TOCA NOS PRIMOS', promptEn: 'TAP THE PRIMES' },
        pt: { title: 'Caça aos primos', how: ['Toca só nos números primos.', 'Primo só se divide por 1 e por ele próprio: 2, 3, 5, 7, 11...'], grade: '5.º e 6.º ano' },
        en: { title: 'Prime hunt', how: ['Tap only the prime numbers.', 'A prime divides only by 1 and itself: 2, 3, 5, 7, 11...'], grade: 'Ages 10-12' }
    }
];

export const DRILL_MS = 60000;
export const BONUS_MS = 20000;

export function drillText(d) {
    return d[lang()] || d.en;
}

export function drillById(id) {
    return DRILLS.find((d) => d.id === id) || DRILLS[0];
}

// ------------------------------------------------------------------ progress

const KEY = 'mm-drills';

function load() {
    try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; }
}

export function drillProgress(id) {
    const p = load()[id] || {};
    return { best: p.best || 0, stars: p.stars || 0 };
}

export function starsFor(d, score) {
    return d.stars.filter((s) => score >= s).length;
}

// Saves a finished round; returns { stars, best, isRecord, newStars }
export function recordDrill(d, score) {
    const all = load();
    const prev = all[d.id] || { best: 0, stars: 0 };
    const stars = starsFor(d, score);
    const next = { best: Math.max(prev.best || 0, score), stars: Math.max(prev.stars || 0, stars) };
    all[d.id] = next;
    try { localStorage.setItem(KEY, JSON.stringify(all)); } catch { /* private mode */ }
    return { stars, best: next.best, isRecord: score > (prev.best || 0) && score > 0, newStars: next.stars - (prev.stars || 0) };
}

// The first drill is open; each next one opens with 1 star on the previous
export function isUnlocked(index) {
    if (settings.get('god')) return true;
    return index === 0 || drillProgress(DRILLS[index - 1].id).stars >= 1 || drillProgress(DRILLS[index].id).stars >= 1;
}

// One drill a day pays double beans (same for everyone)
export function featuredDrill() {
    const k = todayKey();
    let h = 0;
    for (let i = 0; i < k.length; i++) h = (h * 31 + k.charCodeAt(i)) >>> 0;
    return DRILLS[h % DRILLS.length].id;
}

// ------------------------------------------------------------------ maths helpers

export function isPrime(n) {
    if (n < 2) return false;
    for (let d = 2; d * d <= n; d++) if (n % d === 0) return false;
    return true;
}

export function smallestFactor(n) {
    for (let d = 2; d * d <= n; d++) if (n % d === 0) return d;
    return n;
}

// Fractions are kept in 24ths (every denominator used divides 24)
export const F = 24;
export const fracValue = ([n, d]) => (n * F) / d;
const gcd = (a, b) => (b ? gcd(b, a % b) : a);

export function fracLabel(v24) {
    if (v24 === 0) return '0';
    if (v24 % F === 0) return String(v24 / F);
    const g = gcd(v24, F);
    return `${v24 / g}/${F / g}`;
}

// Words for the pizza targets (what a child would say)
export function fracWords(v24) {
    const pt = { 24: '1 PIZZA INTEIRA', 12: 'MEIA PIZZA', 18: '3 QUARTOS DE PIZZA', 6: '1 QUARTO DE PIZZA', 48: '2 PIZZAS' };
    const en = { 24: 'A WHOLE PIZZA', 12: 'HALF A PIZZA', 18: 'THREE QUARTERS', 6: 'A QUARTER', 48: '2 PIZZAS' };
    return (lang() === 'pt' ? pt : en)[v24] || fracLabel(v24);
}

// ------------------------------------------------------------------ stages (harder every 5 correct)

export const STAGES = {
    friends10: [10, 20, 100],                         // the sum to reach
    doubles: [
        { kinds: ['double'], max: 10 },
        { kinds: ['half'], max: 20 },
        { kinds: ['double', 'half'], max: 50 }
    ],
    times: [[2, 5, 10], [2, 3, 4, 5, 10], [2, 3, 4, 5, 6, 7, 8, 9, 10]],
    multiples: [[2, 5, 10], [3, 4], [6, 7, 8, 9]],     // the "multiples of k" picked from these
    primes: [20, 50, 99],                              // the range of numbers
    pizza: [
        { pieces: [[1, 2], [1, 4], [2, 4], [3, 4]], targets: [[1, 1], [1, 2]] },
        { pieces: [[1, 2], [1, 4], [3, 4], [1, 3], [2, 3], [1, 6]], targets: [[1, 1], [1, 2]] },
        { pieces: [[1, 2], [1, 4], [3, 4], [1, 3], [2, 3], [1, 6], [1, 8], [3, 8]], targets: [[1, 1], [1, 2], [3, 4]] }
    ]
};

// A random set of 2-3 pieces from the stage that adds up to the target (for solvability)
export function fractionSplit(stage, target24) {
    const vals = STAGES.pizza[stage].pieces;
    for (let tries = 0; tries < 200; tries++) {
        const k = 2 + (Math.random() < 0.35 ? 1 : 0);
        const pick = Array.from({ length: k }, () => vals[Math.floor(Math.random() * vals.length)]);
        if (pick.reduce((a, f) => a + fracValue(f), 0) === target24) return pick;
    }
    const single = vals.find((f) => fracValue(f) === target24);
    return single ? [single] : [[1, 2], [1, 2]];
}
