import { createStarfield } from '../starfield.js';
import { safeAreaTop } from '../pwa.js';
import { t } from '../i18n.js';
import { chunkyButton, modal } from '../ui.js';
import { view, setupCamera } from '../display.js';
import { haptic } from '../settings.js';
import { Room } from '../net.js';

// 2 PLAYERS lobby: create a TEAM or DUEL room (shows a 4-digit code to give a friend), or join one
// with the code. When both are in, the server sets a start time and both phones count down together.
export class MultiScene extends Phaser.Scene {
    constructor() {
        super({ key: 'MultiScene' });
    }

    create() {
        setupCamera(this);
        const { w, h } = view(this);
        const top = safeAreaTop();
        this.w = w;
        this.h = h;
        this.room = null;
        this.waitUI = null;
        createStarfield(this);

        this.add.text(w / 2, top + 40, t('twoPlayers'), {
            fontFamily: 'Righteous', fontSize: '32px', color: '#ffd23f', stroke: '#1b0f2e', strokeThickness: 6
        }).setOrigin(0.5);

        const cardW = Math.min(w - 28, 360);
        const cards = [
            ['team', '🤝', 0x22c55e, 'teamTitle', 'teamHow'],
            ['duel', '⚔️', 0xef4444, 'duelTitle', 'duelHow']
        ];
        let y = top + 86;
        cards.forEach(([mode, icon, color, title, how]) => {
            const ch = 158;
            const g = this.add.graphics();
            g.fillStyle(0x17112e, 0.95);
            g.fillRoundedRect(w / 2 - cardW / 2, y, cardW, ch, 18);
            g.lineStyle(2, color, 1);
            g.strokeRoundedRect(w / 2 - cardW / 2, y, cardW, ch, 18);
            this.add.text(w / 2 - cardW / 2 + 18, y + 24, `${icon}  ${t(title)}`, {
                fontFamily: 'Righteous', fontSize: '22px', color: '#ffffff'
            }).setOrigin(0, 0.5);
            this.add.text(w / 2 - cardW / 2 + 18, y + 46, t(how), {
                fontFamily: 'Roboto', fontSize: '13px', color: '#c4c6f5', wordWrap: { width: cardW - 36 }, lineSpacing: 2
            });
            chunkyButton(this, w / 2, y + ch - 28, t('createRoom'), color, () => this.createRoom(mode),
                { width: 200, height: 42, fontSize: 18, enter: false });
            y += ch + 12;
        });

        chunkyButton(this, w / 2, y + 30, t('joinRoom'), 0x0ea5e9, () => this.askCode(),
            { width: Math.min(260, w - 60), height: 52, fontSize: 20 });
        this.add.text(w / 2, y + 74, t('friendsOnly'), {
            fontFamily: 'Roboto', fontSize: '12px', color: '#8a84b0', align: 'center', wordWrap: { width: w - 50 }
        }).setOrigin(0.5, 0);

        chunkyButton(this, w / 2, h - 50, t('back'), 0x6366f1, () => this.scene.start('MenuScene'),
            { width: 180, height: 50, fontSize: 22 });

        this.events.once('shutdown', () => {
            // Leaving the lobby without starting a game closes the room
            if (this.room && !this.starting) this.room.close();
        });
    }

    message(text) {
        const m = modal(this, { depth: 800, height: 200 });
        m.add(this.add.text(m.panel.cx, m.panel.y + 70, text, {
            fontFamily: 'Righteous', fontSize: '18px', color: '#ffffff', align: 'center', wordWrap: { width: m.panel.w - 40 }
        }).setOrigin(0.5).setDepth(m.depth));
        m.add(chunkyButton(this, m.panel.cx, m.panel.y + m.panel.h - 40, 'OK', 0x6366f1, () => m.close(),
            { width: 120, height: 44, fontSize: 20, depth: m.depth, enter: false }));
    }

    errorText(err) {
        if (err === 'soon' || err === 'not_configured') return t('roomSoon');
        if (err === 'no_room') return t('roomNotFound');
        if (err === 'full') return t('roomFull');
        if (err === 'own_room') return t('roomOwn');
        return t('roomOffline');
    }

    async createRoom(mode) {
        if (this.busy) return;
        this.busy = true;
        const r = await Room.create(mode);
        this.busy = false;
        if (!this.sys.isActive()) return;
        if (!r.ok) {
            this.message(this.errorText(r.error));
            return;
        }
        this.enterRoom(r.room);
    }

    async joinRoom(code) {
        if (this.busy) return;
        this.busy = true;
        const r = await Room.join(code);
        this.busy = false;
        if (!this.sys.isActive()) return;
        if (!r.ok) {
            this.message(this.errorText(r.error));
            return;
        }
        this.enterRoom(r.room);
    }

