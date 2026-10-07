import { createStarfield } from '../starfield.js';
import { safeAreaTop } from '../pwa.js';
import { t, lang } from '../i18n.js';
import { chunkyButton, modal } from '../ui.js';
import { RES, view, setupCamera } from '../display.js';
import { analysis, tipFor, resetAnalysis } from '../analysis.js';
import { DRILLS, drillText } from '../drills.js';
import { preloadMascot, addMascot } from '../mascot.js';

const OP_COLOR = { '+': 0x8b5cf6, '-': 0x10b981, '×': 0xf97316, '÷': 0x3b82f6 };
const pct = (r) => (r === null || r === undefined ? '—' : `${Math.round(r * 100)}%`);

// ANÁLISE: how the player is doing across the main game and the mini games, which kinds of
// mistakes come up most, which times-table facts to review, and a tip for what to practise.
export class AnalysisScene extends Phaser.Scene {
    constructor() {
        super({ key: 'AnalysisScene' });
    }

    preload() {
        preloadMascot(this, ['think']);
    }

    create() {
        setupCamera(this);
        const { w, h } = view(this);
        const top = safeAreaTop();
        this.w = w;
        createStarfield(this);
        this.children.list.forEach((o) => o.setScrollFactor(0));
        const a = analysis();
        const pt = lang() === 'pt';
        const cw = w - 28;
        let y = top + 96;

        const card = (height, color = 0x3a3458) => {
            const g = this.add.graphics();
            g.fillStyle(0x17112e, 0.95);
            g.fillRoundedRect(14, y, cw, height, 18);
            g.lineStyle(2, color, 1);
            g.strokeRoundedRect(14, y, cw, height, 18);
            return y;
        };
        const title = (text, yy) => this.add.text(30, yy, text, { fontFamily: 'Righteous', fontSize: '17px', color: '#ffd23f' }).setOrigin(0, 0.5);
        const small = (x, yy, text, color = '#c4c6f5', size = 13, origin = 0) => this.add.text(x, yy, text, {
            fontFamily: 'Roboto', fontSize: `${size}px`, color, wordWrap: { width: cw - 40 }
        }).setOrigin(origin, 0.5);

        if (a.total.ok + a.total.bad === 0) {
            card(120);
            this.add.text(w / 2, y + 60, t('analysisEmpty'), {
                fontFamily: 'Righteous', fontSize: '18px', color: '#ffffff', align: 'center', wordWrap: { width: cw - 40 }
            }).setOrigin(0.5);
            y += 140;
        } else {
            // Summary: accuracy, how many answers, this week vs last week
            const y0 = card(150, 0x22c55e);
            this.add.text(30, y0 + 46, pct(a.rate), {
                fontFamily: 'Righteous', fontSize: '50px', color: '#4ade80', stroke: '#1b0f2e', strokeThickness: 6
            }).setOrigin(0, 0.5);
            small(150, y0 + 32, t('analysisRight'), '#ffffff', 15);
            small(150, y0 + 54, t('analysisAnswers', { n: a.total.ok + a.total.bad }), '#c4c6f5', 13);
            const trend = a.thisWeek !== null && a.lastWeek !== null
                ? `${t('analysisWeek')} ${pct(a.thisWeek)}  ·  ${t('analysisLastWeek')} ${pct(a.lastWeek)} ${a.thisWeek > a.lastWeek + 0.02 ? '↑' : a.thisWeek < a.lastWeek - 0.02 ? '↓' : '='}`
                : `${t('analysisWeek')} ${pct(a.thisWeek)}`;
            small(30, y0 + 92, trend, '#ffd9a8', 13);
            // Last 7 days: one bar per day, green part = right answers
            const bx = 30;
            const bw = (cw - 32) / 7;
            const maxN = Math.max(1, ...a.last7.map((d) => d.ok + d.bad));
            const g = this.add.graphics();
            a.last7.forEach((d, i) => {
                const n = d.ok + d.bad;
                const hh = (n / maxN) * 26;
                const x = bx + i * bw;
                g.fillStyle(0x3a3458, 1);
                g.fillRect(x + 3, y0 + 140 - 26, bw - 6, 26);
                if (n) {
                    g.fillStyle(0xef4444, 0.9);
                    g.fillRect(x + 3, y0 + 140 - hh, bw - 6, hh);
                    g.fillStyle(0x22c55e, 1);
                    g.fillRect(x + 3, y0 + 140 - hh, bw - 6, hh * (d.ok / n));
                }
            });
            y += 162;

            // By operation
            const y1 = card(46 + 4 * 34);
            title(t('analysisOps'), y1 + 22);
            a.ops.forEach((o, i) => {
                const yy = y1 + 52 + i * 34;
                const n = o.ok + o.bad;
                this.add.text(36, yy, o.op === '-' ? '−' : o.op, { fontFamily: 'Righteous', fontSize: '22px', color: '#ffffff' }).setOrigin(0.5);
                const barX = 58;
                const barW = cw - 150;
                const g2 = this.add.graphics();
                g2.fillStyle(0x2a2448, 1);
                g2.fillRoundedRect(barX, yy - 8, barW, 16, 8);
                if (n) {
                    g2.fillStyle(OP_COLOR[o.op], 1);
                    g2.fillRoundedRect(barX, yy - 8, Math.max(16, barW * o.rate), 16, 8);
                }
                small(barX + barW + 10, yy, n ? `${pct(o.rate)} · ${n}` : '—', '#ffffff', 13);
            });
            y += 46 + 4 * 34 + 12;

            // Most common kinds of mistakes, explained
            if (a.kinds.length) {
                const list = a.kinds.slice(0, 4);
                const hgt = 46 + list.length * 52;
                const y2 = card(hgt, 0xef4444);
                title(t('analysisMistakes'), y2 + 22);
                list.forEach((k, i) => {
                    const yy = y2 + 50 + i * 52;
                    this.add.text(30, yy, `${t(`mk_${k.kind}`)}  ×${k.n}`, { fontFamily: 'Righteous', fontSize: '15px', color: '#ffb4b4' }).setOrigin(0, 0.5);
                    small(30, yy + 20, t(`mkx_${k.kind}`), '#c4c6f5', 12);
                });
                y += hgt + 12;
            }

            // Times-table facts to review
            if (a.facts.length) {
                const y3 = card(92, 0xf97316);
                title(t('analysisFacts'), y3 + 22);
                const chipW = (cw - 40) / Math.min(6, a.facts.length);
                a.facts.forEach((f, i) => {
                    const x = 30 + i * chipW;
                    const g3 = this.add.graphics();
                    g3.fillStyle(0xf97316, 0.25);
                    g3.fillRoundedRect(x, y3 + 44, chipW - 8, 34, 10);
                    this.add.text(x + (chipW - 8) / 2, y3 + 61, f.fact, { fontFamily: 'Righteous', fontSize: '16px', color: '#ffffff' }).setOrigin(0.5);
                });
                y += 104;
            }

            // Mini games
            const played = a.drills.filter((d) => d.ok + d.bad > 0);
            if (played.length) {
                const hgt = 46 + played.length * 46;
                const y4 = card(hgt, 0x0ea5e9);
                title(t('analysisDrills'), y4 + 22);
                played.forEach((d, i) => {
                    const yy = y4 + 52 + i * 46;
                    const def = DRILLS.find((x) => x.id === d.id);
                    this.add.text(30, yy - 6, def ? drillText(def).title : d.id, { fontFamily: 'Righteous', fontSize: '15px', color: '#ffffff' }).setOrigin(0, 0.5);
                    small(cw - 2, yy - 6, `${pct(d.rate)} · ${d.ok + d.bad}`, '#ffd9a8', 13, 1);
                    if (d.hard.length) small(30, yy + 13, `${t('analysisHard')}: ${d.hard.map((it) => this.itemLabel(d.id, it, pt)).join(', ')}`, '#c4c6f5', 12);
                });
                y += hgt + 12;
            }

            // Tip
            const tip = tipFor(a);
            const y5 = card(110, 0xffd23f);
            title(t('analysisTip'), y5 + 22);
            this.add.text(30, y5 + 42, tip, {
                fontFamily: 'Roboto', fontSize: '14px', color: '#ffffff', wordWrap: { width: cw - 110 }, lineSpacing: 3
            });
            addMascot(this, w - 62, y5 + 104, 'think', { height: 92, depth: 5 });
            y += 122;

            chunkyButton(this, w / 2, y + 26, t('analysisReset'), 0x4b4566, () => this.confirmReset(),
                { width: 200, height: 40, fontSize: 15, enter: false });
            y += 60;
        }

        // Fixed header and footer
        const header = this.add.graphics().setScrollFactor(0).setDepth(50);
        header.fillStyle(0x0b0620, 0.96);
        header.fillRect(0, 0, w, top + 84);
        header.lineStyle(2, 0x0d9488, 0.6);
        header.lineBetween(0, top + 84, w, top + 84);
        this.add.text(w / 2, top + 32, t('analysis'), {
            fontFamily: 'Righteous', fontSize: '30px', color: '#ffd23f', stroke: '#1b0f2e', strokeThickness: 6
        }).setOrigin(0.5).setScrollFactor(0).setDepth(51);
        this.add.text(w / 2, top + 64, t('analysisSub'), {
            fontFamily: 'Roboto', fontSize: '13px', color: '#c4c6f5'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(51);
        const footer = this.add.graphics().setScrollFactor(0).setDepth(50);
        footer.fillStyle(0x0b0620, 0.96);
        footer.fillRect(0, h - 92, w, 92);
        chunkyButton(this, w / 2, h - 50, t('back'), 0x6366f1, () => this.scene.start('MenuScene'),
            { width: 180, height: 50, fontSize: 22, depth: 52 }).setScrollFactor(0);

        const cam = this.cameras.main;
        const maxScroll = Math.max(0, y + 100 - h);
        let start = 0;
        this.input.on('pointerdown', () => { start = cam.scrollY; });
        this.input.on('pointermove', (p) => {
            if (p.isDown) cam.scrollY = Phaser.Math.Clamp(start - (p.y - p.downY) / RES, 0, maxScroll);
        });
        this.input.on('wheel', (p, o, dx, dy) => { cam.scrollY = Phaser.Math.Clamp(cam.scrollY + dy * 0.5, 0, maxScroll); });
    }

    // Readable label for a mini-game item saved by DrillScene.drillItem()
    itemLabel(id, item, pt) {
        if (item.startsWith('double:')) return `${pt ? 'dobro de' : 'double'} ${item.slice(7)}`;
        if (item.startsWith('half:')) return `${pt ? 'metade de' : 'half of'} ${item.slice(5)}`;
        if (item.startsWith('×')) return `${pt ? 'múltiplos de' : 'multiples of'} ${item.slice(1)}`;
        if (item.startsWith('=')) return `${pt ? 'fazer' : 'make'} ${item.slice(1)}`;
        return item;
    }

    confirmReset() {
        const m = modal(this, { depth: 700, height: 220, title: t('analysisReset') });
        m.objs.forEach((o) => o.setScrollFactor(0));
        const { panel, depth } = m;
        const bw = Math.min(120, (panel.w - 60) / 2);
        m.add(chunkyButton(this, panel.cx - bw / 2 - 8, panel.y + panel.h - 50, t('no'), 0x6366f1, () => m.close(),
            { width: bw, height: 46, fontSize: 19, depth, enter: false }).setScrollFactor(0));
        m.add(chunkyButton(this, panel.cx + bw / 2 + 8, panel.y + panel.h - 50, t('yes'), 0xef4444, () => {
            resetAnalysis();
            this.scene.restart();
        }, { width: bw, height: 46, fontSize: 19, depth, enter: false }).setScrollFactor(0));
    }
}
