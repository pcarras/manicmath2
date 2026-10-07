// Bica Games — retro pixel-art overlays (DOM + a 96x104 canvas scaled up with pixelated rendering).
// "Bica" is what an espresso is called in Lisbon: the intro pours one, an update pours a double.
import { settings } from './settings.js';
import { t } from './i18n.js';

const W = 96;
const H = 104;
const HORIZON = 70;
const OUT = '#140a24';

const C = {
    sky: ['#12062b', '#1d0a3d', '#2c0f52', '#45166a', '#6a1d7a', '#952a80', '#c23a7c', '#ec5a6e', '#ff8a5c'],
    sun: ['#fff3a0', '#ffd23f', '#ffb238', '#ff8c42', '#ff5e5b', '#e0407b'],
    star: '#f4efe6',
    floor: '#14061f',
    grid: '#c0307e',
    horizon: '#ff9ad5',
    body: '#5e5e74',
    bodyHi: '#8a8aa0',
    bodyLo: '#45455a',
    chrome: '#c8c8d6',
    chromeHi: '#f4f4fb',
    chromeLo: '#7e7e92',
    red: '#c0392b',
    redHi: '#e8584a',
    redLo: '#8e2a20',
    recess: '#1a1226',
    recessLo: '#0d0816',
    basket: '#2a2a33',
    wood: '#7a4422',
    woodLo: '#4f2a14',
    gold: '#ffd23f',
    cup: '#f4efe6',
    cupShade: '#cfc6b8',
    cupIn: '#b9b0a2',
    coffee: '#3b1e0e',
    coffeeHi: '#6b3a1e',
    crema: '#c68a4a',
    cremaHi: '#e8b878',
    saucer: '#e8e1d4'
};

const STARS = Array.from({ length: 24 }, (_, i) => ({
    x: (i * 37 + 11) % W,
    y: (i * 23 + 3) % 30,
    p: i * 0.7
}));
const SUN_GAPS = new Set([3, 8, 9, 13, 14, 15, 18, 19]);
const BAYER = [[0.25, 0.75], [1, 0.5]];

const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const easeOutBack = (x) => 1 + 2.7 * Math.pow(x - 1, 3) + 1.7 * Math.pow(x - 1, 2);

const pxOn = (ctx) => (x, y, w = 1, h = 1, color) => {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
};

// ------------------------------------------------------------------ static layers (painted once)

let bgLayer = null;
let machineLayer = null;

function hexMix(a, b, f) {
    const pa = parseInt(a.slice(1), 16);
    const pb = parseInt(b.slice(1), 16);
    const ch = (s) => Math.round(((pa >> s) & 255) * (1 - f) + ((pb >> s) & 255) * f);
    return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}

