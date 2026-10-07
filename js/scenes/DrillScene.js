// Mini games ("TREINO"): 60 s themed rounds, or a 20 s bonus round launched over a paused game.
// Each drill has its own daylight background and music, so it feels like a break from the main game,
// and opens with an animated example (a hand taps the right pieces) before the round starts.
// Types (see drills.js): pair, one, filter, fractions.
import { CONSTANTS, PIECE_BODY, COLORS } from '../constants.js';
import { ensureTextures, bakeLabelPiece, bakePizzaPiece, pieceTextureKey, JUNK_SIDE, TEX_PX } from '../textures.js';
import { INV, view, setupCamera } from '../display.js';
import { createDrillBackground } from '../drillbg.js';
import { safeAreaTop, safeAreaBottom } from '../pwa.js';
import { t, lang } from '../i18n.js';
import { settings, haptic } from '../settings.js';
import { chunkyButton, roundButton, modal } from '../ui.js';
import { MusicDirector, DRILL_TRACK } from '../music.js';
import { Sfx } from '../sfx.js';
import { addBeans } from '../progress.js';
import {
    drillById, drillText, recordDrill, featuredDrill, DRILL_MS, BONUS_MS, isPrime, smallestFactor,
    F, fracValue, fracLabel, fracWords, STAGES, fractionSplit, DRILLS
} from '../drills.js';

const R = CONSTANTS.RADIUS;
const TAP_SQ = (R * 1.2) ** 2;
const PER_STAGE = 5;          // correct answers before the next stage
const SPAWN_MS = 750;
const MAX_PIECES = 34;
const DEN_COLORS = { 2: 0xe63946, 3: 0x2d9b4e, 4: 0x1d4ed8, 6: 0x7b2cbf, 8: 0x0d9488 };
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const between = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

export class DrillScene extends Phaser.Scene {
    constructor() {
        super({ key: 'DrillScene' });
    }

    init(data) {
        this.drill = drillById(data && data.id);
        this.bonus = !!(data && data.bonus);
        this.remaining = this.bonus ? BONUS_MS : DRILL_MS;
        this.score = 0;
        this.correct = 0;
        this.combo = 0;
        this.lastOkAt = -1e9;
        this.stage = 0;
        this.pieces = [];
        this.picked = [];
        this.queue = [];
        this.spawnAcc = 0;
        this.dangerAcc = 0;
        this.over = false;
        this.started = false;
        this.lastSecs = -1;
        this.paused = false;
    }

    create() {
        setupCamera(this);
        const { w, h } = view(this);
        this.w = w;
        this.h = h;
        const { Body, Sleeping } = Phaser.Physics.Matter.Matter;
        this.Body = Body;
        this.Sleeping = Sleeping;
        ensureTextures(this);
        createDrillBackground(this, this.drill.bg, w, h);
        this.sfx = new Sfx(this);
        this.music = new MusicDirector(this);
        this.music.setTrack(DRILL_TRACK(this.drill.music));

        this.top = safeAreaTop();
        this.uiH = this.top + 132;
        this.floorGap = 14 + Math.round(safeAreaBottom());
        this.matter.world.setBounds(0, -h, w, h * 2 - this.floorGap, 200, true, true, false, true);

        this.burst = this.add.particles(0, 0, 'particle', {
            speed: { min: 120, max: 300 }, scale: { start: 0.9, end: 0 }, blendMode: 'ADD', lifespan: 420, gravityY: 300, emitting: false
        }).setDepth(200);
        this.stars = this.add.particles(0, 0, 'starParticle', {
            speed: { min: 90, max: 200 }, scale: { start: 0.6, end: 0 }, lifespan: 500, emitting: false
        }).setDepth(200);
        this.rings = Array.from({ length: 6 }, () => this.add.image(0, 0, 'ring').setTint(COLORS.selection)
            .setDepth(12).setVisible(false).setScale(INV));

        this.buildHud();
        this.input.on('pointerdown', this.onDown, this);
        this.events.once('shutdown', () => {
            this.music.stop();
            this.sfx.stopAll();
        });

        for (let i = 0; i < 12; i++) this.spawn(-R * 2 - Math.floor(i / 5) * CONSTANTS.DIAMETER * 1.25);
        this.newTarget();
        this.matter.world.pause();   // pieces wait behind the example card
        if (this.bonus) this.coffeeBreak(() => this.showExample());
        else this.showExample();
    }

    // ------------------------------------------------------------------ HUD

