import { createStarfield } from '../starfield.js';
import { safeAreaTop } from '../pwa.js';
import { t, lang } from '../i18n.js';
import { chunkyButton } from '../ui.js';
import { RES, view, setupCamera } from '../display.js';
import { ensurePreviews, ensureTextures, TEX_PX, POP_FX } from '../textures.js';
import { backdropTexture } from '../backdrops.js';
import {
    beans, catalog, ownedItems, currentItem, buyItem, equipItem, dailyDeals,
    spares, buySpare, SPARE_PRICE, SPARE_MAX
} from '../progress.js';
import { haptic } from '../settings.js';
import { STICKERS, ownedStickers } from '../album.js';

const SAMPLE = ['num_3', 'op_plus', 'num_7', 'op_times', 'special_bomb'];
const TABS = ['deals', 'theme', 'scene', 'pop', 'extra'];
const CARD_H = 104;

// Cosmetics bought with coffee beans: piece themes, game scenes, pop effects, spare coffee,
// plus three items on sale every day. Nothing here changes how the game plays.
export class ShopScene extends Phaser.Scene {
    constructor() {
        super({ key: 'ShopScene' });
    }

    init(data) {
        this.tab = (data && data.tab) || this.tab || 'deals';
    }

    create() {
        setupCamera(this);
        const { w, h } = view(this);
        const top = safeAreaTop();
        this.layout = { w, h, top, listTop: top + 150 };
        ensureTextures(this);
        createStarfield(this);
        this.children.list.forEach((o) => o.setScrollFactor(0));
        catalog('theme').forEach((th) => ensurePreviews(this, th.id));

        // Fixed header: title, wallet and tabs
        const header = this.add.graphics().setScrollFactor(0).setDepth(50);
        header.fillStyle(0x0b0620, 0.96);
        header.fillRect(0, 0, w, top + 142);
        header.lineStyle(2, 0x6366f1, 0.5);
        header.lineBetween(0, top + 142, w, top + 142);
        this.add.text(w / 2, top + 34, t('shop'), {
            fontFamily: 'Righteous', fontSize: '32px', color: '#ffd23f', stroke: '#1b0f2e', strokeThickness: 6
        }).setOrigin(0.5).setScrollFactor(0).setDepth(51);
        this.beansText = this.add.text(w / 2, top + 70, '', {
            fontFamily: 'Righteous', fontSize: '19px', color: '#ffd9a8'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(51);
        this.tabObjs = [];
        this.drawTabs();

        // Fixed footer
        const footer = this.add.graphics().setScrollFactor(0).setDepth(50);
        footer.fillStyle(0x0b0620, 0.96);
        footer.fillRect(0, h - 92, w, 92);
        chunkyButton(this, w / 2, h - 50, t('back'), 0x6366f1, () => this.scene.start('MenuScene'),
            { width: 180, height: 50, fontSize: 22, depth: 52 }).setScrollFactor(0);

        // Drag (or wheel) to scroll; a drag never counts as a tap on a card button
        const cam = this.cameras.main;
        let startScroll = 0;
        this.input.on('pointerdown', () => { startScroll = cam.scrollY; this.dragged = false; });
        this.input.on('pointermove', (pointer) => {
            if (!pointer.isDown) return;
            const dy = (pointer.y - pointer.downY) / RES;
            if (Math.abs(dy) > 8) this.dragged = true;
            cam.scrollY = Phaser.Math.Clamp(startScroll - dy, 0, this.maxScroll);
        });
        this.input.on('wheel', (pointer, objs, dx, dy) => {
            cam.scrollY = Phaser.Math.Clamp(cam.scrollY + dy * 0.5, 0, this.maxScroll);
        });

        this.cards = [];
        this.render();
    }

    drawTabs() {
        const { w, top } = this.layout;
        this.tabObjs.forEach((o) => o.destroy());
        this.tabObjs = [];
        const tw = (w - 20) / TABS.length;
        TABS.forEach((id, i) => {
            const on = id === this.tab;
            const x = 10 + i * tw;
            const g = this.add.graphics().setScrollFactor(0).setDepth(51);
            g.fillStyle(on ? 0xffd23f : 0x1d1440, 1);
            g.fillRoundedRect(x + 2, top + 92, tw - 4, 40, 12);
            if (!on) {
                g.lineStyle(2, 0x3a3458, 1);
                g.strokeRoundedRect(x + 2, top + 92, tw - 4, 40, 12);
            }
            const label = this.add.text(x + tw / 2, top + 112, t(`shopTab_${id}`), {
                fontFamily: 'Righteous', fontSize: tw < 76 ? '11px' : '13px', color: on ? '#1b0f2e' : '#c4c6f5', align: 'center'
            }).setOrigin(0.5).setScrollFactor(0).setDepth(52);
            const hit = this.add.zone(x + tw / 2, top + 112, tw, 44).setScrollFactor(0).setDepth(53).setInteractive();
            hit.on('pointerup', () => {
                if (this.tab === id) return;
                haptic('tap');
                this.tab = id;
                this.cameras.main.scrollY = 0;
                this.drawTabs();
                this.render();
            });
            this.tabObjs.push(g, label, hit);
        });
    }

    // Rows for the current tab: { kind, item, price, off }
    rows() {
        if (this.tab === 'deals') return dailyDeals();
        if (this.tab === 'extra') return [{ kind: 'album' }, { kind: 'spare' }];
        return catalog(this.tab).map((item) => ({ kind: this.tab, item, price: item.price }));
    }

    render() {
        const { w, h, listTop } = this.layout;
        this.cards.forEach((o) => o.destroy());
        this.cards = [];
        const add = (o) => { this.cards.push(o); return o; };
        this.beansText.setText(`☕ ${beans()} ${t('beans')}`);

        let y = listTop;
        if (this.tab === 'deals') {
            add(this.add.text(w / 2, y + 4, t('dealsNote'), {
                fontFamily: 'Roboto', fontSize: '13px', color: '#c4c6f5', align: 'center'
            }).setOrigin(0.5, 0));
            y += 28;
        }
        this.rows().forEach((row) => {
            this.card(row, y, add);
            y += CARD_H;
        });
        if (this.tab === 'extra') {
            add(this.add.text(w / 2, y + 6, t('moreItemsSoon'), {
                fontFamily: 'Roboto', fontSize: '13px', color: '#8a84b0'
            }).setOrigin(0.5, 0));
            y += 30;
        }
        this.maxScroll = Math.max(0, y + 100 - h);
        this.cameras.main.scrollY = Phaser.Math.Clamp(this.cameras.main.scrollY, 0, this.maxScroll);
    }

    card(row, y, add) {
        const { w } = this.layout;
        const cardH = CARD_H - 10;
        const cy = y + cardH / 2;
        if (row.kind === 'album') {
            this.albumCard(y, cardH, add);
            return;
        }
        const wallet = beans();
        const spare = row.kind === 'spare';
        const has = !spare && ownedItems(row.kind).includes(row.item.id);
        const using = !spare && currentItem(row.kind) === row.item.id;

        const g = add(this.add.graphics());
        g.fillStyle(using ? 0x2a1c52 : 0x17112e, 0.95);
        g.fillRoundedRect(14, y, w - 28, cardH, 18);
        g.lineStyle(2, using ? 0xffd23f : row.off ? 0xff8a00 : 0x3a3458, 1);
        g.strokeRoundedRect(14, y, w - 28, cardH, 18);

        const name = spare ? t('spareName') : (row.item[lang()] || row.item.en);
        add(this.add.text(30, y + 20, name, {
            fontFamily: 'Righteous', fontSize: '18px', color: '#ffffff'
        }).setOrigin(0, 0.5));
        if (this.tab === 'deals') {
            add(this.add.text(30, y + 40, t(`shopKind_${row.kind}`), {
                fontFamily: 'Roboto', fontSize: '11px', color: '#a5a8ff'
            }).setOrigin(0, 0.5));
        }
        this.preview(row, y, cardH, add);

        // Button: use / in use / buy / not enough
        let label;
        let color;
        let action = () => {};
        const price = spare ? SPARE_PRICE : row.price;
        const full = spare && spares() >= SPARE_MAX;
        if (using) {
            label = t('inUse');
            color = 0x6b7280;
        } else if (has) {
            label = t('use');
            color = 0x22c55e;
            action = () => { equipItem(row.kind, row.item.id); haptic('success'); this.render(); };
        } else if (full) {
            label = t('spareFull');
            color = 0x6b7280;
        } else if (wallet >= price) {
            label = `${price} ☕`;
            color = row.off ? 0xea580c : 0xc2410c;
            action = () => {
                const ok = spare ? buySpare() : buyItem(row.kind, row.item.id, price);
                if (!ok) return;
                haptic('record');
                this.cameras.main.flash(160, 255, 210, 63);
                this.render();
            };
        } else {
            label = `${price} ☕`;
            color = 0x4b4566;
            action = () => {
                haptic('fail');
                const note = add(this.add.text(w - 84, cy + 30, t('missing', { n: price - wallet }), {
                    fontFamily: 'Roboto', fontSize: '12px', color: '#ff9a9a'
                }).setOrigin(0.5));
                this.tweens.add({ targets: note, alpha: 0, delay: 900, duration: 300 });
            };
        }
        add(chunkyButton(this, w - 84, cy, label, color, () => { if (!this.dragged) action(); },
            { width: 112, height: 42, fontSize: label.length > 8 ? 13 : 17, enter: false }));
        if (row.off && !has) {
            add(this.add.text(w - 84, cy - 30, `-${row.off}%  ${row.item.price}`, {
                fontFamily: 'Righteous', fontSize: '12px', color: '#ffb347'
            }).setOrigin(0.5));
        }
    }

    // Entry to the sticker album (its stickers are chosen and paid inside the album)
    albumCard(y, cardH, add) {
        const { w } = this.layout;
        const g = add(this.add.graphics());
        g.fillStyle(0x2a1c52, 0.95);
        g.fillRoundedRect(14, y, w - 28, cardH, 18);
        g.lineStyle(2, 0x38bdf8, 1);
        g.strokeRoundedRect(14, y, w - 28, cardH, 18);
        add(this.add.text(30, y + 20, t('album'), {
            fontFamily: 'Righteous', fontSize: '18px', color: '#ffffff'
        }).setOrigin(0, 0.5));
        add(this.add.text(30, y + 40, t('albumSub'), {
            fontFamily: 'Roboto', fontSize: '11px', color: '#c4c6f5', wordWrap: { width: w - 190 }
        }).setOrigin(0, 0));
        add(this.add.text(30, y + cardH - 18, `${ownedStickers().length} / ${STICKERS.length}`, {
            fontFamily: 'Righteous', fontSize: '15px', color: '#ffd9a8'
        }).setOrigin(0, 0.5));
        add(chunkyButton(this, w - 84, y + cardH / 2, t('open'), 0x0284c7, () => { if (!this.dragged) this.scene.start('AlbumScene'); },
            { width: 112, height: 42, fontSize: 17, enter: false }));
    }

    preview(row, y, cardH, add) {
        const { w } = this.layout;
        const left = 30;
        const right = w - 150;
        const midY = y + cardH - 30;
        if (row.kind === 'theme') {
            const size = Math.min(36, (right - left) / SAMPLE.length - 4);
            SAMPLE.forEach((k, i) => {
                add(this.add.image(left + size / 2 + i * (size + 4), midY + 4, `prev_${row.item.id}_${k}`).setScale(size / TEX_PX));
            });
        } else if (row.kind === 'scene') {
            // A slice of the scene, as wide as the preview area
            const pw = Math.max(80, right - left);
            const ph = 38;
            const { w: vw, h: vh } = view(this);
            const key = row.item.id === 'space' ? `starfield_${Math.ceil(vw)}x${Math.ceil(vh)}` : backdropTexture(this, row.item.id, Math.ceil(vw), Math.ceil(vh));
            const src = this.textures.get(key).getSourceImage();
            const scale = pw / src.width;
            const cropY = src.height * 0.6;
            const cropH = Math.min(src.height - cropY, ph / scale);
            const boxY = midY - ph / 2 + 4;
            add(this.add.image(left, boxY - cropY * scale, key).setOrigin(0).setScale(scale).setCrop(0, cropY, src.width, cropH));
            const frame = add(this.add.graphics());
            frame.lineStyle(2, 0x3a3458, 1);
            frame.strokeRoundedRect(left, boxY, pw, cropH * scale, 6);
        } else if (row.kind === 'pop') {
            const fx = POP_FX[row.item.id] || POP_FX.glow;
            const x = left + 60;
            const em = add(this.add.particles(0, 0, fx.key, {
                speed: { min: 40, max: 110 },
                scale: fx.scale || { start: 0.9, end: 0 },
                alpha: fx.alpha || 1,
                rotate: fx.rotate ? { min: 0, max: 360 } : 0,
                blendMode: fx.add ? 'ADD' : 'NORMAL',
                lifespan: (fx.lifespan || 420) * 0.9,
                gravityY: (fx.gravity ?? 300) * 0.4,
                tint: fx.tint !== undefined ? fx.tint : [0xff8a00, 0x38bdf8, 0x4ade80, 0xa855f7],
                emitting: false
            }));
            const puff = () => em.emitParticleAt(x, midY, 10);
            puff();
            add(this.time.addEvent({ delay: 1100, loop: true, callback: puff }));
        } else if (row.kind === 'spare') {
            add(this.add.text(left, midY + 2, `☕ ${t('spareOwned', { n: spares(), max: SPARE_MAX })}`, {
                fontFamily: 'Righteous', fontSize: '15px', color: '#ffd9a8'
            }).setOrigin(0, 0.5));
            add(this.add.text(left, y + 42, t('spareHelp'), {
                fontFamily: 'Roboto', fontSize: '11px', color: '#c4c6f5', wordWrap: { width: right - left - 6 }
            }).setOrigin(0, 0.5));
        }
    }
}
