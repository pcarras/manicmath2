// Level music, fully synthesized with Web Audio (no files). Four tracks that get faster and denser
// as the levels climb. Each has pads, a filtered bass, arpeggio, drums and a call-and-response lead,
// a reverb and an echo bus, a compressor, and "pumping" (the pads duck on every kick).
// Songs cycle through sections: intro (no lead), theme, theme with variation, breakdown (no kick).
import { settings } from './settings.js';
import { audioBus } from './audio.js';

const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);

// chord: [root MIDI, intervals]
const m7 = [0, 3, 7, 10];
const M7 = [0, 4, 7, 11];
const add9 = [0, 4, 7, 14];
const m9 = [0, 3, 7, 14];

const TRACKS = [
    {
        name: 'Bica Lounge', bpm: 100, swing: 0.08,
        chords: [[45, m7], [41, M7], [48, M7], [43, add9]],                 // Am7 Fmaj7 Cmaj7 G(add9)
        kick: [0, 7, 10], snare: [4, 12], hat: [2, 6, 10, 14], openHat: [],
        bass: [0, 7, 10, 14], arp: [0, 3, 6, 8, 11, 14], arpWave: 'sine',
        call: [[0, 2, 3], [4, 1, 2], [8, 3, 4], [14, 2, 2]],                  // [step, chord tone, length in 16ths]
        answer: [[0, 4, 2], [2, 3, 2], [6, 1, 4], [12, 0, 4]],
        leadWave: 'triangle', padCut: 1400
    },
    {
        name: 'Neon Run', bpm: 118, swing: 0.04,
        chords: [[40, m9], [36, M7], [43, add9], [38, add9]],                // Em9 Cmaj7 G D
        kick: [0, 4, 8, 12], snare: [4, 12], hat: [2, 6, 10, 14], openHat: [6, 14],
        bass: [0, 3, 6, 8, 10, 14], arp: [0, 2, 4, 6, 8, 10, 12, 14], arpWave: 'square',
        call: [[0, 2, 2], [2, 3, 2], [4, 4, 4], [10, 3, 2], [12, 2, 4]],
        answer: [[0, 1, 2], [2, 2, 2], [4, 0, 6], [12, 1, 4]],
        leadWave: 'square', padCut: 1800
    },
    {
        name: 'Overdrive', bpm: 132, swing: 0,
        chords: [[38, m7], [34, M7], [41, M7], [36, add9]],                  // Dm7 Bbmaj7 Fmaj7 C
        kick: [0, 4, 8, 12], snare: [4, 12], hat: [0, 2, 4, 6, 8, 10, 12, 14], openHat: [2, 6, 10, 14],
        bass: [0, 2, 3, 6, 8, 10, 11, 14], arp: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], arpWave: 'square',
        call: [[0, 4, 2], [2, 3, 1], [3, 2, 1], [4, 3, 4], [8, 2, 2], [10, 1, 2], [12, 2, 4]],
        answer: [[0, 1, 1], [1, 2, 1], [2, 3, 2], [4, 4, 4], [10, 3, 2], [12, 4, 4]],
        leadWave: 'sawtooth', padCut: 2200
    },
    {
        name: 'Hyper Bica', bpm: 146, swing: 0,
        chords: [[42, m9], [38, M7], [45, add9], [40, add9]],                // F#m9 Dmaj7 A E
        kick: [0, 4, 8, 12, 14], snare: [4, 12], hat: [0, 2, 4, 6, 8, 10, 12, 14], openHat: [2, 6, 10, 14],
        bass: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], arp: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], arpWave: 'square',
        call: [[0, 2, 1], [1, 3, 1], [2, 4, 2], [4, 3, 1], [5, 2, 1], [6, 4, 2], [8, 3, 4], [12, 4, 4]],
        answer: [[0, 4, 2], [2, 3, 2], [4, 2, 2], [6, 1, 2], [8, 0, 8]],
        leadWave: 'sawtooth', padCut: 2600
    }
];

// 16-bar song: 4 intro (no lead), 8 theme (call/answer), 2 variation (lead an octave up), 2 breakdown
const SECTION = (bar) => (bar < 4 ? 'intro' : bar < 12 ? 'theme' : bar < 14 ? 'lift' : 'break');

export function trackForLevel(level) {
    if (level <= 2) return 0;
    if (level <= 4) return 1;
    if (level <= 7) return 2;
    return 3;
}

// Short mono impulse: convolution cost grows with its length and channels, and phones glitch
// when the audio thread runs out of time
function impulse(ctx, seconds = 1.2, decay = 3) {
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    return buf;
}