    buildHud() {
        const { w } = this;
        const top = this.top;
        const d = this.drill;
        const g = this.add.graphics().setDepth(100);
        g.fillStyle(0x000000, 0.35);
        g.fillRoundedRect(6, 8, w - 12, this.uiH - 4, 20);
        g.fillStyle(0x10112a, 0.94);
        g.fillRoundedRect(8, 6, w - 16, this.uiH - 10, 18);
        g.lineStyle(3, 0x140a24, 1);
        g.strokeRoundedRect(8, 6, w - 16, this.uiH - 10, 18);
        g.lineStyle(2, d.color, 0.9);
        g.strokeRoundedRect(12, 10, w - 24, this.uiH - 18, 15);

        this.add.text(22, top + 14, this.bonus ? `☕ ${t('bonusRound')}` : drillText(d).title.toUpperCase(), {
            fontFamily: 'Righteous', fontSize: '13px', color: this.bonus ? '#ffd23f' : '#ffb86b', letterSpacing: 1
        }).setDepth(101);
        this.scoreText = this.add.text(22, top + 30, '0', { fontFamily: 'Righteous', fontSize: '22px', color: '#ffffff' }).setDepth(101);

        this.starIcons = this.bonus ? [] : [0, 1, 2].map((i) => this.add.text(w - 96 + i * 22, top + 22, '★', {
            fontFamily: 'Arial', fontSize: '20px', color: '#3a3458'
        }).setOrigin(0.5).setDepth(101));
        if (!this.bonus) roundButton(this, w - 30, top + 26, 'pause', () => this.pause(), { radius: 15, depth: 120 });

        this.prompt = this.add.text(w / 2, top + 76, '', {
            fontFamily: 'Righteous', fontSize: '28px', color: '#FFB347', stroke: '#3b1d00', strokeThickness: 5, align: 'center'
        }).setOrigin(0.5).setDepth(101);
        this.sub = this.add.text(w / 2, top + 104, '', {
            fontFamily: 'Roboto', fontSize: '13px', color: '#e5e3ff', align: 'center'
        }).setOrigin(0.5).setDepth(101);
        this.pie = this.add.graphics().setDepth(101);
        this.timeBar = this.add.graphics().setDepth(101);

        const line = this.add.graphics().setDepth(99);
        line.lineStyle(2.5, 0xff6b6b, 1);
        for (let x = 12; x < w - 12; x += 18) line.lineBetween(x, this.uiH, x + 10, this.uiH);
        line.setAlpha(0.4);
        this.drawTime();
    }

    drawTime() {
        const g = this.timeBar;
        g.clear();
        const x = 24;
        const w = this.w - 48;
        const y = this.uiH - 12;
        const f = Math.max(0, this.remaining / (this.bonus ? BONUS_MS : DRILL_MS));
        g.fillStyle(0x2a1c52, 1);
        g.fillRoundedRect(x, y, w, 6, 3);
        g.fillStyle(f < 0.17 ? 0xef4444 : this.drill.color, 1);
        if (f > 0) g.fillRoundedRect(x, y, Math.max(6, w * f), 6, 3);
    }

    setScore(v) {
        this.score = Math.max(0, v);
        this.scoreText.setText(String(this.score));
        this.starIcons.forEach((s, i) => {
            if (this.score >= this.drill.stars[i] && s.style.color !== '#ffd23f') {
                s.setColor('#ffd23f');
                this.tweens.add({ targets: s, scale: 1.8, duration: 160, yoyo: true });
                this.sfx.fanfare();
            }
        });
    }

    // ------------------------------------------------------------------ intro: break curtain + example

