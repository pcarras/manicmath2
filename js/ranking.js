// Ranking client (daily, classic, weekly, duel, team, friends) + Wordle-style result sharing.
import { player } from './progress.js';
import { stats } from './stats.js';
import { t, lang } from './i18n.js';

const API = 'api/leaderboard';

// Resolves { ok: true, data } or { ok: false, reason: 'soon' | 'offline' }
async function call(init, query = '') {
    try {
        const r = await fetch(`${API}${query}`, { cache: 'no-store', ...init });
        if (r.status === 503 || r.status === 404) return { ok: false, reason: 'soon' };
        if (!r.ok) return { ok: false, reason: 'offline' };
        return { ok: true, data: await r.json() };
    } catch {
        return { ok: false, reason: 'offline' };
    }
}

// board: 'daily' (needs the date), 'classic', 'week', 'duel', 'duelAll' or 'team'.
// last: the week that just ended (weekly prizes). Rows also come with `near`: me and my neighbours.
export function fetchBoard(board, date, last = false) {
    const p = player();
    return call({}, `?board=${board}&date=${date || ''}&id=${p.id}${last ? '&last=1' : ''}`);
}

export async function submitScore(board, score, date, extra = {}) {
    const p = player();
    const who = { n: p.n, a: p.a, num: p.num };
    const r = await call({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ board, date, id: p.id, score, ...who, ...extra })
    });
    return r;
}

// Personal bests saved on the phone before the classic ranking existed (or while
// offline) are sent once, so the ranking always reflects the best ever played on this device.
const SYNC_KEY = 'mm-synced';

export async function syncBests() {
    let synced = {};
    try { synced = JSON.parse(localStorage.getItem(SYNC_KEY) || '{}'); } catch { /* reset */ }
    const bests = { classic: stats.get().best };
    for (const [board, best] of Object.entries(bests)) {
        if (!(best > 0) || best <= (synced[board] || 0)) continue;
        const r = await submitScore(board, best, undefined, { sync: true });   // old bests stay out of this week's board
        if (!r.ok) return;   // offline / not configured: try again next time
        synced[board] = best;
        try { localStorage.setItem(SYNC_KEY, JSON.stringify(synced)); } catch { /* private mode */ }
    }
}

const OP_EMOJI = { '+': '🟪', '-': '🟩', '×': '🟧', '÷': '🟦' };

// One square per equation, coloured by operator (like the pieces), in rows of 8
export function shareText({ date, score, level, comboMult, ops, streak }) {
    const l = lang() === 'pt' ? 'pt-PT' : 'en-US';
    const squares = ops.slice(0, 32).map((op) => OP_EMOJI[op] || '⬜');
    const rows = [];
    for (let i = 0; i < squares.length; i += 8) rows.push(squares.slice(i, i + 8).join(''));
    const lines = [
        `☕ ${t('shareTitle', { d: date })}`,
        `🏆 ${score.toLocaleString(l)} · ${t('levelShort')} ${level} · x${comboMult}`
    ];
    if (streak > 1) lines.push(`🔥 ${t('shareStreak', { n: streak })}`);
    if (rows.length) lines.push('', ...rows);
    lines.push('', location.origin + location.pathname.replace(/index\.html$/, ''));
    return lines.join('\n');
}

// Native share sheet when available, clipboard otherwise. Resolves 'shared' | 'copied' | 'failed'.
export async function share(text) {
    if (navigator.share) {
        try {
            await navigator.share({ text });
            return 'shared';
        } catch (e) {
            if (e && e.name === 'AbortError') return 'shared';
        }
    }
    try {
        await navigator.clipboard.writeText(text);
        return 'copied';
    } catch {
        return 'failed';
    }
}
