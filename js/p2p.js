// Direct phone-to-phone link (WebRTC data channel) for the TEAM mode, where both phones show the
// very same board. The room (net.js) only carries the handshake: one offer and one answer, each
// with all its network candidates, so a slow poll is enough. Public STUN servers help phones
// behind home routers find each other; nothing of the game goes through a server.
const ICE = [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }];

// STUN plus, when configured on the server (api/turn.js), a TURN relay for phones that cannot
// reach each other directly
async function iceServers() {
    try {
        const r = await fetch('api/turn', { cache: 'no-store' });
        if (r.ok) {
            const d = await r.json();
            if (Array.isArray(d.iceServers) && d.iceServers.length) return d.iceServers;
        }
    } catch { /* offline: STUN only */ }
    return ICE;
}
const GATHER_MS = 2500;

// Waits until the local description has its candidates (or a short timeout)
function gathered(pc, ms = GATHER_MS) {
    if (pc.iceGatheringState === 'complete') return Promise.resolve();
    return new Promise((resolve) => {
        const done = () => { pc.removeEventListener('icegatheringstatechange', check); resolve(); };
        const check = () => { if (pc.iceGatheringState === 'complete') done(); };
        pc.addEventListener('icegatheringstatechange', check);
        setTimeout(done, ms);
    });
}

export class Link {
    // host: true on the phone that created the room (it runs the game)
    constructor(room, host) {
        this.room = room;
        this.host = host;
        this.listeners = new Set();
        this.closeListeners = new Set();
        this.open = false;
        this.closed = false;
        this.attempt = 0;
        this.servers = ICE;
        this.hasTurn = false;
        this.ready = new Promise((resolve) => { this.resolveReady = resolve; });
        this.pending = [];
        this.inbox = [];
        this.offSignal = room.onEvent((ev) => {
            if (this.pc) this.onSignal(ev);
            else this.pending.push(ev);
        });
        this.start();
    }

    async start() {
        this.servers = await iceServers();
        this.hasTurn = this.servers.some((s) => [].concat(s.urls).some((u) => /^turns?:/.test(u)));
        if (this.closed) return;
        this.newPc(0);
        this.pending.splice(0).forEach((ev) => this.onSignal(ev));
    }

    // A fresh peer connection. Attempt 0 lets the browser pick any route; later attempts force the
    // TURN relay, which works when two phones cannot reach each other (different browsers on one
    // computer, strict routers, mobile data).
    newPc(attempt) {
        clearTimeout(this.retryTimer);
        if (this.pc) { try { this.pc.close(); } catch { /* already closed */ } }
        this.attempt = attempt;
        this.dc = this.fast = null;
        this.pc = new RTCPeerConnection({
            iceServers: this.servers,
            iceTransportPolicy: attempt >= 1 && this.hasTurn ? 'relay' : 'all'
        });
        const pc = this.pc;
        pc.addEventListener('connectionstatechange', () => {
            if (pc !== this.pc) return;
            const st = pc.connectionState;
            if ((st === 'failed' || st === 'closed' || st === 'disconnected') && this.open) this.lost();
        });
        if (this.host) {
            // Events (reliable and in order) and the board stream (a late frame is useless, so it is
            // never retransmitted and never makes the next ones wait)
            this.attach(pc.createDataChannel('game', { ordered: true }));
            this.attach(pc.createDataChannel('snap', { ordered: false, maxRetransmits: 0 }));
            this.makeOffer(attempt);
        } else {
            pc.addEventListener('datachannel', (e) => { if (pc === this.pc) this.attach(e.channel); });
        }
    }

    // What the lobby shows when linking takes long (helps finding out why)
    diag() {
        const pc = this.pc;
        if (!pc) return 'starting';
        return `${this.attempt > 0 ? 'relay ' : ''}${pc.signalingState}/${pc.iceConnectionState}`;
    }

    attach(dc) {
        if (dc.label === 'snap') this.fast = dc;
        else this.dc = dc;
        dc.addEventListener('open', () => {
            if (dc.label === 'snap') return;
            this.open = true;
            this.resolveReady(true);
        });
        dc.addEventListener('message', (e) => {
            let msg;
            try { msg = JSON.parse(e.data); } catch { return; }
            if (msg.meta) this.meta = msg.meta;       // the host's board size (see GameScene.hostMeta)
            // Before the game scene is ready nobody listens: keep what must not be lost (texture
            // names, board size); board frames and effects would be stale anyway
            if (!this.listeners.size) {
                if (msg.keys || msg.meta) this.inbox.push(msg);
                return;
            }
            this.listeners.forEach((fn) => fn(msg));
        });
        dc.addEventListener('close', () => { if (dc === this.dc || dc === this.fast) this.lost(); });
    }

