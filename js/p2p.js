// Direct phone-to-phone link (WebRTC data channel) for the TEAM mode, where both phones show the
// very same board. The room (net.js) only carries the handshake: one offer and one answer, each
// with all its network candidates, so a slow poll is enough. Public STUN servers help phones
// behind home routers find each other; nothing of the game goes through a server.
const ICE = [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }];
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
        this.pc = new RTCPeerConnection({ iceServers: ICE });
        this.pc.addEventListener('connectionstatechange', () => {
            const s = this.pc.connectionState;
            if ((s === 'failed' || s === 'closed' || s === 'disconnected') && this.open) this.lost();
        });
        this.ready = new Promise((resolve) => { this.resolveReady = resolve; });
        this.offSignal = room.onEvent((ev) => this.onSignal(ev));
        if (host) {
            this.attach(this.pc.createDataChannel('game', { ordered: true }));
            this.makeOffer();
        } else {
            this.pc.addEventListener('datachannel', (e) => this.attach(e.channel));
        }
    }

    attach(dc) {
        this.dc = dc;
        dc.addEventListener('open', () => {
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
        try { this.pc.close(); } catch { /* already closed */ }
    }
}
