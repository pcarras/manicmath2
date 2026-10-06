// Rankings, stored in Upstash Redis through its REST API (no SDK needed).
// Vercel sets KV_REST_API_URL / KV_REST_API_TOKEN when the Upstash database is connected.
//
// Boards: daily (one per UTC day, kept 8 days), classic and sprint (best ever, one row per player).
// GET  /api/leaderboard?board=daily|classic|sprint&date=YYYY-MM-DD&id=<player>
//      -> { board, date, top: [{ name, score, me }], me: { rank, score } | null }
// POST /api/leaderboard { board, date, id, name, score }  (name checked by js/namefilter.js)
//      -> same shape after saving; 422 { error: 'name', reason } when the name is refused
import { checkName } from '../js/namefilter.js';

const URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

// Older clients send a generated name as word-list indexes
const NOUNS = ['Bica', 'Galão', 'Pastel', 'Garoto', 'Cimbalino', 'Abatanado', 'Carioca', 'Pingo', 'Torrada', 'Meia de Leite'];
const ADJS = ['Veloz', 'Turbo', 'Genial', 'Ninja', 'Feroz', 'Audaz', 'Sagaz', 'Imparável', 'Incrível', 'Radical'];

// Far above what a real game reaches; filters obvious fakes
const MAX_SCORE = { daily: 200000, sprint: 150000, classic: 3000000 };
const TOP = 50;
const NAMES = 'lbname';   // player id -> name, shared by every board

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

const boardKey = (board, date) => (board === 'daily' ? `lb:${date}` : `lb:${board}`);

async function read(board, date, id) {
    const key = boardKey(board, date);
    const cmds = [['ZRANGE', key, '0', String(TOP - 1), 'REV', 'WITHSCORES']];
    if (id) cmds.push(['ZREVRANK', key, id], ['ZSCORE', key, id]);
    const [flat, rank, score] = await redis(cmds);
    const ids = [];
    const scores = [];
    for (let i = 0; i < flat.length; i += 2) {
        ids.push(flat[i]);
        scores.push(Number(flat[i + 1]));
    }
    let names = [];
    if (ids.length) {
        const res = await redis([['HMGET', NAMES, ...ids], ...(board === 'daily' ? [['HMGET', `lbn:${date}`, ...ids]] : [])]);
        names = ids.map((_, i) => res[0][i] || (res[1] && res[1][i]) || '?');
    }
    return {
        board,
        date,
        top: ids.map((pid, i) => ({ name: names[i], score: scores[i], me: pid === id })),
        me: id && rank !== null && rank !== undefined ? { rank: rank + 1, score: Number(score) } : null
    };
}

const validBoard = (b) => b === 'daily' || b === 'classic' || b === 'sprint';
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
            res.status(200).json(await read(board, date, id));
            return;
        }
        if (req.method === 'POST') {
            const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
            const board = validBoard(b.board) ? b.board : 'daily';
            const date = board === 'daily' ? b.date : today();
            const { id, score } = b;
            if ((board === 'daily' && !validDate(date)) || !validId(id)
                || !Number.isInteger(score) || score < 0 || score > MAX_SCORE[board]) {
                res.status(400).json({ error: 'invalid' });
                return;
            }
            let name = null;
            if (typeof b.name === 'string') {
                const c = checkName(b.name);
                if (!c.ok) {
                    res.status(422).json({ error: 'name', reason: c.reason });
                    return;
                }
                name = c.name;
            } else if (idx(b.n, NOUNS) && idx(b.a, ADJS) && Number.isInteger(b.num) && b.num >= 1 && b.num <= 99) {
                name = `${NOUNS[b.n]} ${ADJS[b.a]} ${b.num}`;
            } else {
                res.status(400).json({ error: 'invalid' });
                return;
            }
            const key = boardKey(board, date);
            const cmds = [
                ['ZADD', key, 'GT', String(score), id],   // GT: a player's row only ever goes up
                ['HSET', NAMES, id, name]
            ];
            if (board === 'daily') cmds.push(['EXPIRE', key, String(60 * 60 * 24 * 8)]);
            await redis(cmds);
            res.status(200).json(await read(board, date, id));
            return;
        }
        res.status(405).json({ error: 'method' });
    } catch (e) {
        res.status(502).json({ error: 'upstream' });
    }
}
