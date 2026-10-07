// Rankings, stored in Upstash Redis through its REST API (no SDK needed).
// Vercel sets KV_REST_API_URL / KV_REST_API_TOKEN when the Upstash database is connected.
//
// Boards: daily (one per UTC day, kept 8 days), classic (best ever, one row per player) and week
// (best single game of the current UTC week, Monday to Sunday; filled by classic games and by each
// player's share of a TEAM game). sprint is kept only for older clients.
// Two-player boards are read-only here, they are written by api/room.js when a game ends:
// duel (victories this week), duelAll (victories ever) and team (best duos of the week).
// GET  /api/leaderboard?board=daily|classic|week|duel|duelAll|team&date=YYYY-MM-DD&id=<player>[&last=1]
//      -> { board, date, top: [{ name, score, me }], me: { rank, score } | null,
//           near: [{ rank, name, score, me }] | null }   near = the player and 3 rows above and below
//      last=1 (week and duel): the week that just ended, used to hand out the weekly prizes
//      board=friends: this week's scores of me and the players I played a 2-player game with,
//      { top: every row, me, friends: how many friends I have, near: null }
// POST /api/leaderboard { board, date, id, n, a, num, score }  (n, a, num: word-list indexes of the player's generated name)
//      -> same shape after saving
import { NAMES, TEAM_NAMES, WEEK_TTL, weekStart, weekKey, duelWeekKey, DUEL_ALL_KEY, teamWeekKey, teamGamesKey, friendsKey } from './_boards.js';

const URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

// A player's name is a generated one: indexes into these lists (no free text)
const NOUNS = ['Bica', 'Galão', 'Pastel', 'Garoto', 'Cimbalino', 'Abatanado', 'Carioca', 'Pingo', 'Torrada', 'Meia de Leite'];
const ADJS = ['Veloz', 'Turbo', 'Genial', 'Ninja', 'Feroz', 'Audaz', 'Sagaz', 'Imparável', 'Incrível', 'Radical'];

// Far above what a real game reaches; filters obvious fakes
const MAX_SCORE = { daily: 200000, sprint: 150000, classic: 3000000, week: 3000000 };
const TOP = 50;
const NEAR = 3;   // rows shown above and below the player

function today(offset = 0) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + offset);
    return d.toISOString().slice(0, 10);
}

async function redis(commands) {
    const r = await fetch(`${URL}/pipeline`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(commands)
    });
    if (!r.ok) throw new Error(`redis ${r.status}`);
    return (await r.json()).map((x) => x.result);
}

const boardKey = (board, date, last) => {
    if (board === 'daily') return `lb:${date}`;
    if (board === 'week') return weekKey(last ? 1 : 0);
    if (board === 'duel') return duelWeekKey(last ? 1 : 0);
    if (board === 'duelAll') return DUEL_ALL_KEY;
    if (board === 'team') return teamWeekKey();
    return `lb:${board}`;
};

function pairs(flat) {
    const out = [];
    for (let i = 0; flat && i < flat.length; i += 2) out.push({ id: flat[i], score: Number(flat[i + 1]) });
    return out;
}

// Me and my friends (players from my 2-player games) on this week's individual board
async function readFriends(id) {
    const [fl] = id ? await redis([['ZRANGE', friendsKey(id), '0', '-1']]) : [[]];
    const ids = id ? [id, ...fl] : [];
    if (!ids.length) return { board: 'friends', date: weekStart(), top: [], me: null, near: null, friends: 0 };
    const res = await redis([...ids.map((pid) => ['ZSCORE', weekKey(), pid]), ['HMGET', NAMES, ...ids], ['ZRANGE', weekKey(1), '0', '2', 'REV']]);
    const names = res[ids.length];
    const frames = {};
    (res[ids.length + 1] || []).forEach((pid, i) => { frames[pid] = i + 1; });
    const rows = ids.map((pid, i) => ({ pid, score: Number(res[i]) || 0, name: names[i] || '?' }))
        .filter((r) => r.pid === id || r.score > 0)
        .sort((a, b) => b.score - a.score);
    const k = rows.findIndex((r) => r.pid === id);
    return {
        board: 'friends',
        date: weekStart(),
        top: rows.map((r) => ({ name: r.name, score: r.score, me: r.pid === id, ...(frames[r.pid] ? { frame: frames[r.pid] } : {}) })),
        me: k >= 0 ? { rank: k + 1, score: rows[k].score } : null,
        near: null,
        friends: fl.length
    };
}

