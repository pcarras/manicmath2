// Two-player rooms for the TEAM and DUEL modes, on the same Upstash Redis as the ranking.
// Both phones build the same pieces from a shared seed, so only small game events travel:
// "I solved it (these pieces, next target)", "here is some junk", "my board overflowed".
// There is no chat and names come from the ranking name rules (js/namefilter.js).
//
// POST /api/room { action: 'create', mode: 'team'|'duel', id, name | n,a,num }  -> { code, seed, mode, me: 0, now }
// POST /api/room { action: 'join', code, id, name }                   -> { code, seed, mode, me: 1, now }
// POST /api/room { action: 'event', code, id, ev }                    -> { i, now }
// POST /api/room { action: 'leave', code, id }                        -> { ok: true }
// POST /api/room { action: 'result', code, id, win?, score?, total? } -> { counted }
//      end of a game: duel (win: did I win) adds a victory to the winner's trophies; team (score: my
//      points, total: both players') feeds my weekly score and the duo board. Each room counts once.
//      -> { counted, won? }  (won: in a duel, whether the result that counted makes me the winner)
// GET  /api/room?code=1234&id=<player>&since=<n>
//      -> { mode, seed, players: [{ name, here }], startAt, now, events: [{ i, from, ...ev }] }
import { checkName } from '../js/namefilter.js';
import { NAMES, TEAM_NAMES, WEEK_TTL, weekKey, duelWeekKey, DUEL_ALL_KEY, teamWeekKey, teamGamesKey, friendsKey, FRIENDS_MAX } from './_boards.js';

const URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const TTL = 60 * 60 * 2;          // rooms vanish after 2 hours
const START_DELAY = 6000;         // ms between the second player joining and the start
const MIN_PLAY_MS = 20000;        // a game shorter than this is not counted in the rankings
const AWAY_MS = 12000;            // no poll for this long: the player left
const EVENT_TYPES = ['solve', 'junk', 'over', 'score', 'leave', 'signal'];

async function redis(commands) {
    const r = await fetch(`${URL}/pipeline`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(commands)
    });
    if (!r.ok) throw new Error(`redis ${r.status}`);
    return (await r.json()).map((x) => x.result);
}

const validId = (id) => typeof id === 'string' && /^[a-z0-9]{16}$/.test(id);
const validCode = (c) => typeof c === 'string' && /^[0-9]{4}$/.test(c);
const roomKey = (code) => `room:${code}`;
const evKey = (code) => `room:${code}:ev`;

// Same name rules as the ranking: a typed name passes the filter, or a generated one comes as
// word-list indexes (generated names can be longer than a typed one may be)
const NOUNS = ['Bica', 'Galão', 'Pastel', 'Garoto', 'Cimbalino', 'Abatanado', 'Carioca', 'Pingo', 'Torrada', 'Meia de Leite'];
const ADJS = ['Veloz', 'Turbo', 'Genial', 'Ninja', 'Feroz', 'Audaz', 'Sagaz', 'Imparável', 'Incrível', 'Radical'];
const idx = (v, list) => Number.isInteger(v) && v >= 0 && v < list.length;

function cleanName(b) {
    if (typeof b.name === 'string') {
        const c = checkName(b.name);
        return c.ok ? c.name : null;
    }
    if (idx(b.n, NOUNS) && idx(b.a, ADJS) && Number.isInteger(b.num) && b.num >= 1 && b.num <= 99) {
        return `${NOUNS[b.n]} ${ADJS[b.a]} ${b.num}`;
    }
    return null;
}

// Hash reply from Upstash comes as a flat [k, v, k, v] list
function toObj(flat) {
    const o = {};
    for (let i = 0; flat && i < flat.length; i += 2) o[flat[i]] = flat[i + 1];
    return o;
}

