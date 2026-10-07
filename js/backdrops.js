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

function paintOcean(ctx, w, h) {
    vertical(ctx, w, h, [[0, '#0b4f6c'], [0.4, '#0a3552'], [1, '#04142b']]);
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 7; i++) {
        const x = rand(-40, w);
        const g = ctx.createLinearGradient(x, 0, x + 60, h * 0.75);
        g.addColorStop(0, 'rgba(160,220,255,0.12)');
        g.addColorStop(1, 'rgba(160,220,255,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x + rand(30, 60), 0);
        ctx.lineTo(x + rand(120, 200), h * 0.75);
        ctx.lineTo(x + rand(40, 90), h * 0.75);
        ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    // Sand and rocks
    ctx.fillStyle = '#1d2a3a';
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let x = 0; x <= w; x += 10) ctx.lineTo(x, h * 0.92 + Math.sin(x * 0.02) * 10);
    ctx.lineTo(w, h);
    ctx.fill();
    // Seaweed
    for (let i = 0; i < 9; i++) {
        const x = rand(0, w);
        const tall = rand(60, 150);
        ctx.strokeStyle = ['#11604a', '#0f7a52', '#165d3d'][i % 3];
        ctx.lineWidth = rand(4, 7);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x, h);
        ctx.bezierCurveTo(x - 18, h - tall * 0.35, x + 18, h - tall * 0.7, x - 4, h - tall);
        ctx.stroke();
    }
    // Coral
    [[0.15, '#c2416b'], [0.8, '#d9734e']].forEach(([fx, col]) => {
        ctx.strokeStyle = col;
        ctx.lineWidth = 5;
        const x = w * fx;
        const y = h * 0.95;
        [[0, -40], [-18, -30], [16, -34], [-8, -55], [10, -50]].forEach(([dx, dy]) => {
            ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + dx * 0.4, y + dy * 0.6, x + dx, y + dy); ctx.stroke();
        });
    });
}

function paintBeach(ctx, w, h) {
    vertical(ctx, w, h, [[0, '#1b1446'], [0.35, '#5a2a6e'], [0.58, '#c4536a'], [0.66, '#f29a5c'], [0.67, '#1d2f5a'], [1, '#0b1630']]);
    stars(ctx, w, h, (w * h) / 6000, h * 0.25);
    // Setting sun on the horizon
    const hz = h * 0.665;
    glow(ctx, w * 0.5, hz, 160, 'rgba(255,170,90,0.45)');
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, w, hz); ctx.clip();
    ctx.fillStyle = '#ffc46b';
    ctx.beginPath(); ctx.arc(w * 0.5, hz + 8, 42, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    // Sun path on the sea
    for (let y = hz + 4; y < h * 0.86; y += 6) {
        const spread = 30 + (y - hz) * 0.9;
        ctx.fillStyle = `rgba(255,190,110,${(0.4 - (y - hz) / h).toFixed(2)})`;
        ctx.fillRect(w * 0.5 - rand(0.3, 1) * spread, y, rand(0.6, 2) * spread, 2);
    }
    // Sand
    ctx.fillStyle = '#3a2a3e';
    ctx.beginPath();
    ctx.moveTo(0, h);
    ctx.lineTo(0, h * 0.88);
    ctx.quadraticCurveTo(w * 0.5, h * 0.84, w, h * 0.9);
    ctx.lineTo(w, h);
    ctx.fill();
    // Palm tree silhouette
    ctx.strokeStyle = '#140c1e';
    ctx.fillStyle = '#140c1e';
    ctx.lineWidth = 9;
    ctx.lineCap = 'round';
    const px = w * 0.1;
    ctx.beginPath();
    ctx.moveTo(px, h * 0.92);
    ctx.quadraticCurveTo(px + 30, h * 0.75, px + 18, h * 0.58);
    ctx.stroke();
    const top = [px + 18, h * 0.58];
    [[-80, 20], [-60, 50], [70, 30], [80, 0], [30, -40], [-40, -30]].forEach(([dx, dy]) => {
        ctx.beginPath();
        ctx.moveTo(top[0], top[1]);
        ctx.quadraticCurveTo(top[0] + dx * 0.5, top[1] + dy * 0.2 - 25, top[0] + dx, top[1] + dy);
        ctx.quadraticCurveTo(top[0] + dx * 0.5, top[1] + dy * 0.2 - 12, top[0], top[1]);
        ctx.fill();
    });
}


