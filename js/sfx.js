// Synthesized sound effects (Web Audio, no files): tick-tock, bomb fuse, heat wave, steel junk,
// and the rising "reward" tones that climb with every combo, bean and level.
import { settings } from './settings.js';
import { audioBus } from './audio.js';

// C major pentatonic over three octaves: any run of these sounds musical
const PENTA = [0, 2, 4, 7, 9];
const noteFreq = (step, base = 523.25) => {
    const oct = Math.floor(step / PENTA.length);
    const semis = PENTA[((step % PENTA.length) + PENTA.length) % PENTA.length] + 12 * oct;
    return base * Math.pow(2, semis / 12);
};

export class Sfx {
    constructor(scene) {
        this.ctx = scene.sound.context || null;   // null on the HTML5 audio fallback
        this.loops = new Set();
        this.out = null;
        this.noise = null;
        this.tick = null;
        if (!this.ctx) return;
        this.bus = audioBus(scene);
        this.out = this.ctx.createGain();
        this.out.gain.value = 1;
        this.out.connect(this.bus ? this.bus.sfx : this.ctx.destination);
        const len = this.ctx.sampleRate;
        this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = this.noise.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }

    on() {
        return this.ctx && settings.get('sfx') && this.ctx.state === 'running';
    }

    // ------------------------------------------------------------------ building blocks

