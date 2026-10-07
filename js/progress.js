// Meta progression, persisted per device: coffee beans (soft currency), daily streak,
// daily missions, piece themes and the player's leaderboard name.
import { lang } from './i18n.js';
import { todayKey } from './stats.js';
import { settings } from './settings.js';

const KEY = 'mm-progress';

const DEFAULTS = {
    beans: 0,
    streak: { count: 0, best: 0, last: null, freezes: 0 },
    days: [],                    // dateKeys of finished daily challenges (last 40)
    missions: { date: null, list: [] },
    themes: ['classic'],
    theme: 'classic',
    items: { scene: ['space'], pop: ['glow'], acc: ['none'] },   // owned cosmetics other than piece themes
    scene: 'space',
    pop: 'glow',
    acc: 'none',
    player: null,                // { id, a, n, num } -> name built from word lists (no free text)
    rewardsSeen: [],             // streak milestones already paid
    weekly: { days: [], claimed: null, weeks: 0 }   // days played (last 3 weeks), last week paid, weeks with a participation prize
};

function load() {
    try {
        const s = JSON.parse(localStorage.getItem(KEY) || '{}');
        return {
            ...DEFAULTS, ...s,
            streak: { ...DEFAULTS.streak, ...(s.streak || {}) },
            items: { ...DEFAULTS.items, ...(s.items || {}) }
        };
    } catch {
        return { ...DEFAULTS };
    }
}

function save(state) {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* private mode */ }
}

const listeners = new Set();
const notify = () => listeners.forEach((fn) => fn());

export function onProgressChange(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
}

// ------------------------------------------------------------------ dates (UTC, like the daily seed)