    // Waiting room: code, players, then a shared countdown
    enterRoom(room) {
        this.room = room;
        haptic('success');
        const m = modal(this, { depth: 700, height: 420 });
        this.waitUI = m;
        const { panel, depth } = m;
        const D = (o) => m.add(o.setDepth(depth));
        D(this.add.text(panel.cx, panel.y + 34, room.mode === 'team' ? `🤝 ${t('teamTitle')}` : `⚔️ ${t('duelTitle')}`, {
            fontFamily: 'Righteous', fontSize: '22px', color: room.mode === 'team' ? '#4ade80' : '#f87171'
        }).setOrigin(0.5));
        D(this.add.text(panel.cx, panel.y + 70, t('roomCode'), {
            fontFamily: 'Roboto', fontSize: '13px', color: '#a5a8ff'
        }).setOrigin(0.5));
        D(this.add.text(panel.cx, panel.y + 116, room.code.split('').join(' '), {
            fontFamily: 'Righteous', fontSize: '58px', color: '#ffd23f', stroke: '#1b0f2e', strokeThickness: 8
        }).setOrigin(0.5));
        const p0 = D(this.add.text(panel.cx, panel.y + 186, '', { fontFamily: 'Righteous', fontSize: '17px', color: '#ffffff' }).setOrigin(0.5));
        const p1 = D(this.add.text(panel.cx, panel.y + 216, '', { fontFamily: 'Righteous', fontSize: '17px', color: '#ffffff' }).setOrigin(0.5));
        const status = D(this.add.text(panel.cx, panel.y + 270, t('waitingFriend'), {
            fontFamily: 'Righteous', fontSize: '18px', color: '#ffd9a8', align: 'center', wordWrap: { width: panel.w - 40 }
        }).setOrigin(0.5));
        this.tweens.add({ targets: status, alpha: 0.4, duration: 700, yoyo: true, repeat: -1 });
        m.add(chunkyButton(this, panel.cx, panel.y + panel.h - 40, t('cancel'), 0x6b7280, () => {
            room.close();
            this.room = null;
            m.close();
            this.waitUI = null;
        }, { width: 160, height: 46, fontSize: 19, depth, enter: false }));

        room.onState(({ players, startAt, failures }) => {
            if (!this.sys.isActive() || this.room !== room) return;
            const name = (k) => (players[k] ? `${players[k].name}${k === room.me ? ` (${t('you')})` : ''}` : '…');
            p0.setText(`1. ${name(0)}`);
            p1.setText(`2. ${name(1)}`);
            if (failures > 6) status.setText(t('roomOffline'));
            if (startAt) {
                const left = Math.ceil((startAt - room.serverNow()) / 1000);
                status.setText(left > 0 ? t('roomStartsIn', { n: left }) : t('go'));
                this.tweens.killTweensOf(status);
                status.setAlpha(1);
                if (left <= 0 && !this.starting) {
                    this.starting = true;
                    this.scene.start('GameScene', { mode: room.mode, room });
                }
            }
        });
        room.start();
    }

    // Number pad for the 4-digit room code
    askCode() {
        let code = '';
        const m = modal(this, { depth: 700, height: 470, title: t('joinRoom') });
        const { panel, depth } = m;
        const shown = m.add(this.add.text(panel.cx, panel.y + 100, '_ _ _ _', {
            fontFamily: 'Righteous', fontSize: '44px', color: '#ffd23f'
        }).setOrigin(0.5).setDepth(depth));
        const refresh = () => shown.setText((code + '____').slice(0, 4).split('').join(' '));
        const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', 'OK'];
        const kw = Math.min(78, (panel.w - 60) / 3);
        keys.forEach((k, i) => {
            const x = panel.cx + ((i % 3) - 1) * (kw + 10);
            const y = panel.y + 170 + Math.floor(i / 3) * 62;
            const color = k === 'OK' ? 0x22c55e : k === '⌫' ? 0x6b7280 : 0x3a3470;
            m.add(chunkyButton(this, x, y, k, color, () => {
                if (k === '⌫') code = code.slice(0, -1);
                else if (k === 'OK') {
                    if (code.length === 4) {
                        m.close();
                        this.joinRoom(code);
                    }
                    return;
                } else if (code.length < 4) code += k;
                haptic('tap');
                refresh();
            }, { width: kw, height: 50, fontSize: 24, depth, enter: false }));
        });
        m.add(chunkyButton(this, panel.cx, panel.y + panel.h - 30, t('cancel'), 0x6366f1, () => m.close(),
            { width: 150, height: 40, fontSize: 18, depth, enter: false }));
    }
}