// Keep only small, known fields of an event
function cleanEvent(ev) {
    if (!ev || !EVENT_TYPES.includes(ev.type)) return null;
    const out = { type: ev.type };
    const int = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
    if (int(ev.round, 0, 100000)) out.round = ev.round;
    if (int(ev.target, 1, 1000)) out.target = ev.target;
    if (int(ev.pts, -10000, 100000)) out.pts = ev.pts;
    if (int(ev.score, -100000, 10000000)) out.score = ev.score;
    if (int(ev.n, 1, 5)) out.n = ev.n;
    if (Array.isArray(ev.seqs)) out.seqs = ev.seqs.filter((s) => int(s, 0, 1000000)).slice(0, 3);
    // WebRTC handshake for the TEAM mode (p2p.js): one offer and one answer
    if (ev.type === 'signal') {
        if (!['offer', 'answer', 'cand'].includes(ev.kind) || typeof ev.sig !== 'string' || ev.sig.length > 16000) return null;
        out.kind = ev.kind;
        out.sig = ev.sig;
        if (Number.isInteger(ev.try) && ev.try >= 0 && ev.try <= 5) out.try = ev.try;
    }
    return out;
}

export default async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    if (!URL || !TOKEN) {
        res.status(503).json({ error: 'not_configured' });
        return;
    }
    try {
        const now = Date.now();
        if (req.method === 'GET') {
            const { code, id } = req.query;
            const since = Math.max(0, parseInt(req.query.since, 10) || 0);
            if (!validCode(code) || !validId(id)) {
                res.status(400).json({ error: 'invalid' });
                return;
            }
            const [flat] = await redis([['HGETALL', roomKey(code)]]);
            const room = toObj(flat);
            if (!room.seed) {
                res.status(404).json({ error: 'no_room' });
                return;
            }
            const me = room.p0 === id ? 0 : room.p1 === id ? 1 : -1;
            const cmds = [['LRANGE', evKey(code), String(since), '-1']];
            if (me >= 0) cmds.push(['HSET', roomKey(code), `seen${me}`, String(now)]);
            const [list] = await redis(cmds);
            const players = [0, 1].map((k) => (room[`p${k}`]
                ? { name: room[`n${k}`], here: k === me || now - Number(room[`seen${k}`] || 0) < AWAY_MS }
                : null));
            res.status(200).json({
                mode: room.mode,
                seed: Number(room.seed),
                players,
                startAt: room.startAt ? Number(room.startAt) : null,
                now,
                events: (list || []).map((s, k) => ({ i: since + k, ...JSON.parse(s) }))
            });
            return;
        }
        if (req.method !== 'POST') {
            res.status(405).json({ error: 'method' });
            return;
        }
        const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
        if (!validId(b.id)) {
            res.status(400).json({ error: 'invalid' });
            return;
        }

        if (b.action === 'create') {
            const mode = b.mode === 'duel' ? 'duel' : 'team';
            const name = cleanName(b);
            if (!name) {
                res.status(422).json({ error: 'name' });
                return;
            }
            const seed = Math.floor(Math.random() * 2147483647);
            for (let tries = 0; tries < 12; tries++) {
                const code = String(1000 + Math.floor(Math.random() * 9000));
                // HSETNX on a marker field claims the code atomically
                const [claimed] = await redis([['HSETNX', roomKey(code), 'seed', String(seed)]]);
                if (claimed !== 1) continue;
                await redis([
                    ['HSET', roomKey(code), 'mode', mode, 'p0', b.id, 'n0', name, 'seen0', String(now)],
                    ['EXPIRE', roomKey(code), String(TTL)]
                ]);
                res.status(200).json({ code, seed, mode, me: 0, now });
                return;
            }
            res.status(503).json({ error: 'busy' });
            return;
        }

        if (!validCode(b.code)) {
            res.status(400).json({ error: 'invalid' });
            return;
        }
        const [flat] = await redis([['HGETALL', roomKey(b.code)]]);
        const room = toObj(flat);
        if (!room.seed) {
            res.status(404).json({ error: 'no_room' });
            return;
        }

        if (b.action === 'join') {
            const name = cleanName(b);
            if (!name) {
                res.status(422).json({ error: 'name' });
                return;
            }
            if (room.p0 === b.id) {
                res.status(409).json({ error: 'own_room' });
                return;
            }
            if (room.p1 && room.p1 !== b.id) {
                res.status(409).json({ error: 'full' });
                return;
            }
            const startAt = room.startAt || String(now + START_DELAY);
            await redis([
                ['HSET', roomKey(b.code), 'p1', b.id, 'n1', name, 'seen1', String(now), 'startAt', startAt],
                ['EXPIRE', roomKey(b.code), String(TTL)]
            ]);
            res.status(200).json({ code: b.code, seed: Number(room.seed), mode: room.mode, me: 1, now });
            return;
        }

        const me = room.p0 === b.id ? 0 : room.p1 === b.id ? 1 : -1;
        if (me < 0) {
            res.status(403).json({ error: 'not_in_room' });
            return;
        }
        if (b.action === 'event') {
            const ev = cleanEvent(b.ev);
            if (!ev) {
                res.status(400).json({ error: 'invalid' });
                return;
            }
            const [len] = await redis([
                ['RPUSH', evKey(b.code), JSON.stringify({ from: me, ...ev })],
                ['EXPIRE', evKey(b.code), String(TTL)]
            ]);
            res.status(200).json({ i: len - 1, now });
            return;
        }
        if (b.action === 'result') {
            const none = () => res.status(200).json({ counted: false });
            if (!room.p0 || !room.p1 || !room.startAt || now - Number(room.startAt) < MIN_PLAY_MS) { none(); return; }
            const [mineNew] = await redis([['HSETNX', roomKey(b.code), `res${me}`, '1']]);
            if (mineNew !== 1) { none(); return; }
            const ids = [room.p0, room.p1];
            const nameOf = [room.n0, room.n1];
            // Playing together makes two players friends (their ranking shows both, newest friends kept)
            const names = [
                ['HSET', NAMES, ids[0], nameOf[0], ids[1], nameOf[1]],
                ['ZADD', friendsKey(ids[0]), String(now), ids[1]], ['ZREMRANGEBYRANK', friendsKey(ids[0]), '0', String(-FRIENDS_MAX - 1)],
                ['ZADD', friendsKey(ids[1]), String(now), ids[0]], ['ZREMRANGEBYRANK', friendsKey(ids[1]), '0', String(-FRIENDS_MAX - 1)]
            ];
            if (room.mode === 'duel') {
                // one result per room: whoever reports first decides (both phones normally agree)
                const winner = ids[b.win === true ? me : 1 - me];
                const [first] = await redis([['HSETNX', roomKey(b.code), 'duelwin', winner]]);
                if (first !== 1) {
                    // the other phone was first: just tell this one whether the result stands
                    const [stored] = await redis([['HGET', roomKey(b.code), 'duelwin']]);
                    res.status(200).json({ counted: true, won: stored === ids[me] });
                    return;
                }
                const wk = duelWeekKey();
                await redis([...names, ['ZINCRBY', wk, '1', winner], ['EXPIRE', wk, String(WEEK_TTL)], ['ZINCRBY', DUEL_ALL_KEY, '1', winner]]);
                res.status(200).json({ counted: true, won: winner === ids[me] });
                return;
            }
            const score = Number.isInteger(b.score) && b.score >= 0 && b.score <= 200000 ? b.score : null;
            const total = Number.isInteger(b.total) && b.total >= (score || 0) && b.total <= 400000 ? b.total : null;
            if (score === null || total === null) { res.status(400).json({ error: 'invalid' }); return; }
            if (total === 0) { none(); return; }   // nobody scored: nothing to rank
            const wk = weekKey();
            // My share counts for my own weekly score, the pair's total for the duo board
            await redis(score > 0
                ? [...names, ['ZADD', wk, 'GT', String(score), ids[me]], ['EXPIRE', wk, String(WEEK_TTL)]]
                : names);
            const [firstTeam] = await redis([['HSETNX', roomKey(b.code), 'teamres', '1']]);
            if (firstTeam === 1) {
                const duo = [...ids].sort().join('-');
                const tk = teamWeekKey();
                await redis([
                    ['ZADD', tk, 'GT', String(total), duo], ['EXPIRE', tk, String(WEEK_TTL)],
                    ['HSET', TEAM_NAMES, duo, `${nameOf[ids.indexOf(duo.split('-')[0])]} & ${nameOf[ids.indexOf(duo.split('-')[1])]}`],
                    ['HINCRBY', teamGamesKey(), duo, '1'], ['EXPIRE', teamGamesKey(), String(WEEK_TTL)]
                ]);
            }
            res.status(200).json({ counted: true });
            return;
        }
        if (b.action === 'leave') {
            await redis([['RPUSH', evKey(b.code), JSON.stringify({ from: me, type: 'leave' })], ['EXPIRE', evKey(b.code), String(TTL)]]);
            res.status(200).json({ ok: true });
            return;
        }
        res.status(400).json({ error: 'invalid' });
    } catch (e) {
        res.status(502).json({ error: 'upstream' });
    }
}
