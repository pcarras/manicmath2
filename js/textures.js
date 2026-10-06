import { COLORS, CONSTANTS } from './constants.js';
import { RES } from './display.js';

const { RADIUS: R, DIAMETER } = CONSTANTS;

// Piece textures are a bit larger than the ball so the outline is not clipped
export const TEX_SIZE = DIAMETER + 4;
// Real pixel size of piece textures (they are painted at RES for sharp HiDPI rendering).
// Use it to size images: setScale(displayPx / TEX_PX).
export const TEX_PX = TEX_SIZE * RES;
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
const SHARP = (key) => key.startsWith('piece_') || key === 'ring' || key === 'ice' || key === 'hand';

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

// Flat night-time ball: soft volume from the edge darkening, no specular flare
function drawBall(ctx, c, color) {
    const g = ctx.createRadialGradient(c, c * 0.92, R * 0.15, c, c, R);
    g.addColorStop(0, hex(shade(color, 1.06)));
    g.addColorStop(0.7, hex(color));
    g.addColorStop(1, hex(shade(color, 0.7)));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(c, c, R, 0, Math.PI * 2);
    ctx.fill();
    // Thick dark outline (Suika-style) keeps pieces readable inside a crowded pile
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(10,4,20,0.7)';
    ctx.stroke();
}

function drawNumber(ctx, c, text) {
    const px = Math.round(R * 1.25);
    ctx.font = `${px}px Righteous, 'Arial Black', Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 5;
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.strokeText(text, c, c + 2);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(text, c, c + 2);
}

// Operators are drawn as vector shapes so they look identical on every phone font
function drawOperator(ctx, c, op) {
    const L = R * 0.6;
    const T = R * 0.22;
    const bar = (rot) => {
        ctx.save();
        ctx.translate(c, c);
        ctx.rotate(rot);
        roundRectPath(ctx, -L, -T / 2, L * 2, T, T / 2);
        ctx.fill();
        ctx.restore();
    };
    const dot = (dy) => {
        ctx.beginPath();
        ctx.arc(c, c + dy, T * 0.68, 0, Math.PI * 2);
        ctx.fill();
    };

    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 3;
    ctx.shadowOffsetY = 2;
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

    // --- Pieces ---
    for (let i = 1; i <= 9; i++) {
        canvasTexture(scene, `piece_num_${i}`, S, S, (ctx) => {
            drawBall(ctx, c, COLORS.numbers[i % COLORS.numbers.length]);
            drawNumber(ctx, c, String(i));
        });
    }

    Object.entries(OP_KEYS).forEach(([op, name]) => {
        canvasTexture(scene, `piece_op_${name}`, S, S, (ctx) => {
            drawBall(ctx, c, COLORS.operators[op]);
            drawOperator(ctx, c, op);
        });
    });

    canvasTexture(scene, 'piece_special_bomb', S, S, (ctx) => {
        drawBall(ctx, c, COLORS.specials.bomb);
        drawBombIcon(ctx, c);
    });
    canvasTexture(scene, 'piece_special_hint', S, S, (ctx) => {
        drawBall(ctx, c, COLORS.specials.hint);
        drawBulbIcon(ctx, c);
    });
    canvasTexture(scene, 'piece_special_recycle', S, S, (ctx) => {
        drawBall(ctx, c, COLORS.specials.recycle);
        drawRecycleIcon(ctx, c);
    });

    // Timer: the user's art when available, otherwise a drawn stopwatch.
    // Only bake it once we know whether the image loaded, so the fallback never sticks.
    const timerImg = scene.textures.exists('powerupTimeImg');
    if (timerImg || scene.registry.get('timerImgMissing')) {
        canvasTexture(scene, 'piece_special_timer', S, S, (ctx) => {
            if (timerImg) {
                clipCircle(ctx, c, R);
                drawScaledImage(ctx, scene.textures.get('powerupTimeImg').getSourceImage(), c - R, c - R, DIAMETER);
            } else {
                drawBall(ctx, c, COLORS.specials.timer);
                drawClock(ctx, c);
            }
        });
    }
}
