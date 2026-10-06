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