export function dayOffset(dateKey, delta) {
    const d = new Date(`${dateKey}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + delta);
    return d.toISOString().slice(0, 10);
}

function daysBetween(a, b) {
    return Math.round((new Date(`${b}T00:00:00Z`) - new Date(`${a}T00:00:00Z`)) / 86400000);
}

// ------------------------------------------------------------------ beans

// GOD mode (settings): unlimited beans for testing; nothing is really spent
export const GOD_BEANS = 999999;
const god = () => !!settings.get('god');

export function beans() {
    return god() ? GOD_BEANS : load().beans;
}

// What to show in the wallet: ∞ in GOD mode
export function beansLabel() {
    return god() ? '∞' : String(load().beans);
}

// Takes `price` beans from the state; false when there are not enough (always true in GOD mode)
function pay(s, price) {
    if (god()) return true;
    if (s.beans < price) return false;
    s.beans -= price;
    return true;
}

export function addBeans(n) {
    if (n < 0 && god()) return beans();
    const s = load();
    s.beans = Math.max(0, s.beans + Math.round(n));
    save(s);
    notify();
    return s.beans;
}

// Beans for a finished game: about one per 250 points, a little extra for playing at all
export function beansForScore(score) {
    return score > 0 ? 2 + Math.floor(score / 250) : 0;
}

// ------------------------------------------------------------------ streak

// Milestones pay beans and a "spare coffee" that saves the streak when a day is missed
export const STREAK_REWARDS = [
    { days: 3, beans: 30, freezes: 1 },
    { days: 7, beans: 80, freezes: 1 },
    { days: 14, beans: 150, freezes: 1 },
    { days: 30, beans: 400, freezes: 2 }
];

// Current streak as the player sees it: broken if the last daily is older than yesterday
// and there are not enough spare coffees to cover the gap.
export function streakInfo() {
    const s = load();
    const today = todayKey();
    const st = s.streak;
    let count = st.count;
    if (st.last && st.last !== today) {
        const missed = daysBetween(st.last, today) - 1;
        if (missed > st.freezes) count = 0;
    }
    return { count, best: st.best, freezes: st.freezes, doneToday: st.last === today, days: s.days };
}

// Called when a daily challenge ends. Returns { count, extended, usedFreezes, reward }.
export function completeDaily() {
    const s = load();
    const today = todayKey();
    const st = s.streak;
    if (st.last === today) return { count: st.count, extended: false, usedFreezes: 0, reward: null };

    let usedFreezes = 0;
    if (!st.last) {
        st.count = 1;
    } else {
        const missed = daysBetween(st.last, today) - 1;
        if (missed <= 0) st.count += 1;
        else if (missed <= st.freezes) {
            usedFreezes = missed;
            st.freezes -= missed;
            st.count += 1;
        } else {
            st.count = 1;
        }
    }
    st.last = today;
    st.best = Math.max(st.best, st.count);
    s.days = [...s.days.filter((d) => d !== today), today].slice(-40);

    let reward = null;
    const milestone = STREAK_REWARDS.find((r) => r.days === st.count);
    const seenKey = `${milestone ? milestone.days : 0}@${today}`;
    if (milestone && !s.rewardsSeen.includes(seenKey)) {
        reward = milestone;
        s.beans += milestone.beans;
        st.freezes = Math.min(5, st.freezes + milestone.freezes);
        s.rewardsSeen = [...s.rewardsSeen, seenKey].slice(-20);
    }
    save(s);
    notify();
    return { count: st.count, extended: true, usedFreezes, reward };
}

// ------------------------------------------------------------------ missions

const MISSION_POOL = [
    { kind: 'solve', n: [10, 20, 30], beans: 20, pt: 'Resolve {n} contas', en: 'Solve {n} equations' },
    { kind: 'div', n: [3, 5], beans: 30, pt: 'Faz {n} divisões', en: 'Solve {n} divisions' },
    { kind: 'mul', n: [5, 8], beans: 25, pt: 'Faz {n} multiplicações', en: 'Solve {n} multiplications' },
    { kind: 'combo', n: [3, 5], beans: 30, pt: 'Faz {n} contas seguidas em combo', en: 'Chain {n} equations in a combo' },
    { kind: 'ice', n: [3, 6], beans: 25, pt: 'Usa {n} peças geladas', en: 'Use {n} frozen pieces' },
    { kind: 'special', n: [3, 5], beans: 20, pt: 'Usa {n} peças especiais', en: 'Use {n} special pieces' },
    { kind: 'score', n: [2000, 5000], beans: 30, pt: 'Faz {n} pontos num jogo', en: 'Score {n} in one game' },
    { kind: 'level', n: [4, 6], beans: 30, pt: 'Chega ao nível {n}', en: 'Reach level {n}' },
    { kind: 'daily', n: [1], beans: 25, pt: 'Joga o desafio diário', en: 'Play the daily challenge' },
    { kind: 'mode', n: [1], beans: 20, pt: 'Joga uma partida Zen ou Sprint', en: 'Play a Zen or Sprint game' }
];

// Small deterministic generator so everyone gets the same 3 missions on the same day
function seeded(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
    return () => {
        h = Math.imul(h ^ (h >>> 15), 2246822507);
        h = Math.imul(h ^ (h >>> 13), 3266489909);
        return ((h ^= h >>> 16) >>> 0) / 4294967296;
    };
}

function rollMissions(dateKey) {
    const rnd = seeded(`mm-missions-${dateKey}`);
    const pool = [...MISSION_POOL];
    const out = [];
    while (out.length < 3) {
        const def = pool.splice(Math.floor(rnd() * pool.length), 1)[0];
        const n = def.n[Math.floor(rnd() * def.n.length)];
        out.push({ kind: def.kind, n, beans: def.beans + (def.n.indexOf(n) * 10), progress: 0, done: false });
    }
    return out;
}

export function missions() {
    const s = load();
    const today = todayKey();
    if (s.missions.date !== today) {
        s.missions = { date: today, list: rollMissions(today) };
        save(s);
    }
    return s.missions.list;
}

export function missionText(m) {
    const def = MISSION_POOL.find((d) => d.kind === m.kind);
    const l = lang();
    return (def[l] || def.en).replace('{n}', m.n.toLocaleString(l === 'pt' ? 'pt-PT' : 'en-US'));
}

// Feed game events. Returns missions completed by this event (each already paid in beans).
// solve: { op, combo, iced } · special: {} · gameOver: { score, level, mode } · level: { level }
export function track(event, data = {}) {
    missions();
    const s = load();
    const done = [];
    for (const m of s.missions.list) {
        if (m.done) continue;
        const before = m.progress;
        if (event === 'solve') {
            if (m.kind === 'solve') m.progress++;
            if (m.kind === 'div' && data.op === '÷') m.progress++;
            if (m.kind === 'mul' && data.op === '×') m.progress++;
            if (m.kind === 'ice') m.progress += data.iced || 0;
            if (m.kind === 'combo') m.progress = Math.max(m.progress, data.combo || 0);
        } else if (event === 'special' && m.kind === 'special') {
            m.progress++;
        } else if (event === 'level' && m.kind === 'level') {
            m.progress = Math.max(m.progress, data.level || 0);
        } else if (event === 'gameOver') {
            if (m.kind === 'score') m.progress = Math.max(m.progress, data.score || 0);
            if (m.kind === 'daily' && data.mode === 'daily') m.progress = 1;
            if (m.kind === 'mode' && (data.mode === 'zen' || data.mode === 'sprint')) m.progress = 1;
        }
        if (m.progress !== before && m.progress >= m.n) {
            m.progress = m.n;
            m.done = true;
            s.beans += m.beans;
            done.push(m);
        }
    }
    if (event === 'gameOver') {
        const w = { ...DEFAULTS.weekly, ...(s.weekly || {}) };
        const today = todayKey();
        if (!w.days.includes(today)) w.days = [...w.days, today].slice(-21);
        s.weekly = w;
    }
    save(s);
    if (done.length) notify();
    return done;
}

// ------------------------------------------------------------------ themes

export const THEMES = [
    { id: 'classic', price: 0, pt: 'Clássico', en: 'Classic' },
    { id: 'neon', price: 150, pt: 'Neon', en: 'Neon' },
    { id: 'pixel', price: 250, pt: 'Retro Pixel', en: 'Retro Pixel' },
    { id: 'bica', price: 400, pt: 'Bica', en: 'Espresso' },
    { id: 'candy', price: 300, pt: 'Doces', en: 'Sweets' },
    { id: 'planets', price: 350, pt: 'Planetas', en: 'Planets' }
];

export function themeState() {
    const s = load();
    return { owned: s.themes, current: s.theme };
}

export function buyTheme(id) {
    const s = load();
    const th = THEMES.find((x) => x.id === id);
    if (!th || s.themes.includes(id) || !pay(s, th.price)) return false;
    s.themes = [...s.themes, id];
    s.theme = id;
    save(s);
    notify();
    return true;
}

export function equipTheme(id) {
    const s = load();
    if (!s.themes.includes(id)) return false;
    s.theme = id;
    save(s);
    notify();
    return true;
}

// ------------------------------------------------------------------ player name for the ranking

// Names are built from these lists only (the server checks the indexes), so no offensive names.
export const NAME_NOUNS = ['Bica', 'Galão', 'Pastel', 'Garoto', 'Cimbalino', 'Abatanado', 'Carioca', 'Pingo', 'Torrada', 'Meia de Leite'];
export const NAME_ADJS = ['Veloz', 'Turbo', 'Genial', 'Ninja', 'Feroz', 'Audaz', 'Sagaz', 'Imparável', 'Incrível', 'Radical'];

export function player() {
    const s = load();
    if (!s.player) {
        const rnd = () => Math.random();
        const id = Array.from({ length: 16 }, () => 'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(rnd() * 36)]).join('');
        s.player = { id, n: Math.floor(rnd() * NAME_NOUNS.length), a: Math.floor(rnd() * NAME_ADJS.length), num: 1 + Math.floor(rnd() * 99) };
        save(s);
    }
    const generated = `${NAME_NOUNS[s.player.n]} ${NAME_ADJS[s.player.a]} ${s.player.num}`;
    return { ...s.player, name: s.player.custom || generated, generated };
}

// Name typed by the player (already checked with js/namefilter.js)
export function setPlayerName(name) {
    player();
    const s = load();
    s.player = { ...s.player, custom: name };
    save(s);
    notify();
}

// Re-roll the generated name (keeps the same player id)
export function rerollName() {
    const s = load();
    player();
    const p = load().player;
    p.n = Math.floor(Math.random() * NAME_NOUNS.length);
    p.a = Math.floor(Math.random() * NAME_ADJS.length);
    p.num = 1 + Math.floor(Math.random() * 99);
    s.player = p;
    save(s);
    return player();
}

// ------------------------------------------------------------------ shop: scenes, pop effects, spare coffee

// Backgrounds for the main game (purely cosmetic)
export const SCENES = [
    { id: 'space', price: 0, pt: 'Espaço', en: 'Space' },
    { id: 'lisbon', price: 300, pt: 'Lisboa à noite', en: 'Lisbon by night' },
    { id: 'porto', hidden: true, price: 300, pt: 'Porto e o Douro', en: 'Porto and the Douro' },
    { id: 'sintra', hidden: true, price: 300, pt: 'Sintra e a Pena', en: 'Sintra and Pena Palace' },
    { id: 'algarve', hidden: true, price: 250, pt: 'Falésias do Algarve', en: 'Algarve cliffs' },
    { id: 'ocean', price: 250, pt: 'Fundo do mar', en: 'Under the sea' },
    { id: 'beach', price: 250, pt: 'Praia ao pôr do sol', en: 'Sunset beach' }
];

// What flies out of the pieces when an equation is right
export const POPS = [
    { id: 'glow', price: 0, pt: 'Brilho', en: 'Glow' },
    { id: 'confetti', price: 120, pt: 'Confetes', en: 'Confetti' },
    { id: 'bubbles', price: 120, pt: 'Bolhas', en: 'Bubbles' },
    { id: 'hearts', price: 150, pt: 'Corações', en: 'Hearts' },
    { id: 'beans', price: 150, pt: 'Grãos de café', en: 'Coffee beans' }
];

// Accessories for Bica, the mascot (worn in the menu and the shop)
export const ACCESSORIES = [
    { id: 'none', price: 0, pt: 'Sem acessório', en: 'No accessory' },
    { id: 'cap', price: 120, pt: 'Boné', en: 'Cap' },
    { id: 'party', price: 120, pt: 'Chapéu de festa', en: 'Party hat' },
    { id: 'glasses', price: 150, pt: 'Óculos de génio', en: 'Genius glasses' },
    { id: 'scarf', price: 150, pt: 'Cachecol', en: 'Scarf' },
    { id: 'headphones', price: 200, pt: 'Auscultadores', en: 'Headphones' },
    { id: 'crown', price: 300, pt: 'Coroa', en: 'Crown' }
];

export const SPARE_PRICE = 80;
export const SPARE_MAX = 2;

const CATALOG = { theme: THEMES, scene: SCENES, pop: POPS, acc: ACCESSORIES };

// Items on sale; `hidden` ones (art still being made) only show to players who already own them
export function catalog(kind) {
    const owned = ownedItems(kind);
    return CATALOG[kind].filter((it) => !it.hidden || owned.includes(it.id));
}

export function ownedItems(kind) {
    const s = load();
    return kind === 'theme' ? s.themes : s.items[kind] || [];
}

export function currentItem(kind) {
    const s = load();
    return s[kind] || CATALOG[kind][0].id;
}

// Buys at `price` (a daily deal may be cheaper than the list price) and equips it
export function buyItem(kind, id, price) {
    if (kind === 'theme') {
        const s = load();
        if (s.themes.includes(id) || !pay(s, price)) return false;
        s.themes = [...s.themes, id];
        s.theme = id;
        save(s);
        notify();
        return true;
    }
    const s = load();
    const list = s.items[kind] || [];
    if (!CATALOG[kind].some((x) => x.id === id) || list.includes(id) || !pay(s, price)) return false;
    s.items = { ...s.items, [kind]: [...list, id] };
    s[kind] = id;
    save(s);
    notify();
    return true;
}

export function equipItem(kind, id) {
    if (kind === 'theme') return equipTheme(id);
    const s = load();
    if (!(s.items[kind] || []).includes(id)) return false;
    s[kind] = id;
    save(s);
    notify();
    return true;
}

// Spare coffees protect the daily streak; at most SPARE_MAX can be bought (milestones may give more)
export function spares() {
    return load().streak.freezes;
}

export function buySpare() {
    const s = load();
    if (s.streak.freezes >= SPARE_MAX || !pay(s, SPARE_PRICE)) return false;
    s.streak.freezes += 1;
    save(s);
    notify();
    return true;
}

// Three items on sale today, the same for everyone (picked from the date)
export function dailyDeals() {
    const key = todayKey();
    let h = 2166136261;
    for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619) >>> 0;
    const next = () => { h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0; h ^= h >>> 13; return h / 4294967296; };
    const pool = [];
    Object.entries(CATALOG).forEach(([kind, list]) => list.forEach((it) => { if (it.price > 0 && !it.hidden) pool.push({ kind, item: it }); }));
    const cuts = [30, 40, 50];
    const out = [];
    while (out.length < 3 && pool.length) {
        const { kind, item } = pool.splice(Math.floor(next() * pool.length), 1)[0];
        const off = cuts[out.length];
        out.push({ kind, item, off, price: Math.round((item.price * (100 - off)) / 100 / 5) * 5 });
    }
    return out;
}

// ------------------------------------------------------------------ weekly prizes

// Monday (UTC) of the week a date belongs to
export function mondayOf(dateKey) {
    const d = new Date(`${dateKey}T00:00:00Z`);
    return dayOffset(dateKey, -((d.getUTCDay() + 6) % 7));
}

export const WEEKLY_MIN_DAYS = 3;                 // days played in a week for the participation prize
export const WEEKLY_BEANS = 60;
export const TOP_BEANS = [300, 200, 100];         // 1st, 2nd, 3rd of the weekly ranking (they also get a frame)

// Badge for each milestone of weeks with a participation prize
export const BADGES = [
    { weeks: 1, icon: '☕', pt: 'Cliente da semana', en: 'Weekly regular' },
    { weeks: 4, icon: '🫖', pt: 'Habitué do café', en: 'Café regular' },
    { weeks: 12, icon: '🌟', pt: 'Lenda da Bica', en: 'Bica legend' }
];

// The best badge for a number of weeks (null before the first one)
export function badgeFor(weeks) {
    let best = null;
    for (const b of BADGES) if (weeks >= b.weeks) best = b;
    return best;
}

// The week that just ended, when its prizes were not handed out yet: { week, days } or null
export function weeklyDue() {
    const w = { ...DEFAULTS.weekly, ...(load().weekly || {}) };
    const week = dayOffset(mondayOf(todayKey()), -7);
    if (w.claimed === week) return null;
    const days = w.days.filter((d) => mondayOf(d) === week).length;
    return { week, days };
}

export function weeklyBadge() {
    return badgeFor((load().weekly || {}).weeks || 0);
}

// Pays last week's prizes. rank: place in last week's ranking (1 = first) or null. Returns what was won.
export function claimWeekly(week, days, rank) {
    const s = load();
    const w = { ...DEFAULTS.weekly, ...(s.weekly || {}) };
    if (w.claimed === week) return null;
    const out = { beans: 0, participation: false, badge: null, newBadge: false, rank: rank && rank <= 3 ? rank : null };
    if (days >= WEEKLY_MIN_DAYS) {
        out.participation = true;
        out.beans += WEEKLY_BEANS;
        const before = badgeFor(w.weeks);
        w.weeks += 1;
        out.badge = badgeFor(w.weeks);
        out.newBadge = out.badge !== before;
    }
    if (out.rank) out.beans += TOP_BEANS[out.rank - 1];
    w.claimed = week;
    s.weekly = w;
    s.beans += out.beans;
    save(s);
    if (out.beans) notify();
    return out;
}
