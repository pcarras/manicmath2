// Backgrounds for the mini games: daylight scenes that feel like a break from the night-sky game.
// Each is painted once into a texture (sharp at RES), plus a few slow drifting decorations.
import { RES } from './display.js';
import { settings } from './settings.js';

const rand = (a, b) => a + Math.random() * (b - a);

function vertical(ctx, w, h, stops) {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    stops.forEach(([at, col]) => g.addColorStop(at, col));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
}

function glow(ctx, x, y, r, col) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, col);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

const PAINT = {
    sky(ctx, w, h) {
        vertical(ctx, w, h, [[0, '#1e88e5'], [0.55, '#64b5f6'], [1, '#c8e6fa']]);
        glow(ctx, w * 0.82, h * 0.22, w * 0.45, 'rgba(255,244,190,0.75)');
        // distant hills
        ctx.fillStyle = 'rgba(56,142,60,0.55)';
        ctx.beginPath();
        ctx.moveTo(0, h);
        for (let x = 0; x <= w; x += 8) ctx.lineTo(x, h * 0.86 + Math.sin(x * 0.012) * 22 + Math.sin(x * 0.031) * 9);
        ctx.lineTo(w, h);
        ctx.fill();
    },
    mint(ctx, w, h) {
        vertical(ctx, w, h, [[0, '#0f766e'], [0.5, '#34d399'], [1, '#bbf7d0']]);
        glow(ctx, w * 0.2, h * 0.3, w * 0.5, 'rgba(255,255,255,0.25)');
    },
    chalk(ctx, w, h) {
        vertical(ctx, w, h, [[0, '#1d3b2a'], [1, '#13281d']]);
        // chalk dust
        for (let i = 0; i < (w * h) / 900; i++) {
            ctx.fillStyle = `rgba(255,255,255,${rand(0.02, 0.06).toFixed(3)})`;
            ctx.fillRect(rand(0, w), rand(0, h), rand(1, 3), rand(1, 2));
        }
        // faint grid
        ctx.strokeStyle = 'rgba(255,255,255,0.05)';
        ctx.lineWidth = 1;
        for (let x = 0; x < w; x += 32) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
        for (let y = 0; y < h; y += 32) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
        // half-erased sums in chalk
        ctx.font = "26px 'Righteous', sans-serif";
        ctx.fillStyle = 'rgba(255,255,255,0.09)';
        ['2×3=6', '7×8=56', '9×9=81', '5×4=20', '6×7=42', '3×3=9', '8×2=16'].forEach((txt, i) => {
            ctx.save();
            ctx.translate(rand(10, w - 120), h * (0.15 + i * 0.12));
            ctx.rotate(rand(-0.15, 0.15));
            ctx.fillText(txt, 0, 0);
            ctx.restore();
        });
        // wooden frame
        ctx.strokeStyle = '#7a4a22';
        ctx.lineWidth = 10;
        ctx.strokeRect(0, 0, w, h);
    },
    candy(ctx, w, h) {
        vertical(ctx, w, h, [[0, '#7e22ce'], [0.5, '#c084fc'], [1, '#fbcfe8']]);
        for (let y = 0; y < h; y += 46) {
            for (let x = (y / 46) % 2 ? 23 : 0; x < w + 23; x += 46) {
                ctx.fillStyle = 'rgba(255,255,255,0.08)';
                ctx.beginPath();
                ctx.arc(x, y, 9, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    },
    kitchen(ctx, w, h) {
        // red and white checked tablecloth
        const s = 40;
        for (let y = 0; y < h; y += s) {
            for (let x = 0; x < w; x += s) {
                const a = (x / s + y / s) % 2 === 0;
                ctx.fillStyle = a ? '#c62828' : '#fdf3e7';
                ctx.fillRect(x, y, s, s);
            }
        }
        // cross threads where stripes overlap
        ctx.fillStyle = 'rgba(198,40,40,0.35)';
        for (let x = 0; x < w; x += s * 2) ctx.fillRect(x + s, 0, s, h);
        // soft warm vignette so the pieces stand out
        const g = ctx.createRadialGradient(w / 2, h * 0.55, w * 0.2, w / 2, h * 0.55, Math.max(w, h) * 0.75);
        g.addColorStop(0, 'rgba(60,20,0,0.25)');
        g.addColorStop(1, 'rgba(40,10,0,0.75)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
    },
    ocean(ctx, w, h) {
        vertical(ctx, w, h, [[0, '#0e7490'], [0.55, '#155e75'], [1, '#082f49']]);
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 6; i++) {
            const x = rand(0, w);
            const g = ctx.createLinearGradient(x, 0, x + 60, h * 0.8);
            g.addColorStop(0, 'rgba(186,230,253,0.16)');
            g.addColorStop(1, 'rgba(186,230,253,0)');
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x + rand(30, 70), 0);
            ctx.lineTo(x + rand(120, 200), h * 0.8);
            ctx.lineTo(x + rand(40, 90), h * 0.8);
            ctx.fill();
        }
        ctx.globalCompositeOperation = 'source-over';
    }
};

function ensureDecor(scene) {
    if (!scene.textures.exists('decorCloud')) {
        const tex = scene.textures.createCanvas('decorCloud', 160, 80);
        const ctx = tex.getContext();
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        [[45, 50, 28], [80, 38, 34], [115, 50, 26], [80, 56, 30]].forEach(([x, y, r]) => {
            ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
        });
        tex.refresh();
    }
    if (!scene.textures.exists('decorBubble')) {
        const tex = scene.textures.createCanvas('decorBubble', 32, 32);
        const ctx = tex.getContext();
        ctx.strokeStyle = 'rgba(255,255,255,0.7)';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(16, 16, 13, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.beginPath(); ctx.arc(11, 11, 3.5, 0, Math.PI * 2); ctx.fill();
        tex.refresh();
    }
}

export function createDrillBackground(scene, key, w, h, depth = -10) {
    const tk = `drillbg_${key}_${Math.ceil(w)}x${Math.ceil(h)}`;
    if (!scene.textures.exists(tk)) {
        const tex = scene.textures.createCanvas(tk, Math.ceil(w * RES), Math.ceil(h * RES));
        const ctx = tex.getContext();
        ctx.scale(RES, RES);
        (PAINT[key] || PAINT.sky)(ctx, w, h);
        tex.refresh();
    }
    scene.add.image(0, 0, tk).setOrigin(0).setDisplaySize(w, h).setDepth(depth);

    if (settings.get('reduceMotion')) return;
    ensureDecor(scene);
    if (key === 'sky') {
        for (let i = 0; i < 4; i++) {
            const c = scene.add.image(rand(0, w), rand(h * 0.2, h * 0.6), 'decorCloud')
                .setScale(rand(0.5, 1.1)).setAlpha(rand(0.45, 0.8)).setDepth(depth + 1);
            const drift = () => {
                scene.tweens.add({
                    targets: c, x: w + 100, duration: rand(30000, 50000) * ((w + 100 - c.x) / (w + 200)),
                    onComplete: () => { c.x = -100; c.y = rand(h * 0.2, h * 0.6); drift(); }
                });
            };
            drift();
        }
    } else if (key === 'mint' || key === 'ocean' || key === 'candy') {
        for (let i = 0; i < 10; i++) {
            const b = scene.add.image(rand(0, w), rand(0, h), 'decorBubble')
                .setScale(rand(0.4, 1.2)).setAlpha(rand(0.25, 0.6)).setDepth(depth + 1);
            const rise = () => {
                scene.tweens.add({
                    targets: b, y: -40, x: b.x + rand(-30, 30), duration: rand(9000, 16000) * ((b.y + 40) / (h + 40)),
                    onComplete: () => { b.y = h + 40; b.x = rand(0, w); rise(); }
                });
            };
            rise();
        }
    }
}
