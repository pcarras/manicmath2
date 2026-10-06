
import { createStarfield } from '../starfield.js';
import { installMode, install, onInstallChange, safeAreaTop } from '../pwa.js';
import { t } from '../i18n.js';
import { isDebug, toggleDebug, settings } from '../settings.js';
import { stats, daily } from '../stats.js';
import { chunkyButton, roundButton, openSettings } from '../ui.js';
import { view, setupCamera } from '../display.js';

export class MenuScene extends Phaser.Scene {
    constructor() {
        super({ key: 'MenuScene' });
    }

    create() {
        setupCamera(this);
        const { w, h } = view(this);
        const top = safeAreaTop();

        createStarfield(this);
        const titleSize = `${Math.min(62, Math.floor((w - 32) / 6.4))}px`;

        // Floating math symbols in background
        const symbols = ['1', '2', '3', '+', '-', '×', '÷', '=', '7', '9'];
        for (let i = 0; i < 12; i++) {
            const sym = this.add.text(
                Phaser.Math.Between(20, w - 20),
                Phaser.Math.Between(50, h - 50),
                Phaser.Utils.Array.GetRandom(symbols),
                {
                    fontFamily: 'Righteous',
                    fontSize: Phaser.Math.Between(18, 36) + 'px',
                    color: '#ffffff'
                }
            ).setOrigin(0.5).setAlpha(0.04).setDepth(0);

            this.tweens.add({
                targets: sym,
                y: sym.y - Phaser.Math.Between(30, 80),
                alpha: 0.08,
                duration: Phaser.Math.Between(3000, 6000),
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut',
                delay: Phaser.Math.Between(0, 3000)
            });
        }

        // Chunky outlined title with a soft glow behind it
        const titleY = top + h * 0.2;
        const titleGlow = this.add.text(w / 2, titleY, 'MANIC MATH', {
            fontFamily: 'Righteous',
            fontSize: titleSize,
            color: '#6366f1',
            shadow: { offsetX: 0, offsetY: 0, color: '#6366f1', blur: 30, fill: true }
        }).setOrigin(0.5).setAlpha(0.4).setDepth(1);

        const title = this.add.text(w / 2, titleY, 'MANIC MATH', {
            fontFamily: 'Righteous',
            fontSize: titleSize,
            color: '#ffffff',
            stroke: '#1b0f2e',
            strokeThickness: 8,
            shadow: { offsetX: 0, offsetY: 6, color: '#7b2cbf', blur: 0, fill: true, stroke: true }
        }).setOrigin(0.5).setDepth(2);

        title.setScale(0.3).setAlpha(0);
        titleGlow.setScale(0.3).setAlpha(0);
        this.tweens.add({
            targets: [title, titleGlow],
            scaleX: 1, scaleY: 1, alpha: { getEnd: (target) => (target === title ? 1 : 0.4) },
            duration: 600,
            ease: 'Back.easeOut'
        });
        this.tweens.add({
            targets: titleGlow, alpha: 0.6, duration: 2000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: 600
        });

        const subtitle = this.add.text(w / 2, titleY + h * 0.08, t('subtitle'), {
            fontFamily: 'Roboto',
            fontSize: '19px',
            color: '#a5a8dd'
        }).setOrigin(0.5).setDepth(2).setAlpha(0);
        this.tweens.add({ targets: subtitle, alpha: 1, duration: 500, delay: 400 });

        // Personal best
        const best = stats.get().best;
        if (best > 0) {
            const bestText = this.add.text(w / 2, titleY + h * 0.08 + 32, `🏆 ${t('best')}  ${best}`, {
                fontFamily: 'Righteous', fontSize: '18px', color: '#ffd23f', stroke: '#1b0f2e', strokeThickness: 5
            }).setOrigin(0.5).setDepth(2).setAlpha(0);
            this.tweens.add({ targets: bestText, alpha: 1, duration: 500, delay: 500 });
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

        // Main buttons
        const go = (key, data) => () => {
            this.cameras.main.fade(250, 0, 0, 0, false, (cam, progress) => {
                if (progress === 1) this.scene.start(key, typeof data === 'function' ? data() : data);
            });
        };
        const bw = Math.min(250, w - 64);
        let y = top + h * 0.42;
        const gap = Math.min(84, (h - 60 - y) / 3.7);
        chunkyButton(this, w / 2, y, t('play'), 0x22c55e,
            go('GameScene', () => ({ tutorial: !settings.get('tutorialDone') })), { width: bw, height: 70, fontSize: 32, delay: 200 });
        y += gap + 10;

        // Daily challenge, with today's best underneath
        chunkyButton(this, w / 2, y, t('daily'), 0xa855f7, go('GameScene', { daily: true }),
            { width: bw, height: 56, fontSize: 21, delay: 280 });
        const todayBest = daily.best();
        this.add.text(w / 2, y + 40, `${t('today')}: ${todayBest > 0 ? todayBest : '—'}`, {
            fontFamily: 'Righteous', fontSize: '13px', color: '#c4a7ff'
        }).setOrigin(0.5).setDepth(10);
        y += gap + 8;

        chunkyButton(this, w / 2, y, t('tutorial'), 0xf59e0b, go('GameScene', { tutorial: true }),
            { width: bw, height: 54, fontSize: 22, delay: 340 });
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
                    { width: bw, height: 54, fontSize: 22, delay: 440 });
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
}
