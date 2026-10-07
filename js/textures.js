import { COLORS, CONSTANTS } from './constants.js';
import { RES } from './display.js';
import { settings } from './settings.js';
import { themeState } from './progress.js';

const { RADIUS: R, DIAMETER } = CONSTANTS;

// Piece textures are a bit larger than the ball so the outline is not clipped
export const TEX_SIZE = DIAMETER + 4;
// Real pixel size of piece textures (they are painted at RES for sharp HiDPI rendering).
// Use it to size images: setScale(displayPx / TEX_PX).
export const TEX_PX = TEX_SIZE * RES;
export const SHEEN_FRAMES = 10;
export const OP_KEYS = { '+': 'plus', '-': 'minus', '×': 'times', '÷': 'divide' };

const TIMER_IMG_URL = 'assets/power up time20s.png';

const hex = (c) => '#' + c.toString(16).padStart(6, '0');

function shade(color, f) {
    const ch = (s) => {
        const v = (color >> s) & 0xff;
        return Math.round(f < 1 ? v * f : v + (255 - v) * (f - 1));
    };
    return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

// Textures with hard edges (pieces, rings, ice, hand) are painted at RES; soft FX stay at 1x.
// Images using a sharp texture are shown at scale INV (see display.js).
const SHARP = (key) => key.startsWith('piece_') || key.startsWith('prev_') || key === 'ring' || key === 'ice' || key === 'hand' || key === 'sheen';

function canvasTexture(scene, key, w, h, draw) {
    if (scene.textures.exists(key)) return;
    const res = SHARP(key) ? RES : 1;
    const tex = scene.textures.createCanvas(key, Math.ceil(w * res), Math.ceil(h * res));
    const ctx = tex.getContext();
    ctx.save();
    ctx.scale(res, res);
    draw(ctx, w, h);
    ctx.restore();
    tex.refresh();
}

function roundRectPath(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}

// ------------------------------------------------------------------ piece styles (themes)
// style = { theme: 'classic' | 'neon' | 'pixel' | 'bica', hc: high contrast }

const BICA_BROWN = 0x5a3016;

function circleFill(ctx, c, r) {
    ctx.beginPath();
    ctx.arc(c, c, r, 0, Math.PI * 2);
}

// Retro Pixel: the ball is a grid of square cells with a 1-cell outline and a corner highlight
function drawPixelBall(ctx, c, color, hc) {
    const N = 19;
    const cell = (R * 2) / N;
    const x0 = c - R;
    const inside = (i, j) => {
        const dx = i + 0.5 - N / 2;
        const dy = j + 0.5 - N / 2;
        return dx * dx + dy * dy <= (N / 2) * (N / 2);
    };
    for (let j = 0; j < N; j++) {
        for (let i = 0; i < N; i++) {
            if (!inside(i, j)) continue;
            const edge = !inside(i - 1, j) || !inside(i + 1, j) || !inside(i, j - 1) || !inside(i, j + 1);
            let col = color;
            if (edge) col = hc ? 0xffffff : 0x140a24;
            else if (i + j < 9) col = shade(color, 1.25);
            else if (i + j > 27) col = shade(color, 0.72);
            ctx.fillStyle = hex(col);
            ctx.fillRect(x0 + i * cell, x0 + j * cell, Math.ceil(cell), Math.ceil(cell));
        }
    }
}

function drawBall(ctx, c, color, style = {}) {
    const theme = style.theme || 'classic';
    if (theme === 'pixel') {
        drawPixelBall(ctx, c, color, style.hc);
        return;
    }
    if (theme === 'neon') {
        // Dark glass with a glowing tube of the piece colour
        const g = ctx.createRadialGradient(c, c, R * 0.1, c, c, R);
        g.addColorStop(0, '#0c0d22');
        g.addColorStop(0.8, '#090a1a');
        g.addColorStop(1, hex(shade(color, 0.35)));
        ctx.fillStyle = g;
        circleFill(ctx, c, R - 1);
        ctx.fill();
        ctx.save();
        ctx.shadowColor = hex(shade(color, 1.3));
        ctx.shadowBlur = 6;
        ctx.lineWidth = style.hc ? 5 : 3.5;
        ctx.strokeStyle = hex(shade(color, 1.35));
        circleFill(ctx, c, R - 3);
        ctx.stroke();
        ctx.restore();
        return;
    }
    if (theme === 'bica') {
        // Espresso seen from above: dark coffee, a crema ring in the piece colour, cup rim outline
        const g = ctx.createRadialGradient(c - R * 0.2, c - R * 0.25, R * 0.1, c, c, R);
        g.addColorStop(0, '#8a5130');
        g.addColorStop(0.55, hex(BICA_BROWN));
        g.addColorStop(1, '#2b1508');
        ctx.fillStyle = g;
        circleFill(ctx, c, R);
        ctx.fill();
        ctx.lineWidth = 4;
        ctx.strokeStyle = hex(shade(color, 1.15));
        ctx.globalAlpha = 0.85;
        circleFill(ctx, c, R - 5);
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.lineWidth = style.hc ? 5 : 3;
        ctx.strokeStyle = style.hc ? '#ffffff' : '#f4efe6';
        circleFill(ctx, c, R - 0.5);
        ctx.stroke();
        return;
    }
    // Classic: flat night-time ball, soft volume from the edge darkening, no specular flare
    const g = ctx.createRadialGradient(c, c * 0.92, R * 0.15, c, c, R);
    g.addColorStop(0, hex(shade(color, 1.06)));
    g.addColorStop(0.7, hex(color));
    g.addColorStop(1, hex(shade(color, 0.7)));
    ctx.fillStyle = g;
    circleFill(ctx, c, R);
    ctx.fill();
    // Thick dark outline (Suika-style) keeps pieces readable inside a crowded pile
    ctx.lineWidth = style.hc ? 6 : 3;
    ctx.strokeStyle = style.hc ? '#000000' : 'rgba(10,4,20,0.7)';
    ctx.stroke();
    if (style.hc) {
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#ffffff';
        circleFill(ctx, c, R - 4);
        ctx.stroke();
    }
}

function drawNumber(ctx, c, text, style = {}, color = 0xffffff) {
    const theme = style.theme || 'classic';
    const pixel = theme === 'pixel';
    const px = Math.round(R * (pixel ? 0.95 : style.hc ? 1.45 : 1.25));
    const family = pixel ? "'Press Start 2P', monospace" : "Righteous, 'Arial Black', Arial, sans-serif";
    ctx.font = `${style.hc && !pixel ? 'bold ' : ''}${px}px ${family}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = pixel ? 'miter' : 'round';
    const y = c + (pixel ? 3 : 2);
    if (pixel) {
        // A hard drop shadow instead of an outline: a thick stroke fills the holes of 8 / 9 / 6
        ctx.fillStyle = '#000000';
        ctx.globalAlpha = style.hc ? 1 : 0.6;
        ctx.fillText(text, c + 3, y + 3);
        ctx.globalAlpha = 1;
    } else {
        ctx.lineWidth = style.hc ? 8 : 5;
        ctx.strokeStyle = style.hc ? '#000000' : 'rgba(0,0,0,0.4)';
        ctx.strokeText(text, c, y);
    }
    if (theme === 'neon') {
        ctx.save();
        ctx.shadowColor = hex(shade(color, 1.3));
        ctx.shadowBlur = 10;
        ctx.fillStyle = hex(shade(color, 1.7));
        ctx.fillText(text, c, y);
        ctx.restore();
    } else {
        ctx.fillStyle = theme === 'bica' ? '#fff3dc' : '#ffffff';
        ctx.fillText(text, c, y);
    }
}

// Operators are drawn as vector shapes so they look identical on every phone font
function drawOperator(ctx, c, op, style = {}, color = 0xffffff) {
    const pixel = style.theme === 'pixel';
    const L = R * (style.hc ? 0.66 : 0.6);
    const T = R * (style.hc ? 0.27 : 0.22);
    const bar = (rot) => {
        ctx.save();
        ctx.translate(c, c);
        ctx.rotate(rot);
        if (pixel) {
            ctx.beginPath();
            ctx.rect(-L, -T / 2, L * 2, T);
        } else {
            roundRectPath(ctx, -L, -T / 2, L * 2, T, T / 2);
        }
        if (style.hc) ctx.stroke();
        ctx.fill();
        ctx.restore();
    };
    const dot = (dy) => {
        ctx.beginPath();
        if (pixel) ctx.rect(c - T * 0.68, c + dy - T * 0.68, T * 1.36, T * 1.36);
        else ctx.arc(c, c + dy, T * 0.68, 0, Math.PI * 2);
        if (style.hc) ctx.stroke();
        ctx.fill();
    };

    ctx.save();
    ctx.fillStyle = style.theme === 'neon' ? hex(shade(color, 1.7)) : style.theme === 'bica' ? '#ffd23f' : '#ffffff';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 5;
    ctx.shadowColor = style.theme === 'neon' ? hex(shade(color, 1.3)) : 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = style.theme === 'neon' ? 10 : 3;
    ctx.shadowOffsetY = style.theme === 'neon' ? 0 : 2;
    if (op === '+') { bar(0); bar(Math.PI / 2); }
    else if (op === '-') { bar(0); }
    else if (op === '×') { bar(Math.PI / 4); bar(-Math.PI / 4); }
    else if (op === '÷') { bar(0); dot(-L * 0.62); dot(L * 0.62); }
    ctx.restore();
}

// Vector special icons: identical on every phone (emoji differ per platform)
function drawBombIcon(ctx, c) {
    ctx.save();
    // fuse
    ctx.strokeStyle = '#c9a26b';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(c + R * 0.32, c - R * 0.62);
    ctx.quadraticCurveTo(c + R * 0.55, c - R * 0.95, c + R * 0.78, c - R * 0.78);
    ctx.stroke();
    // spark
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
        const r = i % 2 ? 4 : 9;
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        ctx.lineTo(c + R * 0.8 + Math.cos(a) * r, c - R * 0.8 + Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ff7a1a';
    ctx.beginPath();
    ctx.arc(c + R * 0.8, c - R * 0.8, 3.5, 0, Math.PI * 2);
    ctx.fill();
    // angry little face
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(c - 10, c + 2, 6, 0, Math.PI * 2);
    ctx.arc(c + 10, c + 2, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#140a24';
    ctx.beginPath();
    ctx.arc(c - 9, c + 3, 3, 0, Math.PI * 2);
    ctx.arc(c + 9, c + 3, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(c - 17, c - 9);
    ctx.lineTo(c - 5, c - 4);
    ctx.moveTo(c + 17, c - 9);
    ctx.lineTo(c + 5, c - 4);
    ctx.moveTo(c - 7, c + 16);
    ctx.quadraticCurveTo(c, c + 11, c + 7, c + 16);
    ctx.stroke();
    ctx.restore();
}

function drawBulbIcon(ctx, c) {
    ctx.save();
    ctx.lineCap = 'round';
    // rays
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 3;
    [-2.4, -1.57, -0.74, -3.2, 0.06].forEach((a) => {
        ctx.beginPath();
        ctx.moveTo(c + Math.cos(a) * R * 0.62, c - 6 + Math.sin(a) * R * 0.62);
        ctx.lineTo(c + Math.cos(a) * R * 0.8, c - 6 + Math.sin(a) * R * 0.8);
        ctx.stroke();
    });
    // glass
    ctx.fillStyle = '#fff6c2';
    ctx.strokeStyle = '#140a24';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(c, c - 6, R * 0.42, Math.PI * 0.8, Math.PI * 2.2);
    ctx.lineTo(c + R * 0.18, c + R * 0.3);
    ctx.lineTo(c - R * 0.18, c + R * 0.3);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // base
    ctx.fillStyle = '#9aa0b4';
    ctx.fillRect(c - R * 0.2, c + R * 0.33, R * 0.4, R * 0.22);
    ctx.strokeRect(c - R * 0.2, c + R * 0.33, R * 0.4, R * 0.22);
    // filament
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(c - 6, c - 2);
    ctx.lineTo(c - 2, c - 8);
    ctx.lineTo(c + 2, c - 2);
    ctx.lineTo(c + 6, c - 8);
    ctx.stroke();
    ctx.restore();
}

function drawRecycleIcon(ctx, c) {
    ctx.save();
    ctx.strokeStyle = '#ffffff';
    ctx.fillStyle = '#ffffff';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    const r = R * 0.48;
    for (let i = 0; i < 3; i++) {
        const a0 = (i * 2 * Math.PI) / 3 - Math.PI / 2 + 0.35;
        const a1 = a0 + (2 * Math.PI) / 3 - 0.75;
        ctx.beginPath();
        ctx.arc(c, c + 2, r, a0, a1);
        ctx.stroke();
        // arrow head at the end of each arc
        const hx = c + Math.cos(a1) * r;
        const hy = c + 2 + Math.sin(a1) * r;
        const ta = a1 + Math.PI / 2;
        ctx.beginPath();
        ctx.moveTo(hx + Math.cos(ta) * 9, hy + Math.sin(ta) * 9);
        ctx.lineTo(hx + Math.cos(ta + 2.3) * 8, hy + Math.sin(ta + 2.3) * 8);
        ctx.lineTo(hx + Math.cos(ta - 2.3) * 8, hy + Math.sin(ta - 2.3) * 8);
        ctx.closePath();
        ctx.fill();
    }
    ctx.restore();
}

// Flame: outer orange tongue, inner yellow core
function drawFlameIcon(ctx, c) {
    const flame = (scale, color, dy) => {
        const s = R * scale;
        const y0 = c + dy;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(c, y0 - s * 1.05);
        ctx.bezierCurveTo(c + s * 0.25, y0 - s * 0.55, c + s * 0.8, y0 - s * 0.35, c + s * 0.62, y0 + s * 0.28);
        ctx.bezierCurveTo(c + s * 0.5, y0 + s * 0.72, c + s * 0.15, y0 + s * 0.85, c, y0 + s * 0.85);
        ctx.bezierCurveTo(c - s * 0.15, y0 + s * 0.85, c - s * 0.5, y0 + s * 0.72, c - s * 0.62, y0 + s * 0.28);
        ctx.bezierCurveTo(c - s * 0.75, y0 - s * 0.15, c - s * 0.35, y0 - s * 0.3, c - s * 0.2, y0 - s * 0.62);
        ctx.bezierCurveTo(c - s * 0.1, y0 - s * 0.4, c - s * 0.05, y0 - s * 0.75, c, y0 - s * 1.05);
        ctx.closePath();
        ctx.fill();
    };
    ctx.save();
    ctx.shadowColor = 'rgba(255,170,60,0.9)';
    ctx.shadowBlur = 8;
    flame(0.62, '#ff8a1f', 2);
    ctx.shadowBlur = 0;
    flame(0.4, '#ffd23f', 7);
    flame(0.2, '#fff6c2', 11);
    ctx.restore();
}

// Junk ("trambolho"): a heavy square steel block. hp 3 = new; 2 = dented and scratched;
// 1 = a bent corner, a rivet gone and a split in the plate. Drawn once per state (no runtime cost).
export const JUNK_SIDE = Math.round(DIAMETER * 0.9);

function drawIron(ctx, c, hp, style = {}) {
    const h = JUNK_SIDE / 2;
    const x0 = c - h;
    const y0 = c - h;
    const side = JUNK_SIDE;
    const bevel = 7;

    // Plate: cool steel gradient
    const g = ctx.createLinearGradient(x0, y0, x0 + side, y0 + side);
    g.addColorStop(0, '#8d97a6');
    g.addColorStop(0.45, '#5d6674');
    g.addColorStop(1, '#3a414c');
    ctx.fillStyle = g;
    roundRectPath(ctx, x0, y0, side, side, 6);
    ctx.fill();

    // Brushed metal: fine diagonal streaks
    ctx.save();
    roundRectPath(ctx, x0, y0, side, side, 6);
    ctx.clip();
    for (let i = -side; i < side * 2; i += 3) {
        ctx.strokeStyle = i % 9 === 0 ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x0 + i, y0);
        ctx.lineTo(x0 + i - side * 0.35, y0 + side);
        ctx.stroke();
    }
    ctx.restore();

    // Bevel: light top-left edges, dark bottom-right edges
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.beginPath();
    ctx.moveTo(x0, y0); ctx.lineTo(x0 + side, y0); ctx.lineTo(x0 + side - bevel, y0 + bevel);
    ctx.lineTo(x0 + bevel, y0 + bevel); ctx.lineTo(x0 + bevel, y0 + side - bevel); ctx.lineTo(x0, y0 + side);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.32)';
    ctx.beginPath();
    ctx.moveTo(x0 + side, y0); ctx.lineTo(x0 + side, y0 + side); ctx.lineTo(x0, y0 + side);
    ctx.lineTo(x0 + bevel, y0 + side - bevel); ctx.lineTo(x0 + side - bevel, y0 + side - bevel);
    ctx.lineTo(x0 + side - bevel, y0 + bevel);
    ctx.closePath();
    ctx.fill();

    // X brace across the inner panel
    const i0 = x0 + bevel + 3;
    const i1 = x0 + side - bevel - 3;
    const j0 = y0 + bevel + 3;
    const j1 = y0 + side - bevel - 3;
    [[i0, j0, i1, j1], [i1, j0, i0, j1]].forEach(([ax, ay, bx, by]) => {
        ctx.lineCap = 'round';
        ctx.strokeStyle = 'rgba(0,0,0,0.45)';
        ctx.lineWidth = 7;
        ctx.beginPath(); ctx.moveTo(ax, ay + 1.5); ctx.lineTo(bx, by + 1.5); ctx.stroke();
        ctx.strokeStyle = '#6f7887';
        ctx.lineWidth = 5;
        ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.25)';
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(ax, ay - 1.5); ctx.lineTo(bx, by - 1.5); ctx.stroke();
    });

    // Rivets (one pops off at hp 1)
    const rivets = [[x0 + 8, y0 + 8], [x0 + side - 8, y0 + 8], [x0 + 8, y0 + side - 8], [x0 + side - 8, y0 + side - 8]];
    rivets.forEach(([rx, ry], k) => {
        if (hp <= 1 && k === 1) {
            ctx.fillStyle = '#15181d';
            ctx.beginPath(); ctx.arc(rx, ry, 2.6, 0, Math.PI * 2); ctx.fill();
            return;
        }
        const rg = ctx.createRadialGradient(rx - 1, ry - 1, 0.5, rx, ry, 3.6);
        rg.addColorStop(0, '#e6ebf2');
        rg.addColorStop(0.5, '#8d97a6');
        rg.addColorStop(1, '#2c3139');
        ctx.fillStyle = rg;
        ctx.beginPath(); ctx.arc(rx, ry, 3.6, 0, Math.PI * 2); ctx.fill();
    });

    // Damage
    const dent = (dx, dy, rx, ry, rot) => {
        ctx.save();
        ctx.translate(c + dx, c + dy);
        ctx.rotate(rot);
        const dg = ctx.createRadialGradient(-rx * 0.3, -ry * 0.3, 0, 0, 0, Math.max(rx, ry));
        dg.addColorStop(0, 'rgba(10,12,16,0.55)');
        dg.addColorStop(0.7, 'rgba(10,12,16,0.25)');
        dg.addColorStop(1, 'rgba(10,12,16,0)');
        ctx.fillStyle = dg;
        ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
        ctx.restore();
    };
    const scratch = (ax, ay, bx, by) => {
        ctx.strokeStyle = 'rgba(230,236,245,0.55)';
        ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(c + ax, c + ay); ctx.lineTo(c + bx, c + by); ctx.stroke();
        ctx.strokeStyle = 'rgba(0,0,0,0.35)';
        ctx.beginPath(); ctx.moveTo(c + ax + 1, c + ay + 1); ctx.lineTo(c + bx + 1, c + by + 1); ctx.stroke();
    };
    if (hp <= 2) {
        dent(-10, 9, 9, 6, 0.4);
        dent(12, -11, 7, 5, -0.6);
        scratch(-20, -6, -6, -18);
        scratch(4, 16, 20, 6);
    }
    if (hp <= 1) {
        dent(6, 6, 11, 8, 0.9);
        // Split in the plate with a hot glow inside
        const split = [[-h + 2, -4], [-12, -1], [-6, 5], [2, 2], [9, 9], [h - 3, 7]];
        ctx.lineJoin = 'round';
        [[5, 'rgba(10,8,8,0.95)'], [2.2, 'rgba(255,120,40,0.9)'], [0.8, 'rgba(255,230,160,0.9)']].forEach(([w, col]) => {
            ctx.strokeStyle = col;
            ctx.lineWidth = w;
            ctx.beginPath();
            split.forEach(([x, y], k) => (k ? ctx.lineTo(c + x, c + y) : ctx.moveTo(c + x, c + y)));
            ctx.stroke();
        });
        // Bent top-right corner
        ctx.fillStyle = '#2a2f37';
        ctx.beginPath();
        ctx.moveTo(x0 + side - 15, y0); ctx.lineTo(x0 + side, y0); ctx.lineTo(x0 + side, y0 + 15);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#a3adbb';
        ctx.beginPath();
        ctx.moveTo(x0 + side - 15, y0); ctx.lineTo(x0 + side, y0 + 15); ctx.lineTo(x0 + side - 11, y0 + 11);
        ctx.closePath();
        ctx.fill();
    }

    // Outline
    ctx.lineWidth = style.hc ? 5 : 3;
    ctx.strokeStyle = style.hc ? '#ffffff' : 'rgba(10,6,18,0.9)';
    roundRectPath(ctx, x0, y0, side, side, 6);
    ctx.stroke();
}

function drawClock(ctx, c) {
    ctx.save();
    ctx.strokeStyle = '#ffffff';
    ctx.fillStyle = '#ffffff';
    ctx.lineCap = 'round';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(c, c + 3, R * 0.52, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillRect(c - 4, c - R * 0.72, 8, 6);
    ctx.beginPath();
    ctx.moveTo(c, c + 3);
    ctx.lineTo(c, c + 3 - R * 0.34);
    ctx.moveTo(c, c + 3);
    ctx.lineTo(c + R * 0.24, c + 3 + R * 0.12);
    ctx.stroke();
    ctx.font = `bold ${Math.round(R * 0.36)}px Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('20s', c, c + R * 0.8);
    ctx.restore();
}

function clipCircle(ctx, c, r) {
    ctx.beginPath();
    ctx.arc(c, c, r, 0, Math.PI * 2);
    ctx.clip();
}

// Downscale in two steps so the 512px source does not alias at piece size
function drawScaledImage(ctx, src, x, y, size) {
    const mid = document.createElement('canvas');
    mid.width = mid.height = size * 2;
    const m = mid.getContext('2d');
    m.imageSmoothingQuality = 'high';
    m.drawImage(src, 0, 0, size * 2, size * 2);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(mid, x, y, size, size);
}

export function preloadPieceAssets(scene) {
    if (!scene.textures.exists('icecircle')) {
        scene.load.image('icecircle', 'assets/icecircle.png');
    }
    if (!scene.textures.exists('powerupTimeImg') && !scene.registry.get('timerImgMissing')) {
        scene.load.image('powerupTimeImg', TIMER_IMG_URL);
        const onError = (file) => {
            if (file.key === 'powerupTimeImg') scene.registry.set('timerImgMissing', true);
        };
        scene.load.on('loaderror', onError);
        scene.load.once('complete', () => scene.load.off('loaderror', onError));
    }
}

export function pieceTextureKey(piece) {
    if (piece.type === 'number') return `piece_num_${piece.value}`;
    if (piece.type === 'operator') return `piece_op_${OP_KEYS[piece.value]}`;
    if (piece.type === 'junk') return `piece_junk_${piece.hp}`;
    return `piece_special_${piece.special}`;
}

export function ensureTextures(scene) {
    const S = TEX_SIZE;
    const c = S / 2;

    // --- FX textures ---
    canvasTexture(scene, 'particle', 16, 16, (ctx) => {
        const g = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
        g.addColorStop(0, 'rgba(255,255,255,1)');
        g.addColorStop(0.5, 'rgba(255,255,255,0.8)');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 16, 16);
    });

    canvasTexture(scene, 'spark', 8, 8, (ctx) => {
        ctx.fillStyle = '#ff7a1a';
        ctx.beginPath();
        ctx.arc(4, 4, 4, 0, Math.PI * 2);
        ctx.fill();
    });

    // 4-point sparkle (Suika-style) for success bursts
    canvasTexture(scene, 'starParticle', 24, 24, (ctx) => {
        ctx.fillStyle = '#fff6c2';
        ctx.beginPath();
        ctx.moveTo(12, 0);
        ctx.quadraticCurveTo(12, 12, 24, 12);
        ctx.quadraticCurveTo(12, 12, 12, 24);
        ctx.quadraticCurveTo(12, 12, 0, 12);
        ctx.quadraticCurveTo(12, 12, 12, 0);
        ctx.fill();
    });

    // Pointing hand for the interactive tutorial
    canvasTexture(scene, 'hand', 64, 64, (ctx) => {
        ctx.font = "50px 'Segoe UI Emoji', 'Apple Color Emoji', 'Noto Color Emoji', sans-serif";
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0,0,0,0.6)';
        ctx.shadowBlur = 6;
        ctx.shadowOffsetY = 3;
        ctx.fillText('👇', 32, 30);
    });

    // Confetti strip, tinted per particle
    canvasTexture(scene, 'confetti', 8, 14, (ctx) => {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, 8, 14);
    });

    // Red edge glow shown when the pile gets close to the death line (stretched to the screen)
    canvasTexture(scene, 'vignette', 256, 256, (ctx) => {
        const g = ctx.createRadialGradient(128, 128, 70, 128, 128, 182);
        g.addColorStop(0, 'rgba(239,68,68,0)');
        g.addColorStop(0.6, 'rgba(239,68,68,0.18)');
        g.addColorStop(1, 'rgba(239,68,68,0.75)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 256, 256);
    });

    // Heat wave: a soft hot ring with a bright leading edge, scaled up from the heat piece
    canvasTexture(scene, 'heatwave', 256, 256, (ctx) => {
        const g = ctx.createRadialGradient(128, 128, 60, 128, 128, 128);
        g.addColorStop(0, 'rgba(255,120,40,0)');
        g.addColorStop(0.55, 'rgba(255,90,30,0.10)');
        g.addColorStop(0.82, 'rgba(255,170,60,0.55)');
        g.addColorStop(0.92, 'rgba(255,240,180,0.9)');
        g.addColorStop(1, 'rgba(255,200,120,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 256, 256);
    });

    // Sheen: a diagonal glint crossing a ball, in SHEEN_FRAMES steps side by side (one texture,
    // so every glint on screen is drawn in a single batch)
    if (!scene.textures.exists('sheen')) {
        canvasTexture(scene, 'sheen', S * SHEEN_FRAMES, S, (ctx) => {
            for (let k = 0; k < SHEEN_FRAMES; k++) {
                const ox = k * S;
                const t = k / (SHEEN_FRAMES - 1);
                ctx.save();
                ctx.beginPath();
                ctx.arc(ox + c, c, R - 1, 0, Math.PI * 2);
                ctx.clip();
                const g = ctx.createLinearGradient(ox + c - R, c - R, ox + c + R, c + R);
                const at = (v) => Math.min(1, Math.max(0, v));
                g.addColorStop(0, 'rgba(255,255,255,0)');
                g.addColorStop(at(t - 0.16), 'rgba(255,255,255,0)');
                g.addColorStop(at(t - 0.05), 'rgba(255,255,255,0.35)');
                g.addColorStop(at(t), 'rgba(255,255,255,0.6)');
                g.addColorStop(at(t + 0.05), 'rgba(255,255,255,0.35)');
                g.addColorStop(at(t + 0.16), 'rgba(255,255,255,0)');
                g.addColorStop(1, 'rgba(255,255,255,0)');
                ctx.fillStyle = g;
                ctx.fillRect(ox, 0, S, S);
                ctx.restore();
            }
        });
        const tex = scene.textures.get('sheen');
        for (let k = 0; k < SHEEN_FRAMES; k++) tex.add(k, 0, k * S * RES, 0, S * RES, S * RES);
    }

    // Hint glow behind the pieces of the solution
    canvasTexture(scene, 'hintGlow', 128, 128, (ctx) => {
        const g = ctx.createRadialGradient(64, 64, 20, 64, 64, 64);
        g.addColorStop(0, 'rgba(92,255,184,0.95)');
        g.addColorStop(0.45, 'rgba(52,211,153,0.55)');
        g.addColorStop(1, 'rgba(52,211,153,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 128, 128);
    });

    // Steel shard for breaking junk (tinted per particle)
    canvasTexture(scene, 'shard', 10, 6, (ctx) => {
        ctx.fillStyle = '#c9d1dc';
        ctx.beginPath();
        ctx.moveTo(0, 1); ctx.lineTo(10, 0); ctx.lineTo(8, 6); ctx.lineTo(1, 5);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.fillRect(1, 1, 8, 1);
    });

    // Steam puff for melting ice
    canvasTexture(scene, 'steam', 32, 32, (ctx) => {
        const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
        g.addColorStop(0, 'rgba(255,255,255,0.7)');
        g.addColorStop(0.6, 'rgba(235,245,255,0.25)');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 32, 32);
    });

    // Selection / hint ring, tinted at use
    const RING = S + 16;
    canvasTexture(scene, 'ring', RING, RING, (ctx) => {
        const rc = RING / 2;
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(rc, rc, R + 6, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(rc, rc, R + 2, 0, Math.PI * 2);
        ctx.stroke();
    });

    // Ice cover: same size as a piece so it can sit on top of it
    if (scene.textures.exists('icecircle')) {
        canvasTexture(scene, 'ice', S, S, (ctx) => {
            clipCircle(ctx, c, R + 1);
            drawScaledImage(ctx, scene.textures.get('icecircle').getSourceImage(), c - R - 1, c - R - 1, DIAMETER + 2);
        });
    }

    // --- Pieces (themed; rebuilt when the theme or high-contrast setting changes) ---
    const style = currentStyle();
    const styleKey = `${style.theme}|${style.hc ? 1 : 0}`;
    if (scene.registry.get('pieceStyle') !== styleKey) {
        scene.textures.getTextureKeys().filter((k) => k.startsWith('piece_')).forEach((k) => scene.textures.remove(k));
        scene.registry.set('pieceStyle', styleKey);
    }
    bakePieces(scene, 'piece_', style);

    // Timer: the user's art when available, otherwise a drawn stopwatch.
    // Only bake it once we know whether the image loaded, so the fallback never sticks.
    const timerImg = scene.textures.exists('powerupTimeImg');
    if (timerImg || scene.registry.get('timerImgMissing')) {
        canvasTexture(scene, 'piece_special_timer', S, S, (ctx) => {
            if (timerImg) {
                clipCircle(ctx, c, R);
                drawScaledImage(ctx, scene.textures.get('powerupTimeImg').getSourceImage(), c - R, c - R, DIAMETER);
            } else {
                drawBall(ctx, c, COLORS.specials.timer, style);
                drawClock(ctx, c);
            }
        });
    }
}

// Theme chosen in the shop + accessibility setting
export function currentStyle() {
    return { theme: themeState().current, hc: !!settings.get('highContrast') };
}

// Numbers, operators and the drawn specials, for one style, under a key prefix
function bakePieces(scene, prefix, style) {
    const S = TEX_SIZE;
    const c = S / 2;
    for (let i = 1; i <= 9; i++) {
        const color = COLORS.numbers[i % COLORS.numbers.length];
        canvasTexture(scene, `${prefix}num_${i}`, S, S, (ctx) => {
            drawBall(ctx, c, color, style);
            drawNumber(ctx, c, String(i), style, color);
        });
    }
    Object.entries(OP_KEYS).forEach(([op, name]) => {
        const color = COLORS.operators[op];
        canvasTexture(scene, `${prefix}op_${name}`, S, S, (ctx) => {
            drawBall(ctx, c, color, style);
            drawOperator(ctx, c, op, style, color);
        });
    });
    canvasTexture(scene, `${prefix}special_bomb`, S, S, (ctx) => {
        drawBall(ctx, c, COLORS.specials.bomb, style);
        drawBombIcon(ctx, c);
    });
    canvasTexture(scene, `${prefix}special_hint`, S, S, (ctx) => {
        drawBall(ctx, c, COLORS.specials.hint, style);
        drawBulbIcon(ctx, c);
    });
    canvasTexture(scene, `${prefix}special_recycle`, S, S, (ctx) => {
        drawBall(ctx, c, COLORS.specials.recycle, style);
        drawRecycleIcon(ctx, c);
    });
    for (let hp = 1; hp <= 3; hp++) {
        canvasTexture(scene, `${prefix}junk_${hp}`, S, S, (ctx) => drawIron(ctx, c, hp, style));
    }
    canvasTexture(scene, `${prefix}special_heat`, S, S, (ctx) => {
        drawBall(ctx, c, COLORS.specials.heat, style);
        drawFlameIcon(ctx, c);
    });
}

// Shop previews: a few pieces of each theme (never replaced, the theme art does not change)
export function ensurePreviews(scene, themeId) {
    bakePieces(scene, `prev_${themeId}_`, { theme: themeId, hc: false });
}
