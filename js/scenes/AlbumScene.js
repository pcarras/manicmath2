import { createStarfield } from '../starfield.js';
import { safeAreaTop } from '../pwa.js';
import { t } from '../i18n.js';
import { chunkyButton, modal } from '../ui.js';
import { RES, view, setupCamera } from '../display.js';
import { beans, addBeans, beansLabel } from '../progress.js';
import { STICKERS, STICKER_PRICE, stickerText, ownedStickers, freeStickers, claimSticker } from '../album.js';
import { haptic } from '../settings.js';

const COLS = 3;

// Sticker album: every sticker is chosen by the player (no random packs). Owned stickers open a
// card with the curiosity; a missing one asks before spending anything.
export class AlbumScene extends Phaser.Scene {
    constructor() {
        super({ key: 'AlbumScene' });
    }

    create() {
        setupCamera(this);
        const { w, h } = view(this);
        const top = safeAreaTop();
        this.layout = { w, h, top, listTop: top + 128 };
        createStarfield(this);
        this.children.list.forEach((o) => o.setScrollFactor(0));

        const header = this.add.graphics().setScrollFactor(0).setDepth(50);
        header.fillStyle(0x0b0620, 0.96);
        header.fillRect(0, 0, w, top + 118);
        header.lineStyle(2, 0x6366f1, 0.5);
        header.lineBetween(0, top + 118, w, top + 118);
        this.add.text(w / 2, top + 32, t('album'), {
            fontFamily: 'Righteous', fontSize: '30px', color: '#ffd23f', stroke: '#1b0f2e', strokeThickness: 6
        }).setOrigin(0.5).setScrollFactor(0).setDepth(51);
        this.info = this.add.text(w / 2, top + 66, '', {
            fontFamily: 'Righteous', fontSize: '16px', color: '#ffd9a8'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(51);
        this.free = this.add.text(w / 2, top + 94, '', {
            fontFamily: 'Roboto', fontSize: '12px', color: '#c4c6f5', align: 'center'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(51);

        const footer = this.add.graphics().setScrollFactor(0).setDepth(50);
        footer.fillStyle(0x0b0620, 0.96);
        footer.fillRect(0, h - 92, w, 92);
        chunkyButton(this, w / 2, h - 50, t('back'), 0x6366f1, () => this.scene.start('ShopScene', { tab: 'extra' }),
            { width: 180, height: 50, fontSize: 22, depth: 52 }).setScrollFactor(0);

        const cam = this.cameras.main;
        let startScroll = 0;
        this.input.on('pointerdown', () => { startScroll = cam.scrollY; this.dragged = false; });
        this.input.on('pointermove', (pointer) => {
            if (!pointer.isDown || this.dialog) return;
            const dy = (pointer.y - pointer.downY) / RES;
            if (Math.abs(dy) > 8) this.dragged = true;
            cam.scrollY = Phaser.Math.Clamp(startScroll - dy, 0, this.maxScroll);
        });
        this.input.on('wheel', (pointer, objs, dx, dy) => {
            if (!this.dialog) cam.scrollY = Phaser.Math.Clamp(cam.scrollY + dy * 0.5, 0, this.maxScroll);
        });

        this.cards = [];
        this.render();
    }

    render() {
        const { w, h, listTop } = this.layout;
        this.cards.forEach((o) => o.destroy());
        this.cards = [];
        const add = (o) => { this.cards.push(o); return o; };
        const owned = ownedStickers();
        const free = freeStickers();
        this.info.setText(`${owned.length} / ${STICKERS.length}   ·   ☕ ${beansLabel()}`);
        this.free.setText(free > 0 ? t('freeStickers', { n: free }) : t('freeStickerHow'));

        const gap = 10;
        const cw = (w - 28 - gap * (COLS - 1)) / COLS;
        const ch = cw * 1.3;
        STICKERS.forEach((s, i) => {
            const x = 14 + (i % COLS) * (cw + gap);
            const y = listTop + Math.floor(i / COLS) * (ch + gap);
            const has = owned.includes(s.id);
            const txt = stickerText(s);
            const g = add(this.add.graphics());
            if (has) {
                g.fillStyle(s.color, 1);
                g.fillRoundedRect(x, y, cw, ch, 14);
                g.fillStyle(0xffffff, 0.12);
                g.fillRoundedRect(x + 4, y + 4, cw - 8, ch * 0.62, 10);
                g.lineStyle(3, 0xffffff, 0.9);
                g.strokeRoundedRect(x, y, cw, ch, 14);
            } else {
                g.fillStyle(0x17112e, 0.95);
                g.fillRoundedRect(x, y, cw, ch, 14);
                g.lineStyle(2, 0x3a3458, 1);
                g.strokeRoundedRect(x, y, cw, ch, 14);
            }
            const symSize = Math.round(Math.min(40, (cw * 1.5) / Math.max(1.6, s.sym.length)));
            add(this.add.text(x + cw / 2, y + ch * 0.33, has ? s.sym : '?', {
                fontFamily: 'Righteous', fontSize: `${has ? symSize : 40}px`, color: has ? '#ffffff' : '#4b4566',
                stroke: has ? '#1b0f2e' : undefined, strokeThickness: has ? 5 : 0
            }).setOrigin(0.5));
            add(this.add.text(x + cw / 2, y + ch * 0.72, has ? txt.name : `#${i + 1}`, {
                fontFamily: 'Righteous', fontSize: '13px', color: has ? '#ffffff' : '#6d6890', align: 'center',
                wordWrap: { width: cw - 8 }
            }).setOrigin(0.5));
            add(this.add.text(x + cw / 2, y + ch * 0.9, has ? txt.where : (free > 0 ? t('free') : `${STICKER_PRICE} ☕`), {
                fontFamily: 'Roboto', fontSize: '11px', color: has ? '#f1f5f9' : free > 0 ? '#4ade80' : '#ffb86b'
            }).setOrigin(0.5));
            const hit = add(this.add.zone(x + cw / 2, y + ch / 2, cw, ch).setInteractive());
            hit.on('pointerup', () => {
                if (this.dragged || this.dialog) return;
                haptic('tap');
                if (has) this.showSticker(s);
                else this.askSticker(s);
            });
        });
        const rows = Math.ceil(STICKERS.length / COLS);
        this.maxScroll = Math.max(0, listTop + rows * (ch + gap) + 100 - h);
    }

    // Detail card with the curiosity
    showSticker(s) {
        const txt = stickerText(s);
        const m = modal(this, { depth: 700, height: 400 });
        this.dialog = m;
        m.objs.forEach((o) => o.setScrollFactor(0));
        const { panel, depth } = m;
        const add = (o) => m.add(o.setScrollFactor(0).setDepth(depth));
        const g = add(this.add.graphics());
        g.fillStyle(s.color, 1);
        g.fillRoundedRect(panel.cx - 60, panel.y + 26, 120, 100, 16);
        g.lineStyle(3, 0xffffff, 0.9);
        g.strokeRoundedRect(panel.cx - 60, panel.y + 26, 120, 100, 16);
        add(this.add.text(panel.cx, panel.y + 76, s.sym, {
            fontFamily: 'Righteous', fontSize: `${Math.min(48, Math.round(170 / Math.max(1.6, s.sym.length)))}px`, color: '#ffffff', stroke: '#1b0f2e', strokeThickness: 6
        }).setOrigin(0.5));
        add(this.add.text(panel.cx, panel.y + 150, txt.name, {
            fontFamily: 'Righteous', fontSize: '24px', color: '#ffd23f'
        }).setOrigin(0.5));
        add(this.add.text(panel.cx, panel.y + 178, `${t('born')} ${txt.when} · ${txt.where}`, {
            fontFamily: 'Roboto', fontSize: '13px', color: '#a5a8ff'
        }).setOrigin(0.5));
        add(this.add.text(panel.cx, panel.y + 200, txt.fact, {
            fontFamily: 'Roboto', fontSize: '15px', color: '#ffffff', align: 'center', lineSpacing: 4,
            wordWrap: { width: panel.w - 44 }
        }).setOrigin(0.5, 0));
        m.add(chunkyButton(this, panel.cx, panel.y + panel.h - 34, 'OK', 0x22c55e, () => this.closeDialog(),
            { width: 140, height: 46, fontSize: 20, depth, enter: false }).setScrollFactor(0));
    }

    // Ask before using a free sticker or spending beans
    askSticker(s) {
        const free = freeStickers() > 0;
        const wallet = beans();
        const can = free || wallet >= STICKER_PRICE;
        const m = modal(this, { depth: 700, height: 260 });
        this.dialog = m;
        m.objs.forEach((o) => o.setScrollFactor(0));
        const { panel, depth } = m;
        m.add(this.add.text(panel.cx, panel.y + 56, t('wantSticker'), {
            fontFamily: 'Righteous', fontSize: '22px', color: '#ffd23f', align: 'center', wordWrap: { width: panel.w - 40 }
        }).setOrigin(0.5).setScrollFactor(0).setDepth(depth));
        m.add(this.add.text(panel.cx, panel.y + 104, can ? (free ? t('useFreeSticker') : t('stickerCost', { n: STICKER_PRICE })) : t('missing', { n: STICKER_PRICE - wallet }), {
            fontFamily: 'Roboto', fontSize: '15px', color: can ? '#ffffff' : '#ff9a9a', align: 'center', wordWrap: { width: panel.w - 40 }
        }).setOrigin(0.5).setScrollFactor(0).setDepth(depth));
        const bw = Math.min(130, (panel.w - 60) / 2);
        m.add(chunkyButton(this, panel.cx - bw / 2 - 8, panel.y + panel.h - 44, t('no'), 0x6b7280, () => this.closeDialog(),
            { width: bw, height: 46, fontSize: 18, depth, enter: false }).setScrollFactor(0));
        if (can) {
            m.add(chunkyButton(this, panel.cx + bw / 2 + 8, panel.y + panel.h - 44, t('yes'), 0x22c55e, () => {
                if (!free) addBeans(-STICKER_PRICE);
                claimSticker(s.id, { free });
                haptic('record');
                this.cameras.main.flash(160, 255, 210, 63);
                this.closeDialog();
                this.showSticker(s);
            }, { width: bw, height: 46, fontSize: 18, depth, enter: false }).setScrollFactor(0));
        }
    }

    closeDialog() {
        if (this.dialog) this.dialog.close();
        this.dialog = null;
        this.render();
    }
}