class Synth {
    constructor(ctx, output) {
        this.ctx = ctx;
        // master -> shared bus (the bus limiter in audio.js is the only compressor)
        this.master = ctx.createGain();
        this.master.gain.value = 0;
        this.master.connect(output || ctx.destination);

        // pumped bus (pads, bass, arp) ducks on each kick
        this.pump = ctx.createGain();
        this.pump.connect(this.master);

        this.reverb = ctx.createConvolver();
        this.reverb.buffer = impulse(ctx);
        const wet = ctx.createGain();
        wet.gain.value = 0.38;
        this.reverb.connect(wet).connect(this.master);

        this.delay = ctx.createDelay(1);
        const fb = ctx.createGain();
        fb.gain.value = 0.32;
        const dlp = ctx.createBiquadFilter();
        dlp.type = 'lowpass';
        dlp.frequency.value = 2600;
        this.delay.connect(dlp).connect(fb).connect(this.delay);
        const dwet = ctx.createGain();
        dwet.gain.value = 0.28;
        dlp.connect(dwet).connect(this.master);

        const len = ctx.sampleRate;
        this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
        const d = this.noise.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

        this.track = TRACKS[0];
        this.step = 0;
        this.bar = 0;
        this.timer = null;
        this.danger = false;
    }

    setTrack(i) {
        if (this.track === TRACKS[i]) return;
        this.track = TRACKS[i];
        this.bar = 0;
        this.step = 0;
    }

    start() {
        if (this.timer) return;
        const t = this.ctx.currentTime;
        this.master.gain.cancelScheduledValues(t);
        this.master.gain.setValueAtTime(this.master.gain.value, t);
        this.master.gain.linearRampToValueAtTime(0.5, t + 0.8);
        this.nextTime = t + 0.06;
        this.timer = setInterval(() => this.schedule(), 60);
    }

    stop(fade = 0.4) {
        const t = this.ctx.currentTime;
        this.master.gain.cancelScheduledValues(t);
        this.master.gain.setValueAtTime(this.master.gain.value, t);
        this.master.gain.linearRampToValueAtTime(0, t + fade);
        clearInterval(this.timer);
        this.timer = null;
    }

    schedule() {
        const tr = this.track;
        const sixteenth = 60 / (tr.bpm * (this.danger ? 1.08 : 1)) / 4;
        // If the page stalled (tab hidden, long frame), skip ahead instead of firing a burst of late notes
        if (this.nextTime < this.ctx.currentTime - 0.05) this.nextTime = this.ctx.currentTime + 0.05;
        // Notes are queued 0.35 s ahead so a busy main thread never leaves a gap
        while (this.nextTime < this.ctx.currentTime + 0.35) {
            const sw = this.step % 2 === 1 ? tr.swing * sixteenth : 0;
            this.playStep(tr, this.step, this.nextTime + sw, sixteenth);
            this.nextTime += sixteenth;
            this.step = (this.step + 1) % 16;
            if (this.step === 0) this.bar = (this.bar + 1) % 16;
        }
    }

    playStep(tr, s, t, dur) {
        const section = SECTION(this.bar);
        const [root, chord] = tr.chords[this.bar % tr.chords.length];
        const tone = (k) => root + chord[k % chord.length] + 12 * Math.floor(k / chord.length);

        // Drums
        if (section !== 'break' && tr.kick.includes(s)) this.kick(t);
        if (section === 'break' && s === 0 && this.bar === 15) this.riser(t, dur * 32);
        if (tr.snare.includes(s) && section !== 'intro') this.snare(t);
        if (section === 'intro' && s === 12 && this.bar % 2 === 1) this.snare(t, 0.5);
        if (tr.hat.includes(s) || (this.danger && s % 2 === 1)) this.hat(t, 0.035, 0.1);
        if (tr.openHat.includes(s) && section !== 'break') this.hat(t, 0.14, 0.06);

        // Pad on each bar (slow attack, long release)
        if (s === 0) this.pad(t, chord.map((iv) => root + 24 + iv), dur * 16, tr.padCut);

        // Bass: root with an octave jump on the off-beats
        if (section !== 'break' && tr.bass.includes(s)) {
            this.bass(t, midi(root + (s % 4 === 2 ? 12 : 0)), dur * 1.7);
        }

        // Arpeggio through the chord, an octave above the pad
        if (tr.arp.includes(s) && section !== 'intro') {
            const idx = tr.arp.indexOf(s);
            this.pluck(t, midi(tone(idx % 4) + 36), dur * 0.9, tr.arpWave, section === 'break' ? 0.025 : 0.04);
        }

        // Lead: call on even bars, answer on odd bars; an octave up in the lift
        if (section === 'theme' || section === 'lift') {
            const phrase = this.bar % 2 === 0 ? tr.call : tr.answer;
            for (const [step, k, len] of phrase) {
                if (step === s) this.lead(t, midi(tone(k) + (section === 'lift' ? 48 : 36)), dur * len, tr.leadWave);
            }
        }
    }

