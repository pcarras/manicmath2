import { createStarfield } from '../starfield.js';
import { safeAreaTop } from '../pwa.js';
import { t } from '../i18n.js';
import { chunkyButton } from '../ui.js';
import { RES, view, setupCamera } from '../display.js';
import { ACHIEVEMENTS, achievementState, achievementText, drawMedal } from '../achievements.js';

const ROW_H = 70;

// Scrollable list of all achievements (drag or mouse wheel); header and back button stay fixed.
export class AchievementsScene extends Phaser.Scene {
    constructor() {
        super({ key: 'AchievementsScene' });
    }

    create() {
        setupCamera(this);
        const { w, h } = view(this);
        const top = safeAreaTop();
        const cam = this.cameras.main;

        createStarfield(this);
        this.children.list.forEach((o) => o.setScrollFactor(0));

        const { unlocked } = achievementState();
        const count = ACHIEVEMENTS.filter((a) => unlocked[a.id]).length;

        // List
        const listTop = top + 110;
        ACHIEVEMENTS.forEach((a, i) => {
            const y = listTop + i * ROW_H + ROW_H / 2;
            const got = !!unlocked[a.id];
            const [title, desc] = achievementText(a);
            const card = this.add.graphics();
            card.fillStyle(got ? 0x2a1c52 : 0x17112e, 0.92);
            card.fillRoundedRect(14, y - ROW_H / 2 + 4, w - 28, ROW_H - 8, 16);
            card.lineStyle(2, got ? 0x6366f1 : 0x2a2448, got ? 0.7 : 1);
            card.strokeRoundedRect(14, y - ROW_H / 2 + 4, w - 28, ROW_H - 8, 16);
            drawMedal(this, 46, y, 22, a, got, 2);
            this.add.text(80, y - 11, title, {
                fontFamily: 'Righteous', fontSize: '18px', color: got ? '#ffffff' : '#8a84b0'
            }).setOrigin(0, 0.5);
            this.add.text(80, y + 13, desc, {
                fontFamily: 'Roboto', fontSize: '13px', color: got ? '#c9c7ee' : '#6d6890',
                wordWrap: { width: w - 110 }
            }).setOrigin(0, 0.5);
        });
        const listBottom = listTop + ACHIEVEMENTS.length * ROW_H;

        // Fixed header
        const header = this.add.graphics().setScrollFactor(0).setDepth(50);
        header.fillStyle(0x0b0620, 0.96);
        header.fillRect(0, 0, w, top + 96);
        header.lineStyle(2, 0x6366f1, 0.5);
        header.lineBetween(0, top + 96, w, top + 96);
        this.add.text(w / 2, top + 38, t('achievements'), {
            fontFamily: 'Righteous', fontSize: '32px', color: '#ffd23f', stroke: '#1b0f2e', strokeThickness: 6
        }).setOrigin(0.5).setScrollFactor(0).setDepth(51);
        this.add.text(w / 2, top + 74, `${count} / ${ACHIEVEMENTS.length}`, {
            fontFamily: 'Righteous', fontSize: '16px', color: '#a5a8ff'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(51);

        // Fixed footer with the back button
        const footer = this.add.graphics().setScrollFactor(0).setDepth(50);
        footer.fillStyle(0x0b0620, 0.96);
        footer.fillRect(0, h - 92, w, 92);
        chunkyButton(this, w / 2, h - 50, t('back'), 0x6366f1, () => this.scene.start('MenuScene'),
            { width: 180, height: 50, fontSize: 22, depth: 52 }).setScrollFactor(0);

        // Scrolling
        const maxScroll = Math.max(0, listBottom + 100 - h);
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
