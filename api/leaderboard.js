// Daily challenge ranking, stored in Upstash Redis through its REST API (no SDK needed).
// Vercel sets the credentials when an Upstash Redis database is connected to the project:
// KV_REST_API_URL / KV_REST_API_TOKEN (or UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN).
//
// GET  /api/leaderboard?date=YYYY-MM-DD&id=<player>  -> { top: [{ name, score }], me: { rank, score } | null }
// POST /api/leaderboard { date, id, n, a, num, score } -> same shape, after saving the score

const URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

// Must match js/progress.js: names are only ever built from these lists
const NOUNS = ['Bica', 'Galão', 'Pastel', 'Garoto', 'Cimbalino', 'Abatanado', 'Carioca', 'Pingo', 'Torrada', 'Meia de Leite'];
const ADJS = ['Veloz', 'Turbo', 'Genial', 'Ninja', 'Feroz', 'Audaz', 'Sagaz', 'Imparável', 'Incrível', 'Radical'];

const MAX_SCORE = 200000;   // far above what 2 minutes allow; filters obvious fakes
const TOP = 50;

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

async function board(date, id) {
    const key = `lb:${date}`;
    const cmds = [['ZRANGE', key, '0', String(TOP - 1), 'REV', 'WITHSCORES']];
    if (id) cmds.push(['ZREVRANK', key, id], ['ZSCORE', key, id]);
    const [flat, rank, score] = await redis(cmds);
    const ids = [];
    const scores = [];
    for (let i = 0; i < flat.length; i += 2) {
        ids.push(flat[i]);
        scores.push(Number(flat[i + 1]));
    }
    const names = ids.length ? (await redis([['HMGET', `lbn:${date}`, ...ids]]))[0] : [];
    return {
        date,
        top: ids.map((pid, i) => ({ name: names[i] || '?', score: scores[i], me: pid === id })),
        me: id && rank !== null && rank !== undefined ? { rank: rank + 1, score: Number(score) } : null
    };
}

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
            const date = validDate(req.query.date) ? req.query.date : today();
            const id = validId(req.query.id) ? req.query.id : null;
            // Short CDN cache when no player row is needed (menu peeks)
            if (!id) res.setHeader('Cache-Control', 'public, s-maxage=20, stale-while-revalidate=60');
            res.status(200).json(await board(date, id));
            return;
        }
        if (req.method === 'POST') {
            const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
            const { date, id, n, a, num, score } = b;
            if (!validDate(date) || !validId(id) || !idx(n, NOUNS) || !idx(a, ADJS)
                || !Number.isInteger(num) || num < 1 || num > 99
                || !Number.isInteger(score) || score < 0 || score > MAX_SCORE) {
                res.status(400).json({ error: 'invalid' });
                return;
            }
            const key = `lb:${date}`;
            const ttl = String(60 * 60 * 24 * 8);
            // GT: only ever raises a player's score for the day
            await redis([
                ['ZADD', key, 'GT', String(score), id],
                ['HSET', `lbn:${date}`, id, `${NOUNS[n]} ${ADJS[a]} ${num}`],
                ['EXPIRE', key, ttl],
                ['EXPIRE', `lbn:${date}`, ttl]
            ]);
            res.status(200).json(await board(date, id));
            return;
        }
        res.status(405).json({ error: 'method' });
    } catch (e) {
        res.status(502).json({ error: 'upstream' });
    }
}