    // ------------------------------------------------------------------ instruments

    duck(t) {
        const g = this.pump.gain;
        g.cancelScheduledValues(t);
        g.setValueAtTime(0.72, t);   // gentle pump: a deeper dip sounds like the music cutting out
        g.linearRampToValueAtTime(1, t + 0.18);
    }

    kick(t) {
        const ctx = this.ctx;
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.frequency.setValueAtTime(165, t);
        o.frequency.exponentialRampToValueAtTime(42, t + 0.14);
        g.gain.setValueAtTime(1, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
        o.connect(g).connect(this.master);
        o.start(t);
        o.stop(t + 0.34);
        this.duck(t);
    }

    noiseHit(t, freq, len, vol, type = 'highpass', out = this.master, send = 0) {
        const ctx = this.ctx;
        const src = ctx.createBufferSource();
        src.buffer = this.noise;
        const f = ctx.createBiquadFilter();
        f.type = type;
        f.frequency.value = freq;
        const g = ctx.createGain();
        g.gain.setValueAtTime(vol, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + len);
        src.connect(f).connect(g).connect(out);
        if (send) {
            const s = ctx.createGain();
            s.gain.value = send;
            g.connect(s).connect(this.reverb);
        }
        src.start(t, Math.random() * 0.5);
        src.stop(t + len + 0.02);
    }

    snare(t, vol = 1) {
        this.noiseHit(t, 1600, 0.18, 0.42 * vol, 'bandpass', this.master, 0.5);
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = 'triangle';
        o.frequency.setValueAtTime(220, t);
        o.frequency.exponentialRampToValueAtTime(150, t + 0.08);
        g.gain.setValueAtTime(0.35 * vol, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
        o.connect(g).connect(this.master);
        o.start(t);
        o.stop(t + 0.12);
    }

    hat(t, len, vol) {
        this.noiseHit(t, 8000, len, vol, 'highpass', this.pump);
    }

    // White-noise sweep that builds tension before the song loops
    riser(t, len) {
        const ctx = this.ctx;
        const src = ctx.createBufferSource();
        src.buffer = this.noise;
        src.loop = true;
        const f = ctx.createBiquadFilter();
        f.type = 'bandpass';
        f.Q.value = 3;
        f.frequency.setValueAtTime(400, t);
        f.frequency.exponentialRampToValueAtTime(6000, t + len);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.001, t);
        g.gain.exponentialRampToValueAtTime(0.12, t + len);
        g.gain.linearRampToValueAtTime(0, t + len + 0.05);
        src.connect(f).connect(g).connect(this.master);
        g.connect(this.reverb);
        src.start(t);
        src.stop(t + len + 0.1);
    }

    pad(t, notes, len, cutoff) {
        const ctx = this.ctx;
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.setValueAtTime(cutoff * 0.5, t);
        f.frequency.linearRampToValueAtTime(cutoff, t + len * 0.5);
        f.frequency.linearRampToValueAtTime(cutoff * 0.6, t + len);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.05, t + 0.35);
        g.gain.setValueAtTime(0.05, t + len - 0.1);
        g.gain.linearRampToValueAtTime(0.0001, t + len + 0.4);
        f.connect(g);
        g.connect(this.pump);
        g.connect(this.reverb);
        notes.forEach((n) => {
            [-7, 7].forEach((cents) => {
                const o = ctx.createOscillator();
                o.type = 'sawtooth';
                o.frequency.value = midi(n);
                o.detune.value = cents;
                o.connect(f);
                o.start(t);
                o.stop(t + len + 0.5);
            });
        });
    }

