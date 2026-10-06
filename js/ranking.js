// Daily ranking client + Wordle-style result sharing.
import { player } from './progress.js';
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

export function fetchBoard(date) {
    const p = player();
    return call({}, `?date=${date}&id=${p.id}`);
}

export function submitScore(date, score) {
    const p = player();
    return call({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, id: p.id, n: p.n, a: p.a, num: p.num, score })
    });
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
