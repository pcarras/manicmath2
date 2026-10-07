// One mixing bus for every sound in the game: sampled effects (Phaser), synthesized effects
// (sfx.js) and music (music.js) each get a level, then all go through a single limiter.
// Without it, many sounds at once add up past full scale and crackle / distort.
let bus = null;

export function audioBus(scene) {
    const sm = scene.sound;
    const ctx = sm && sm.context;
    if (!ctx) return null;
    if (bus && bus.ctx === ctx) return bus;

    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -9;
    limiter.knee.value = 4;
    limiter.ratio.value = 14;
    limiter.attack.value = 0.002;
    limiter.release.value = 0.12;
    const out = ctx.createGain();
    out.gain.value = 0.92;
    limiter.connect(out).connect(ctx.destination);

    const level = (v) => {
        const g = ctx.createGain();
        g.gain.value = v;
        g.connect(limiter);
        return g;
    };
    const music = level(0.7);
    const sfx = level(0.62);
    const samples = level(0.8);

    // Reroute Phaser's own output (the sampled sounds) into the bus
    try {
        const node = sm.masterVolumeNode;
        node.disconnect();
        node.connect(samples);
    } catch { /* older Phaser layout: leave it as is */ }

    bus = {
        ctx, limiter, music, sfx, samples,
        // Music steps back for a moment under big effects (explosions, heat wave)
        duck(depth = 0.4, ms = 450) {
            const t = ctx.currentTime;
            music.gain.cancelScheduledValues(t);
            music.gain.setValueAtTime(music.gain.value, t);
            music.gain.linearRampToValueAtTime(0.7 * depth, t + 0.04);
            music.gain.linearRampToValueAtTime(0.7, t + ms / 1000);
        }
    };
    return bus;
}
