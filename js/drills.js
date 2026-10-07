// Training drills ("mini-níveis"): short themed rounds that each practise one skill.
// Definitions + per-device progress (best score, stars, unlocks, today's featured drill).
import { lang } from './i18n.js';
import { todayKey } from './stats.js';

export const DRILLS = [
    {
        id: 'times', type: 'product', color: 0xea580c, icon: '7×8', base: 100, stars: [700, 1700, 2900],
        pt: { title: 'Tabuada relâmpago', how: 'Toca nos 2 números cuja multiplicação dá o resultado.', grade: '2.º a 4.º ano' },
        en: { title: 'Times-table flash', how: 'Tap the 2 numbers that multiply to the target.', grade: 'Ages 7-10' }
    },
    {
        id: 'primes', type: 'primes', color: 0x0d9488, icon: '7', base: 60, stars: [500, 1300, 2300],
        pt: { title: 'Caça aos primos', how: 'Toca só nos números primos. Os outros viram ferro!', grade: '5.º e 6.º ano' },
        en: { title: 'Prime hunt', how: 'Tap only the prime numbers. The others turn to steel!', grade: 'Ages 10-12' }
    },
    {
        id: 'pizza', type: 'fractions', color: 0xd97706, icon: '½', base: 150, stars: [600, 1500, 2600],
        pt: { title: 'Frações em pizza', how: 'Junta fatias até fazer a fração pedida.', grade: '3.º a 5.º ano' },
        en: { title: 'Pizza fractions', how: 'Add slices until you make the target fraction.', grade: 'Ages 8-11' }
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
    return index === 0 || drillProgress(DRILLS[index - 1].id).stars >= 1;
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

// Pieces and targets by stage (stages advance with correct answers)
export const FRACTION_STAGES = [
    { pieces: [[1, 2], [1, 4], [2, 4], [3, 4]], targets: [[1, 1], [1, 2]] },
    { pieces: [[1, 2], [1, 4], [3, 4], [1, 3], [2, 3], [1, 6]], targets: [[1, 1], [1, 2]] },
    { pieces: [[1, 2], [1, 4], [3, 4], [1, 3], [2, 3], [1, 6], [1, 8], [3, 8]], targets: [[1, 1], [1, 2], [3, 4]] }
];

export const TIMES_STAGES = [[2, 5, 10], [2, 3, 4, 5, 10], [2, 3, 4, 5, 6, 7, 8, 9, 10]];
export const PRIME_STAGES = [20, 50, 99];

// A random set of 2-3 pieces from the stage that adds up to the target (for solvability)
export function fractionSplit(stage, target24) {
    const vals = FRACTION_STAGES[stage].pieces;
    for (let tries = 0; tries < 200; tries++) {
        const k = 2 + (Math.random() < 0.35 ? 1 : 0);
        const pick = Array.from({ length: k }, () => vals[Math.floor(Math.random() * vals.length)]);
        if (pick.reduce((a, f) => a + fracValue(f), 0) === target24) return pick;
    }
    const single = vals.find((f) => fracValue(f) === target24);
    return single ? [single] : [[1, 2], [1, 2]];
}