    tone(freq, { at = 0, dur = 0.15, type = 'sine', vol = 0.2, attack = 0.005, to = null, out = this.out } = {}) {
        const t = this.ctx.currentTime + at;
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = type;
        o.frequency.setValueAtTime(freq, t);
        if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol, t + attack);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g).connect(out);
        o.start(t);
        o.stop(t + dur + 0.05);
    }

    noiseBurst({ at = 0, dur = 0.2, vol = 0.3, type = 'bandpass', freq = 1000, q = 1, to = null, loop = false } = {}) {
        const t = this.ctx.currentTime + at;
        const src = this.ctx.createBufferSource();
        src.buffer = this.noise;
        src.loop = loop;
        const f = this.ctx.createBiquadFilter();
        f.type = type;
        f.frequency.setValueAtTime(freq, t);
        if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur);
        f.Q.value = q;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.03, dur / 4));
        if (!loop) g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        src.connect(f).connect(g).connect(this.out);
        src.start(t, Math.random() * 0.5);
        if (!loop) src.stop(t + dur + 0.05);
        return { src, gain: g, filter: f };
    }

    // ------------------------------------------------------------------ rewards (rising pitch)

    // A two-note chime that climbs one pentatonic step per combo
    rise(step) {
        if (!this.on()) return;
        const s = Math.min(14, Math.max(0, step));
        this.tone(noteFreq(s), { dur: 0.18, type: 'triangle', vol: 0.18 });
        this.tone(noteFreq(s + 2), { at: 0.07, dur: 0.25, type: 'triangle', vol: 0.16 });
        this.tone(noteFreq(s + 2) * 2, { at: 0.07, dur: 0.2, type: 'sine', vol: 0.05 });
    }

    // Coin "bling" that climbs while beans keep coming
    coin(step) {
        if (!this.on()) return;
        const f = noteFreq(Math.min(16, 5 + step), 659.25);
        this.tone(f, { dur: 0.08, type: 'square', vol: 0.06 });
        this.tone(f * 1.5, { at: 0.06, dur: 0.22, type: 'square', vol: 0.06 });
    }

    fanfare() {
        if (!this.on()) return;
        [0, 2, 4, 5, 7].forEach((s, i) => this.tone(noteFreq(s + 5), { at: i * 0.07, dur: 0.22, type: 'square', vol: 0.07 }));
        this.tone(noteFreq(12), { at: 0.35, dur: 0.6, type: 'triangle', vol: 0.16 });
    }

    // Game-over score counter: short ticks whose pitch follows the progress (0..1)
    count(progress) {
        if (!this.on()) return;
        this.tone(500 + progress * 900, { dur: 0.04, type: 'square', vol: 0.035 });
    }

    // ------------------------------------------------------------------ power-ups

    // Clock tick-tock loop while the timer power-up holds the pieces
    startTickTock() {
        if (!this.ctx || this.tick) return;
        let n = 0;
        let next = this.ctx.currentTime + 0.05;
        this.tick = setInterval(() => {
            while (next < this.ctx.currentTime + 0.12) {
                if (this.on()) {
                    const tick = n % 2 === 0;
                    const at = next - this.ctx.currentTime;
                    this.tone(tick ? 2100 : 1500, { at, dur: 0.035, type: 'square', vol: 0.07 });
                    this.noiseBurst({ at, dur: 0.03, vol: 0.12, freq: tick ? 4000 : 2600, q: 6 });
                }
                n++;
                next += 0.5;
            }
        }, 40);
    }

    stopTickTock() {
        clearInterval(this.tick);
        this.tick = null;
    }

    // Lit fuse: crackling hiss until stopped. Returns a handle with stop().
    fuse() {
        if (!this.on()) return { stop() {}, pause() {}, resume() {} };
        const hiss = this.noiseBurst({ dur: 10, vol: 0.09, type: 'highpass', freq: 3500, q: 0.7, loop: true });
        const crackle = setInterval(() => {
            if (this.on() && Math.random() < 0.6) this.noiseBurst({ dur: 0.02, vol: 0.18, freq: 1500 + Math.random() * 3000, q: 4 });
        }, 70);
        const handle = {
            stopped: false,
            stop: () => {
                if (handle.stopped) return;
                handle.stopped = true;
                clearInterval(crackle);
                const t = this.ctx.currentTime;
                hiss.gain.gain.cancelScheduledValues(t);
                hiss.gain.gain.setValueAtTime(hiss.gain.gain.value, t);
                hiss.gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
                hiss.src.stop(t + 0.08);
                this.loops.delete(handle);
            },
            pause: () => hiss.gain.gain.setValueAtTime(0.0001, this.ctx.currentTime),
            resume: () => hiss.gain.gain.setValueAtTime(0.09, this.ctx.currentTime)
        };
        this.loops.add(handle);
        return handle;
    }

    // Heat wave: rising roar of hot air, low rumble and fire crackle
    heat() {
        if (!this.on()) return;
        if (this.bus) this.bus.duck(0.45, 1100);
        this.noiseBurst({ dur: 1.2, vol: 0.55, type: 'lowpass', freq: 250, to: 4200, q: 1.2 });
        this.noiseBurst({ at: 0.15, dur: 1.1, vol: 0.3, type: 'bandpass', freq: 600, to: 1800, q: 2 });
        this.tone(70, { dur: 1.1, type: 'sine', vol: 0.35, attack: 0.08, to: 45 });
        for (let i = 0; i < 14; i++) {
            this.noiseBurst({ at: 0.1 + Math.random() * 1.0, dur: 0.025, vol: 0.25, freq: 2000 + Math.random() * 4000, q: 5 });
        }
    }

    // ------------------------------------------------------------------ steel junk

    // Big hit: music steps back so the effect cuts through
    duck(depth, ms) {
        if (this.bus) this.bus.duck(depth, ms);
    }

    // Inharmonic partials = a struck steel plate
    clank(pitch = 1) {
        if (!this.on()) return;
        [[523, 0.12], [1306, 0.07], [2153, 0.05], [3210, 0.03]].forEach(([f, v]) => {
            this.tone(f * pitch, { dur: 0.45, type: 'sine', vol: v, attack: 0.002 });
        });
        this.noiseBurst({ dur: 0.06, vol: 0.25, freq: 3000, q: 1.5 });
    }

    metalBreak() {
        if (!this.on()) return;
        this.clank(0.8);
        this.noiseBurst({ dur: 0.35, vol: 0.4, type: 'bandpass', freq: 2500, to: 600, q: 0.8 });
        for (let i = 0; i < 6; i++) this.tone(1800 + Math.random() * 2500, { at: 0.05 + i * 0.04, dur: 0.12, vol: 0.04 });
    }

    // ------------------------------------------------------------------ pause support

    pauseLoops() {
        this.loops.forEach((h) => h.pause());
    }

    resumeLoops() {
        this.loops.forEach((h) => h.resume());
    }

    stopAll() {
        this.stopTickTock();
        [...this.loops].forEach((h) => h.stop());
    }
}
