import { createStarfield } from '../starfield.js';
import { safeAreaTop } from '../pwa.js';
import { t, lang } from '../i18n.js';
import { chunkyButton } from '../ui.js';
import { RES, view, setupCamera } from '../display.js';
import { todayKey } from '../stats.js';
import { player, weeklyBadge } from '../progress.js';
import { fetchBoard } from '../ranking.js';
import { askName } from '../nameDialog.js';

const ROW_H = 44;
const BOARDS = ['week', 'classic', 'daily', 'duel', 'team'];
const TAB_KEYS = { daily: 'boardDaily', classic: 'boardAllTime', week: 'boardWeek', duel: 'boardDuel', team: 'boardTeam' };
const MEDALS = [0xffd23f, 0xc0c7d6, 0xcd7f32];

// Rankings: the classic game (this week, best ever, today's daily challenge) and the two-player
// games (duel victories, best duos). The list opens on "near you" (me and the rows around me, with
// how far the next one is) and can switch to the top 50. The list scrolls like the achievements
// screen; header (tabs + name) and footer stay fixed.
export class RankingScene extends Phaser.Scene {
    constructor() {
        super({ key: 'RankingScene' });
    }

    init(data) {
        this.board = BOARDS.includes(data && data.board) ? data.board : 'week';
        this.allTime = !!(data && data.allTime);      // duel board: trophies of all time instead of this week
        this.viewMode = data && data.view === 'top' ? 'top' : 'near';
    }