function paintBackground() {
    const c = document.createElement('canvas');
    c.width = W;
    c.height = HORIZON + 1;
    const ctx = c.getContext('2d');
    const px = pxOn(ctx);

    // Synthwave sky: hard colour bands with ordered dithering between them
    for (let y = 0; y < HORIZON; y++) {
        const f = (y / (HORIZON - 1)) * (C.sky.length - 1);
        const i = Math.min(C.sky.length - 2, Math.floor(f));
        const frac = f - i;
        for (let x = 0; x < W; x++) {
            px(x, y, 1, 1, frac > BAYER[y % 2][x % 2] ? C.sky[i + 1] : C.sky[i]);
        }
    }

    // Sun glow + striped sun
    const glow = ctx.createRadialGradient(48, 50, 4, 48, 50, 38);
    glow.addColorStop(0, 'rgba(255,170,120,0.45)');
    glow.addColorStop(1, 'rgba(255,90,140,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 10, W, HORIZON - 10);
    const r = 22;
    for (let y = 50 - r; y < HORIZON; y++) {
        const k = y - 50;
        if (k > 0 && SUN_GAPS.has(k)) continue;
        const half = Math.floor(Math.sqrt(Math.max(0, r * r - k * k)));
        const band = C.sun[Math.min(C.sun.length - 1, Math.floor(((y - (50 - r)) / (2 * r)) * C.sun.length))];
        px(48 - half, y, half * 2, 1, band);
    }

    // Two layers of mountains with neon rims
    for (let x = 0; x < W; x++) {
        const back = Math.round(56 + 5 * Math.sin(x * 0.12 + 0.5) + 3 * Math.sin(x * 0.29 + 2) + 2 * Math.sin(x * 0.61));
        px(x, back, 1, HORIZON - back, '#3a0f5c');
        px(x, back, 1, 1, '#ff7ab6');
        const front = Math.round(63 + 3 * Math.sin(x * 0.19 + 1.3) + 2 * Math.sin(x * 0.43 + 0.4));
        px(x, front, 1, HORIZON - front, '#22083a');
        px(x, front, 1, 1, '#c04f9a');
    }
    px(0, HORIZON, W, 1, C.horizon);
    return c;
}

function paintMachine() {
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const ctx = c.getContext('2d');
    const px = pxOn(ctx);

    // Body + top cap
    px(17, 12, 62, 1, OUT);
    px(18, 13, 60, 3, C.chrome);
    px(18, 13, 60, 1, C.chromeHi);
    px(17, 13, 1, 3, OUT);
    px(78, 13, 1, 3, OUT);
    px(18, 16, 60, 1, '#3a3a4a');
    px(20, 17, 56, 73, C.body);
    px(20, 17, 3, 73, C.bodyHi);
    px(72, 17, 4, 73, C.bodyLo);
    px(19, 16, 1, 74, OUT);
    px(76, 16, 1, 74, OUT);

    // Red stripe
    px(20, 21, 56, 4, C.red);
    px(20, 21, 56, 1, C.redHi);
    px(20, 24, 56, 1, C.redLo);

    // Pressure gauge (needle drawn per frame)
    for (let y = -6; y <= 6; y++) {
        for (let x = -6; x <= 6; x++) {
            const d = Math.hypot(x, y);
            if (d <= 6.2) px(30 + x, 35 + y, 1, 1, d > 5 ? C.chrome : '#f4efe6');
        }
    }
    [0.85, 1.25, 1.65, 2.05].forEach((a) => {
        px(30 + Math.round(Math.cos(a * Math.PI) * 4), 35 + Math.round(Math.sin(a * Math.PI) * 4), 1, 1, '#555');
    });
    px(33, 31, 1, 1, C.red);
    px(34, 33, 1, 1, C.red);

    // LED housing + gold "B" badge
    px(42, 33, 4, 4, C.basket);
    px(56, 30, 12, 11, '#2a1a3a');
    px(56, 30, 12, 1, C.gold);
    px(56, 40, 12, 1, C.gold);
    px(56, 30, 1, 11, C.gold);
    px(67, 30, 1, 11, C.gold);
    ['##.', '#.#', '##.', '#.#', '##.'].forEach((row, ry) => {
        [...row].forEach((ch, rx) => { if (ch === '#') px(61 + rx, 33 + ry, 1, 1, C.gold); });
    });

    // Brew recess
    px(28, 44, 40, 40, C.recess);
    px(28, 44, 40, 2, C.recessLo);
    px(28, 44, 1, 40, C.recessLo);
    px(67, 44, 1, 40, C.recessLo);

    // Group head + portafilter (handle sticks out to the left)
    px(39, 44, 18, 6, C.chrome);
    px(39, 44, 18, 1, C.chromeHi);
    px(39, 49, 18, 1, C.chromeLo);
    px(40, 50, 16, 3, C.basket);
    px(40, 50, 16, 1, '#b9b9c9');
    px(18, 51, 22, 2, C.wood);
    px(13, 50, 6, 4, C.woodLo);
    px(13, 50, 6, 1, C.wood);

    // Drip tray + base + feet
    for (let x = 28; x < 68; x++) {
        px(x, 82, 1, 2, x % 2 ? '#5a5a6c' : '#33334a');
    }
    px(26, 84, 44, 3, C.chrome);
    px(26, 84, 44, 1, C.chromeHi);
    px(26, 86, 44, 1, C.chromeLo);
    px(20, 87, 56, 3, '#4a4a5e');
    px(19, 90, 58, 1, OUT);
    px(22, 91, 5, 2, OUT);
    px(69, 91, 5, 2, OUT);

    // Steam wand on the right
    px(76, 30, 4, 2, '#9a9aae');
    px(79, 32, 2, 34, '#b9b9c9');
    px(80, 32, 1, 34, C.chromeLo);
    px(78, 66, 4, 3, '#d8d8e6');
    return c;
}

// ------------------------------------------------------------------ frame

function drawScene(ctx, s) {
    if (!bgLayer) bgLayer = paintBackground();
    if (!machineLayer) machineLayer = paintMachine();
    const px = pxOn(ctx);
    const t = s.t;

    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(bgLayer, 0, 0);

    for (const st of STARS) {
        if (Math.sin(t * 3 + st.p) > -0.3) px(st.x, st.y, 1, 1, C.star);
    }

    // Shooting star
    const ss = s.shootingStar;
    if (ss > 0 && ss < 1) {
        const hx = Math.round(92 - ss * 50);
        const hy = Math.round(2 + ss * 20);
        for (let k = 0; k < 7; k++) {
            ctx.globalAlpha = 1 - k / 7;
            px(hx + k * 2, hy - k, 1, 1, '#ffffff');
        }
        ctx.globalAlpha = 1;
    }

    // Scrolling neon floor
    px(0, HORIZON + 1, W, H - HORIZON - 1, C.floor);
    ctx.globalAlpha = 0.75;
    const scroll = (t * 0.8) % 1;
    for (let i = 0; i < 7; i++) {
        const y = HORIZON + 1 + Math.round(32 * Math.pow((i + scroll) / 7, 2));
        if (y > HORIZON + 1) px(0, y, W, 1, C.grid);
    }
    for (let k = -7; k <= 7; k++) {
        for (let y = HORIZON + 1; y < H; y++) {
            px(Math.round(48 + k * 2 + (k * 14 * (y - HORIZON)) / 33), y, 1, 1, C.grid);
        }
    }
    ctx.globalAlpha = 0.5;
    px(16, 92, 64, 2, '#05010c');
    ctx.globalAlpha = 1;

    ctx.drawImage(machineLayer, 0, 0);

    // Gauge needle (0..9 bar) + status LED
    const a = (0.75 + 1.5 * clamp(s.pressure || 0)) * Math.PI;
    for (let r = 1; r <= 4; r++) px(30 + Math.round(Math.cos(a) * r), 35 + Math.round(Math.sin(a) * r), 1, 1, C.red);
    px(30, 35, 1, 1, OUT);
    const brewing = (s.pressure || 0) > 0.5;
    px(43, 34, 2, 2, brewing ? (Math.sin(t * 14) > 0 ? '#ff5e5b' : '#7a1d1d') : '#3ddc84');

    // Spouts
    const streams = s.spouts === 2 ? [43, 51] : [47];
    if (s.spouts === 2) {
        px(43, 53, 10, 1, C.basket);
        px(43, 54, 2, 1, C.basket);
        px(51, 54, 2, 1, C.basket);
    } else {
        px(46, 53, 4, 1, C.basket);
        px(47, 54, 2, 1, C.basket);
    }

    // Coffee stream(s) down to the cup rim
    const rim = 69;
    const len = rim - 55;
    const y0 = 55 + Math.round(len * clamp(s.streamTop || 0));
    const y1 = 55 + Math.round(len * clamp(s.streamBottom || 0));
    for (const sx of streams) {
        for (let y = y0; y < y1; y++) px(sx, y, 2, 1, ((y - t * 60) | 0) % 5 === 0 ? C.coffeeHi : C.coffee);
        if (y1 >= rim && y0 < rim && Math.random() < 0.6) {
            px(sx - 1 + ((Math.random() * 4) | 0), rim - 1 - ((Math.random() * 2) | 0), 1, 1, C.crema);
        }
    }

    // Cup on its saucer (slides in from the right)
    const dx = Math.round(s.cupX || 0);
    const fill = clamp(s.fill || 0);
    px(34 + dx, 80, 28, 1, OUT);
    px(33 + dx, 81, 30, 1, C.saucer);
    px(33 + dx, 81, 1, 1, OUT);
    px(62 + dx, 81, 1, 1, OUT);
    px(38 + dx, 67, 20, 1, OUT);
    for (let y = 68; y <= 69; y++) {
        px(38 + dx, y, 1, 1, OUT);
        px(57 + dx, y, 1, 1, OUT);
        for (let x = 39; x <= 56; x++) {
            let col = C.cupIn;
            if (fill >= 0.85) col = ((x * 3 + y + t * 6) | 0) % 9 === 0 ? C.cremaHi : C.crema;
            else if (fill > 0.08) col = ((x + t * 20) | 0) % 7 === 0 ? C.coffeeHi : C.coffee;
            px(x + dx, y, 1, 1, col);
        }
    }
    for (let i = 0; i <= 9; i++) {
        const y = 70 + i;
        const left = 38 + Math.floor(i * 0.3);
        const right = 57 - Math.floor(i * 0.3);
        px(left + dx, y, 1, 1, OUT);
        px(left + 1 + dx, y, right - left - 4, 1, C.cup);
        px(right - 3 + dx, y, 3, 1, C.cupShade);
        px(right + dx, y, 1, 1, OUT);
    }
    px(41 + dx, 79, 14, 1, OUT);
    px(58 + dx, 70, 3, 1, OUT);
    px(61 + dx, 71, 1, 5, OUT);
    px(58 + dx, 76, 3, 1, OUT);
    px(58 + dx, 71, 3, 1, C.cup);
    px(60 + dx, 72, 1, 3, C.cupShade);
    px(58 + dx, 75, 3, 1, C.cup);
    ['##.', '#.#', '##.', '#.#', '##.'].forEach((row, ry) => {
        [...row].forEach((ch, rx) => { if (ch === '#') px(46 + rx + dx, 72 + ry, 1, 1, C.coffee); });
    });

    // Steam from the cup
    const steam = clamp(s.steam || 0);
    if (steam > 0) {
        [[44, 0], [48, 2], [52, 4]].forEach(([base, phase]) => {
            for (let k = 0; k < 11; k++) {
                if ((k + ((t * 10) | 0)) % 3 === 0) continue;
                const x = base + Math.round(Math.sin(k * 0.5 - t * 4 + phase) * (0.6 + k * 0.1));
                ctx.globalAlpha = steam * (1 - k / 11) * 0.8;
                px(x + dx, 66 - k, 1, 1, '#ffffff');
            }
        });
        ctx.globalAlpha = 1;
    }

    // Steam wand puff
    const puff = clamp(s.puff || 0);
    if (puff > 0) {
        for (let k = 0; k < 34; k++) {
            if ((k + ((t * 12) | 0)) % 4 === 0) continue;
            const x = 80 + Math.round(Math.sin(k * 0.35 - t * 5) * (1 + k * 0.12));
            ctx.globalAlpha = puff * (1 - k / 34) * 0.85;
            px(x, 68 - k, 1 + (k > 14 ? 1 : 0), 1, '#ffffff');
        }
        ctx.globalAlpha = 1;
    }

    // Light glint sweeping across the steel body
    const g = s.glint;
    if (g > 0 && g < 1) {
        ctx.globalAlpha = 0.4;
        const x0 = -12 + g * 124;
        for (let y = 13; y < 90; y++) {
            for (let w = 0; w < 3; w++) {
                const x = Math.round(x0 + (90 - y) * 0.35) + w;
                const inBody = x >= 20 && x <= 75;
                const inRecess = x >= 28 && x <= 67 && y >= 44 && y <= 83;
                if (inBody && !inRecess) px(x, y, 1, 1, '#ffffff');
            }
        }
        ctx.globalAlpha = 1;
    }

    // Sparkle on the cup rim
    const sp = clamp(s.sparkle || 0);
    if (sp > 0) {
        const arm = Math.round(1 + Math.sin(sp * Math.PI) * 3);
        const sx = 59 + dx;
        const sy = 64;
        px(sx, sy - arm, 1, arm * 2 + 1, '#ffffff');
        px(sx - arm, sy, arm * 2 + 1, 1, '#ffffff');
    }
}

// ------------------------------------------------------------------ chiptune blips

let actx = null;

function audio() {
    try {
        actx = actx || new (window.AudioContext || window.webkitAudioContext)();
        if (actx.state === 'suspended') actx.resume().catch(() => {});
        return actx.state === 'running' ? actx : null;
    } catch {
        return null;
    }
}

function blip(freq, dur = 0.08, type = 'square', vol = 0.04, when = 0) {
    if (!settings.get('sfx')) return;
    const a = audio();
    if (!a) return;
    const o = a.createOscillator();
    const g = a.createGain();
    const t0 = a.currentTime + when;
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(a.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
}

// Tiny synthesized click for UI buttons (no audio asset needed in the menu)
export function uiClick() {
    blip(660, 0.05, 'square', 0.035);
}

const jingle = () => [523, 659, 784, 1047].forEach((f, i) => blip(f, 0.14, 'square', 0.04, i * 0.09));

// ------------------------------------------------------------------ overlay

function fontReady() {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    return Promise.race([
        document.fonts.load('16px "Press Start 2P"').catch(() => {}),
        new Promise((r) => setTimeout(r, 1200))
    ]);
}

function buildOverlay({ header = '', title = '', small = false, bar = false, skip = '' }) {
    const root = document.createElement('div');
    root.className = 'bica crt-on';
    root.innerHTML = `
        <div class="bica__screen">
            <div class="bica__header"></div>
            <canvas class="bica__art" width="${W}" height="${H}"></canvas>
            <div class="bica__title${small ? ' bica__title--small' : ''}"></div>
            <div class="bica__sub"></div>
            <div class="bica__bar"><i></i></div>
            <div class="bica__tag"></div>
        </div>
        <div class="bica__skip"></div>`;
    const $ = (sel) => root.querySelector(sel);
    const o = {
        root,
        ctx: $('canvas').getContext('2d'),
        header: $('.bica__header'),
        title: $('.bica__title'),
        sub: $('.bica__sub'),
        tag: $('.bica__tag'),
        bar: $('.bica__bar i'),
        skip: $('.bica__skip')
    };
    o.header.textContent = header;
    if (!header) o.header.style.display = 'none';
    if (!bar) $('.bica__bar').style.display = 'none';
    o.skip.textContent = skip;
    [...title].forEach((ch) => {
        const span = document.createElement('span');
        span.textContent = ch;
        o.title.appendChild(span);
    });
    o.close = () => new Promise((resolve) => {
        root.classList.replace('crt-on', 'crt-off');
        setTimeout(() => {
            root.remove();
            resolve();
        }, 360);
    });
    document.body.appendChild(root);
    return o;
}

// ------------------------------------------------------------------ public

// The studio intro that is playing right now (so an update found at start-up can replace it)
let currentIntro = null;

export function isIntroPlaying() {
    return !!currentIntro;
}

// Ends the intro early; resolves once its overlay is gone
export function abortIntro() {
    if (!currentIntro) return Promise.resolve();
    const intro = currentIntro;
    intro.finish();
    return intro.closed;
}

export function isOverlayOpen() {
    return !!document.querySelector('.bica');
}

// Studio intro: CRT on, a cup slides onto the machine, a bica is pulled at 9 bar, chrome BICA drops in,
// neon GAMES flickers on, a glint sweeps the steel. Tap to skip. Once per session.
export function playIntro() {
    try {
        if (sessionStorage.getItem('bica-intro') === '1') return Promise.resolve();
        sessionStorage.setItem('bica-intro', '1');
    } catch {
        // storage blocked: just play it
    }

    return fontReady().then(() => new Promise((resolve) => {
        const o = buildOverlay({ title: 'BICA', skip: t('tapToSkip') });
        const letters = [...o.title.children];
        let done = false;
        let letterIdx = 0;
        let neonOn = false;
        let shined = false;
        let tagShown = false;
        let dinged = false;

        let closedResolve;
        const closed = new Promise((r) => { closedResolve = r; });
        const finish = () => {
            if (done) return;
            done = true;
            currentIntro = null;
            o.close().then(() => {
                closedResolve();
                resolve();
            });
        };
        currentIntro = { finish, closed };
        o.root.addEventListener('pointerdown', finish);
        // Safety net: if animation frames are throttled (hidden tab), never block the game
        setTimeout(finish, 6000);

        const start = performance.now();
        const frame = (now) => {
            if (done) return;
            const ms = now - start;

            while (letterIdx < letters.length && ms > 1100 + letterIdx * 150) {
                letters[letterIdx].classList.add('in');
                blip(220 + letterIdx * 110);
                letterIdx++;
            }
            if (!neonOn && ms > 2000) {
                neonOn = true;
                o.sub.textContent = 'GAMES';
                o.sub.classList.add('neon');
                blip(110, 0.05, 'sawtooth', 0.03);
                blip(110, 0.05, 'sawtooth', 0.03, 0.18);
            }
            if (!dinged && ms > 2350) {
                dinged = true;
                jingle();
            }
            if (!shined && ms > 2500) {
                shined = true;
                o.title.classList.add('shine');
            }
            if (!tagShown && ms > 2900) {
                tagShown = true;
                o.tag.textContent = t('tagline');
            }

            drawScene(o.ctx, {
                t: ms / 1000,
                spouts: 1,
                cupX: 46 * (1 - easeOutBack(clamp((ms - 300) / 600))),
                pressure: ms < 2400 ? clamp((ms - 800) / 600) : 1 - 0.85 * clamp((ms - 2400) / 500),
                streamBottom: clamp((ms - 1000) / 220),
                streamTop: clamp((ms - 2300) / 220),
                fill: clamp((ms - 1050) / 1250),
                steam: clamp((ms - 2350) / 500),
                puff: clamp((ms - 2500) / 250) * (1 - clamp((ms - 3300) / 500)),
                glint: (ms - 2400) / 500,
                sparkle: ms > 2900 && ms < 3600 ? (ms - 2900) / 700 : 0,
                shootingStar: (ms - 1300) / 450
            });

            if (ms > 4500) finish();
            else requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
    }));
}

// Update overlay: a double espresso (two spouts) fills while the new version installs.
// `ready` resolves when the new service worker has taken over.
export function playDoubleEspresso({ ready, from, to }) {
    return fontReady().then(() => new Promise((resolve) => {
        const o = buildOverlay({ header: t('newVersion'), title: t('double'), small: true, bar: true });
        const letters = [...o.title.children];
        o.sub.textContent = t('espresso');
        o.sub.classList.add('neon');
        o.tag.innerHTML = (from && to && from !== to ? `v${from} > v${to}<br>` : '') + t('brewing');

        let isReady = false;
        Promise.resolve(ready).then(() => { isReady = true; });

        let fill = 0;
        let doneAt = 0;
        let letterIdx = 0;
        let last = performance.now();
        const start = last;

        const frame = (now) => {
            const ms = now - start;
            const dt = (now - last) / 1000;
            last = now;

            while (letterIdx < letters.length && ms > 500 + letterIdx * 140) {
                letters[letterIdx].classList.add('in');
                blip(330 + letterIdx * 90);
                letterIdx++;
            }

            // Fill to 90% over ~3s, then finish only once the new version is ready
            const base = 0.9 * clamp((ms - 700) / 2300);
            if (isReady && base >= 0.9) fill = Math.min(1, fill + dt * 0.6);
            else fill = Math.max(fill, base);
            o.bar.style.width = `${Math.round(fill * 100)}%`;

            if (fill >= 1 && !doneAt) {
                doneAt = now;
                o.header.textContent = t('updated');
                o.tag.textContent = t('ready');
                o.title.classList.add('shine');
                jingle();
            }
            const since = doneAt ? now - doneAt : 0;

            drawScene(o.ctx, {
                t: ms / 1000,
                spouts: 2,
                cupX: 46 * (1 - easeOutBack(clamp((ms - 200) / 500))),
                pressure: doneAt ? 1 - clamp(since / 500) * 0.85 : clamp((ms - 500) / 500),
                streamBottom: clamp((ms - 700) / 250),
                streamTop: doneAt ? clamp(since / 250) : 0,
                fill,
                steam: doneAt ? clamp(since / 500) : 0,
                puff: doneAt ? clamp(since / 250) : 0,
                glint: doneAt ? since / 500 : 0,
                sparkle: doneAt && since < 700 ? since / 700 : 0
            });

            if (doneAt && since > 1300) o.close().then(resolve);
            else requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
    }));
}

// iPhone/iPad: Safari has no install prompt, so explain "Add to Home Screen"
export function showInstallHelp() {
    const root = document.createElement('div');
    root.className = 'bica bica--help crt-on';
    const share = '<svg width="18" height="22" viewBox="0 0 18 22" fill="none" stroke="#ffd23f" stroke-width="2"><path d="M9 14V2M4 6l5-5 5 5"/><path d="M5 9H2v12h14V9h-3"/></svg>';
    root.innerHTML = `
        <div class="bica__screen">
            <div class="bica__title bica__title--small"><span class="in">${t('iosTitle')}</span></div>
            <div class="bica__help">
                ${t('iosSteps').map((step, i) => `${i + 1}. ${step.replace('{share}', share)}`).join('<br>')}
            </div>
            <button class="bica__btn">OK</button>
        </div>`;
    root.querySelector('.bica__btn').addEventListener('click', () => {
        root.classList.replace('crt-on', 'crt-off');
        setTimeout(() => root.remove(), 360);
    });
    document.body.appendChild(root);
}
