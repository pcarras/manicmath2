// Local test server: serves the game and runs api/*.js with an in-memory Redis that speaks the
// small part of the Upstash REST pipeline the APIs use. Lets two browser windows play a
// 2-player game without the real database.  Usage: node tools/dev/server.mjs [port]
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PORT = Number(process.argv[2] || 8790);
process.env.KV_REST_API_URL = 'http://fake-redis';
process.env.KV_REST_API_TOKEN = 'dev';
// DEV_TURN=1 pretends Cloudflare TURN is configured, to test how the game behaves with relay servers listed
if (process.env.DEV_TURN) {
    process.env.CF_TURN_KEY_ID = 'dev';
    process.env.CF_TURN_API_TOKEN = 'dev';
}

const db = new Map();   // key -> string | Map (hash) | Array (list) | sorted set as Map
function run([cmd, key, ...a]) {
    switch (cmd) {
        case 'HSETNX': { const h = db.get(key) || new Map(); if (h.has(a[0])) return 0; h.set(a[0], a[1]); db.set(key, h); return 1; }
        case 'HSET': { const h = db.get(key) || new Map(); for (let i = 0; i < a.length; i += 2) h.set(a[i], a[i + 1]); db.set(key, h); return a.length / 2; }
        case 'HGET': { const h = db.get(key); return h && h.has(a[0]) ? h.get(a[0]) : null; }
        case 'HGETALL': { const h = db.get(key); return h ? [...h].flat() : []; }
        case 'HMGET': { const h = db.get(key) || new Map(); return a.map((f) => h.get(f) ?? null); }
        case 'EXPIRE': return 1;
        case 'RPUSH': { const l = db.get(key) || []; l.push(...a); db.set(key, l); return l.length; }
        case 'LRANGE': { const l = db.get(key) || []; const s = Number(a[0]); const e = Number(a[1]); return l.slice(s, e === -1 ? undefined : e + 1); }
        case 'ZADD': { const z = db.get(key) || new Map(); z.set(a[a.length - 1], Math.max(Number(a[a.length - 2]), z.get(a[a.length - 1]) || 0)); db.set(key, z); return 1; }
        case 'ZRANGE': {
            const z = db.get(key) || new Map();
            const rows = [...z].sort((x, y) => y[1] - x[1]);
            const st = Number(a[0]); const en = Number(a[1]);
            const part = rows.slice(st, en < 0 ? undefined : en + 1);
            return a.includes('WITHSCORES') ? part.flat().map(String) : part.map((r) => r[0]);
        }
        case 'ZREMRANGEBYRANK': return 0;
        case 'ZINCRBY': { const z = db.get(key) || new Map(); z.set(a[1], (z.get(a[1]) || 0) + Number(a[0])); db.set(key, z); return String(z.get(a[1])); }
        case 'HINCRBY': { const h = db.get(key) || new Map(); h.set(a[0], String(Number(h.get(a[0]) || 0) + Number(a[1]))); db.set(key, h); return Number(h.get(a[0])); }
        case 'ZREVRANK': { const z = db.get(key) || new Map(); const ids = [...z].sort((x, y) => y[1] - x[1]).map((x) => x[0]); const i = ids.indexOf(a[0]); return i < 0 ? null : i; }
        case 'ZSCORE': { const z = db.get(key) || new Map(); return z.has(a[0]) ? String(z.get(a[0])) : null; }
        default: throw new Error('unsupported ' + cmd);
    }
}
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
    if (String(url).startsWith('http://fake-redis')) {
        const cmds = JSON.parse(init.body);
        return new Response(JSON.stringify(cmds.map((c) => ({ result: run(c) }))), { status: 200 });
    }
    if (process.env.DEV_TURN && String(url).startsWith('https://rtc.live.cloudflare.com')) {
        return new Response(JSON.stringify({ iceServers: [
            { urls: ['stun:stun.cloudflare.com:3478', 'stun:stun.cloudflare.com:443'] },
            { urls: ['turn:turn.cloudflare.com:3478?transport=udp', 'turn:turn.cloudflare.com:3478?transport=tcp', 'turns:turn.cloudflare.com:5349?transport=tcp', 'turn:turn.cloudflare.com:443?transport=udp', 'turn:turn.cloudflare.com:80?transport=tcp', 'turns:turn.cloudflare.com:443?transport=tcp'], username: 'u', credential: 'c' }
        ] }), { status: 201 });
    }
    return realFetch(url, init);
};

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
    '.png': 'image/png', '.webp': 'image/webp', '.mp3': 'audio/mpeg', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };

http.createServer(async (req, res) => {
    const u = new URL(req.url, 'http://x');
    if (u.pathname.startsWith('/api/')) {
        const name = u.pathname.slice(5).replace(/[^a-z]/g, '');
        const mod = await import(path.join(ROOT, 'api', `${name}.js`));
        let body = '';
        for await (const c of req) body += c;
        const vreq = { method: req.method, query: Object.fromEntries(u.searchParams), body };
        const vres = {
            code: 200,
            setHeader: (k, v) => res.setHeader(k, v),
            status(c) { this.code = c; return this; },
            json(o) { res.writeHead(this.code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); }
        };
        await mod.default(vreq, vres);
        return;
    }
    const file = path.join(ROOT, decodeURIComponent(u.pathname === '/' ? '/index.html' : u.pathname));
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
}).listen(PORT, () => console.log(`http://127.0.0.1:${PORT}`));