    // Bonus rounds open like a coffee break: a warm curtain with a steaming cup
    coffeeBreak(done) {
        const { w, h } = this;
        const box = this.add.container(0, 0).setDepth(900);
        const bg = this.add.rectangle(w / 2, h / 2, w, h, 0x3b1e0e, 0.94);
        const cup = this.add.graphics();
        const cx = w / 2;
        const cy = h * 0.4;
        cup.fillStyle(0xf4efe6, 1);
        cup.fillRoundedRect(cx - 34, cy - 10, 68, 50, { tl: 4, tr: 4, bl: 26, br: 26 });
        cup.lineStyle(7, 0xf4efe6, 1);
        cup.strokeCircle(cx + 40, cy + 8, 13);
        cup.fillStyle(0x6b3a1e, 1);
        cup.fillRect(cx - 30, cy - 6, 60, 8);
        cup.fillStyle(0xc68a4a, 1);
        cup.fillRect(cx - 30, cy - 6, 60, 3);
        cup.fillStyle(0xe8e1d4, 1);
        cup.fillEllipse(cx + 2, cy + 44, 110, 14);
        const steam = [-14, 0, 14].map((dx, i) => {
            const s = this.add.text(cx + dx, cy - 30, '~', { fontFamily: 'Arial', fontSize: '28px', color: '#ffffff' })
                .setOrigin(0.5).setAlpha(0.7).setAngle(90);
            this.tweens.add({ targets: s, y: cy - 60, alpha: 0, duration: 1100, repeat: -1, delay: i * 250 });
            return s;
        });
        const title = this.add.text(cx, h * 0.6, t('coffeeBreak'), {
            fontFamily: 'Righteous', fontSize: '30px', color: '#ffd23f', stroke: '#1b0f2e', strokeThickness: 6, align: 'center'
        }).setOrigin(0.5);
        const sub = this.add.text(cx, h * 0.6 + 40, `${t('bonusRound')} · 20s`, {
            fontFamily: 'Righteous', fontSize: '16px', color: '#ffd9a8'
        }).setOrigin(0.5);
        box.add([bg, cup, ...steam, title, sub]);
        box.y = -h;
        this.tweens.add({ targets: box, y: 0, duration: 420, ease: 'Bounce.easeOut' });
        this.sfx.rise(2);
        this.time.delayedCall(1700, () => {
            this.tweens.add({ targets: box, y: -h, duration: 320, ease: 'Cubic.easeIn', onComplete: () => { box.destroy(); done(); } });
        });
    }

    demoKey(label) {
        const key = `drill_demo_${label.replace('/', '_')}`;
        if (this.textures.exists(key)) return key;
        if (label.includes('/')) {
            const [n, dn] = label.split('/').map(Number);
            bakePizzaPiece(this, key, n, dn, DEN_COLORS[dn] || 0x9a3412);
        } else {
            bakeLabelPiece(this, key, label, COLORS.numbers[Number(label) % COLORS.numbers.length]);
        }
        return key;
    }

    // Animated example: the prompt, three pieces, a hand taps the right ones, a big ✓
    showExample() {
        const d = this.drill;
        const txt = drillText(d);
        const demo = d.demo;
        const { w, h } = this;
        const cw = Math.min(w - 28, 350);
        const ch = 330;
        const cx = w / 2 - cw / 2;
        const cy = Math.max(this.uiH + 10, h / 2 - ch / 2);
        const box = this.add.container(0, 0).setDepth(600);
        const card = this.add.graphics();
        card.fillStyle(0x000000, 0.4);
        card.fillRoundedRect(cx + 4, cy + 8, cw, ch, 22);
        card.fillStyle(0x1b1238, 0.97);
        card.fillRoundedRect(cx, cy, cw, ch, 22);
        card.lineStyle(4, d.color, 1);
        card.strokeRoundedRect(cx, cy, cw, ch, 22);
        const title = this.add.text(w / 2, cy + 28, txt.title, {
            fontFamily: 'Righteous', fontSize: '24px', color: '#ffd23f', stroke: '#1b0f2e', strokeThickness: 5
        }).setOrigin(0.5);
        const prompt = this.add.text(w / 2, cy + 66, lang() === 'pt' ? demo.prompt : (demo.promptEn || demo.prompt), {
            fontFamily: 'Righteous', fontSize: '24px', color: '#FFB347', stroke: '#3b1d00', strokeThickness: 5
        }).setOrigin(0.5);
        box.add([card, title, prompt]);

        const size = 62;
        const pieces = demo.pieces.map((label, i) => {
            const img = this.add.image(w / 2 + (i - 1) * (size + 18), cy + 128, this.demoKey(label)).setScale(size / TEX_PX);
            box.add(img);
            return img;
        });
        const how = this.add.text(w / 2, cy + 196, txt.how[0], {
            fontFamily: 'Roboto', fontSize: '16px', color: '#ffffff', align: 'center', wordWrap: { width: cw - 30 }
        }).setOrigin(0.5);
        const ex = this.add.text(w / 2, cy + 236, txt.how[1], {
            fontFamily: 'Righteous', fontSize: '15px', color: '#4ade80', align: 'center', wordWrap: { width: cw - 30 }
        }).setOrigin(0.5);
        box.add([how, ex]);

        // Hand taps the right pieces in a loop
        const hand = this.add.image(0, 0, 'hand').setScale(INV * 0.9).setDepth(602);
        const tick = this.add.text(w / 2 + (size + 18) * 1.6, cy + 128, '✓', {
            fontFamily: 'Arial', fontSize: '44px', color: '#4ade80', stroke: '#14532d', strokeThickness: 6
        }).setOrigin(0.5).setAlpha(0);
        box.add([hand, tick]);
        let alive = true;
        const loop = () => {
            if (!alive) return;
            pieces.forEach((p) => p.setScale(size / TEX_PX).clearTint());
            tick.setAlpha(0);
            demo.taps.forEach((idx, k) => {
                const p = pieces[idx];
                this.time.delayedCall(350 + k * 700, () => {
                    if (!alive) return;
                    this.tweens.add({ targets: hand, x: p.x, y: p.y - 34, duration: 280, ease: 'Sine.easeInOut' });
                    this.time.delayedCall(320, () => {
                        if (!alive) return;
                        this.tweens.add({ targets: p, scale: (size / TEX_PX) * 1.22, duration: 120, yoyo: true });
                        p.setTint(0xfff3a0);
                        this.sfx.rise(k + 2);
                    });
                });
            });
            this.time.delayedCall(350 + demo.taps.length * 700 + 200, () => {
                if (!alive) return;
                this.tweens.add({ targets: tick, alpha: 1, scale: { from: 0.4, to: 1 }, duration: 260, ease: 'Back.easeOut' });
            });
            this.time.delayedCall(350 + demo.taps.length * 700 + 1500, loop);
        };
        hand.setPosition(w / 2, cy + 190);
        loop();

        const start = () => {
            if (!alive) return;
            alive = false;
            this.tweens.add({ targets: box, alpha: 0, duration: 200, onComplete: () => box.destroy() });
            this.matter.world.resume();
            this.started = true;
            this.sfx.rise(5);
        };
        if (this.bonus) {
            // Short break: the example plays once, then the round starts by itself
            this.time.delayedCall(350 + demo.taps.length * 700 + 900, start);
        } else {
            const btn = chunkyButton(this, w / 2, cy + ch - 40, t('gotIt'), 0x22c55e, start,
                { width: Math.min(220, cw - 40), height: 52, fontSize: 22, depth: 610, delay: 300 });
            box.add(btn);
        }
        box.setAlpha(0);
        this.tweens.add({ targets: box, alpha: 1, duration: 220 });
    }