    bass(t, freq, len) {
        const ctx = this.ctx;
        const o = ctx.createOscillator();
        const sub = ctx.createOscillator();
        const f = ctx.createBiquadFilter();
        const g = ctx.createGain();
        o.type = 'sawtooth';
        o.frequency.value = freq;
        sub.type = 'sine';
        sub.frequency.value = freq / 2;
        f.type = 'lowpass';
        f.Q.value = 6;
        f.frequency.setValueAtTime(1400, t);
        f.frequency.exponentialRampToValueAtTime(220, t + len);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.32, t + 0.008);
        g.gain.exponentialRampToValueAtTime(0.0001, t + len);
        o.connect(f);
        sub.connect(f);
        f.connect(g).connect(this.pump);
        o.start(t);
        sub.start(t);
        o.stop(t + len + 0.05);
        sub.stop(t + len + 0.05);
    }

    pluck(t, freq, len, wave, vol) {
        const ctx = this.ctx;
        const o = ctx.createOscillator();
        const f = ctx.createBiquadFilter();
        const g = ctx.createGain();
        o.type = wave;
        o.frequency.value = freq;
        f.type = 'lowpass';
        f.frequency.setValueAtTime(4500, t);
        f.frequency.exponentialRampToValueAtTime(900, t + len);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol, t + 0.004);
        g.gain.exponentialRampToValueAtTime(0.0001, t + len);
        o.connect(f).connect(g);
        g.connect(this.pump);
        const send = ctx.createGain();
        send.gain.value = 0.6;
        g.connect(send).connect(this.delay);
        o.start(t);
        o.stop(t + len + 0.05);
    }

    lead(t, freq, len, wave) {
        const ctx = this.ctx;
        const o = ctx.createOscillator();
        const f = ctx.createBiquadFilter();
        const g = ctx.createGain();
        const lfo = ctx.createOscillator();
        const lg = ctx.createGain();
        o.type = wave;
        o.frequency.setValueAtTime(freq * 0.985, t);
        o.frequency.exponentialRampToValueAtTime(freq, t + 0.04);   // tiny scoop into the note
        lfo.frequency.value = 5.5;
        lg.gain.setValueAtTime(0, t);
        lg.gain.linearRampToValueAtTime(freq * 0.012, t + Math.min(0.25, len));   // delayed vibrato
        lfo.connect(lg).connect(o.frequency);
        f.type = 'lowpass';
        f.frequency.value = wave === 'sawtooth' ? 2600 : 3400;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.075, t + 0.015);
        g.gain.setValueAtTime(0.075, t + len * 0.7);
        g.gain.exponentialRampToValueAtTime(0.0001, t + len + 0.08);
        o.connect(f);
        f.connect(g).connect(this.master);
        const send = ctx.createGain();
        send.gain.value = 0.5;
        g.connect(send);
        send.connect(this.delay);
        send.connect(this.reverb);
        [o, lfo].forEach((n) => { n.start(t); n.stop(t + len + 0.1); });
    }
}

// One synth per audio context for the whole session. Its reverb and echo loop never go idle,
// so creating a new synth for every game used to leave old ones running and the audio thread
// overloaded (heard as small dropouts that got worse game after game).
let shared = null;

function synthFor(ctx, out) {
    if (!shared || shared.ctx !== ctx) shared = new Synth(ctx, out);
    return shared;
}

// Picks the track for the current level, handles danger, pausing and the timer hold.
export class MusicDirector {
    constructor(scene) {
        this.scene = scene;
        const ctx = scene.sound.context;
        const bus = audioBus(scene);
        this.synth = ctx ? synthFor(ctx, bus && bus.music) : null;
        if (this.synth) this.synth.danger = false;   // Web Audio only (silent on the HTML5 audio fallback)
        this.current = null;
        this.danger = false;
        this.paused = false;
        this.held = false;     // timer power-up: silence while the clock ticks
    }

    enabled() {
        return this.synth && settings.get('music') && !this.paused && !this.held;
    }

    setLevel(level) {
        const track = trackForLevel(level);
        if (track === this.current) return;
        this.current = track;
        if (this.synth) this.synth.setTrack(track);
        if (this.enabled()) this.synth.start();
    }

    setDanger(on) {
        this.danger = on;
        if (this.synth) this.synth.danger = on;
    }

    // Silences the music without losing the place in the song (resumes when released)
    hold(on) {
        if (this.held === on) return;
        this.held = on;
        if (!this.synth) return;
        if (on) this.synth.stop(0.25);
        else if (this.enabled()) this.synth.start();
    }

    pause() {
        this.paused = true;
        if (this.synth) this.synth.stop(0.1);
    }

    resume() {
        this.paused = false;
        if (this.enabled()) this.synth.start();
    }

    // Music setting toggled
    refresh() {
        if (!this.synth) return;
        if (this.enabled()) this.synth.start();
        else this.synth.stop(0.1);
    }

    stop() {
        if (this.synth) this.synth.stop(0.6);
    }
}
