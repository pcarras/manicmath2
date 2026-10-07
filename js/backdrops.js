// Backgrounds for the main game, bought in the shop. 'space' is the original night sky (starfield.js).
// The others are painted once into a texture (sharp at RES) with a few slow decorations on top.
// All of them stay dark enough for the coloured pieces to stand out.
import { RES, view } from './display.js';
import { settings } from './settings.js';
import { createStarfield } from './starfield.js';

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
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

function stars(ctx, w, h, n, maxY) {
    for (let i = 0; i < n; i++) {
        ctx.fillStyle = `rgba(255,255,240,${rand(0.25, 0.8).toFixed(2)})`;
        const s = Math.random() < 0.1 ? 2 : 1;
        ctx.fillRect(rand(0, w), rand(0, maxY), s, s);
    }
}

// Lisbon by night: moon, the castle on its hill, houses with lit windows down to the river,
// the red bridge and the lights shimmering on the Tagus
function paintLisbon(ctx, w, h) {
    vertical(ctx, w, h, [[0, '#070b24'], [0.5, '#1a1747'], [0.72, '#3a2459'], [1, '#0b1028']]);
    stars(ctx, w, h, (w * h) / 2600, h * 0.5);
    // Moon
    glow(ctx, w * 0.8, h * 0.14, 90, 'rgba(255,240,200,0.35)');
    ctx.fillStyle = '#fff4d6';
    ctx.beginPath(); ctx.arc(w * 0.8, h * 0.14, 22, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(200,190,160,0.35)';
    [[-6, -5, 5], [7, 4, 4], [-2, 8, 3]].forEach(([dx, dy, r]) => {
        ctx.beginPath(); ctx.arc(w * 0.8 + dx, h * 0.14 + dy, r, 0, Math.PI * 2); ctx.fill();
    });

    const river = h * 0.86;
    // Far hill with the castle (São Jorge)
    ctx.fillStyle = '#1b1838';
    ctx.beginPath();
    ctx.moveTo(0, river);
    ctx.lineTo(0, h * 0.66);
    ctx.quadraticCurveTo(w * 0.3, h * 0.52, w * 0.55, h * 0.6);
    ctx.quadraticCurveTo(w * 0.8, h * 0.66, w, h * 0.64);
    ctx.lineTo(w, river);
    ctx.fill();
    const cx = w * 0.3;
    const cy = h * 0.56;
    ctx.fillStyle = '#25214a';
    ctx.fillRect(cx - 42, cy - 10, 84, 20);
    [-42, -20, 4, 26].forEach((dx, i) => {
        const tw = i % 2 ? 14 : 18;
        ctx.fillRect(cx + dx, cy - 24 - (i % 2) * 6, tw, 24 + (i % 2) * 6);
        for (let b = 0; b < tw; b += 6) ctx.fillRect(cx + dx + b, cy - 30 - (i % 2) * 6, 4, 6);
    });
    // Floodlight on the castle walls
    glow(ctx, cx, cy - 6, 70, 'rgba(255,200,120,0.18)');

    // Houses: rows of little boxes stepping down the hill, warm lit windows
    const rows = 4;
    for (let r = 0; r < rows; r++) {
        const base = h * (0.68 + r * 0.05);
        let x = -10;
        while (x < w) {
            const bw = rand(18, 34);
            const bh = rand(18, 34);
            ctx.fillStyle = ['#2a2350', '#2f2757', '#251f47', '#332a5e'][(r + Math.floor(x)) % 4];
            ctx.fillRect(x, base - bh, bw, bh + h * 0.05);
            // Roof
            ctx.fillStyle = '#4a2b3a';
            ctx.beginPath();
            ctx.moveTo(x - 2, base - bh);
            ctx.lineTo(x + bw / 2, base - bh - 7);
            ctx.lineTo(x + bw + 2, base - bh);
            ctx.fill();
            // Windows
            for (let wy = base - bh + 5; wy < base - 4; wy += 9) {
                for (let wx = x + 4; wx < x + bw - 5; wx += 8) {
                    if (Math.random() < 0.45) {
                        ctx.fillStyle = Math.random() < 0.8 ? 'rgba(255,205,110,0.9)' : 'rgba(170,220,255,0.8)';
                        ctx.fillRect(wx, wy, 4, 5);
                    }
                }
            }
            x += bw + rand(1, 4);
        }
    }

    // River
    vertical(ctx, w, h, [[0, 'rgba(0,0,0,0)'], [0.86, 'rgba(0,0,0,0)'], [0.861, '#0d1636'], [1, '#060a1e']]);
    // Light reflections on the water
    for (let i = 0; i < 70; i++) {
        const x = rand(0, w);
        const y = rand(river + 4, h - 4);
        ctx.fillStyle = `rgba(255,200,120,${rand(0.08, 0.35).toFixed(2)})`;
        ctx.fillRect(x, y, rand(6, 18), 1.5);
    }
    // 25 de Abril bridge: red towers and the deck crossing the river mouth
    const deck = river - 6;
    ctx.strokeStyle = '#b8322a';
    ctx.fillStyle = '#b8322a';
    ctx.lineWidth = 3;
    ctx.fillRect(0, deck, w, 4);
    [w * 0.55, w * 0.92].forEach((tx) => {
        ctx.fillRect(tx - 4, deck - 70, 3, 80);
        ctx.fillRect(tx + 3, deck - 70, 3, 80);
        ctx.fillRect(tx - 4, deck - 52, 10, 3);
        ctx.fillRect(tx - 4, deck - 30, 10, 3);
    });
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(w * 0.2, deck);
    ctx.quadraticCurveTo(w * 0.38, deck - 10, w * 0.55, deck - 70);
    ctx.quadraticCurveTo(w * 0.735, deck - 8, w * 0.92, deck - 70);
    ctx.quadraticCurveTo(w * 1.0, deck - 30, w * 1.1, deck);
    ctx.stroke();
    // Little red lights on top of the towers
    [w * 0.55, w * 0.92].forEach((tx) => glow(ctx, tx + 1, deck - 72, 8, 'rgba(255,60,60,0.9)'));
    // Gentle darkening in the middle, where the pieces play
    const v = ctx.createRadialGradient(w / 2, h * 0.45, w * 0.1, w / 2, h * 0.45, h * 0.7);
    v.addColorStop(0, 'rgba(4,4,16,0.35)');
    v.addColorStop(1, 'rgba(4,4,16,0)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, w, h);
}

const PAINT = { lisbon: paintLisbon };

function ensureBubble(scene) {
    if (scene.textures.exists('decorBubble')) return;
    const tex = scene.textures.createCanvas('decorBubble', 32, 32);
    const ctx = tex.getContext();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(16, 16, 13, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath(); ctx.arc(11, 11, 3.5, 0, Math.PI * 2); ctx.fill();
    tex.refresh();
}

function ensureDot(scene) {
    if (scene.textures.exists('starDot')) return;
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

// Paints (once) and returns the texture key for a scene; also used for the shop thumbnails
export function backdropTexture(scene, id, w, h) {
    const key = `backdrop_${id}_${Math.ceil(w)}x${Math.ceil(h)}`;
    if (!scene.textures.exists(key)) {
        const tex = scene.textures.createCanvas(key, Math.ceil(w * RES), Math.ceil(h * RES));
        const ctx = tex.getContext();
        ctx.scale(RES, RES);
        (PAINT[id] || paintLisbon)(ctx, w, h);
        tex.refresh();
    }
    return key;
}

// Scenes painted offline in high resolution (assets/scenes, made by tools/scenes/process.py)
const PICTURES = ['lisbon', 'alfama', 'porto', 'sintra', 'algarve', 'coimbra', 'obidos', 'evora', 'madeira', 'acores', 'ocean', 'beach'];

export function hasPicture(id) {
    return PICTURES.includes(id);
}

// Call from a scene's preload() for the scene in use (the full picture and where its animations go)
export function preloadBackdrop(scene, id) {
    if (!hasPicture(id) || scene.textures.exists(`scene_${id}`)) return;
    scene.load.image(`scene_${id}`, `assets/scenes/web/${id}.webp`);
    scene.load.json(`scene_${id}_anim`, `assets/scenes/web/${id}.json`);
}

// The shop only needs a small preview of each scene, not the full picture
export function preloadThumb(scene, id) {
    if (!hasPicture(id) || scene.textures.exists(`thumb_${id}`)) return;
    scene.load.image(`thumb_${id}`, `assets/scenes/thumb/${id}.webp`);
}

function ensureSoftCloud(scene) {
    if (scene.textures.exists('softCloud')) return;
    const tex = scene.textures.createCanvas('softCloud', 256, 96);
    const ctx = tex.getContext();
    ctx.filter = 'blur(10px)';
    ctx.fillStyle = 'rgba(190,180,230,0.55)';
    [[70, 55, 40], [120, 45, 48], [170, 55, 38], [120, 62, 50]].forEach(([x, y, r]) => {
        ctx.beginPath(); ctx.ellipse(x, y, r * 1.4, r * 0.55, 0, 0, Math.PI * 2); ctx.fill();
    });
    tex.refresh();
}

// The offline picture, scaled to cover the screen (anchored at the bottom, where the city is),
// with a few quiet animations on top, as listed in the scene's json (see tools/scenes/process.py):
// windows switching off and on, lamps pulsing, light shimmering on the water, clouds or fog drifting,
// stars twinkling, a breathing moon halo, bubbles rising. Lisbon also has beacons and cars.
function createPicture(scene, id, w, h, depth) {
    const key = `scene_${id}`;
    const img = scene.add.image(0, 0, key).setOrigin(0.5, 1).setDepth(depth);
    const src = scene.textures.get(key).getSourceImage();
    let fit = null;
    img.fit = (W, H) => {
        const k = Math.max(W / src.width, H / src.height);
        img.setScale(k).setPosition(W / 2, H);
        fit = { k, x0: W / 2 - (src.width * k) / 2, y0: H - src.height * k, iw: src.width * k, ih: src.height * k };
    };
    img.fit(w, h);
    const anim = scene.cache.json.get(`scene_${id}_anim`);
    if (!anim || settings.get('reduceMotion')) return img;
    const P = ([x, y]) => [fit.x0 + x * fit.iw, fit.y0 + y * fit.ih];
    ensureDot(scene);
    ensureSoftCloud(scene);
    const add = (o) => o.setDepth(depth + 1);

    // Clouds drifting slowly across the sky band
    if (anim.clouds) {
        for (let i = 0; i < 3; i++) {
            const cy = fit.y0 + rand(anim.clouds[0], anim.clouds[1]) * fit.ih;
            const c = add(scene.add.image(rand(-100, w), cy, 'softCloud').setScale(rand(1, 2)).setAlpha(rand(0.18, 0.32)));
            const drift = () => scene.tweens.add({
                targets: c, x: w + 260, duration: rand(70000, 110000) * ((w + 260 - c.x) / (w + 520)),
                onComplete: () => { c.x = -260; drift(); }
            });
            drift();
        }
    }
    // Moon: a halo that breathes very slowly
    if (anim.moon) {
        const [px, py] = P(anim.moon);
        const rr = anim.moon[2] * fit.iw;
        const halo = add(scene.add.image(px, py, 'starDot').setTint(anim.moonTint || 0xfff1cc).setBlendMode(Phaser.BlendModes.ADD)
            .setScale((rr * 7) / 16).setAlpha(0.18));
        scene.tweens.add({ targets: halo, alpha: 0.32, scale: (rr * 8.5) / 16, duration: 7000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
    // Stars: a few twinkle, and now and then a shooting star crosses the sky
    if (anim.sky) {
        const y0 = fit.y0 + anim.sky[0] * fit.ih;
        const y1 = fit.y0 + anim.sky[1] * fit.ih;
        for (let i = 0; i < 18; i++) {
            const st = add(scene.add.image(rand(0, w), rand(Math.max(0, y0), y1), 'starDot').setTint(0xe8eeff)
                .setBlendMode(Phaser.BlendModes.ADD).setScale(rand(0.2, 0.4)).setAlpha(0));
            scene.tweens.add({ targets: st, alpha: rand(0.5, 0.9), duration: rand(1500, 3500), yoyo: true, repeat: -1, delay: rand(0, 6000), repeatDelay: rand(1000, 5000) });
        }
        const shoot = () => {
            const sx = rand(w * 0.1, w * 0.9);
            const sy = rand(Math.max(0, y0), (y0 + y1) / 2);
            const st = add(scene.add.rectangle(sx, sy, 46, 1.6, 0xffffff).setAngle(-24).setAlpha(0));
            scene.tweens.add({
                targets: st, x: sx - 160, y: sy + 70, alpha: { from: 0.9, to: 0 }, duration: 900, ease: 'Sine.easeIn',
                onComplete: () => st.destroy()
            });
            scene.time.delayedCall(rand(14000, 30000), shoot);
        };
        scene.time.delayedCall(rand(6000, 15000), shoot);
    }
    // Windows: some switch off and on again now and then
    (anim.windows || []).forEach(([x, y]) => {
        const [px, py] = P([x, y]);
        if (px < 0 || px > w) return;
        const d = add(scene.add.image(px, py, 'starDot').setTint(0x0b0820).setScale(0.22 * fit.k * 2.5).setAlpha(0));
        scene.tweens.add({ targets: d, alpha: 0.95, duration: 200, hold: rand(3000, 9000), yoyo: true, repeat: -1, delay: rand(0, 20000), repeatDelay: rand(6000, 20000) });
    });
    // Beacons pulse
    (anim.beacons || []).forEach((b) => {
        const [px, py] = P(b);
        const d = add(scene.add.image(px, py, 'starDot').setTint(0xff4030).setBlendMode(Phaser.BlendModes.ADD).setScale(1.2).setAlpha(0.2));
        scene.tweens.add({ targets: d, alpha: 1, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    });
    // Cars crossing the bridge deck
    if (anim.cars) {
        const [x0, x1, y] = anim.cars;
        const a = P([x0, y]);
        const b = P([x1, y]);
        for (let i = 0; i < 6; i++) {
            const right = i % 2 === 0;
            const car = add(scene.add.image(a[0], a[1], 'starDot').setTint(right ? 0xfff0c8 : 0xff5040)
                .setBlendMode(Phaser.BlendModes.ADD).setScale(0.35));
            const go = () => {
                car.x = right ? a[0] : b[0];
                scene.tweens.add({ targets: car, x: right ? b[0] : a[0], duration: rand(9000, 14000), delay: rand(0, 6000), onComplete: go });
            };
            go();
        }
    }
    // Lamps and lanterns: a warm glow that pulses slowly, each at its own pace
    (anim.glows || []).forEach(([x, y, r]) => {
        const [px, py] = P([x, y]);
        const d = add(scene.add.image(px, py, 'starDot').setTint(0xffc060).setBlendMode(Phaser.BlendModes.ADD)
            .setScale((r * fit.iw * 2) / 16).setAlpha(0.15));
        scene.tweens.add({ targets: d, alpha: rand(0.4, 0.6), scale: (r * fit.iw * 2.6) / 16, duration: rand(1800, 3200), yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: rand(0, 1500) });
    });
    // Bubbles rising (underwater)
    if (anim.bubbles) {
        ensureBubble(scene);
        for (let i = 0; i < 14; i++) {
            const b = add(scene.add.image(rand(0, w), rand(0, h), 'decorBubble').setScale(rand(0.3, 0.9)).setAlpha(rand(0.2, 0.5)));
            const rise = () => {
                scene.tweens.add({
                    targets: b, y: -30, x: b.x + rand(-30, 30), duration: rand(10000, 18000) * ((b.y + 30) / (h + 30)),
                    onComplete: () => { b.y = h + 30; b.x = rand(0, w); rise(); }
                });
            };
            rise();
        }
    }
    // Shimmer on the water: a band [y0, y1] (and optionally only between waterX), or from a line down
    if (anim.water) {
        const band = Array.isArray(anim.water) ? anim.water : [anim.water, 1];
        const y0 = fit.y0 + band[0] * fit.ih;
        const y1 = Math.min(h, fit.y0 + band[1] * fit.ih);
        const xr = anim.waterX ? [fit.x0 + anim.waterX[0] * fit.iw, fit.x0 + anim.waterX[1] * fit.iw] : [0, w];
        for (let i = 0; i < 14; i++) {
            const s = add(scene.add.rectangle(rand(xr[0], xr[1]), rand(y0 + 6, y1), rand(8, 26), 1.5, anim.shimmer || 0xffe2b0).setAlpha(0));
            scene.tweens.add({
                targets: s, alpha: rand(0.25, 0.6), duration: rand(700, 1400), yoyo: true, repeat: -1, delay: rand(0, 4000),
                repeatDelay: rand(500, 3000), onRepeat: () => { s.x = rand(xr[0], xr[1]); s.y = rand(y0 + 6, y1); }
            });
        }
    }
    return img;
}

export function createBackdrop(scene, id, depth = -10, forced = null) {
    const size0 = forced || view(scene);
    if (scene.textures.exists(`scene_${id}`)) return createPicture(scene, id, size0.w, size0.h, depth);
    if (!PAINT[id]) return createStarfield(scene, depth, forced);
    const size = forced || view(scene);
    const w = Math.max(1, Math.ceil(size.w));
    const h = Math.max(1, Math.ceil(size.h));
    const bg = scene.add.image(0, 0, backdropTexture(scene, id, w, h)).setOrigin(0).setDisplaySize(w, h).setDepth(depth);
    return bg;
}