// Porto at night: Ribeira houses climbing the hill, the Clérigos tower, the iron arch of the
// D. Luís I bridge over the Douro and a rabelo boat
function paintPorto(ctx, w, h) {
    vertical(ctx, w, h, [[0, '#060a22'], [0.55, '#1c1a4a'], [0.75, '#3b2650'], [1, '#081028']]);
    stars(ctx, w, h, (w * h) / 3000, h * 0.45);
    glow(ctx, w * 0.18, h * 0.12, 70, 'rgba(255,240,200,0.3)');
    ctx.fillStyle = '#fff4d6';
    ctx.beginPath(); ctx.arc(w * 0.18, h * 0.12, 16, 0, Math.PI * 2); ctx.fill();
    const river = h * 0.84;
    // Hill (Ribeira side, left) and Gaia (right)
    ctx.fillStyle = '#1a1838';
    ctx.beginPath();
    ctx.moveTo(0, river); ctx.lineTo(0, h * 0.5);
    ctx.quadraticCurveTo(w * 0.35, h * 0.5, w * 0.62, river);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(w, river); ctx.lineTo(w, h * 0.66);
    ctx.quadraticCurveTo(w * 0.85, h * 0.68, w * 0.72, river);
    ctx.fill();
    // Clérigos tower on the hilltop
    const tx = w * 0.2;
    const ty = h * 0.5;
    ctx.fillStyle = '#2b2752';
    ctx.fillRect(tx - 9, ty - 90, 18, 90);
    ctx.fillRect(tx - 12, ty - 60, 24, 6);
    ctx.beginPath(); ctx.moveTo(tx - 9, ty - 90); ctx.quadraticCurveTo(tx, ty - 120, tx + 9, ty - 90); ctx.fill();
    ctx.fillRect(tx - 1.5, ty - 132, 3, 14);
    glow(ctx, tx, ty - 70, 50, 'rgba(255,200,120,0.15)');
    // Ribeira: tall narrow colourful houses stepping down to the river
    const cols = ['#7a2f3a', '#2f5a7a', '#8a6a2a', '#5a3a7a', '#2f6a55', '#8a3f2a'];
    for (let r = 0; r < 5; r++) {
        const base = h * (0.6 + r * 0.05);
        let x = -5;
        const end = w * (0.32 + r * 0.06);
        while (x < end) {
            const bw = rand(12, 20);
            const bh = rand(26, 40);
            ctx.fillStyle = cols[Math.floor(rand(0, cols.length))];
            ctx.globalAlpha = 0.75;
            ctx.fillRect(x, base - bh, bw, bh + 20);
            ctx.globalAlpha = 1;
            for (let wy = base - bh + 5; wy < base - 3; wy += 9) {
                if (Math.random() < 0.55) {
                    ctx.fillStyle = 'rgba(255,205,110,0.9)';
                    ctx.fillRect(x + bw / 2 - 2, wy, 4, 5);
                }
            }
            x += bw + 1;
        }
    }
    // River
    vertical(ctx, w, h, [[0, 'rgba(0,0,0,0)'], [0.84, 'rgba(0,0,0,0)'], [0.841, '#0c1634'], [1, '#050a1c']]);
    for (let i = 0; i < 60; i++) {
        ctx.fillStyle = `rgba(255,200,120,${rand(0.08, 0.3).toFixed(2)})`;
        ctx.fillRect(rand(0, w), rand(river + 4, h - 4), rand(6, 16), 1.5);
    }
    // D. Luís I bridge: a big iron arch with the upper deck on top and the lower deck at the river
    const L = w * 0.4;
    const Rr = w * 0.98;
    const mid = (L + Rr) / 2;
    const topDeck = h * 0.64;
    ctx.strokeStyle = '#4a4a62';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(w * 0.3, topDeck); ctx.lineTo(w * 1.05, topDeck); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(L, river - 14); ctx.lineTo(Rr, river - 14); ctx.stroke();
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(L, river); ctx.quadraticCurveTo(mid, h * 0.5, Rr, river); ctx.stroke();
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(L + 10, river); ctx.quadraticCurveTo(mid, h * 0.54, Rr - 10, river); ctx.stroke();
    ctx.lineWidth = 1.2;
    for (let i = 1; i < 14; i++) {
        const x = L + ((Rr - L) * i) / 14;
        const tt = (x - L) / (Rr - L);
        const ay = (1 - tt) * (1 - tt) * river + 2 * (1 - tt) * tt * h * 0.5 + tt * tt * river;
        ctx.beginPath(); ctx.moveTo(x, topDeck); ctx.lineTo(x, Math.min(ay, river - 14)); ctx.stroke();
    }
    for (let i = 0; i < 12; i++) glow(ctx, w * 0.32 + i * w * 0.065, topDeck - 2, 6, 'rgba(255,210,140,0.8)');
    // Rabelo boat with a square sail
    const bx = w * 0.22;
    const by = river + 14;
    ctx.fillStyle = '#140c1e';
    ctx.beginPath(); ctx.moveTo(bx - 30, by); ctx.lineTo(bx + 30, by); ctx.lineTo(bx + 22, by + 8); ctx.lineTo(bx - 24, by + 8); ctx.fill();
    ctx.fillRect(bx - 1, by - 34, 2, 34);
    ctx.fillStyle = '#d8cbb0';
    ctx.fillRect(bx - 12, by - 32, 24, 22);
}

