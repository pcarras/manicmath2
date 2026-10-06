import { createStarfield } from '../starfield.js';
import { safeAreaTop } from '../pwa.js';
import { t, lang } from '../i18n.js';
import { chunkyButton } from '../ui.js';
import { view, setupCamera } from '../display.js';
import { ensurePreviews, TEX_PX } from '../textures.js';
import { THEMES, themeState, beans, buyTheme, equipTheme } from '../progress.js';
import { haptic } from '../settings.js';

const SAMPLE = ['num_3', 'op_plus', 'num_7', 'op_times', 'special_bomb'];

// Piece themes bought with coffee beans. Purely cosmetic.
export class ShopScene extends Phaser.Scene {
    constructor() {
        super({ key: 'ShopScene' });
    }

    create() {
        setupCamera(this);
        const { w, h } = view(this);
        const top = safeAreaTop();
        createStarfield(this);
        THEMES.forEach((th) => ensurePreviews(this, th.id));

        this.add.text(w / 2, top + 40, t('shop'), {
            fontFamily: 'Righteous', fontSize: '34px', color: '#ffd23f', stroke: '#1b0f2e', strokeThickness: 6
        }).setOrigin(0.5);
        this.beansText = this.add.text(w / 2, top + 78, '', {
            fontFamily: 'Righteous', fontSize: '20px', color: '#ffd9a8'
        }).setOrigin(0.5);

        this.cards = [];
        this.layout = { w, h, top };
        this.render();

        chunkyButton(this, w / 2, h - 50, t('back'), 0x6366f1, () => this.scene.start('MenuScene'),
            { width: 180, height: 50, fontSize: 22, depth: 52 });
    }

    render() {
        const { w, h, top } = this.layout;
        this.cards.forEach((o) => o.destroy());
        this.cards = [];
        const add = (o) => { this.cards.push(o); return o; };
        const { owned, current } = themeState();
        const wallet = beans();
        this.beansText.setText(`☕ ${wallet} ${t('beans')}`);

        const avail = h - 100 - (top + 104);
        const cardH = Math.min(124, avail / THEMES.length - 8);
        let y = top + 104;
        THEMES.forEach((th) => {
            const has = owned.includes(th.id);
            const using = current === th.id;
            const g = add(this.add.graphics());
            g.fillStyle(using ? 0x2a1c52 : 0x17112e, 0.95);
            g.fillRoundedRect(14, y, w - 28, cardH, 18);
            g.lineStyle(2, using ? 0xffd23f : 0x3a3458, 1);
            g.strokeRoundedRect(14, y, w - 28, cardH, 18);

            add(this.add.text(30, y + 22, th[lang()] || th.en, {
                fontFamily: 'Righteous', fontSize: '20px', color: '#ffffff'
            }).setOrigin(0, 0.5));

            // Preview pieces
            const size = Math.min(40, (w - 190) / SAMPLE.length);
            SAMPLE.forEach((k, i) => {
                add(this.add.image(30 + size / 2 + i * (size + 4), y + cardH - size / 2 - 14, `prev_${th.id}_${k}`)
                    .setScale(size / TEX_PX));
            });

            let label;
            let color;
            let action = null;
            if (using) {
                label = t('inUse');
                color = 0x6b7280;
            } else if (has) {
                label = t('use');
                color = 0x22c55e;
                action = () => { equipTheme(th.id); haptic('success'); this.render(); };
            } else if (wallet >= th.price) {
                label = `${th.price} ☕`;
                color = 0xc2410c;
                action = () => {
                    if (buyTheme(th.id)) {
                        haptic('record');
                        this.cameras.main.flash(160, 255, 210, 63);
                        this.render();
                    }
                };
            } else {
                label = `${th.price} ☕`;
                color = 0x4b4566;
                action = () => {
                    haptic('fail');
                    const note = this.add.text(w - 84, y + cardH / 2 + 30, t('missing', { n: th.price - wallet }), {
                        fontFamily: 'Roboto', fontSize: '12px', color: '#ff9a9a'
                    }).setOrigin(0.5);
                    this.tweens.add({ targets: note, alpha: 0, delay: 900, duration: 300, onComplete: () => note.destroy() });
                };
            }
            add(chunkyButton(this, w - 84, y + cardH / 2, label, color, action || (() => {}),
                { width: 112, height: 42, fontSize: 17, enter: false }));
            y += cardH + 8;
        });
    }
}
