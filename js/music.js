// Level music. Levels 1-2 play the original soundtrack file; from level 3 a procedural chiptune
// sequencer (Web Audio, no assets) takes over with faster tracks as the game speeds up.
import { settings } from './settings.js';

const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);

// Each track: tempo, a 4-chord progression (bass root MIDI + quality) and 16-step patterns.
const TRACKS = [
    {
        name: 'Neon Bica', bpm: 110,
        chords: [[45, 'm'], [41, 'M'], [48, 'M'], [43, 'M']],          // Am F C G
        kick: [0, 8], snare: [4, 12], hat: [2, 6, 10, 14],
        bass: [0, 3, 6, 8, 11, 14], arpRate: 2, lead: [0, 3, 6, 10, 12]
    },
    {
        name: 'Sprint', bpm: 124,
        chords: [[40, 'm'], [36, 'M'], [43, 'M'], [38, 'M']],          // Em C G D
        kick: [0, 6, 8], snare: [4, 12], hat: [0, 2, 4, 6, 8, 10, 12, 14],
        bass: [0, 2, 4, 6, 8, 10, 12, 14], arpRate: 1, lead: [0, 2, 4, 7, 8, 12, 14]
    },
    {
        name: 'Overdrive', bpm: 138,
        chords: [[38, 'm'], [34, 'M'], [41, 'M'], [36, 'M']],          // Dm Bb F C
        kick: [0, 4, 8, 12], snare: [4, 12], hat: [1, 3, 5, 7, 9, 11, 13, 15],
        bass: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], arpRate: 1, lead: [0, 3, 4, 6, 8, 11, 12, 14]
    }
];

const TRIADS = { m: [0, 3, 7], M: [0, 4, 7] };
const MOTIF = [0, 1, 2, 1, 2, 0, 1, 2];   // which chord tone each lead note uses

export function trackForLevel(level) {
    if (level <= 2) return -1;            // -1 = original soundtrack file
    if (level <= 4) return 0;
    if (level <= 6) return 1;
    return 2;
}

class Chiptune {
    constructor(ctx) {
        this.ctx = ctx;
        this.master = ctx.createGain();
        this.master.gain.value = 0;
        this.master.connect(ctx.destination);
        this.noise = this.makeNoise();
        this.track = TRACKS[0];
        this.step = 0;
        this.bar = 0;
        this.timer = null;
        this.danger = false;
    }

    makeNoise() {
        const len = this.ctx.sampleRate;
        const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
        return buf;
    }

    setTrack(i) {
        this.track = TRACKS[i];
    }

    start() {
        if (this.timer) return;
        const t = this.ctx.currentTime;
        this.master.gain.cancelScheduledValues(t);
        this.master.gain.setValueAtTime(this.master.gain.value, t);
        this.master.gain.linearRampToValueAtTime(0.16, t + 0.6);
        this.nextTime = t + 0.05;
        this.timer = setInterval(() => this.schedule(), 25);
    }

    stop(fade = 0.4) {
        const t = this.ctx.currentTime;
        this.master.gain.cancelScheduledValues(t);
        this.master.gain.setValueAtTime(this.master.gain.value, t);
        this.master.gain.linearRampToValueAtTime(0, t + fade);
        clearInterval(this.timer);
        this.timer = null;
    }

    // Look-ahead scheduler: queue every 16th note that starts within the next 120 ms
    schedule() {
        const tr = this.track;
        const bpm = tr.bpm * (this.danger ? 1.1 : 1);
        const sixteenth = 60 / bpm / 4;
        while (this.nextTime < this.ctx.currentTime + 0.12) {
            this.playStep(tr, this.step, this.nextTime, sixteenth);
            this.nextTime += sixteenth;
            this.step = (this.step + 1) % 16;
            if (this.step === 0) this.bar = (this.bar + 1) % 8;
        }
    }

    playStep(tr, s, t, dur) {
        const [root, quality] = tr.chords[Math.floor(this.bar / 2) % tr.chords.length];
        const triad = TRIADS[quality];

        if (tr.kick.includes(s)) this.kick(t);
        if (tr.snare.includes(s)) this.snare(t);
        if (tr.hat.includes(s) || (this.danger && s % 2 === 1)) this.hat(t);
        if (tr.bass.includes(s)) this.tone(t, midi(s % 8 === 6 ? root + 12 : root), dur * 1.6, 'triangle', 0.32, 900);
        if (s % tr.arpRate === 0) {
            const idx = (s / tr.arpRate) % 3;
            this.tone(t, midi(root + 24 + triad[idx]), dur * 0.9, 'square', 0.045, 3200);
        }
        // Lead plays on odd bars so the arrangement breathes
        if (this.bar % 2 === 1) {
            const k = tr.lead.indexOf(s);
            if (k !== -1) {
                const note = root + 36 + triad[MOTIF[(k + this.bar) % MOTIF.length]];
                this.tone(t, midi(note), dur * 1.8, 'square', 0.06, 4200, true);
            }
        }
    }