    async makeOffer(attempt) {
        const pc = this.pc;
        await pc.setLocalDescription(await pc.createOffer());
        await gathered(pc, attempt > 0 ? 5000 : GATHER_MS);
        if (pc !== this.pc || this.closed) return;
        this.room.send({ type: 'signal', kind: 'offer', sig: JSON.stringify(pc.localDescription), try: attempt });
        // Not linked after a while: try again through the relay
        this.retryTimer = setTimeout(() => {
            if (!this.open && !this.closed && this.attempt < 2) this.newPc(this.attempt + 1);
        }, 9000);
    }

    async onSignal(ev) {
        if (ev.type !== 'signal' || this.closed) return;
        try {
            const desc = JSON.parse(ev.sig);
            const attempt = ev.try || 0;
            if (ev.kind === 'offer' && !this.host) {
                if (this.open || attempt < this.attempt) return;
                if (attempt > this.attempt) this.newPc(attempt);
                const pc = this.pc;
                await pc.setRemoteDescription(desc);
                await pc.setLocalDescription(await pc.createAnswer());
                await gathered(pc, attempt > 0 ? 5000 : GATHER_MS);
                if (pc !== this.pc || this.closed) return;
                this.room.send({ type: 'signal', kind: 'answer', sig: JSON.stringify(pc.localDescription), try: attempt });
            } else if (ev.kind === 'answer' && this.host && attempt === this.attempt && !this.pc.currentRemoteDescription) {
                await this.pc.setRemoteDescription(desc);
            }
        } catch { /* a broken handshake is retried by the host */ }
    }

    // Resolves true when the channel opens, false after `ms`
    waitOpen(ms) {
        return Promise.race([this.ready, new Promise((r) => setTimeout(() => r(false), ms))]);
    }

    send(msg) {
        if (this.open && this.dc && this.dc.readyState === 'open') this.dc.send(JSON.stringify(msg));
    }

    // Board stream: the fast channel when it is up, else the normal one
    sendFast(msg) {
        const ch = this.fast && this.fast.readyState === 'open' ? this.fast : this.dc;
        if (this.open && ch && ch.readyState === 'open' && ch.bufferedAmount < 64000) ch.send(JSON.stringify(msg));
    }

    onMessage(fn) {
        this.listeners.add(fn);
        this.inbox.splice(0).forEach((m) => fn(m));
        return () => this.listeners.delete(fn);
    }

    // How the two phones are linked: { kind: 'lan' | 'direct' | 'relay', rtt: ms } (null if unknown yet)
    async route() {
        if (!this.pc || !this.open) return null;
        try {
            const stats = await this.pc.getStats();
            let pair = null;
            stats.forEach((r) => {
                if (r.type === 'transport' && r.selectedCandidatePairId) pair = stats.get(r.selectedCandidatePairId);
            });
            if (!pair) stats.forEach((r) => { if (r.type === 'candidate-pair' && r.nominated && r.state === 'succeeded') pair = r; });
            if (!pair) return null;
            const a = stats.get(pair.localCandidateId);
            const b = stats.get(pair.remoteCandidateId);
            const types = [a && a.candidateType, b && b.candidateType];
            const kind = types.includes('relay') ? 'relay' : types.every((x) => x === 'host') ? 'lan' : 'direct';
            return { kind, rtt: pair.currentRoundTripTime ? Math.round(pair.currentRoundTripTime * 1000) : null };
        } catch {
            return null;
        }
    }

    onClose(fn) {
        this.closeListeners.add(fn);
        return () => this.closeListeners.delete(fn);
    }

    lost() {
        if (this.closed) return;
        this.closed = true;
        this.open = false;
        this.closeListeners.forEach((fn) => fn());
    }

    close() {
        this.offSignal();
        this.listeners.clear();
        this.closeListeners.clear();
        clearTimeout(this.retryTimer);
        this.closed = true;
        try { if (this.pc) this.pc.close(); } catch { /* already closed */ }
    }
}