async function read(board, date, id, last) {
    if (board === 'friends') return readFriends(id);
    const key = boardKey(board, date, last);
    const team = board === 'team';   // rows are duos ("idA-idB"), so a single player has no rank of their own
    const cmds = [['ZRANGE', key, '0', String(TOP - 1), 'REV', 'WITHSCORES']];
    if (id && !team) cmds.push(['ZREVRANK', key, id], ['ZSCORE', key, id]);
    const [flat, rank, score] = await redis(cmds);
    const top = pairs(flat);
    let near = null;
    if (rank !== null && rank !== undefined) {
        const from = Math.max(0, rank - NEAR);
        const [nf] = await redis([['ZRANGE', key, String(from), String(rank + NEAR), 'REV', 'WITHSCORES']]);
        near = pairs(nf).map((r, i) => ({ ...r, rank: from + i + 1 }));
    }
    const ids = [...new Set([...top, ...(near || [])].map((r) => r.id))];
    let names = {};
    let games = {};
    const frames = {};
    if (ids.length) {
        const cmds2 = [['HMGET', team ? TEAM_NAMES : NAMES, ...ids]];
        if (board === 'daily') cmds2.push(['HMGET', `lbn:${date}`, ...ids]);
        if (team) cmds2.push(['HMGET', teamGamesKey(), ...ids]);
        // Last week's top 3 (of the duel board on the duel boards) wear a frame this week
        const frameAt = cmds2.length;
        if (!team) cmds2.push(['ZRANGE', board === 'duel' || board === 'duelAll' ? duelWeekKey(1) : weekKey(1), '0', '2', 'REV']);
        const res = await redis(cmds2);
        if (!team) (res[frameAt] || []).forEach((pid, i) => { frames[pid] = i + 1; });
        ids.forEach((pid, i) => {
            names[pid] = res[0][i] || (board === 'daily' && res[1] && res[1][i]) || '?';
            if (team) games[pid] = Number(res[1][i]) || 1;
        });
    }
    const mine = (pid) => (team ? !!id && pid.split('-').includes(id) : pid === id);
    const row = (r) => ({
        name: names[r.id], score: r.score, me: mine(r.id),
        ...(team ? { games: games[r.id] } : frames[r.id] ? { frame: frames[r.id] } : {})
    });
    return {
        board,
        date: board === 'week' || board === 'duel' ? weekStart(last ? 1 : 0) : board === 'daily' ? date : weekStart(),
        top: top.map(row),
        me: id && rank !== null && rank !== undefined ? { rank: rank + 1, score: Number(score) } : null,
        near: near ? near.map((r) => ({ rank: r.rank, ...row(r) })) : null
    };
}

const validBoard = (b) => ['daily', 'classic', 'week', 'sprint', 'duel', 'duelAll', 'team', 'friends'].includes(b);
const writable = (b) => b === 'daily' || b === 'classic' || b === 'sprint';   // the others are filled by api/room.js
const validDate = (d) => d === today() || d === today(-1);
const validId = (id) => typeof id === 'string' && /^[a-z0-9]{16}$/.test(id);
const idx = (v, list) => Number.isInteger(v) && v >= 0 && v < list.length;

export default async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    if (!URL || !TOKEN) {
        res.status(503).json({ error: 'not_configured' });
        return;
    }
    try {
        if (req.method === 'GET') {
            const board = validBoard(req.query.board) ? req.query.board : 'daily';
            const date = validDate(req.query.date) ? req.query.date : today();
            const id = validId(req.query.id) ? req.query.id : null;
            res.status(200).json(await read(board, date, id, req.query.last === '1'));
            return;
        }
        if (req.method === 'POST') {
            const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
            const board = writable(b.board) ? b.board : 'daily';
            const date = board === 'daily' ? b.date : today();
            const { id, score } = b;
            if ((board === 'daily' && !validDate(date)) || !validId(id)
                || !Number.isInteger(score) || score < 0 || score > MAX_SCORE[board]) {
                res.status(400).json({ error: 'invalid' });
                return;
            }
            // Names are only ever built from the word lists: nobody can type text that other players see
            if (!(idx(b.n, NOUNS) && idx(b.a, ADJS) && Number.isInteger(b.num) && b.num >= 1 && b.num <= 99)) {
                res.status(400).json({ error: 'invalid' });
                return;
            }
            const name = `${NOUNS[b.n]} ${ADJS[b.a]} ${b.num}`;
            const key = boardKey(board, date);
            const cmds = [
                ['ZADD', key, 'GT', String(score), id],   // GT: a player's row only ever goes up
                ['HSET', NAMES, id, name]
            ];
            if (board === 'daily') cmds.push(['EXPIRE', key, String(60 * 60 * 24 * 8)]);
            if (board === 'classic' && !b.sync) {
                const wk = weekKey();
                cmds.push(['ZADD', wk, 'GT', String(score), id], ['EXPIRE', wk, String(WEEK_TTL)]);
            }
            await redis(cmds);
            res.status(200).json(await read(board, date, id));
            return;
        }
        res.status(405).json({ error: 'method' });
    } catch (e) {
        res.status(502).json({ error: 'upstream' });
    }
}