    // ------------------------------------------------------------------ loop

    update(time, delta) {
        for (const p of this.pieces) {
            p.img.x = p.body.position.x;
            p.img.y = p.body.position.y;
            if (p.junk) p.img.rotation = p.body.angle;
        }
        this.picked.forEach((p, i) => this.rings[i].setVisible(true).setPosition(p.img.x, p.img.y));
        for (let i = this.picked.length; i < this.rings.length; i++) this.rings[i].setVisible(false);

        if (!this.started || this.over || this.paused) return;
        this.remaining -= delta;
        this.drawTime();
        const secs = Math.ceil(this.remaining / 1000);
        if (secs !== this.lastSecs) {
            this.lastSecs = secs;
            if (secs <= 5 && secs > 0) this.sfx.count(1 - secs / 6);
        }
        if (this.remaining <= 0) {
            this.finish();
            return;
        }
        this.spawnAcc += delta;
        if (this.spawnAcc >= SPAWN_MS && this.pieces.length < MAX_PIECES) {
            this.spawnAcc = 0;
            this.spawn();
        }
        this.dangerAcc += delta;
        if (this.dangerAcc >= 200) {
            this.dangerAcc = 0;
            this.overflow();
        }
    }

    // No game over in mini games: pieces that settle above the line just pop
    overflow() {
        for (const p of [...this.pieces]) {
            const settled = p.body.isSleeping || p.body.speed < 0.35;
            if (settled && p.body.position.y - R < this.uiH && !this.picked.includes(p)) {
                this.burst.setParticleTint(p.color);
                this.burst.emitParticleAt(p.img.x, p.img.y, 6);
                this.remove(p);
            }
        }
    }

    // ------------------------------------------------------------------ pieces

    pieceData() {
        if (this.queue.length) return this.queue.shift();
        const d = this.drill;
        if (d.id === 'friends10') {
            const sum = STAGES.friends10[this.stage];
            return { kind: 'num', value: sum === 100 ? between(1, 9) * 10 : between(1, sum - 1) };
        }
        if (d.id === 'times') {
            const nums = STAGES.times[this.stage];
            return { kind: 'num', value: Math.random() < 0.5 ? pick(nums) : between(1, 10) };
        }
        if (d.id === 'doubles') {
            // around the answer, so near misses are on screen too
            const a = this.answer || 10;
            return { kind: 'num', value: Math.max(1, a + between(-6, 6) * (Math.random() < 0.5 ? 1 : 2)) };
        }
        if (d.id === 'multiples') {
            const k = this.k;
            if (Math.random() < 0.45) return { kind: 'num', value: k * between(1, 10) };
            let v;
            do { v = between(1, k * 10); } while (v % k === 0);
            return { kind: 'num', value: v };
        }
        if (d.id === 'primes') {
            const max = STAGES.primes[this.stage];
            const primes = [];
            for (let n = 2; n <= max; n++) if (isPrime(n)) primes.push(n);
            if (Math.random() < 0.45) return { kind: 'num', value: pick(primes) };
            let v;
            do { v = between(1, max); } while (isPrime(v));
            return { kind: 'num', value: v };
        }
        const f = pick(STAGES.pizza[this.stage].pieces);
        return { kind: 'frac', num: f[0], den: f[1] };
    }