    create() {
        setupCamera(this);
        const { w, h } = view(this);
        const top = safeAreaTop();
        this.w = w;
        this.h = h;
        this.listTop = top + 202;
        createStarfield(this);
        this.children.list.forEach((o) => o.setScrollFactor(0));

        const header = this.add.graphics().setScrollFactor(0).setDepth(50);
        header.fillStyle(0x0b0620, 0.96);
        header.fillRect(0, 0, w, top + 178);
        header.lineStyle(2, 0x6366f1, 0.5);
        header.lineBetween(0, top + 178, w, top + 178);
        this.add.text(w / 2, top + 32, t('rankingTitle'), {
            fontFamily: 'Righteous', fontSize: '30px', color: '#ffd23f', stroke: '#1b0f2e', strokeThickness: 6
        }).setOrigin(0.5).setScrollFactor(0).setDepth(51);

        // Tabs
        const tabW = Math.min(76, (w - 28) / BOARDS.length - 4);
        BOARDS.forEach((b, i) => {
            const on = b === this.board;
            chunkyButton(this, w / 2 + (i - (BOARDS.length - 1) / 2) * (tabW + 4), top + 76, t(TAB_KEYS[b]), on ? 0xa855f7 : 0x3a3458,
                () => { if (!on) this.scene.restart({ board: b }); },
                { width: tabW, height: 38, fontSize: 13, depth: 52, enter: false }).setScrollFactor(0);
        });
        const duel = this.board === 'duel';
        const captions = {
            daily: `${t('daily')} · ${todayKey()}`, week: t('rankingWeek'), classic: t('rankingAllTime'),
            duel: this.allTime ? t('rankingDuelAll') : t('rankingDuelWeek'), team: t('rankingTeam')
        };
        this.add.text(duel ? 16 : w / 2, top + 118, captions[this.board], {
            fontFamily: 'Roboto', fontSize: '12px', color: '#a5a8ff'
        }).setOrigin(duel ? 0 : 0.5, 0.5).setScrollFactor(0).setDepth(51);
        if (duel) {
            chunkyButton(this, w - 62, top + 118, this.allTime ? t('viewWeek') : t('viewAll'), 0x0ea5e9,
                () => this.scene.restart({ board: 'duel', allTime: !this.allTime, view: this.viewMode }),
                { width: 96, height: 26, fontSize: 12, depth: 52, enter: false }).setScrollFactor(0);
        }

        // Player name + change
        this.nameText = this.add.text(22, top + 152, '', {
            fontFamily: 'Righteous', fontSize: '15px', color: '#ffffff'
        }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(51);
        this.showName();
        chunkyButton(this, w - 66, top + 152, t('change'), 0x0d9488, () => {
            askName().then((name) => { if (name && this.sys.isActive()) this.scene.restart({ board: this.board, allTime: this.allTime, view: this.viewMode }); });
        }, { width: 100, height: 34, fontSize: 15, depth: 52, enter: false }).setScrollFactor(0);

        const footer = this.add.graphics().setScrollFactor(0).setDepth(50);
        footer.fillStyle(0x0b0620, 0.96);
        footer.fillRect(0, h - 92, w, 92);
        this.backButton = chunkyButton(this, w / 2, h - 50, t('back'), 0x6366f1, () => this.scene.start('MenuScene'),
            { width: 180, height: 50, fontSize: 22, depth: 52 }).setScrollFactor(0);

        this.status = this.add.text(w / 2, this.listTop + 60, '…', {
            fontFamily: 'Righteous', fontSize: '17px', color: '#c9c7ee', align: 'center', wordWrap: { width: w - 60 }
        }).setOrigin(0.5);

        fetchBoard(this.board === 'duel' && this.allTime ? 'duelAll' : this.board, todayKey()).then((r) => {
            if (!this.sys.isActive()) return;
            if (!r.ok) {
                this.status.setText(r.reason === 'soon' ? t('rankingSoon') : t('rankingOffline'));
                return;
            }
            this.render(r.data);
        });
    }

    showName() {
        const badge = weeklyBadge();
        this.nameText.setText(`${t('yourName')}: ${player().name}${badge ? `  ${badge.icon}` : ''}`);
        // Shrink long names so the CHANGE button never overlaps
        this.nameText.setFontSize(this.nameText.width > this.w - 150 ? 12 : 15);
    }

    unit(n) {
        const wins = this.board === 'duel';
        return t(wins ? (n === 1 ? 'unitWin' : 'unitWins') : (n === 1 ? 'unitPt' : 'unitPts'));
    }

    // "X points to pass Y" for the row just above me; first place gets a nudge to keep the lead
    gapText(near) {
        const k = near.findIndex((r) => r.me);
        if (k < 0) return null;
        if (k === 0) return { text: t('gapFirst'), color: '#4ade80' };
        const above = near[k - 1];
        const n = above.score - near[k].score + 1;
        return { text: t(n === 1 ? 'gapToOne' : 'gapTo', { n, unit: this.unit(n), name: above.name }), color: '#ffd9a8' };
    }

    // One list row. rank: place number; row: { name, score, me, games?, frame? }
    drawRow(y, i, rank, row) {
        const { w } = this;
        const team = this.board === 'team';
        const g = this.add.graphics();
        g.fillStyle(row.me ? 0x3b2a6e : i % 2 ? 0x17112e : 0x1d1638, 0.92);
        g.fillRoundedRect(14, y - ROW_H / 2 + 3, w - 28, ROW_H - 6, 12);
        if (row.me) {
            g.lineStyle(2, 0xffd23f, 1);
            g.strokeRoundedRect(14, y - ROW_H / 2 + 3, w - 28, ROW_H - 6, 12);
        }
        // Last week's top 3 wear a frame in their medal colour
        if (row.frame) {
            g.lineStyle(3, MEDALS[row.frame - 1], 1);
            g.strokeRoundedRect(14, y - ROW_H / 2 + 3, w - 28, ROW_H - 6, 12);
        }
        if (rank <= 3) {
            g.fillStyle(MEDALS[rank - 1], 1);
            g.fillCircle(38, y, 13);
            g.lineStyle(2, 0x140a24, 1);
            g.strokeCircle(38, y, 13);
        }
        this.add.text(38, y, team ? '' : String(rank), {
            fontFamily: 'Righteous', fontSize: rank > 99 ? '11px' : '15px', color: rank <= 3 ? '#2b160b' : '#a5a8ff'
        }).setOrigin(0.5);
        if (team) {
            this.add.text(38, y, String(i + 1), { fontFamily: 'Righteous', fontSize: '15px', color: i < 3 ? '#2b160b' : '#a5a8ff' }).setOrigin(0.5);
        }
        const name = `${row.name}${row.me && !team ? `  (${t('you')})` : ''}`;
        const label = this.add.text(64, team ? y - 7 : y, name, {
            fontFamily: 'Righteous', fontSize: '16px', color: row.me ? '#ffd23f' : '#ffffff'
        }).setOrigin(0, 0.5);
        const room = w - (team ? 120 : 160);
        if (label.width > room) label.setFontSize(Math.max(10, Math.floor(16 * room / label.width)));
        if (team) {
            this.add.text(64, y + 10, t(row.games === 1 ? 'gamesTogetherOne' : 'gamesTogether', { n: row.games }), {
                fontFamily: 'Roboto', fontSize: '11px', color: '#8a84b0'
            }).setOrigin(0, 0.5);
        }
        this.add.text(w - 28, y, row.score.toLocaleString(lang() === 'pt' ? 'pt-PT' : 'en-US'), {
            fontFamily: 'Righteous', fontSize: '17px', color: '#FFB347'
        }).setOrigin(1, 0.5);
    }

    render(data) {
        const { w } = this;
        if (data.top.length === 0) {
            const hints = { daily: 'rankingHint', duel: 'rankingDuelHint', team: 'rankingTeamHint' };
            this.status.setText(`${t('rankingEmpty')}\n\n${t(hints[this.board] || 'rankingPlayHint')}`);
            return;
        }
        this.status.setVisible(false);
        const canNear = !!data.near && !!data.me;
        const near = canNear && this.viewMode === 'near';
        if (canNear) {
            // Switch between "near you" and the top 50
            this.backButton.destroy();
            const bw = Math.min(170, (w - 40) / 2);
            this.backButton = chunkyButton(this, w / 2 - bw / 2 - 6, this.h - 50, t('back'), 0x6366f1, () => this.scene.start('MenuScene'),
                { width: bw, height: 50, fontSize: 20, depth: 52, enter: false }).setScrollFactor(0);
            chunkyButton(this, w / 2 + bw / 2 + 6, this.h - 50, near ? t('viewTop') : t('viewNear'), 0xf59e0b,
                () => this.scene.restart({ board: this.board, allTime: this.allTime, view: near ? 'top' : 'near' }),
                { width: bw, height: 50, fontSize: 18, depth: 52, enter: false }).setScrollFactor(0);
        }

        let bottom;
        if (near) {
            const gap = this.gapText(data.near);
            const y0 = this.listTop - 6;
            if (gap) {
                const card = this.add.graphics();
                card.fillStyle(0x241a4a, 0.95);
                card.fillRoundedRect(14, y0, w - 28, 44, 12);
                card.lineStyle(2, 0x6366f1, 0.7);
                card.strokeRoundedRect(14, y0, w - 28, 44, 12);
                this.add.text(w / 2, y0 + 22, gap.text, {
                    fontFamily: 'Righteous', fontSize: '14px', color: gap.color, align: 'center', wordWrap: { width: w - 56 }
                }).setOrigin(0.5);
            }
            data.near.forEach((row, i) => this.drawRow(y0 + 80 + i * ROW_H, i, row.rank, row));
            bottom = y0 + 80 + data.near.length * ROW_H;
        } else {
            data.top.forEach((row, i) => this.drawRow(this.listTop + i * ROW_H, i, i + 1, row));
            bottom = this.listTop + data.top.length * ROW_H;
            if (data.me && data.me.rank > data.top.length) {
                this.add.text(w / 2, bottom + 10, `${t('you')}: #${data.me.rank} · ${data.me.score}`, {
                    fontFamily: 'Righteous', fontSize: '16px', color: '#ffd23f'
                }).setOrigin(0.5);
                bottom += 40;
            } else if (!data.me && this.board !== 'team') {
                this.add.text(w / 2, bottom + 16, t('notRankedYet'), {
                    fontFamily: 'Roboto', fontSize: '13px', color: '#8a84b0'
                }).setOrigin(0.5);
                bottom += 40;
            }
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