    tone(t, freq, len, type, vol, cutoff, vibrato = false) {
        const ctx = this.ctx;
        const o = ctx.createOscillator();
        const f = ctx.createBiquadFilter();
        const g = ctx.createGain();
        o.type = type;
        o.frequency.setValueAtTime(freq, t);
        if (vibrato) {
            const lfo = ctx.createOscillator();
            const lg = ctx.createGain();
            lfo.frequency.value = 6;
            lg.gain.value = freq * 0.012;
            lfo.connect(lg).connect(o.frequency);
            lfo.start(t);
            lfo.stop(t + len + 0.05);
        }
        f.type = 'lowpass';
        f.frequency.value = cutoff;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t + len);
        o.connect(f).connect(g).connect(this.master);
        o.start(t);
        o.stop(t + len + 0.05);
    }

    kick(t) {
        const ctx = this.ctx;
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.frequency.setValueAtTime(150, t);
        o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
        g.gain.setValueAtTime(0.9, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
        o.connect(g).connect(this.master);
        o.start(t);
        o.stop(t + 0.16);
    }

    noiseHit(t, freq, len, vol) {
        const ctx = this.ctx;
        const src = ctx.createBufferSource();
        const f = ctx.createBiquadFilter();
        const g = ctx.createGain();
        src.buffer = this.noise;
        f.type = 'highpass';
        f.frequency.value = freq;
        g.gain.setValueAtTime(vol, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + len);
        src.connect(f).connect(g).connect(this.master);
        src.start(t, Math.random() * 0.5);
        src.stop(t + len + 0.02);
    }

    snare(t) {
        this.noiseHit(t, 1800, 0.14, 0.35);
        this.tone(t, 190, 0.08, 'triangle', 0.15, 2000);
    }

    hat(t) {
        this.noiseHit(t, 7000, 0.035, 0.12);
    }
}

// Picks the soundtrack file or a chiptune track for the current level, handles danger and pausing.
export class MusicDirector {
    constructor(scene) {
        this.scene = scene;
        this.file = scene.cache.audio.exists('bgMusic')
            ? scene.sound.add('bgMusic', { loop: true, volume: 0.35 }) : null;
        const ctx = scene.sound.context;
        this.chip = ctx ? new Chiptune(ctx) : null;   // Web Audio only (not on HTML5 audio fallback)
        this.current = null;
        this.danger = false;
        this.paused = false;
    }

    enabled() {
        return settings.get('music') && !this.paused;
    }

    setLevel(level) {
        let track = trackForLevel(level);
        if (track >= 0 && !this.chip) track = -1;
        if (track === this.current) return;
        this.current = track;
        if (!this.enabled()) return;
        this.apply();
    }

    apply() {
        if (this.current === -1) {
            if (this.chip) this.chip.stop();
            if (this.file && !this.file.isPlaying) this.file.play();
            if (this.file) this.file.setRate(this.danger ? 1.12 : 1);
        } else {
            if (this.file) this.file.stop();
            this.chip.setTrack(this.current);
            this.chip.danger = this.danger;
            this.chip.start();
        }
    }

    setDanger(on) {
        this.danger = on;
        if (this.file) this.file.setRate(on ? 1.12 : 1);
        if (this.chip) this.chip.danger = on;
    }

    pause() {
        this.paused = true;
        if (this.file && this.file.isPlaying) this.file.pause();
        if (this.chip) this.chip.stop(0.1);
    }

    resume() {
        this.paused = false;
        if (!settings.get('music')) return;
        if (this.current === -1 && this.file && this.file.isPaused) {
            this.file.resume();
            return;
        }
        this.apply();
    }

    // Music setting toggled
    refresh() {
        if (settings.get('music')) {
            if (!this.paused) this.apply();
        } else {
            if (this.file) this.file.stop();
            if (this.chip) this.chip.stop(0.1);
        }
    }

    stop() {
        if (this.file) this.file.stop();
        if (this.chip) this.chip.stop(0.6);
    }
}
