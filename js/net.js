// Client side of the two-player rooms (api/room.js). Polls the room a few times per second and
// hands new events to whoever is listening; sends small events. The server clock is used for
// the shared start time, so both phones count down together.
import { player } from './progress.js';

const API = 'api/room';
const POLL_MS = 450;

async function post(body) {
    try {
        const r = await fetch(API, {
            method: 'POST',
            cache: 'no-store',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        const data = await r.json().catch(() => ({}));
        if (r.ok) return { ok: true, data };
        // The host may replace a 404 body with its own page, so the status alone means "no such room"
        const fallback = r.status === 404 ? 'no_room' : r.status === 503 ? 'soon' : 'offline';
        return { ok: false, status: r.status, error: data.error || fallback };
    } catch {
        return { ok: false, error: 'offline' };
    }
}

function who() {
    const p = player();
    return p.custom ? { id: p.id, name: p.custom } : { id: p.id, n: p.n, a: p.a, num: p.num };
}

export class Room {
    constructor(info) {
        this.code = info.code;
        this.seed = info.seed;
        this.mode = info.mode;
        this.me = info.me;
        this.offset = info.now ? info.now - Date.now() : 0;   // server time minus local time
        this.since = 0;
        this.players = [null, null];
        this.startAt = null;
        this.listeners = new Set();
        this.stateListeners = new Set();
        this.timer = null;
        this.closed = false;
        this.failures = 0;
    }

    static async create(mode) {
        const r = await post({ action: 'create', mode, ...who() });
        return r.ok ? { ok: true, room: new Room(r.data) } : r;
    }

    static async join(code) {
        const r = await post({ action: 'join', code, ...who() });
        return r.ok ? { ok: true, room: new Room(r.data) } : r;
    }

    serverNow() {
        return Date.now() + this.offset;
    }

    other() {
        return this.players[1 - this.me];
    }

    onEvent(fn) {
        this.listeners.add(fn);
        return () => this.listeners.delete(fn);
    }

    // Called with the room state after every poll ({ players, startAt, failures })
    onState(fn) {
        this.stateListeners.add(fn);
        return () => this.stateListeners.delete(fn);
    }

    start() {
        if (this.timer || this.closed) return;
        const tick = async () => {
            if (this.closed) return;
            await this.poll();
            if (!this.closed) this.timer = setTimeout(tick, this.pollMs || POLL_MS);
        };
        tick();
    }

    async poll() {
        const id = player().id;
        try {
            const r = await fetch(`${API}?code=${this.code}&id=${id}&since=${this.since}`, { cache: 'no-store' });
            if (!r.ok) throw new Error(String(r.status));
            const d = await r.json();
            this.failures = 0;
            // Smooth the clock offset a little (network delay varies)
            const off = d.now - Date.now();
            this.offset = Math.abs(off - this.offset) > 2000 ? off : this.offset * 0.8 + off * 0.2;
            this.players = d.players;
            this.startAt = d.startAt;
            for (const ev of d.events) {
                this.since = ev.i + 1;
                if (ev.from === this.me) continue;   // my own events are applied when sent
                this.listeners.forEach((fn) => fn(ev));
            }
        } catch {
            this.failures++;
        }
        this.stateListeners.forEach((fn) => fn({ players: this.players, startAt: this.startAt, failures: this.failures }));
    }

    // Resolves with the event's index in the room log (null when it could not be sent)
    async send(ev) {
        if (this.closed) return null;
        const r = await post({ action: 'event', code: this.code, id: player().id, ev });
        return r.ok ? r.data.i : null;
    }

    close() {
        if (this.closed) return;
        this.closed = true;
        clearTimeout(this.timer);
        post({ action: 'leave', code: this.code, id: player().id });
        this.listeners.clear();
        this.stateListeners.clear();
    }
}