// Sintra: Pena Palace (yellow and red, with towers and a dome) on a forested hill, evening mist
function paintSintra(ctx, w, h) {
    vertical(ctx, w, h, [[0, '#14123a'], [0.45, '#3a2e6a'], [0.7, '#6a4a7a'], [1, '#0c1a1e']]);
    stars(ctx, w, h, (w * h) / 5000, h * 0.35);
    // Hills of forest
    const hill = (y0, col, amp) => {
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.moveTo(0, h);
        for (let x = 0; x <= w; x += 6) ctx.lineTo(x, y0 - Math.sin((x / w) * Math.PI) * amp + Math.sin(x * 0.15) * 4 + Math.sin(x * 0.05) * 6);
        ctx.lineTo(w, h);
        ctx.fill();
    };
    hill(h * 0.72, '#1e2a3e', h * 0.18);
    // Palace on the top
    const px = w * 0.5;
    const py = h * 0.54 - 6;
    glow(ctx, px, py - 30, 120, 'rgba(255,210,140,0.25)');
    ctx.fillStyle = '#d9a63a';
    ctx.fillRect(px - 60, py - 34, 70, 34);
    ctx.fillStyle = '#b8443a';
    ctx.fillRect(px + 10, py - 46, 46, 46);
    ctx.fillStyle = '#d9a63a';
    ctx.fillRect(px - 26, py - 74, 22, 40);
    ctx.beginPath(); ctx.arc(px - 15, py - 74, 13, Math.PI, 0); ctx.fill();
    ctx.fillRect(px - 16, py - 96, 2, 10);
    ctx.fillStyle = '#8a7ab0';
    ctx.fillRect(px + 30, py - 70, 16, 24);
    ctx.beginPath(); ctx.moveTo(px + 28, py - 70); ctx.lineTo(px + 38, py - 86); ctx.lineTo(px + 48, py - 70); ctx.fill();
    ctx.fillStyle = '#c75a3a';
    ctx.fillRect(px - 58, py - 46, 14, 12);
    for (let i = 0; i < 8; i++) ctx.fillRect(px - 60 + i * 9, py - 38, 5, 4);
    ctx.fillStyle = 'rgba(255,220,140,0.9)';
    [[-50, -22], [-36, -22], [-22, -22], [18, -30], [32, -30], [44, -30], [-18, -56]].forEach(([dx, dy]) => ctx.fillRect(px + dx, py + dy, 4, 7));
    hill(h * 0.86, '#13241c', h * 0.12);
    // Trees as little round clumps
    for (let i = 0; i < 40; i++) {
        const x = rand(0, w);
        const y = rand(h * 0.74, h);
        ctx.fillStyle = ['#183a28', '#1d4530', '#14301f'][i % 3];
        ctx.beginPath(); ctx.arc(x, y, rand(10, 22), 0, Math.PI * 2); ctx.fill();
    }
    // Mist
    for (let i = 0; i < 4; i++) {
        const y = h * (0.66 + i * 0.07);
        const g = ctx.createLinearGradient(0, y - 20, 0, y + 20);
        g.addColorStop(0, 'rgba(200,200,230,0)');
        g.addColorStop(0.5, 'rgba(200,200,230,0.12)');
        g.addColorStop(1, 'rgba(200,200,230,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, y - 20, w, 40);
    }
}

// Algarve at dusk: golden sea cliffs with an arch and sea stacks, turquoise water, a small boat
function paintAlgarve(ctx, w, h) {
    vertical(ctx, w, h, [[0, '#1a2050'], [0.4, '#5a3a78'], [0.58, '#e07a5a'], [0.6, '#16506a'], [1, '#08283a']]);
    stars(ctx, w, h, (w * h) / 7000, h * 0.2);
    const hz = h * 0.6;
    glow(ctx, w * 0.65, hz, 140, 'rgba(255,180,100,0.4)');
    // Turquoise shallows
    for (let i = 0; i < 50; i++) {
        ctx.fillStyle = `rgba(120,220,220,${rand(0.05, 0.18).toFixed(2)})`;
        ctx.fillRect(rand(0, w), rand(hz + 6, h), rand(10, 40), 2);
    }
    const rock = (pts) => {
        const g = ctx.createLinearGradient(0, h * 0.4, 0, h);
        g.addColorStop(0, '#c9873f');
        g.addColorStop(1, '#6b3a22');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(pts[0][0], pts[0][1]);
        pts.slice(1).forEach(([x, y]) => ctx.lineTo(x, y));
        ctx.closePath();
        ctx.fill();
        // Rock layers
        ctx.strokeStyle = 'rgba(80,40,20,0.35)';
        ctx.lineWidth = 1.5;
        const ys = pts.map((p) => p[1]);
        for (let y = Math.min(...ys) + 10; y < Math.max(...ys); y += 9) {
            ctx.beginPath(); ctx.moveTo(Math.min(...pts.map((p) => p[0])), y); ctx.lineTo(Math.max(...pts.map((p) => p[0])), y + 3); ctx.stroke();
        }
    };
    // Big cliff on the left with an arch cut through
    rock([[0, h], [0, h * 0.5], [w * 0.2, h * 0.48], [w * 0.38, h * 0.55], [w * 0.42, h * 0.75], [w * 0.36, h * 0.9], [w * 0.42, h]]);
    ctx.fillStyle = '#16506a';
    ctx.beginPath();
    ctx.moveTo(w * 0.14, h * 0.92);
    ctx.quadraticCurveTo(w * 0.22, h * 0.68, w * 0.3, h * 0.92);
    ctx.fill();
    // Sea stacks on the right
    rock([[w * 0.72, h * 0.9], [w * 0.74, h * 0.66], [w * 0.8, h * 0.62], [w * 0.84, h * 0.7], [w * 0.85, h * 0.9]]);
    rock([[w * 0.88, h * 0.92], [w * 0.9, h * 0.76], [w * 0.95, h * 0.74], [w * 0.97, h * 0.92]]);
    // Foam at the foot of the rocks
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    [[w * 0.36, h * 0.9], [w * 0.78, h * 0.9], [w * 0.92, h * 0.92]].forEach(([x, y]) => ctx.fillRect(x - 18, y, 36, 2));
    // Small boat
    const bx = w * 0.56;
    const by = h * 0.8;
    ctx.fillStyle = '#f4efe6';
    ctx.beginPath(); ctx.moveTo(bx - 16, by); ctx.lineTo(bx + 16, by); ctx.lineTo(bx + 11, by + 6); ctx.lineTo(bx - 12, by + 6); ctx.fill();
    ctx.fillStyle = '#2a6aa0';
    ctx.fillRect(bx - 12, by + 3, 23, 2);
}

const PAINT = { lisbon: paintLisbon, porto: paintPorto, sintra: paintSintra, algarve: paintAlgarve, ocean: paintOcean, beach: paintBeach };

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

export function createBackdrop(scene, id, depth = -10) {
    if (!PAINT[id]) return createStarfield(scene, depth);
    const size = view(scene);
    const w = Math.max(1, Math.ceil(size.w));
    const h = Math.max(1, Math.ceil(size.h));
    const bg = scene.add.image(0, 0, backdropTexture(scene, id, w, h)).setOrigin(0).setDisplaySize(w, h).setDepth(depth);
    if (settings.get('reduceMotion')) return bg;

    if (id === 'ocean') {
        ensureBubble(scene);
        for (let i = 0; i < 12; i++) {
            const b = scene.add.image(rand(0, w), rand(0, h), 'decorBubble')
                .setScale(rand(0.3, 0.9)).setAlpha(rand(0.2, 0.5)).setDepth(depth + 1);
            const rise = () => {
                scene.tweens.add({
                    targets: b, y: -30, x: b.x + rand(-30, 30), duration: rand(10000, 18000) * ((b.y + 30) / (h + 30)),
                    onComplete: () => { b.y = h + 30; b.x = rand(0, w); rise(); }
                });
            };
            rise();
        }
    } else {
        // Twinkling windows (Lisbon) or stars (beach)
        ensureDot(scene);
        const city = id === 'lisbon' || id === 'porto';
        const n = city ? 14 : 10;
        for (let i = 0; i < n; i++) {
            const y = city ? rand(h * 0.6, h * 0.84) : rand(0, h * 0.2);
            const d = scene.add.image(rand(0, w), y, 'starDot')
                .setTint(city ? 0xffcd6e : 0xfff4ea).setScale(rand(0.25, 0.45)).setAlpha(0)
                .setBlendMode(Phaser.BlendModes.ADD).setDepth(depth + 1);
            scene.tweens.add({ targets: d, alpha: rand(0.4, 0.9), duration: rand(800, 1800), yoyo: true, repeat: -1, delay: rand(0, 4000), hold: rand(500, 3000) });
        }
    }
    return bg;
}