    spawn(y) {
        const data = this.pieceData();
        const x = R + 4 + Math.random() * (this.w - 2 * R - 8);
        let key;
        let color;
        if (data.kind === 'num') {
            color = COLORS.numbers[data.value % COLORS.numbers.length];
            key = `drill_n${data.value}`;
            if (!this.textures.exists(key)) bakeLabelPiece(this, key, String(data.value), color);
        } else {
            color = DEN_COLORS[data.den] || 0x9a3412;   // one colour per family: halves, thirds, quarters...
            key = `drill_f${data.num}_${data.den}`;
            if (!this.textures.exists(key)) bakePizzaPiece(this, key, data.num, data.den, color);
        }
        const body = this.matter.add.circle(x, y === undefined ? -R * 2 : y, R, { ...PIECE_BODY, label: 'piece' });
        this.Body.setVelocity(body, { x: Phaser.Math.FloatBetween(-1.2, 1.2), y: 3 });
        const img = this.add.image(x, body.position.y, key).setDepth(10).setScale(INV);
        const p = { ...data, color, body, img, alive: true };
        this.pieces.push(p);
        return p;
    }

    remove(p) {
        if (!p.alive) return;
        p.alive = false;
        this.matter.world.remove(p.body);
        this.tweens.killTweensOf(p.img);
        p.img.destroy();
        this.pieces.splice(this.pieces.indexOf(p), 1);
        const i = this.picked.indexOf(p);
        if (i !== -1) this.picked.splice(i, 1);
        this.pieces.forEach((q) => this.Sleeping.set(q.body, false));
    }

    onField(v) {
        return this.pieces.some((p) => p.kind === 'num' && !p.junk && p.value === v && p.body.position.y > this.uiH);
    }

    // ------------------------------------------------------------------ targets

    newTarget() {
        const d = this.drill;
        this.picked = [];
        this.prompt.setFontSize(28).setY(this.top + 76);
        this.pie.clear();
        if (d.type === 'pair') {
            let a;
            let b;
            if (d.op === '+') {
                const sum = STAGES.friends10[this.stage];
                a = sum === 100 ? between(1, 9) * 10 : between(1, sum - 1);
                b = sum - a;
                this.target = sum;
            } else {
                a = pick(STAGES.times[this.stage]);
                b = between(2, 10);
                this.target = a * b;
            }
            this.showPair();
            this.sub.setText(t('tapTwo'));
            if (!this.onField(a)) this.queue.push({ kind: 'num', value: a });
            if (!this.onField(b) || a === b) this.queue.push({ kind: 'num', value: b });
        } else if (d.type === 'one') {
            const st = STAGES.doubles[this.stage];
            this.kind = pick(st.kinds);
            if (this.kind === 'double') {
                this.n = between(1, st.max);
                this.answer = this.n * 2;
                this.prompt.setText(t('doubleOf', { n: this.n }));
            } else {
                this.n = between(1, st.max) * 2;
                this.answer = this.n / 2;
                this.prompt.setText(t('halfOf', { n: this.n }));
            }
            this.sub.setText(t('tapOne'));
            if (!this.onField(this.answer)) this.queue.unshift({ kind: 'num', value: this.answer });
        } else if (d.rule === 'multiple') {
            this.k = pick(STAGES.multiples[this.stage]);
            this.prompt.setText(t('multiplesOf', { n: this.k }));
            this.sub.setText(`${[1, 2, 3, 4].map((i) => this.k * i).join(', ')}...`);
        } else if (d.rule === 'prime') {
            this.prompt.setText(t('tapPrimes'));
            this.sub.setText('2, 3, 5, 7, 11, 13, 17, 19...');
        } else {
            const f = pick(STAGES.pizza[this.stage].targets);
            this.target = fracValue(f);
            this.queue.push(...fractionSplit(this.stage, this.target).map(([num, den]) => ({ kind: 'frac', num, den })));
            this.drawPies();
        }
        this.tweens.add({ targets: this.prompt, scale: { from: 0.7, to: 1 }, duration: 260, ease: 'Back.easeOut' });
    }

