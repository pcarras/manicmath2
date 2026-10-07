// Lisbon by night, seen from the river: Alfama climbing to the floodlit São Jorge castle,
// the Sé towers, the white dome of the Pantheon, Cristo Rei and the 25 de Abril bridge
// on the far bank, all mirrored in the Tagus.
import { rng, layer, vgrad, glow, clouds, stars, bloom, reflect, grain, vignette, mix } from './paint.js';

export function paintLisbon(W, H) {
    const r = rng(1755);
    const out = layer(W, H);
    const ctx = out.ctx;
    const lights = layer(W, H);
    const lx = lights.ctx;
    const u = W / 1170;   // unit: keeps sizes right at any resolution
    const river = H * 0.8;
    // Points the game animates on top of the picture (normalised 0..1)
    const anim = { windows: [], beacons: [], cars: null, water: river / H, clouds: [0.08, 0.45] };
    const mark = (list, x, y) => list.push([+(x / W).toFixed(4), +(y / H).toFixed(4)]);

    // ---------------- sky
    vgrad(ctx, 0, 0, river, W, [[0, '#04061a'], [0.35, '#0b1238'], [0.62, '#24205a'], [0.82, '#4a2d63'], [1, '#6b3a5e']]);
    stars(ctx, W, H, r, 520, river * 0.62);
    // Moon with halo
    const mx = W * 0.68;
    const my = H * 0.25;
    glow(ctx, mx, my, 360 * u, 'rgba(190,200,255,0.18)');
    glow(ctx, mx, my, 140 * u, 'rgba(255,245,215,0.35)');
    const mg = ctx.createRadialGradient(mx - 14 * u, my - 14 * u, 4 * u, mx, my, 46 * u);
    mg.addColorStop(0, '#fffbea');
    mg.addColorStop(1, '#e9dfc0');
    ctx.fillStyle = mg;
    ctx.beginPath(); ctx.arc(mx, my, 46 * u, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(160,150,120,0.28)';
    [[-14, -10, 11], [16, 8, 8], [-4, 18, 6], [10, -20, 5]].forEach(([dx, dy, rr]) => {
        ctx.beginPath(); ctx.arc(mx + dx * u, my + dy * u, rr * u, 0, Math.PI * 2); ctx.fill();
    });
    // Clouds lit by the moon
    ctx.drawImage(clouds(W, H, 11, { y0: H * 0.05, y1: H * 0.5, scale: 0.0026 / u, cover: 0.55, color: [70, 64, 120], alpha: 0.55 }), 0, 0);
    ctx.drawImage(clouds(W, H, 23, { y0: H * 0.3, y1: H * 0.66, scale: 0.004 / u, cover: 0.58, color: [110, 70, 120], alpha: 0.35, stretch: 5 }), 0, 0);

    // ---------------- far bank (Almada) with Cristo Rei
    const fb = river - 70 * u;
    ctx.fillStyle = '#1a1c40';
    ctx.beginPath();
    ctx.moveTo(0, river);
    for (let x = 0; x <= W; x += 10) ctx.lineTo(x, fb - 30 * u * Math.sin(x / W * 3 + 1) - 18 * u * Math.sin(x / W * 11));
    ctx.lineTo(W, river);
    ctx.fill();
    for (let i = 0; i < 160; i++) {
        const x = r() * W;
        const y = fb + r() * 70 * u - 10 * u;
        lx.fillStyle = `rgba(255,${180 + r() * 50},${100 + r() * 60},${0.4 + r() * 0.5})`;
        lx.fillRect(x, y, 2.4 * u, 2.4 * u);
    }
    // Cristo Rei: tall pedestal (four legs joined at the top) and the statue with open arms
    const cx = W * 0.7;
    const cb = fb - 20 * u;
    const ped = 150 * u;
    ctx.fillStyle = '#c9c4d8';
    ctx.fillRect(cx - 16 * u, cb - ped, 32 * u, ped);
    ctx.fillStyle = '#1a1c40';
    ctx.fillRect(cx - 6 * u, cb - ped + 26 * u, 12 * u, ped - 26 * u);
    ctx.fillStyle = '#d8d3e6';
    ctx.fillRect(cx - 20 * u, cb - ped - 8 * u, 40 * u, 10 * u);
    ctx.beginPath();
    ctx.moveTo(cx - 5 * u, cb - ped - 8 * u);
    ctx.lineTo(cx - 4 * u, cb - ped - 48 * u);
    ctx.lineTo(cx - 24 * u, cb - ped - 52 * u);
    ctx.lineTo(cx - 24 * u, cb - ped - 56 * u);
    ctx.lineTo(cx + 24 * u, cb - ped - 56 * u);
    ctx.lineTo(cx + 24 * u, cb - ped - 52 * u);
    ctx.lineTo(cx + 4 * u, cb - ped - 48 * u);
    ctx.lineTo(cx + 5 * u, cb - ped - 8 * u);
    ctx.fill();
    ctx.beginPath(); ctx.arc(cx, cb - ped - 61 * u, 5 * u, 0, Math.PI * 2); ctx.fill();
    glow(lx, cx, cb - ped - 30 * u, 70 * u, 'rgba(220,220,255,0.35)');

    // ---------------- 25 de Abril bridge
    const deck = fb - 4 * u;
    const t1 = W * 0.82;
    const t2 = W * 1.38;
    const tTop = H * 0.47;
    const bridgeRed = '#a8352b';
    ctx.strokeStyle = bridgeRed;
    ctx.fillStyle = bridgeRed;
    // deck truss
    ctx.fillRect(W * 0.4, deck - 12 * u, W, 12 * u);
    ctx.lineWidth = 1.4 * u;
    for (let x = W * 0.4; x < W; x += 14 * u) {
        ctx.beginPath(); ctx.moveTo(x, deck - 12 * u); ctx.lineTo(x + 14 * u, deck); ctx.stroke();
    }
    // towers: two legs with cross beams
    [t1].forEach((tx) => {
        ctx.fillRect(tx - 18 * u, tTop, 9 * u, deck - tTop + 40 * u);
        ctx.fillRect(tx + 9 * u, tTop, 9 * u, deck - tTop + 40 * u);
        for (let k = 0; k < 4; k++) ctx.fillRect(tx - 18 * u, tTop + k * (deck - tTop) / 4 + 6 * u, 36 * u, 7 * u);
        glow(lx, tx, tTop - 4 * u, 22 * u, 'rgba(255,60,50,0.9)');
        mark(anim.beacons, tx, tTop - 4 * u);
    });
    // main cable from the far anchor, down to mid-span and up to the tower (off to the right)
    ctx.lineWidth = 3.2 * u;
    ctx.beginPath();
    ctx.moveTo(W * 0.4, deck - 12 * u);
    ctx.quadraticCurveTo(W * 0.62, deck - 70 * u, t1, tTop + 4 * u);
    ctx.quadraticCurveTo((t1 + t2) / 2, deck + 40 * u, t2, tTop);
    ctx.stroke();
    ctx.lineWidth = 1 * u;
    for (let x = t1 + 16 * u; x < W; x += 16 * u) {
        const k = (x - t1) / (t2 - t1);
        const cy = (1 - k) * (1 - k) * (tTop + 4 * u) + 2 * (1 - k) * k * (deck + 40 * u) + k * k * tTop;
        ctx.beginPath(); ctx.moveTo(x, cy); ctx.lineTo(x, deck - 12 * u); ctx.stroke();
    }
    for (let x = W * 0.42; x < t1 - 10 * u; x += 16 * u) {
        const k = (x - W * 0.4) / (t1 - W * 0.4);
        const cy = (1 - k) * (1 - k) * (deck - 12 * u) + 2 * (1 - k) * k * (deck - 70 * u) + k * k * (tTop + 4 * u);
        ctx.beginPath(); ctx.moveTo(x, cy); ctx.lineTo(x, deck - 12 * u); ctx.stroke();
    }
    // Car lights on the deck
    anim.cars = [0.4, 1, +((deck - 15 * u) / H).toFixed(4)];
    for (let x = W * 0.4; x < W; x += 9 * u) {
        if (r() < 0.5) lx.fillStyle = r() < 0.5 ? 'rgba(255,240,200,0.9)' : 'rgba(255,80,60,0.9)', lx.fillRect(x, deck - 16 * u, 4 * u, 2.5 * u);
    }
    for (let x = W * 0.4; x < W; x += 34 * u) glow(lx, x, deck - 18 * u, 8 * u, 'rgba(255,200,120,0.8)');

    // Haze in front of the far bank
    vgrad(ctx, 0, H * 0.55, river, W, [[0, 'rgba(60,40,90,0)'], [1, 'rgba(80,50,100,0.45)']]);

    // ---------------- the hill of Alfama
    const hill = (x) => river - 30 * u - (H * 0.19) * Math.exp(-Math.pow((x - W * 0.26) / (W * 0.36), 2)) - (H * 0.05) * Math.exp(-Math.pow((x - W * 0.52) / (W * 0.12), 2));
    ctx.fillStyle = '#16133a';
    ctx.beginPath();
    ctx.moveTo(0, river);
    for (let x = 0; x <= W * 0.95; x += 6) ctx.lineTo(x, hill(x));
    ctx.lineTo(W * 0.95, river);
    ctx.fill();

    // Castle of São Jorge on the top, floodlit from below
    const kx = W * 0.3;
    const ky = hill(kx) + 10 * u;
    // trees around the castle
    for (let i = 0; i < 70; i++) {
        const x = kx + (r() - 0.5) * 380 * u;
        const y = hill(x) + 10 * u + r() * 40 * u;
        ctx.fillStyle = mix('#0f1e24', '#1d3a30', r());
        ctx.beginPath(); ctx.arc(x, y, (10 + r() * 16) * u, 0, Math.PI * 2); ctx.fill();
    }
    const wallTop = ky - 60 * u;
    const castle = layer(W, H);
    const cc = castle.ctx;
    const stone = cc.createLinearGradient(0, wallTop - 60 * u, 0, ky + 20 * u);
    stone.addColorStop(0, '#4a3f4a');
    stone.addColorStop(0.55, '#9a7656');
    stone.addColorStop(1, '#d6a668');
    cc.fillStyle = stone;
    cc.fillRect(kx - 170 * u, wallTop, 340 * u, 80 * u);
    const towers = [[-170, 44, 46], [-95, 38, 70], [-20, 46, 40], [55, 40, 62], [130, 44, 48]];
    towers.forEach(([dx, tw, th]) => {
        cc.fillRect(kx + dx * u, wallTop - th * u, tw * u, (th + 80) * u);
        for (let b = 0; b < tw; b += 11) cc.fillRect(kx + (dx + b) * u, wallTop - (th + 9) * u, 7 * u, 9 * u);
        cc.fillStyle = 'rgba(40,20,20,0.5)';
        cc.fillRect(kx + (dx + tw / 2 - 2) * u, wallTop - (th - 14) * u, 4 * u, 10 * u);
        cc.fillStyle = stone;
    });
    for (let b = -170; b < 170; b += 13) cc.fillRect(kx + b * u, wallTop - 9 * u, 8 * u, 9 * u);
    // flag
    cc.fillStyle = '#e8e2d0';
    cc.fillRect(kx + (-95 + 18) * u, wallTop - 110 * u, 2.5 * u, 32 * u);
    cc.fillStyle = '#2e7d4f';
    cc.fillRect(kx + (-95 + 20) * u, wallTop - 110 * u, 9 * u, 14 * u);
    cc.fillStyle = '#c62828';
    cc.fillRect(kx + (-95 + 29) * u, wallTop - 110 * u, 13 * u, 14 * u);
    ctx.drawImage(castle.c, 0, 0);
    glow(lx, kx, ky, 260 * u, 'rgba(255,170,80,0.16)');

    // ---------------- houses of Alfama and Baixa, back to front
    const facades = ['#d9a25f', '#c97b6a', '#e2c98a', '#8fa9c4', '#d6b4a6', '#b7c2a0', '#e6d6c0', '#c9895c', '#9db6c9', '#e0b07a'];
    const rows = 11;
    for (let row = 0; row < rows; row++) {
        const depth = row / (rows - 1);   // 0 far .. 1 near
        let x = -20 * u + r() * 20 * u;
        const scale = (0.55 + depth * 0.7) * u;
        while (x < W * (0.62 + depth * 0.36)) {
            const bw = (34 + r() * 40) * scale;
            const floors = 2 + Math.floor(r() * 3);
            const fh = 22 * scale;
            const bh = floors * fh + 10 * scale;
            const ground = Math.min(river - 6 * u, hill(x + bw / 2) + 46 * u + row * ((river - hill(x + bw / 2)) / rows) * 0.98);
            if (ground > river - 4 * u) { x += bw; continue; }
            if (r() < 0.07) {
                // a small garden or a staircase between houses
                for (let k = 0; k < 3; k++) {
                    ctx.fillStyle = mix('#0f1e24', '#1d3a30', r());
                    ctx.beginPath(); ctx.arc(x + r() * bw, ground - r() * 20 * scale, (8 + r() * 10) * scale, 0, Math.PI * 2); ctx.fill();
                }
                x += bw;
                continue;
            }
            const top = ground - bh;
            // facade: lit from the street below, darker with distance (haze)
            const base = facades[Math.floor(r() * facades.length)];
            const fg = ctx.createLinearGradient(0, top, 0, ground);
            fg.addColorStop(0, mix(base, '#0e0c28', 0.9 - depth * 0.14));
            fg.addColorStop(1, mix(base, '#2a1636', 0.7 - depth * 0.2));
            ctx.fillStyle = fg;
            ctx.fillRect(x, top, bw, bh + 30 * scale);
            // side shade
            ctx.fillStyle = 'rgba(10,8,30,0.35)';
            ctx.fillRect(x + bw - 5 * scale, top, 5 * scale, bh + 30 * scale);
            // terracotta roof
            ctx.fillStyle = mix('#a4482c', '#1a1236', 0.62 - depth * 0.3);
            ctx.beginPath();
            ctx.moveTo(x - 3 * scale, top + 2 * scale);
            ctx.lineTo(x + bw * 0.5, top - 13 * scale);
            ctx.lineTo(x + bw + 3 * scale, top + 2 * scale);
            ctx.fill();
            // windows
            const cols = Math.max(1, Math.floor(bw / (14 * scale)));
            for (let f = 0; f < floors; f++) {
                for (let c = 0; c < cols; c++) {
                    const wx = x + (bw / cols) * (c + 0.5) - 3.5 * scale;
                    const wy = top + 8 * scale + f * fh;
                    const lit = r() < 0.22;
                    if (lit) {
                        const warm = r() < 0.82;
                        lx.fillStyle = warm ? `rgba(255,${190 + r() * 40},${110 + r() * 40},${0.75 + r() * 0.25})` : 'rgba(180,220,255,0.8)';
                        lx.fillRect(wx, wy, 7 * scale, 10 * scale);
                        if (warm && r() < 0.12) mark(anim.windows, wx + 3.5 * scale, wy + 5 * scale);
                    } else {
                        ctx.fillStyle = 'rgba(15,12,35,0.75)';
                        ctx.fillRect(wx, wy, 7 * scale, 10 * scale);
                    }
                    if (r() < 0.25) {   // little balcony
                        ctx.fillStyle = 'rgba(20,16,30,0.8)';
                        ctx.fillRect(wx - 2 * scale, wy + 10 * scale, 11 * scale, 1.6 * scale);
                    }
                }
            }
            x += bw + r() * 2 * scale;
        }
        // street lamps along each row
        for (let i = 0; i < 2 + Math.floor(row / 2); i++) {
            const lxp = r() * W * 0.9;
            const ly = Math.min(river - 8 * u, hill(lxp) + 60 * u + row * ((river - hill(lxp)) / rows));
            glow(lx, lxp, ly, (6 + depth * 10) * u, 'rgba(255,190,100,0.7)');
        }
        if (row === 3) {
            // Sé cathedral: two square towers with battlements and a rose window
            const sx = W * 0.44;
            const sg = hill(sx) + 120 * u;
            ctx.fillStyle = mix('#d9c7a5', '#1a1640', 0.45);
            ctx.fillRect(sx - 60 * u, sg - 120 * u, 120 * u, 120 * u);
            [-60, 28].forEach((dx) => {
                ctx.fillRect(sx + dx * u, sg - 175 * u, 32 * u, 60 * u);
                for (let b = 0; b < 32; b += 10) ctx.fillRect(sx + (dx + b) * u, sg - 183 * u, 6 * u, 8 * u);
            });
            ctx.fillStyle = 'rgba(20,14,30,0.85)';
            ctx.beginPath(); ctx.arc(sx, sg - 20 * u, 16 * u, Math.PI, 0); ctx.fill();
            ctx.fillRect(sx - 16 * u, sg - 20 * u, 32 * u, 20 * u);
            [-46, 34].forEach((dx) => { ctx.fillRect(sx + (dx + 6) * u, sg - 160 * u, 8 * u, 18 * u); });
            lx.fillStyle = 'rgba(255,200,130,0.55)';
            lx.beginPath(); lx.arc(sx, sg - 80 * u, 11 * u, 0, Math.PI * 2); lx.fill();
            glow(lx, sx, sg - 100 * u, 90 * u, 'rgba(255,190,110,0.12)');
        }
        if (row === 5) {
            // National Pantheon: the white dome with a lantern
            const px = W * 0.56;
            const pg = hill(px) + 150 * u;
            ctx.fillStyle = mix('#efe9dc', '#1a1640', 0.35);
            ctx.fillRect(px - 50 * u, pg - 70 * u, 100 * u, 70 * u);
            ctx.fillRect(px - 34 * u, pg - 98 * u, 68 * u, 30 * u);
            ctx.beginPath(); ctx.arc(px, pg - 98 * u, 34 * u, Math.PI, 0); ctx.fill();
            ctx.fillRect(px - 5 * u, pg - 150 * u, 10 * u, 20 * u);
            glow(lx, px, pg - 100 * u, 80 * u, 'rgba(230,230,255,0.12)');
        }
        if (row === 7) {
            // Tram 28 climbing the street
            const tx = W * 0.2;
            const ty = hill(tx) + 230 * u;
            ctx.fillStyle = '#f2b705';
            ctx.fillRect(tx, ty - 34 * u, 80 * u, 30 * u);
            ctx.fillStyle = '#f7f1e1';
            ctx.fillRect(tx, ty - 8 * u, 80 * u, 4 * u);
            for (let k = 0; k < 5; k++) {
                lx.fillStyle = 'rgba(255,230,160,0.95)';
                lx.fillRect(tx + 6 * u + k * 14.5 * u, ty - 29 * u, 9 * u, 10 * u);
            }
            ctx.strokeStyle = '#111';
            ctx.lineWidth = 1.5 * u;
            ctx.beginPath(); ctx.moveTo(tx + 40 * u, ty - 34 * u); ctx.lineTo(tx + 55 * u, ty - 60 * u); ctx.stroke();
        }
    }

    // ---------------- composite: lights + bloom, then the river
    ctx.drawImage(lights.c, 0, 0);
    bloom(ctx, lights.c, W, H, 0.9);
    ctx.clearRect(0, river, W, H - river);
    vgrad(ctx, 0, river, H, W, [[0, '#121a3e'], [1, '#04071a']]);
    reflect(ctx, out.c, W, H, river, { tint: 'rgba(6,12,36,0.62)' });
    // moon path on the water
    for (let y = river + 6 * u; y < H; y += 5 * u) {
        const k = (y - river) / (H - river);
        const half = (14 + k * 90) * u;
        ctx.fillStyle = `rgba(255,240,210,${0.35 * (1 - k) * r()})`;
        ctx.fillRect(mx - half * (0.4 + r()), y, half * (0.3 + r()), 1.8 * u);
    }
    // quay edge
    ctx.fillStyle = '#0a0a18';
    ctx.fillRect(0, river - 3 * u, W, 6 * u);

    // Darken the middle a little so the coloured pieces stay readable, then vignette and grain
    const mid = ctx.createLinearGradient(0, 0, 0, H);
    mid.addColorStop(0, 'rgba(4,4,18,0.15)');
    mid.addColorStop(0.5, 'rgba(4,4,18,0.0)');
    mid.addColorStop(1, 'rgba(4,4,18,0.25)');
    ctx.fillStyle = mid;
    ctx.fillRect(0, 0, W, H);
    vignette(ctx, W, H, 0.5);
    grain(ctx, W, H, 99, 9);
    return { canvas: out.c, anim };
}
