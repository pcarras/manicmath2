// Offline painter for the shop scenes. Runs in a browser canvas (see render.mjs) and writes
// high-resolution images to assets/scenes/. The game only loads the finished picture, so every
// effect here (blur, bloom, reflections, grain) costs nothing while playing.

// ------------------------------------------------------------------ helpers

export function rng(seed) {
    let s = seed >>> 0;
    return () => {
        s = (s + 0x6d2b79f5) >>> 0;
        let t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

export function layer(W, H) {
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    return { c, ctx: c.getContext('2d') };
}

export function vgrad(ctx, x0, y0, y1, w, stops) {
    const g = ctx.createLinearGradient(0, y0, 0, y1);
    stops.forEach(([a, col]) => g.addColorStop(a, col));
    ctx.fillStyle = g;
    ctx.fillRect(x0, y0, w, y1 - y0);
}

export function glow(ctx, x, y, r, col, a = 1) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, col);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = a;
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
    ctx.globalAlpha = 1;
}

// Smooth value noise (for clouds, water and texture)
export function noise2(seed) {
    const r = rng(seed);
    const N = 256;
    const p = new Float32Array(N * N);
    for (let i = 0; i < p.length; i++) p[i] = r();
    const at = (x, y) => p[((y & 255) * N) + (x & 255)];
    const sm = (t) => t * t * (3 - 2 * t);
    const n = (x, y) => {
        const xi = Math.floor(x);
        const yi = Math.floor(y);
        const xf = sm(x - xi);
        const yf = sm(y - yi);
        const a = at(xi, yi) + (at(xi + 1, yi) - at(xi, yi)) * xf;
        const b = at(xi, yi + 1) + (at(xi + 1, yi + 1) - at(xi, yi + 1)) * xf;
        return a + (b - a) * yf;
    };
    return (x, y, oct = 5) => {
        let v = 0;
        let amp = 0.5;
        let f = 1;
        for (let o = 0; o < oct; o++) { v += amp * n(x * f, y * f); amp *= 0.5; f *= 2.03; }
        return v;
    };
}

// Soft clouds painted from noise into their own layer
export function clouds(W, H, seed, { y0, y1, scale = 0.004, cover = 0.52, color = [120, 110, 170], alpha = 0.5, stretch = 3 }) {
    const L = layer(W, H);
    const img = L.ctx.createImageData(W, H);
    const fbm = noise2(seed);
    for (let y = Math.floor(y0); y < Math.min(H, y1); y++) {
        const fade = Math.sin(((y - y0) / (y1 - y0)) * Math.PI);
        for (let x = 0; x < W; x++) {
            const v = fbm((x * scale) / stretch, y * scale);
            const d = Math.max(0, (v - cover) / (1 - cover));
            const a = Math.min(1, d * 2.2) * fade * alpha;
            const i = (y * W + x) * 4;
            img.data[i] = color[0] + d * 60;
            img.data[i + 1] = color[1] + d * 50;
            img.data[i + 2] = color[2] + d * 40;
            img.data[i + 3] = a * 255;
        }
    }
    L.ctx.putImageData(img, 0, 0);
    return L.c;
}

export function stars(ctx, W, H, r, n, maxY) {
    for (let i = 0; i < n; i++) {
        const x = r() * W;
        const y = Math.pow(r(), 1.4) * maxY;
        const b = Math.pow(r(), 3);
        const s = 0.6 + b * 2.2;
        ctx.fillStyle = `rgba(${230 + r() * 25},${230 + r() * 25},255,${0.25 + b * 0.75})`;
        ctx.beginPath();
        ctx.arc(x, y, s, 0, Math.PI * 2);
        ctx.fill();
        if (b > 0.6) glow(ctx, x, y, s * 6, 'rgba(200,210,255,0.35)');
    }
}

// Light bloom: blur the bright layer twice and add it on top
export function bloom(ctx, lights, W, H, strength = 1) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.9 * strength;
    ctx.filter = `blur(${Math.round(W / 220)}px)`;
    ctx.drawImage(lights, 0, 0);
    ctx.globalAlpha = 0.7 * strength;
    ctx.filter = `blur(${Math.round(W / 60)}px)`;
    ctx.drawImage(lights, 0, 0);
    ctx.filter = 'none';
    ctx.globalAlpha = 1;
    ctx.drawImage(lights, 0, 0);
    ctx.restore();
}

// Water reflection of everything above `y`: flipped, squashed, rippled, blurred and darkened
export function reflect(ctx, src, W, H, y, { tint = 'rgba(8,16,40,0.55)', squash = 0.9, seed = 7 } = {}) {
    const r = rng(seed);
    const depth = H - y;
    const tmp = layer(W, depth);
    tmp.ctx.save();
    tmp.ctx.translate(0, y * squash);
    tmp.ctx.scale(1, -squash);
    tmp.ctx.drawImage(src, 0, 0, W, y, 0, 0, W, y);
    tmp.ctx.restore();
    // Ripples: shift thin strips sideways, more with distance
    const out = layer(W, depth);
    for (let sy = 0; sy < depth; sy += 2) {
        const k = sy / depth;
        const dx = Math.sin(sy * 0.21 + r() * 2) * (2 + k * 18) + (r() - 0.5) * k * 10;
        out.ctx.drawImage(tmp.c, 0, sy, W, 2, dx, sy, W, 2);
    }
    ctx.save();
    ctx.filter = `blur(${Math.round(W / 260)}px)`;
    ctx.globalAlpha = 0.7;
    ctx.drawImage(out.c, 0, y);
    ctx.filter = 'none';
    ctx.globalAlpha = 1;
    ctx.fillStyle = tint;
    ctx.fillRect(0, y, W, depth);
    ctx.restore();
}

export function grain(ctx, W, H, seed, amount = 10) {
    const r = rng(seed);
    const img = ctx.getImageData(0, 0, W, H);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
        const n = (r() - 0.5) * amount;
        d[i] += n; d[i + 1] += n; d[i + 2] += n;
    }
    ctx.putImageData(img, 0, 0);
}

export function vignette(ctx, W, H, a = 0.55) {
    const g = ctx.createRadialGradient(W / 2, H * 0.45, W * 0.3, W / 2, H * 0.5, H * 0.75);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, `rgba(0,0,10,${a})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
}

// Mix two hex colours
export function mix(a, b, t) {
    const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
    const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
    return `rgb(${pa.map((v, i) => Math.round(v + (pb[i] - v) * t)).join(',')})`;
}
