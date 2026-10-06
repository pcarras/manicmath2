import { createStarfield } from '../starfield.js';
import { safeAreaTop } from '../pwa.js';
import { t } from '../i18n.js';
import { chunkyButton } from '../ui.js';
import { RES, view, setupCamera } from '../display.js';
import { todayKey } from '../stats.js';
import { player, rerollName } from '../progress.js';
import { fetchBoard } from '../ranking.js';

const ROW_H = 44;

// Today's daily challenge ranking. Scrolls like the achievements list; header and footer stay fixed.
export class RankingScene extends Phaser.Scene {
    constructor() {
        super({ key: 'RankingScene' });
    }

    create() {
        setupCamera(this);
        const { w, h } = view(this);
        const top = safeAreaTop();
        this.w = w;
        this.h = h;
        this.listTop = top + 150;
        createStarfield(this);
        this.children.list.forEach((o) => o.setScrollFactor(0));

        const header = this.add.graphics().setScrollFactor(0).setDepth(50);
        header.fillStyle(0x0b0620, 0.96);
        header.fillRect(0, 0, w, top + 136);
        header.lineStyle(2, 0x6366f1, 0.5);
        header.lineBetween(0, top + 136, w, top + 136);
        this.add.text(w / 2, top + 34, t('rankingToday'), {
            fontFamily: 'Righteous', fontSize: '28px', color: '#ffd23f', stroke: '#1b0f2e', strokeThickness: 6
        }).setOrigin(0.5).setScrollFactor(0).setDepth(51);
        this.add.text(w / 2, top + 64, todayKey(), {
            fontFamily: 'Roboto', fontSize: '13px', color: '#a5a8ff'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(51);

        // Player name (generated from word lists) + reroll
        this.nameText = this.add.text(22, top + 104, '', {
            fontFamily: 'Righteous', fontSize: '15px', color: '#ffffff'
        }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(51);
        this.showName();
        chunkyButton(this, w - 78, top + 104, t('newName'), 0x0d9488, () => {
            rerollName();
            this.showName();
        }, { width: 124, height: 34, fontSize: 14, depth: 52, enter: false }).setScrollFactor(0);

        const footer = this.add.graphics().setScrollFactor(0).setDepth(50);
        footer.fillStyle(0x0b0620, 0.96);
        footer.fillRect(0, h - 92, w, 92);
        chunkyButton(this, w / 2, h - 50, t('back'), 0x6366f1, () => this.scene.start('MenuScene'),
            { width: 180, height: 50, fontSize: 22, depth: 52 }).setScrollFactor(0);

        this.status = this.add.text(w / 2, this.listTop + 60, '…', {
            fontFamily: 'Righteous', fontSize: '17px', color: '#c9c7ee', align: 'center', wordWrap: { width: w - 60 }
        }).setOrigin(0.5);

        fetchBoard(todayKey()).then((r) => {
            if (!this.sys.isActive()) return;
            if (!r.ok) {
                this.status.setText(r.reason === 'soon' ? t('rankingSoon') : t('rankingOffline'));
                return;
            }
            this.render(r.data);
        });
    }

    showName() {
        this.nameText.setText(`${t('yourName')}: ${player().name}`);
    }

    render(data) {
        const { w } = this;
        if (data.top.length === 0) {
            this.status.setText(`${t('rankingEmpty')}\n\n${t('rankingHint')}`);
            return;
        }
        this.status.setVisible(false);
        const medals = [0xffd23f, 0xc0c7d6, 0xcd7f32];
        data.top.forEach((row, i) => {
            const y = this.listTop + i * ROW_H;
            const g = this.add.graphics();
            g.fillStyle(row.me ? 0x3b2a6e : i % 2 ? 0x17112e : 0x1d1638, 0.92);
            g.fillRoundedRect(14, y - ROW_H / 2 + 3, w - 28, ROW_H - 6, 12);
            if (row.me) {
                g.lineStyle(2, 0xffd23f, 1);
                g.strokeRoundedRect(14, y - ROW_H / 2 + 3, w - 28, ROW_H - 6, 12);
            }
            if (i < 3) {
                g.fillStyle(medals[i], 1);
                g.fillCircle(38, y, 13);
                g.lineStyle(2, 0x140a24, 1);
                g.strokeCircle(38, y, 13);
            }
            this.add.text(38, y, String(i + 1), {
                fontFamily: 'Righteous', fontSize: '15px', color: i < 3 ? '#2b160b' : '#a5a8ff'
            }).setOrigin(0.5);
            this.add.text(64, y, row.me ? `${row.name}  (${t('you')})` : row.name, {
                fontFamily: 'Righteous', fontSize: '16px', color: row.me ? '#ffd23f' : '#ffffff'
            }).setOrigin(0, 0.5);
            this.add.text(w - 28, y, String(row.score), {
                fontFamily: 'Righteous', fontSize: '17px', color: '#FFB347'
            }).setOrigin(1, 0.5);
        });
        let bottom = this.listTop + data.top.length * ROW_H;
        if (data.me && data.me.rank > data.top.length) {
            this.add.text(w / 2, bottom + 10, `${t('you')}: #${data.me.rank} · ${data.me.score}`, {
                fontFamily: 'Righteous', fontSize: '16px', color: '#ffd23f'
            }).setOrigin(0.5);
            bottom += 40;
        }

        const cam = this.cameras.main;
        const maxScroll = Math.max(0, bottom + 110 - this.h);
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