    showPair() {
        const [a, b] = this.picked;
        this.prompt.setText(`${a ? a.value : '?'} ${this.drill.op} ${b ? b.value : '?'} = ${this.target}`);
    }

    sum24() {
        return this.picked.reduce((a, p) => a + fracValue([p.num, p.den]), 0);
    }

    // Pizza HUD: "MAKE HALF A PIZZA", what you have on the left, the target on the right
    drawPies() {
        const g = this.pie;
        g.clear();
        const y = this.top + 84;
        const r = 18;
        const pie = (x, v24, fill) => {
            const wholes = Math.max(1, Math.ceil(v24 / F));
            for (let k = 0; k < wholes; k++) {
                const cx = x + (k - (wholes - 1) / 2) * (r * 2 + 6);
                g.fillStyle(0x1b0f05, 1);
                g.fillCircle(cx, y, r);
                const part = Math.min(F, v24 - k * F);
                if (part > 0) {
                    g.fillStyle(fill, 1);
                    g.slice(cx, y, r - 2, -Math.PI / 2, -Math.PI / 2 + (part / F) * Math.PI * 2, false);
                    g.fillPath();
                }
                g.lineStyle(3, 0xc97a2b, 1);
                g.strokeCircle(cx, y, r);
            }
        };
        const s = this.sum24();
        pie(this.w * 0.24, s, s > this.target ? 0xef4444 : 0x4ade80);
        pie(this.w * 0.76, this.target, 0xffc94a);
        this.prompt.setText(t('makePizza', { w: fracWords(this.target) })).setFontSize(20).setY(this.top + 56);
        this.sub.setText(`${t('youHave')} ${fracLabel(s)}   ·   ${t('target')} ${fracLabel(this.target)}`).setY(this.top + 110);
    }

    // ------------------------------------------------------------------ input

    onDown(pointer, over) {
        if (!this.started || this.over || this.paused || (over && over.length)) return;
        const x = pointer.worldX;
        const y = pointer.worldY;
        if (y < this.uiH) return;
        let best = null;
        let bd = TAP_SQ;
        for (const p of this.pieces) {
            const dx = p.body.position.x - x;
            const dy = p.body.position.y - y;
            const dd = dx * dx + dy * dy;
            if (dd < bd) { bd = dd; best = p; }
        }
        if (!best) return;
        if (best.junk) {
            this.sfx.clank(1.2);
            haptic('tap');
            this.tweens.add({ targets: best.img, scale: 0.9 * INV, duration: 70, yoyo: true });
            return;
        }
        const d = this.drill;
        if (d.type === 'filter') return this.tapFilter(best);
        if (d.type === 'one') {
            if (best.value === this.answer) this.success([best]);
            else {
                const msg = this.kind === 'double'
                    ? t('doubleIs', { n: this.n, a: this.answer }) : t('halfIs', { n: this.n, a: this.answer });
                this.fail(msg);
            }
            return;
        }

        const i = this.picked.indexOf(best);
        if (i !== -1) {
            this.picked.splice(i, 1);
            this.playClick();
            if (d.type === 'fractions') this.drawPies();
            else this.showPair();
            return;
        }
        this.picked.push(best);
        this.playClick();
        this.tweens.add({ targets: best.img, scale: 1.12 * INV, duration: 80, yoyo: true });
        if (d.type === 'pair') {
            this.showPair();
            if (this.picked.length === 2) {
                const [a, b] = this.picked;
                const r = d.op === '+' ? a.value + b.value : a.value * b.value;
                if (r === this.target) this.success(this.picked.slice());
                else this.fail(`${a.value} ${d.op} ${b.value} = ${r}  ≠ ${this.target}`);
            }
        } else {
            this.drawPies();
            const s = this.sum24();
            if (s === this.target) this.success(this.picked.slice());
            else if (s > this.target) {
                const parts = this.picked.map((p) => `${p.num}/${p.den}`);
                const lhs = parts.length > 1 ? `${parts.join(' + ')} = ${fracLabel(s)}` : parts[0];
                this.fail(`${lhs}  > ${fracLabel(this.target)}`);
            }
        }
    }

