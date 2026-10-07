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
function gathered(pc) {
    if (pc.iceGatheringState === 'complete') return Promise.resolve();
    return new Promise((resolve) => {
        const done = () => { pc.removeEventListener('icegatheringstatechange', check); resolve(); };
        const check = () => { if (pc.iceGatheringState === 'complete') done(); };
        pc.addEventListener('icegatheringstatechange', check);
        setTimeout(done, GATHER_MS);
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
        this.ready = new Promise((resolve) => { this.resolveReady = resolve; });
        this.pending = [];
        this.offSignal = room.onEvent((ev) => {
            if (this.pc) this.onSignal(ev);
            else this.pending.push(ev);
        });
        this.start();
    }

    async start() {
        this.pc = new RTCPeerConnection({ iceServers: await iceServers() });
        if (this.closed) return;
        this.pc.addEventListener('connectionstatechange', () => {
            const s = this.pc.connectionState;
            if ((s === 'failed' || s === 'closed' || s === 'disconnected') && this.open) this.lost();
        });
        if (this.host) {
            // Events (reliable and in order) and the board stream (a late frame is useless, so it is
            // never retransmitted and never makes the next ones wait)
            this.attach(this.pc.createDataChannel('game', { ordered: true }));
            this.attach(this.pc.createDataChannel('snap', { ordered: false, maxRetransmits: 0 }));
            this.makeOffer();
        } else {
            this.pc.addEventListener('datachannel', (e) => this.attach(e.channel));
        }
        this.pending.splice(0).forEach((ev) => this.onSignal(ev));
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
            this.listeners.forEach((fn) => fn(msg));
        });
        dc.addEventListener('close', () => this.lost());
    }

    async makeOffer() {
        await this.pc.setLocalDescription(await this.pc.createOffer());
        await gathered(this.pc);
        this.room.send({ type: 'signal', kind: 'offer', sig: JSON.stringify(this.pc.localDescription) });
    }

    async onSignal(ev) {
        if (ev.type !== 'signal' || this.closed) return;
        try {
            const desc = JSON.parse(ev.sig);
            if (ev.kind === 'offer' && !this.host) {
                await this.pc.setRemoteDescription(desc);
                await this.pc.setLocalDescription(await this.pc.createAnswer());
                await gathered(this.pc);
                this.room.send({ type: 'signal', kind: 'answer', sig: JSON.stringify(this.pc.localDescription) });
            } else if (ev.kind === 'answer' && this.host && !this.pc.currentRemoteDescription) {
                await this.pc.setRemoteDescription(desc);
            }
        } catch { /* a broken handshake just times out */ }
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
        return () => this.listeners.delete(fn);
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
        this.closed = true;
        try { if (this.pc) this.pc.close(); } catch { /* already closed */ }
    }
}
