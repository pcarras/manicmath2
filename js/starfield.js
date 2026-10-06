import { RES, view } from './display.js';
import { settings } from './settings.js';

// Realistic night sky, painted once into a static texture (zero per-frame cost)
// plus a handful of twinkling stars driven by tweens.

const STAR_COLORS = [
    '#9bb0ff', '#aabfff', '#cad7ff', '#f8f7ff', '#f8f7ff', '#f8f7ff',
    '#fff4ea', '#fff4ea', '#ffd2a1', '#ffcc6f'
];
const TWINKLE_TINTS = [0xcad7ff, 0xf8f7ff, 0xfff4ea, 0xffd2a1, 0xaabfff];

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[(Math.random() * arr.length) | 0];

function gaussian() {
    let u = 0;
    let v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function paintSky(ctx, w, h) {
    // Deep sky gradient, slightly lighter towards the horizon
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#03040b');
    sky.addColorStop(0.55, '#060918');
    sky.addColorStop(1, '#0c0f26');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    // Milky Way band running diagonally across the screen
    const x0 = -0.15 * w, y0 = 0.92 * h;
    const x1 = 1.15 * w, y1 = 0.08 * h;
    const len = Math.hypot(x1 - x0, y1 - y0);
    const nx = -(y1 - y0) / len;
    const ny = (x1 - x0) / len;
    const diag = Math.hypot(w, h);
    const bandPoint = (spread) => {
        const t = Math.random();
        const off = gaussian() * spread * diag;
        return { x: x0 + (x1 - x0) * t + nx * off, y: y0 + (y1 - y0) * t + ny * off };
    };

    ctx.globalCompositeOperation = 'lighter';
    const hazes = ['80,100,180', '110,80,170', '60,120,160', '150,130,170'];
    for (let i = 0; i < 70; i++) {
        const p = bandPoint(0.06);
        const r = rand(0.08, 0.22) * diag;
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
        g.addColorStop(0, `rgba(${pick(hazes)},${rand(0.018, 0.04).toFixed(3)})`);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(p.x - r, p.y - r, r * 2, r * 2);
    }

    // Dark dust lanes along the band
    ctx.globalCompositeOperation = 'source-over';
    for (let i = 0; i < 18; i++) {
        const p = bandPoint(0.02);
        const r = rand(0.03, 0.08) * diag;
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
        g.addColorStop(0, 'rgba(3,4,11,0.28)');
        g.addColorStop(1, 'rgba(3,4,11,0)');
        ctx.fillStyle = g;
        ctx.fillRect(p.x - r, p.y - r, r * 2, r * 2);
    }

    const area = w * h;
    const dot = (x, y, r, color, alpha) => {
        ctx.globalAlpha = alpha;
        ctx.fillStyle = color;
        if (r < 0.6) {
            ctx.fillRect(x, y, r * 2, r * 2);
        } else {
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fill();
        }
    };

    // Faint background stars everywhere
    for (let i = 0, n = area / 450; i < n; i++) {
        dot(Math.random() * w, Math.random() * h, rand(0.3, 0.65), pick(STAR_COLORS), rand(0.12, 0.5));
    }
    // Dense faint stars inside the band
    for (let i = 0, n = area / 500; i < n; i++) {
        const p = bandPoint(0.05);
        dot(p.x, p.y, rand(0.3, 0.6), pick(STAR_COLORS), rand(0.12, 0.45));
    }
    // Medium stars
    for (let i = 0, n = area / 6000; i < n; i++) {
        dot(Math.random() * w, Math.random() * h, rand(0.7, 1.2), pick(STAR_COLORS), rand(0.5, 0.9));
    }

    // A few bright stars with a soft glow; the brightest get faint diffraction spikes
    const bright = Math.max(6, Math.round(area / 40000));
    for (let i = 0; i < bright; i++) {
        const x = Math.random() * w;
        const y = Math.random() * h;
        const color = pick(STAR_COLORS);
        const glowR = rand(5, 10);
        ctx.globalAlpha = 1;
        const g = ctx.createRadialGradient(x, y, 0, x, y, glowR);
        g.addColorStop(0, 'rgba(255,255,255,0.35)');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.fillRect(x - glowR, y - glowR, glowR * 2, glowR * 2);
        dot(x, y, rand(1.2, 1.8), color, 1);

        if (i < 3) {
            const s = rand(8, 14);
            ctx.globalAlpha = 0.22;
            ctx.strokeStyle = color;
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.moveTo(x - s, y);
            ctx.lineTo(x + s, y);
            ctx.moveTo(x, y - s);
            ctx.lineTo(x, y + s);
            ctx.stroke();
        }
    }
    ctx.globalAlpha = 1;
}

export function createStarfield(scene, depth = -10) {
    // A 0-size canvas throws on refresh (e.g. a window that starts hidden)
    const size = view(scene);
    const w = Math.max(1, Math.ceil(size.w));
    const h = Math.max(1, Math.ceil(size.h));
    const key = `starfield_${w}x${h}`;

    if (!scene.textures.exists(key)) {
        // painted at RES so stars stay pin-sharp on HiDPI screens
        const tex = scene.textures.createCanvas(key, Math.ceil(w * RES), Math.ceil(h * RES));
        const ctx = tex.getContext();
        ctx.scale(RES, RES);
        paintSky(ctx, w, h);
        tex.refresh();
    }
    if (!scene.textures.exists('starDot')) {
        const tex = scene.textures.createCanvas('starDot', 16, 16);
        const ctx = tex.getContext();
        const g = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
        g.addColorStop(0, 'rgba(255,255,255,1)');
        g.addColorStop(0.25, 'rgba(255,255,255,0.6)');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 16, 16);
        tex.refresh();
    }

    const bg = scene.add.image(0, 0, key).setOrigin(0).setDisplaySize(w, h).setDepth(depth);
    addAmbience(scene, w, h, depth);

    const twinkles = settings.get('reduceMotion') ? 0 : Phaser.Math.Clamp(Math.round((w * h) / 14000), 12, 40);
    for (let i = 0; i < twinkles; i++) {
        const star = scene.add.image(Math.random() * w, Math.random() * h, 'starDot')
            .setTint(pick(TWINKLE_TINTS))
            .setScale(rand(0.25, 0.55))
            .setAlpha(rand(0.2, 0.5))
            .setBlendMode(Phaser.BlendModes.ADD)
            .setDepth(depth + 1);

        scene.tweens.add({
            targets: star,
            alpha: rand(0.7, 1),
            duration: rand(1400, 4000),
            delay: rand(0, 3000),
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
    }
    return bg;
}

// ------------------------------------------------------------------ ambience
// Discreet "wow": two coloured nebulae drifting and breathing very slowly, plus a rare shooting
// star. Only a few images and tweens, so it costs almost nothing per frame.

const NEBULA_TINTS = [0x7c3aed, 0x0e7490, 0xbe185d];

function ensureAmbienceTextures(scene) {
    if (!scene.textures.exists('nebula')) {
        const tex = scene.textures.createCanvas('nebula', 256, 256);
        const ctx = tex.getContext();
        // Soft lumpy cloud: a few overlapping radial blobs
        const blobs = [[128, 128, 120, 1], [90, 110, 80, 0.7], [170, 150, 90, 0.6], [140, 80, 60, 0.5]];
        for (const [x, y, r, a] of blobs) {
            const g = ctx.createRadialGradient(x, y, 0, x, y, r);
            g.addColorStop(0, `rgba(255,255,255,${0.55 * a})`);
            g.addColorStop(0.5, `rgba(255,255,255,${0.18 * a})`);
            g.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, 256, 256);
        }
        tex.refresh();
    }
    if (!scene.textures.exists('shootingStar')) {
        const tex = scene.textures.createCanvas('shootingStar', 160, 6);
        const ctx = tex.getContext();
        const g = ctx.createLinearGradient(0, 0, 160, 0);
        g.addColorStop(0, 'rgba(255,255,255,0)');
        g.addColorStop(0.85, 'rgba(200,220,255,0.7)');
        g.addColorStop(1, 'rgba(255,255,255,1)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(0, 3);
        ctx.lineTo(156, 0.5);
        ctx.arc(156, 3, 2.5, -Math.PI / 2, Math.PI / 2);
        ctx.lineTo(0, 3);
        ctx.fill();
        tex.refresh();
    }
}

function addAmbience(scene, w, h, depth) {
    ensureAmbienceTextures(scene);
    const calm = settings.get('reduceMotion');
    const size = Math.max(w, h);

    for (let i = 0; i < 2; i++) {
        const neb = scene.add.image(rand(0.15, 0.85) * w, (i === 0 ? rand(0.15, 0.4) : rand(0.6, 0.85)) * h, 'nebula')
            .setTint(NEBULA_TINTS[(Math.random() * NEBULA_TINTS.length) | 0])
            .setDisplaySize(size * rand(0.8, 1.05), size * rand(0.6, 0.8))
            .setAngle(rand(-30, 30))
            .setAlpha(0.13)
            .setBlendMode(Phaser.BlendModes.ADD)
            .setDepth(depth + 0.2);
        if (calm) continue;
        scene.tweens.add({
            targets: neb,
            x: neb.x + rand(-60, 60),
            y: neb.y + rand(-40, 40),
            angle: neb.angle + rand(-8, 8),
            duration: rand(22000, 32000),
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
        scene.tweens.add({
            targets: neb, alpha: 0.22, duration: rand(6000, 9000), yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
        });
    }
    if (calm) return;

    // A shooting star every 7-14 s, never twice in the same place
    const shoot = () => {
        const star = scene.add.image(rand(0.3, 1.1) * w, rand(-0.05, 0.45) * h, 'shootingStar')
            .setOrigin(1, 0.5)
            .setAngle(rand(140, 160))
            .setAlpha(0)
            .setScale(rand(0.6, 1))
            .setBlendMode(Phaser.BlendModes.ADD)
            .setScrollFactor(0)
            .setDepth(depth + 0.5);
        const a = Phaser.Math.DegToRad(star.angle);
        const dist = rand(0.35, 0.6) * w;
        scene.tweens.add({
            targets: star,
            x: star.x + Math.cos(a) * dist,
            y: star.y + Math.sin(a) * dist,
            duration: rand(700, 1000),
            ease: 'Cubic.easeIn',
            onComplete: () => star.destroy()
        });
        scene.tweens.add({ targets: star, alpha: { from: 0, to: 0.9 }, duration: 250, yoyo: true, hold: 300 });
        scene.time.delayedCall(rand(7000, 14000), shoot);
    };
    scene.time.delayedCall(rand(2500, 6000), shoot);
}
