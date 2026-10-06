// Meta progression, persisted per device: coffee beans (soft currency), daily streak,
// daily missions, piece themes and the player's leaderboard name.
import { lang } from './i18n.js';
import { todayKey } from './stats.js';

const KEY = 'mm-progress';

const DEFAULTS = {
    beans: 0,
    streak: { count: 0, best: 0, last: null, freezes: 0 },
    days: [],                    // dateKeys of finished daily challenges (last 40)
    missions: { date: null, list: [] },
    themes: ['classic'],
    theme: 'classic',
    player: null,                // { id, a, n, num } -> name built from word lists (no free text)
    rewardsSeen: []              // streak milestones already paid
};

function load() {
    try {
        const s = JSON.parse(localStorage.getItem(KEY) || '{}');
        return { ...DEFAULTS, ...s, streak: { ...DEFAULTS.streak, ...(s.streak || {}) } };
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

export function beans() {
    return load().beans;
}

export function addBeans(n) {
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
    save(s);
    if (done.length) notify();
    return done;
}

// ------------------------------------------------------------------ themes

export const THEMES = [
    { id: 'classic', price: 0, pt: 'Clássico', en: 'Classic' },
    { id: 'neon', price: 150, pt: 'Neon', en: 'Neon' },
    { id: 'pixel', price: 250, pt: 'Retro Pixel', en: 'Retro Pixel' },
    { id: 'bica', price: 400, pt: 'Bica', en: 'Espresso' }
];

export function themeState() {
    const s = load();
    return { owned: s.themes, current: s.theme };
}

export function buyTheme(id) {
    const s = load();
    const th = THEMES.find((x) => x.id === id);
    if (!th || s.themes.includes(id) || s.beans < th.price) return false;
    s.beans -= th.price;
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
    return { ...s.player, name: `${NAME_NOUNS[s.player.n]} ${NAME_ADJS[s.player.a]} ${s.player.num}` };
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
