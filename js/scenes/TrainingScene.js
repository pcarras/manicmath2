import { createStarfield } from '../starfield.js';
import { safeAreaTop } from '../pwa.js';
import { t } from '../i18n.js';
import { chunkyButton } from '../ui.js';
import { RES, view, setupCamera } from '../display.js';
import { ensureTextures, bakeLabelPiece, bakePizzaPiece, TEX_PX } from '../textures.js';
import { DRILLS, drillText, drillProgress, isUnlocked, featuredDrill } from '../drills.js';

const CARD_H = 100;

// TREINO: the mini games with school year, stars, best score and today's featured one.
// The list scrolls (drag or wheel); the header and the back button stay fixed.
export class TrainingScene extends Phaser.Scene {
    constructor() {
        super({ key: 'TrainingScene' });
    }

    create() {
        setupCamera(this);
        const { w, h } = view(this);
        const top = safeAreaTop();
        const cam = this.cameras.main;
        ensureTextures(this);
        createStarfield(this);
        this.children.list.forEach((o) => o.setScrollFactor(0));

        const featured = featuredDrill();
        const listTop = top + 112;
        DRILLS.forEach((d, i) => {
            const y = listTop + i * CARD_H;
            const open = isUnlocked(i);
            const prog = drillProgress(d.id);
            const txt = drillText(d);
            const cardH = CARD_H - 10;
            const cy = y + cardH / 2;
            const g = this.add.graphics();
            g.fillStyle(open ? 0x1d1440 : 0x120d26, 0.95);
            g.fillRoundedRect(14, y, w - 28, cardH, 18);
            g.lineStyle(2, open ? d.color : 0x2a2448, 1);
            g.strokeRoundedRect(14, y, w - 28, cardH, 18);

            const key = `drill_icon_${d.id}`;
            if (!this.textures.exists(key)) {
                if (d.type === 'fractions') bakePizzaPiece(this, key, 1, 2, 0xe63946);
                else bakeLabelPiece(this, key, d.icon, d.color);
            }
            this.add.image(50, cy, key).setScale(54 / TEX_PX).setAlpha(open ? 1 : 0.35);

            this.add.text(86, cy - 24, txt.title, {
                fontFamily: 'Righteous', fontSize: '18px', color: open ? '#ffffff' : '#6d6890'
            }).setOrigin(0, 0.5);
            this.add.text(86, cy - 2, txt.grade, {
                fontFamily: 'Roboto', fontSize: '12px', color: open ? '#a5a8ff' : '#55507a'
            }).setOrigin(0, 0.5);
            this.add.text(86, cy + 20, open ? `${'★'.repeat(prog.stars)}${'☆'.repeat(3 - prog.stars)}   ${t('best')}: ${prog.best}` : `🔒 ${t('unlockHint')}`, {
                fontFamily: 'Righteous', fontSize: '13px', color: open ? '#ffd23f' : '#6d6890'
            }).setOrigin(0, 0.5);
            if (open) {
                chunkyButton(this, w - 58, cy - 6, t('go'), 0x22c55e, () => this.scene.start('DrillScene', { id: d.id }),
                    { width: 70, height: 38, fontSize: 17, delay: 120 + i * 60 });
                if (d.id === featured) {
                    const badge = this.add.text(w - 58, cy + 28, t('featured'), {
                        fontFamily: 'Righteous', fontSize: '11px', color: '#2b160b', backgroundColor: '#ffd23f', padding: { x: 5, y: 2 }
                    }).setOrigin(0.5).setDepth(5);
                    this.tweens.add({ targets: badge, scale: 1.08, duration: 600, yoyo: true, repeat: -1 });
                }
            }
        });
        const listBottom = listTop + DRILLS.length * CARD_H;
        this.add.text(w / 2, listBottom + 10, t('moreSoon'), {
            fontFamily: 'Roboto', fontSize: '13px', color: '#8a84b0'
        }).setOrigin(0.5);

        // Fixed header
        const header = this.add.graphics().setScrollFactor(0).setDepth(50);
        header.fillStyle(0x0b0620, 0.96);
        header.fillRect(0, 0, w, top + 100);
        header.lineStyle(2, 0x6366f1, 0.5);
        header.lineBetween(0, top + 100, w, top + 100);
        this.add.text(w / 2, top + 38, t('training'), {
            fontFamily: 'Righteous', fontSize: '34px', color: '#ffd23f', stroke: '#1b0f2e', strokeThickness: 6
        }).setOrigin(0.5).setScrollFactor(0).setDepth(51);
        this.add.text(w / 2, top + 74, t('trainingSub'), {
            fontFamily: 'Roboto', fontSize: '14px', color: '#c4c6f5'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(51);

        // Fixed footer
        const footer = this.add.graphics().setScrollFactor(0).setDepth(50);
        footer.fillStyle(0x0b0620, 0.96);
        footer.fillRect(0, h - 92, w, 92);
        chunkyButton(this, w / 2, h - 50, t('back'), 0x6366f1, () => this.scene.start('MenuScene'),
            { width: 180, height: 50, fontSize: 22, depth: 52 }).setScrollFactor(0);

        const maxScroll = Math.max(0, listBottom + 130 - h);
        let startScroll = 0;
        this.input.on('pointerdown', () => { startScroll = cam.scrollY; });
        this.input.on('pointermove', (pointer) => {
            if (!pointer.isDown) return;
            cam.scrollY = Phaser.Math.Clamp(startScroll - (pointer.y - pointer.downY) / RES, 0, maxScroll);
        });
        this.input.on('wheel', (pointer, objs, dx, dy) => {
            cam.scrollY = Phaser.Math.Clamp(cam.scrollY + dy * 0.5, 0, maxScroll);
        });
    }
}
