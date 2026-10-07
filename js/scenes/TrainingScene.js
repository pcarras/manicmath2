import { createStarfield } from '../starfield.js';
import { safeAreaTop } from '../pwa.js';
import { t } from '../i18n.js';
import { chunkyButton } from '../ui.js';
import { view, setupCamera } from '../display.js';
import { ensureTextures, bakeLabelPiece, bakePizzaPiece, TEX_PX } from '../textures.js';
import { DRILLS, drillText, drillProgress, isUnlocked, featuredDrill } from '../drills.js';

// TREINO: the list of drills with stars, best score, school year and today's featured drill
export class TrainingScene extends Phaser.Scene {
    constructor() {
        super({ key: 'TrainingScene' });
    }

    create() {
        setupCamera(this);
        const { w, h } = view(this);
        const top = safeAreaTop();
        ensureTextures(this);
        createStarfield(this);

        this.add.text(w / 2, top + 40, t('training'), {
            fontFamily: 'Righteous', fontSize: '34px', color: '#ffd23f', stroke: '#1b0f2e', strokeThickness: 6
        }).setOrigin(0.5);
        this.add.text(w / 2, top + 76, t('trainingSub'), {
            fontFamily: 'Roboto', fontSize: '14px', color: '#c4c6f5'
        }).setOrigin(0.5);

        const featured = featuredDrill();
        const cardH = Math.min(118, (h - top - 200) / (DRILLS.length + 0.6));
        let y = top + 104;
        DRILLS.forEach((d, i) => {
            const open = isUnlocked(i);
            const prog = drillProgress(d.id);
            const txt = drillText(d);
            const g = this.add.graphics();
            g.fillStyle(open ? 0x1d1440 : 0x120d26, 0.95);
            g.fillRoundedRect(14, y, w - 28, cardH - 10, 18);
            g.lineStyle(2, open ? d.color : 0x2a2448, 1);
            g.strokeRoundedRect(14, y, w - 28, cardH - 10, 18);

            // Icon: a real drill piece
            const key = `drill_icon_${d.id}`;
            if (!this.textures.exists(key)) {
                if (d.type === 'fractions') bakePizzaPiece(this, key, 1, 2, 0xb45309);
                else bakeLabelPiece(this, key, d.type === 'product' ? '7×8' : '7', d.color);
            }
            const cy = y + (cardH - 10) / 2;
            this.add.image(52, cy, key).setScale(56 / TEX_PX).setAlpha(open ? 1 : 0.35);

            this.add.text(90, cy - 24, txt.title, {
                fontFamily: 'Righteous', fontSize: '19px', color: open ? '#ffffff' : '#6d6890'
            }).setOrigin(0, 0.5);
            this.add.text(90, cy, txt.grade, {
                fontFamily: 'Roboto', fontSize: '12px', color: open ? '#a5a8ff' : '#55507a'
            }).setOrigin(0, 0.5);
            this.add.text(90, cy + 22, open ? `${'★'.repeat(prog.stars)}${'☆'.repeat(3 - prog.stars)}   ${t('best')}: ${prog.best}` : `🔒 ${t('unlockHint')}`, {
                fontFamily: 'Righteous', fontSize: '14px', color: open ? '#ffd23f' : '#6d6890'
            }).setOrigin(0, 0.5);
            if (d.id === featured && open) {
                const badge = this.add.text(w - 62, cy + 30, t('featured'), {
                    fontFamily: 'Righteous', fontSize: '12px', color: '#2b160b', backgroundColor: '#ffd23f', padding: { x: 6, y: 3 }
                }).setOrigin(0.5, 0.5).setDepth(5);
                this.tweens.add({ targets: badge, scale: 1.08, duration: 600, yoyo: true, repeat: -1 });
            }
            if (open) {
                chunkyButton(this, w - 62, cy - 6, t('go'), 0x22c55e, () => this.scene.start('DrillScene', { id: d.id }),
                    { width: 76, height: 40, fontSize: 18, delay: 120 + i * 80 });
            }
            y += cardH;
        });
        this.add.text(w / 2, y + 12, t('moreSoon'), {
            fontFamily: 'Roboto', fontSize: '13px', color: '#8a84b0'
        }).setOrigin(0.5);

        chunkyButton(this, w / 2, h - 50, t('back'), 0x6366f1, () => this.scene.start('MenuScene'),
            { width: 180, height: 50, fontSize: 22 });
    }
}
