
import { createStarfield } from '../starfield.js';
import { installMode, install, onInstallChange, safeAreaTop } from '../pwa.js';
import { t } from '../i18n.js';
import { isDebug, toggleDebug, settings } from '../settings.js';
import { stats, daily } from '../stats.js';
import { chunkyButton, roundButton, openSettings, modal } from '../ui.js';
import { view, setupCamera } from '../display.js';
import { beans, onProgressChange, streakInfo, missions, missionText } from '../progress.js';
import { modeBest } from '../stats.js';
import { syncBests } from '../ranking.js';
import { ensureTextures } from '../textures.js';
import { createTitle, createPieceRain } from '../title.js';

export class MenuScene extends Phaser.Scene {
    constructor() {
        super({ key: 'MenuScene' });
    }

    create() {
        setupCamera(this);
        const { w, h } = view(this);
        const top = safeAreaTop();

        createStarfield(this);
        syncBests();
        ensureTextures(this);
        const calm = settings.get('reduceMotion');
        if (!calm) createPieceRain(this, w, h);

        // Animated title: the full drop-in plays once per session, later visits just fade in
        const size = Math.min(84, Math.floor((w - 40) / 4.3), Math.floor(h * 0.105));
        const short = h < 720;   // small screens drop the subtitle to keep the buttons roomy
        const firstTime = !this.registry.get('titleShown');
        this.registry.set('titleShown', true);
        const titleBottom = createTitle(this, w / 2, top + Math.max(short ? 82 : 92, h * 0.13), size, { intro: firstTime, calm });

        const subtitle = this.add.text(w / 2, titleBottom + 14, t('subtitle'), {
            fontFamily: 'Roboto',
            fontSize: '18px',
            color: '#c4c6f5'
        }).setOrigin(0.5).setDepth(3).setAlpha(0);
        if (short) subtitle.setVisible(false);
        else this.tweens.add({ targets: subtitle, alpha: 1, duration: 500, delay: firstTime ? 1100 : 200 });
        let contentBottom = short ? titleBottom - 6 : titleBottom + 26;

        // Personal best
        const best = stats.get().best;
        if (best > 0) {
            const bestText = this.add.text(w / 2, short ? titleBottom + 14 : titleBottom + 44, `🏆 ${t('best')}  ${best}`, {
                fontFamily: 'Righteous', fontSize: '18px', color: '#ffd23f', stroke: '#1b0f2e', strokeThickness: 5
            }).setOrigin(0.5).setDepth(3).setAlpha(0);
            this.tweens.add({ targets: bestText, alpha: 1, duration: 500, delay: firstTime ? 1200 : 250 });
            contentBottom = short ? titleBottom + 26 : titleBottom + 56;
        }

        // Achievements (top left)
        roundButton(this, 34, top + 34, 'trophy', () => {
            this.cameras.main.fade(200, 0, 0, 0, false, (cam, progress) => {
                if (progress === 1) this.scene.start('AchievementsScene');
            });
        }, { radius: 20, depth: 20, color: 0xb45309 });

        // Settings (top right)
        roundButton(this, w - 34, top + 34, 'gear', () => {
            openSettings(this, { onClose: (langChanged) => { if (langChanged) this.scene.restart(); } });
        }, { radius: 20, depth: 20 });

        // Coffee beans (top centre)
        const pill = this.add.graphics().setDepth(19);
        pill.fillStyle(0x2b160b, 0.92);
        pill.fillRoundedRect(w / 2 - 54, top + 18, 108, 32, 16);
        pill.lineStyle(2, 0xc68a4a, 0.9);
        pill.strokeRoundedRect(w / 2 - 54, top + 18, 108, 32, 16);
        const beansText = this.add.text(w / 2, top + 34, `☕ ${beans()}`, {
            fontFamily: 'Righteous', fontSize: '18px', color: '#ffd9a8'
        }).setOrigin(0.5).setDepth(20);
        const offBeans = onProgressChange(() => {
            if (beansText.active) beansText.setText(`☕ ${beans()}`);
        });

        // Main buttons
        const go = (key, data) => () => {
            this.cameras.main.fade(250, 0, 0, 0, false, (cam, progress) => {
                if (progress === 1) this.scene.start(key, typeof data === 'function' ? data() : data);
            });
        };
        this.go = go;
        const bw = Math.min(250, w - 64);
        let y = Math.max(top + h * 0.4, contentBottom + 46);
        const gap = Math.min(80, (h - 70 - y) / 4.6);
        const playBtn = chunkyButton(this, w / 2, y, t('play'), 0x22c55e,
            go('GameScene', () => ({ tutorial: !settings.get('tutorialDone') })), { width: bw, height: 66, fontSize: 32, delay: 200 });
        // The main call to action breathes gently
        if (!calm) this.tweens.add({ targets: playBtn, scale: 1.045, duration: 900, yoyo: true, repeat: -1, delay: 1400, ease: 'Sine.easeInOut' });
        y += gap + 8;

        // Daily challenge, with the streak and today's best underneath
        chunkyButton(this, w / 2, y, t('daily'), 0xa855f7, go('GameScene', { daily: true }),
            { width: bw, height: 54, fontSize: 21, delay: 280 });
        const todayBest = daily.best();
        const st = streakInfo();
        const flame = st.count > 0 ? `🔥 ${st.count}${st.doneToday ? ' ✓' : ''}   ·   ` : '';
        this.add.text(w / 2, y + 39, `${flame}${t('today')}: ${todayBest > 0 ? todayBest : '—'}`, {
            fontFamily: 'Righteous', fontSize: '13px', color: st.count > 0 && !st.doneToday ? '#ffb238' : '#c4a7ff'
        }).setOrigin(0.5).setDepth(10);
        y += gap + 8;

        chunkyButton(this, w / 2, y, t('modes'), 0xf59e0b, () => this.openModes(),
            { width: bw, height: 50, fontSize: 22, delay: 340 });
        y += gap - 4;

        // Missions / shop / ranking row
        const third = (bw - 16) / 3;
        const left = w / 2 - bw / 2 + third / 2;
        const done = missions().filter((m) => m.done).length;
        const missionsBtn = chunkyButton(this, left, y, `${t('missions')}`, 0x0d9488, () => this.openMissions(),
            { width: third, height: 44, fontSize: third < 80 ? 12 : 14, delay: 380 });
        if (done < 3) {
            const dot = this.add.circle(left + third / 2 - 6, y - 20, 9, 0xef4444).setDepth(12).setStrokeStyle(2, 0x140a24);
            const n = this.add.text(dot.x, dot.y, String(3 - done), { fontFamily: 'Righteous', fontSize: '12px', color: '#fff' })
                .setOrigin(0.5).setDepth(13);
            missionsBtn.once('destroy', () => { dot.destroy(); n.destroy(); });
        }
        chunkyButton(this, left + third + 8, y, t('shop'), 0xc2410c, go('ShopScene'),
            { width: third, height: 44, fontSize: third < 80 ? 12 : 14, delay: 420 });
        chunkyButton(this, left + 2 * (third + 8), y, t('ranking'), 0x6366f1, go('RankingScene'),
            { width: third, height: 44, fontSize: third < 80 ? 12 : 14, delay: 460 });
        y += gap;

        // Install / fullscreen: only when the browser can actually do it
        this.installBtn = null;
        const installY = y;
        const refreshInstall = () => {
            const mode = installMode();
            const label = mode === 'fullscreen' ? t('fullscreen') : t('install');
            if (this.installBtn && (!mode || this.installBtn.labelText !== label)) {
                this.installBtn.destroy();
                this.installBtn = null;
            }
            if (mode && !this.installBtn) {
                this.installBtn = chunkyButton(this, w / 2, installY, label, 0x0ea5e9, () => install(),
                    { width: bw, height: 46, fontSize: 19, delay: 500 });
                this.installBtn.labelText = label;
            }
        };
        refreshInstall();
        const offInstall = onInstallChange(refreshInstall);

        // Developer tools stay hidden from players (see settings.js)
        if (isDebug()) {
            chunkyButton(this, w / 2, y + gap, 'TEST PERF', 0x64748b, go('TestScene'), { width: bw, height: 48, fontSize: 20, delay: 560 });
        }

        // Rebuild the layout when the window size changes (fullscreen, rotation, address bar)
        let resizeTimer = null;
        const onResize = () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => this.scene.restart(), 250);
        };
        this.scale.on('resize', onResize);
        this.events.once('shutdown', () => {
            offInstall();
            offBeans();
            clearTimeout(resizeTimer);
            this.scale.off('resize', onResize);
        });

        // Version + studio. 5 quick taps toggle debug mode.
        const version = this.add.text(w / 2, h - 30, `v${self.APP_VERSION} · Bica Games ☕`, {
            fontFamily: 'Roboto',
            fontSize: '13px',
            color: '#55557a'
        }).setOrigin(0.5).setDepth(2).setPadding(12, 8).setInteractive();
        let taps = 0;
        let tapTimer = null;
        version.on('pointerdown', () => {
            taps++;
            clearTimeout(tapTimer);
            tapTimer = setTimeout(() => { taps = 0; }, 1200);
            if (taps >= 5) {
                taps = 0;
                const on = toggleDebug();
                const note = this.add.text(w / 2, h - 60, on ? t('debugOn') : t('debugOff'), {
                    fontFamily: 'Righteous', fontSize: '16px', color: '#00ff88'
                }).setOrigin(0.5).setDepth(30);
                this.time.delayedCall(900, () => this.scene.restart());
                this.tweens.add({ targets: note, alpha: 0, delay: 600, duration: 300 });
            }
        });
    }

    // Game modes: classic, zen, sprint and the tutorial
    openModes() {
        const rows = [
            ['classic', 'classicDesc', 0x22c55e, () => ({ mode: 'classic' })],
            ['zen', 'zenDesc', 0x0d9488, () => ({ mode: 'zen' })],
            ['sprint', 'sprintDesc', 0xef4444, () => ({ mode: 'sprint' })],
            ['tutorial', 'howToDesc', 0xf59e0b, () => ({ tutorial: true })]
        ];
        const m = modal(this, { depth: 700, height: 96 + rows.length * 84 + 70, title: t('modes') });
        const { panel } = m;
        let y = panel.y + 104;
        const sprintBest = modeBest.get('sprint');
        rows.forEach(([key, desc, color, data]) => {
            m.add(chunkyButton(this, panel.cx, y, t(key), color, () => { m.close(); this.go('GameScene', data)(); },
                { width: Math.min(240, panel.w - 48), height: 46, fontSize: 20, depth: m.depth, enter: false }));
            let sub = t(desc);
            if (key === 'sprint' && sprintBest > 0) sub += `  ·  🏆 ${sprintBest}`;
            m.add(this.add.text(panel.cx, y + 36, sub, {
                fontFamily: 'Roboto', fontSize: '13px', color: '#c9c7ee', align: 'center', wordWrap: { width: panel.w - 40 }
            }).setOrigin(0.5).setDepth(m.depth));
            y += 84;
        });
        m.add(chunkyButton(this, panel.cx, panel.y + panel.h - 40, t('close'), 0x6366f1, () => m.close(),
            { width: 160, height: 44, fontSize: 20, depth: m.depth, enter: false }));
    }

    // Today's missions + the streak calendar (last 7 days)
    openMissions() {
        const list = missions();
        const m = modal(this, { depth: 700, height: 520, title: t('missionsToday') });
        const { panel } = m;
        const d = m.depth;
        let y = panel.y + 92;
        const barW = panel.w - 120;
        list.forEach((mi) => {
            m.add(this.add.text(panel.x + 26, y, missionText(mi), {
                fontFamily: 'Righteous', fontSize: '16px', color: mi.done ? '#4ade80' : '#ffffff',
                wordWrap: { width: panel.w - 110 }
            }).setOrigin(0, 0.5).setDepth(d));
            m.add(this.add.text(panel.x + panel.w - 26, y, mi.done ? '✓' : `+${mi.beans} ☕`, {
                fontFamily: 'Righteous', fontSize: mi.done ? '22px' : '15px', color: mi.done ? '#4ade80' : '#e8b878'
            }).setOrigin(1, 0.5).setDepth(d));
            const g = m.add(this.add.graphics().setDepth(d));
            g.fillStyle(0x2a1c52, 1);
            g.fillRoundedRect(panel.x + 26, y + 16, barW, 8, 4);
            const f = Math.min(1, mi.progress / mi.n);
            if (f > 0) {
                g.fillStyle(mi.done ? 0x4ade80 : 0xffd23f, 1);
                g.fillRoundedRect(panel.x + 26, y + 16, Math.max(8, barW * f), 8, 4);
            }
            m.add(this.add.text(panel.x + 30 + barW, y + 20, `${Math.min(mi.progress, mi.n)}/${mi.n}`, {
                fontFamily: 'Roboto', fontSize: '11px', color: '#a5a8ff'
            }).setOrigin(0, 0.5).setDepth(d));
            y += 62;
        });

        // Streak: 7 cups, oldest to today
        const st = streakInfo();
        y += 6;
        m.add(this.add.text(panel.cx, y, `🔥 ${t('streak')}: ${t('streakDays', { n: st.count })}`, {
            fontFamily: 'Righteous', fontSize: '19px', color: '#ffb238'
        }).setOrigin(0.5).setDepth(d));
        y += 44;
        const today = new Date();
        const cupGap = Math.min(40, (panel.w - 40) / 7);
        const x0 = panel.cx - cupGap * 3;
        const names = t('weekdays');
        for (let i = 0; i < 7; i++) {
            const day = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - (6 - i)));
            const key = day.toISOString().slice(0, 10);
            const full = st.days.includes(key);
            const x = x0 + i * cupGap;
            const g = m.add(this.add.graphics().setDepth(d));
            this.drawCup(g, x, y, full, i === 6);
            m.add(this.add.text(x, y + 22, names[(day.getUTCDay() + 6) % 7], {
                fontFamily: 'Roboto', fontSize: '11px', color: i === 6 ? '#ffd23f' : '#8a84b0'
            }).setOrigin(0.5).setDepth(d));
        }
        y += 50;
        m.add(this.add.text(panel.cx, y, `${t('streakBest', { n: st.best })}   ·   ${t('spares', { n: st.freezes })}`, {
            fontFamily: 'Roboto', fontSize: '13px', color: '#c9c7ee'
        }).setOrigin(0.5).setDepth(d));
        m.add(this.add.text(panel.cx, y + 20, t('spareHelp'), {
            fontFamily: 'Roboto', fontSize: '11px', color: '#8a84b0', align: 'center', wordWrap: { width: panel.w - 40 }
        }).setOrigin(0.5).setDepth(d));
        m.add(chunkyButton(this, panel.cx, panel.y + panel.h - 40, t('close'), 0x6366f1, () => m.close(),
            { width: 160, height: 44, fontSize: 20, depth: d, enter: false }));
    }

    // Little espresso cup: full (coffee + crema) when that day's challenge was done
    drawCup(g, x, y, full, isToday) {
        g.lineStyle(2, isToday ? 0xffd23f : 0xf4efe6, full ? 1 : 0.45);
        g.fillStyle(full ? 0xf4efe6 : 0x1b1238, 1);
        g.fillRoundedRect(x - 11, y - 9, 22, 18, { tl: 2, tr: 2, bl: 8, br: 8 });
        g.strokeRoundedRect(x - 11, y - 9, 22, 18, { tl: 2, tr: 2, bl: 8, br: 8 });
        g.strokeCircle(x + 13, y - 2, 4);
        if (full) {
            g.fillStyle(0x3b1e0e, 1);
            g.fillRect(x - 9, y - 7, 18, 4);
            g.fillStyle(0xc68a4a, 1);
            g.fillRect(x - 9, y - 7, 18, 2);
        }
    }
}