    // Multiples / primes: the right ones pop, a wrong one turns to steel with an explanation
    tapFilter(p) {
        const prime = this.drill.rule === 'prime';
        const ok = prime ? isPrime(p.value) : p.value % this.k === 0;
        if (ok) {
            this.success([p]);
            return;
        }
        let msg;
        if (prime) {
            const f = smallestFactor(p.value);
            msg = p.value === 1 ? t('oneNotPrime') : `${p.value} = ${f} × ${p.value / f}`;
        } else {
            msg = t('notMultiple', { n: p.value, k: this.k });
        }
        this.fail(msg, true);
        p.junk = true;
        p.hp = 2;
        p.img.setTexture(pieceTextureKey({ type: 'junk', hp: 2 }));
        const { x, y } = p.body.position;
        this.matter.world.remove(p.body);
        p.body = this.matter.add.rectangle(x, y, JUNK_SIDE, JUNK_SIDE,
            { ...PIECE_BODY, density: 0.005, friction: 0.12, chamfer: { radius: 6 }, label: 'piece' });
        this.sfx.clank(0.8);
    }

    playClick() {
        if (settings.get('sfx') && this.cache.audio.exists('clickbutton')) this.sound.play('clickbutton', { volume: 0.5 });
    }

    // ------------------------------------------------------------------ results of a move

    success(list) {
        const now = this.time.now;
        this.combo = now - this.lastOkAt < 5000 ? this.combo + 1 : 1;
        this.lastOkAt = now;
        this.correct++;
        const mult = Math.min(3, 1 + (this.combo - 1) * 0.25);
        const pts = Math.round(this.drill.base * (1 + this.stage * 0.25) * mult);
        this.setScore(this.score + pts);
        this.sfx.rise(this.combo);
        haptic('success');
        if (settings.get('sfx') && this.cache.audio.exists('popSound')) this.sound.play('popSound', { volume: 0.7 });
        const at = list[0].img;
        this.floatText(at.x, at.y - 30, `+${pts}`, '#4ade80');
        if (this.combo >= 3) this.floatText(this.w / 2, this.uiH + 50, `${t('combo')} x${mult}`, '#a855f7', 30);
        list.forEach((p) => {
            this.burst.setParticleTint(p.color);
            this.burst.emitParticleAt(p.img.x, p.img.y, 14);
            this.stars.emitParticleAt(p.img.x, p.img.y, 4);
            this.remove(p);
        });
        this.picked = [];
        // Steel cracks a step with every correct answer
        for (const j of this.pieces.filter((q) => q.junk)) {
            j.hp--;
            if (j.hp <= 0) {
                this.burst.setParticleTint(0x9a9aa8);
                this.burst.emitParticleAt(j.img.x, j.img.y, 12);
                this.sfx.metalBreak();
                this.remove(j);
            } else {
                j.img.setTexture(pieceTextureKey({ type: 'junk', hp: j.hp }));
                this.sfx.clank(1);
            }
        }
        const stageUp = this.correct % PER_STAGE === 0 && this.stage < 2;
        if (stageUp) {
            this.stage++;
            this.floatText(this.w / 2, this.h * 0.42, t('harder'), '#ffd23f', 34);
            this.sfx.fanfare();
        }
        // Filters keep their rule until the stage changes; the others get a new question each time
        if (this.drill.type !== 'filter' || stageUp) this.newTarget();
    }

    fail(explain, keepPicks = false) {
        this.combo = 0;
        this.setScore(this.score - 30);
        haptic('fail');
        if (settings.get('sfx') && this.cache.audio.exists('dropSound')) this.sound.play('dropSound', { volume: 0.7 });
        if (!settings.get('reduceMotion')) this.cameras.main.shake(180, 0.008);
        const y = this.uiH + 46;
        const label = this.add.text(this.w / 2, y, explain, {
            fontFamily: 'Righteous', fontSize: '24px', color: '#ffe4e4', stroke: '#5a0a0a', strokeThickness: 7,
            align: 'center', wordWrap: { width: this.w - 30 }
        }).setOrigin(0.5).setDepth(215).setScale(0.6);
        this.tweens.add({ targets: label, scale: 1, duration: 200, ease: 'Back.easeOut' });
        this.tweens.add({ targets: label, alpha: 0, y: y - 16, delay: 1800, duration: 300, onComplete: () => label.destroy() });
        if (!keepPicks) {
            this.picked = [];
            if (this.drill.type === 'fractions') this.drawPies();
            else if (this.drill.type === 'pair') this.showPair();
        }
    }

    floatText(x, y, msg, color, size = 26) {
        const txt = this.add.text(x, y, msg, {
            fontFamily: 'Righteous', fontSize: `${size}px`, color, stroke: '#1b0f2e', strokeThickness: 6
        }).setOrigin(0.5).setDepth(210).setScale(0.5);
        this.tweens.add({ targets: txt, scale: 1, y: y - 30, duration: 300, ease: 'Back.easeOut' });
        this.tweens.add({ targets: txt, alpha: 0, delay: 700, duration: 300, onComplete: () => txt.destroy() });
    }

    // ------------------------------------------------------------------ pause / end

    pause() {
        if (this.paused || this.over || !this.started) return;
        this.paused = true;
        this.matter.world.pause();
        this.music.pause();
        const m = modal(this, { depth: 700, height: 300, title: t('paused') });
        const opts = { width: Math.min(220, m.panel.w - 48), height: 54, fontSize: 22, depth: m.depth, enter: false };
        m.add(chunkyButton(this, m.panel.cx, m.panel.y + 120, t('resume'), 0x22c55e, () => {
            m.close();
            this.paused = false;
            this.matter.world.resume();
            this.music.resume();
        }, opts));
        m.add(chunkyButton(this, m.panel.cx, m.panel.y + 196, t('training'), 0x8b5cf6, () => this.scene.start('TrainingScene'), opts));
    }

    finish() {
        this.over = true;
        this.matter.world.pause();
        this.rings.forEach((r) => r.setVisible(false));
        this.music.stop();
        this.sfx.fanfare();
        if (this.bonus) {
            this.floatText(this.w / 2, this.h * 0.4, `+${this.score}`, '#ffd23f', 40);
            this.time.delayedCall(700, () => this.floatText(this.w / 2, this.h * 0.4 + 50, t('backToGame'), '#ffffff', 24));
            this.time.delayedCall(1600, () => {
                const gs = this.scene.get('GameScene');
                this.scene.stop();
                if (gs && gs.bonusDone) gs.bonusDone(this.score);
            });
            return;
        }
        const d = this.drill;
        const res = recordDrill(d, this.score);
        const featured = featuredDrill() === d.id;
        const beans = Math.round((this.score / 150) * (featured ? 2 : 1));
        if (beans) addBeans(beans);

        const m = modal(this, { depth: 500, height: 420 });
        const { panel } = m;
        m.add(this.add.text(panel.cx, panel.y + 44, t('timeUp'), {
            fontFamily: 'Righteous', fontSize: '36px', color: '#ffffff', stroke: '#1b0f2e', strokeThickness: 7
        }).setOrigin(0.5).setDepth(m.depth));
        [0, 1, 2].forEach((i) => {
            const s = m.add(this.add.text(panel.cx + (i - 1) * 62, panel.y + 104, '★', {
                fontFamily: 'Arial', fontSize: '54px', color: i < res.stars ? '#ffd23f' : '#3a3458',
                stroke: '#1b0f2e', strokeThickness: 5
            }).setOrigin(0.5).setDepth(m.depth).setScale(0));
            this.tweens.add({
                targets: s, scale: 1, duration: 320, delay: 300 + i * 260, ease: 'Back.easeOut',
                onStart: () => { if (i < res.stars) this.sfx.rise(4 + i * 2); }
            });
        });
        m.add(this.add.text(panel.cx, panel.y + 168, String(this.score), {
            fontFamily: 'Righteous', fontSize: '48px', color: '#FFB347', stroke: '#3b1d00', strokeThickness: 6
        }).setOrigin(0.5).setDepth(m.depth));
        const info = [res.isRecord ? `🏆 ${t('newRecord')}` : `${t('best')}: ${res.best}`];
        if (beans) info.push(`☕ +${beans}${featured ? '  (x2)' : ''}`);
        m.add(this.add.text(panel.cx, panel.y + 216, info.join('   ·   '), {
            fontFamily: 'Righteous', fontSize: '15px', color: '#ffd9a8'
        }).setOrigin(0.5).setDepth(m.depth));
        const idx = DRILLS.indexOf(d);
        if (res.newStars > 0 && res.stars >= 1 && idx < DRILLS.length - 1 && res.stars - res.newStars < 1) {
            m.add(this.add.text(panel.cx, panel.y + 242, `🔓 ${drillText(DRILLS[idx + 1]).title}`, {
                fontFamily: 'Righteous', fontSize: '15px', color: '#4ade80'
            }).setOrigin(0.5).setDepth(m.depth));
        }
        const bw = Math.min(220, panel.w - 48);
        m.add(chunkyButton(this, panel.cx, panel.y + 300, t('restart'), 0x22c55e, () => this.scene.restart({ id: d.id }),
            { width: bw, height: 54, fontSize: 24, depth: m.depth, delay: 900 }));
        m.add(chunkyButton(this, panel.cx, panel.y + 368, t('training'), 0x8b5cf6, () => this.scene.start('TrainingScene'),
            { width: bw, height: 48, fontSize: 21, depth: m.depth, delay: 1000 }));
    }
}
