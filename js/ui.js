// Shared UI kit: chunky 3D buttons (lip + press-down, Candy Crush / Royal Match style),
// round icon buttons and the settings panel. Used by the menu, pause and game over screens.
import { settings } from './settings.js';
import { t, lang } from './i18n.js';
import { uiClick } from './bica.js';
import { view } from './display.js';

const OUTLINE = 0x140a24;

function shade(color, f) {
    const ch = (s) => Math.round(((color >> s) & 0xff) * f);
    return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

// Wires press-down feedback; the action fires on release so it counts as a user gesture
// (needed for the install prompt and fullscreen).
function makePressable(c, movers, lip, onClick) {
    let pressed = false;
    const setDown = (down) => movers.forEach((m) => { m.y = m.baseY + (down ? lip : 0); });
    c.on('pointerdown', (pointer, x, y, event) => {
        if (event) event.stopPropagation();
        pressed = true;
        setDown(true);
    });
    c.on('pointerout', () => {
        pressed = false;
        setDown(false);
    });
    c.on('pointerup', () => {
        if (!pressed) return;
        pressed = false;
        setDown(false);
        uiClick();
        onClick();
    });
}

export function chunkyButton(scene, x, y, label, color, onClick, opts = {}) {
    const { width = 220, height = 60, fontSize = 26, delay = 0, depth = 10, enter = true } = opts;
    const lip = Math.round(height * 0.13);
    const r = Math.round(height * 0.32);
    const c = scene.add.container(x, y).setDepth(depth);

    const base = scene.add.graphics();
    base.fillStyle(0x000000, 0.35);
    base.fillRoundedRect(-width / 2 + 3, -height / 2 + 5, width, height + lip, r);
    base.fillStyle(shade(color, 0.58), 1);
    base.fillRoundedRect(-width / 2, -height / 2, width, height + lip, r);
    base.lineStyle(3, OUTLINE, 1);
    base.strokeRoundedRect(-width / 2, -height / 2, width, height + lip, r);

    const face = scene.add.graphics();
    face.fillStyle(color, 1);
    face.fillRoundedRect(-width / 2 + 1.5, -height / 2 + 1.5, width - 3, height - 3, r - 1);
    face.fillStyle(0xffffff, 0.22);
    face.fillRoundedRect(-width / 2 + 8, -height / 2 + 5, width - 16, height * 0.36, Math.max(4, r * 0.6));
    face.baseY = 0;

    const text = scene.add.text(0, -2, label, {
        fontFamily: 'Righteous', fontSize: `${fontSize}px`, color: '#ffffff',
        stroke: '#1b0f2e', strokeThickness: 5
    }).setOrigin(0.5);
    text.baseY = -2;

    c.add([base, face, text]);
    c.setSize(width, height + lip);
    c.setInteractive({ useHandCursor: true });
    makePressable(c, [face, text], lip, onClick);
    c.label = text;

    if (enter) {
        c.setAlpha(0).setScale(0.8);
        scene.tweens.add({ targets: c, alpha: 1, scale: 1, duration: 380, delay, ease: 'Back.easeOut' });
    }
    return c;
}

// Round icon button: 'pause' or 'gear'
export function roundButton(scene, x, y, icon, onClick, { radius = 20, color = 0x4c3f8f, depth = 101 } = {}) {
    const lip = 4;
    const c = scene.add.container(x, y).setDepth(depth);
    const base = scene.add.graphics();
    base.fillStyle(shade(color, 0.55), 1);
    base.fillCircle(0, lip, radius);
    base.lineStyle(3, OUTLINE, 1);
    base.strokeCircle(0, lip, radius);

    const face = scene.add.graphics();
    face.fillStyle(color, 1);
    face.fillCircle(0, 0, radius);
    face.lineStyle(3, OUTLINE, 1);
    face.strokeCircle(0, 0, radius);
    face.fillStyle(0xffffff, 0.18);
    face.fillEllipse(0, -radius * 0.45, radius * 1.3, radius * 0.6);
    face.fillStyle(0xffffff, 1);
    if (icon === 'pause') {
        const bw = radius * 0.24;
        const bh = radius * 0.9;
        face.fillRoundedRect(-bw * 1.6, -bh / 2, bw, bh, 2);
        face.fillRoundedRect(bw * 0.6, -bh / 2, bw, bh, 2);
    } else if (icon === 'trophy') {
        // cup + handles + base
        face.fillRoundedRect(-radius * 0.38, -radius * 0.5, radius * 0.76, radius * 0.55, { tl: 2, tr: 2, bl: radius * 0.38, br: radius * 0.38 });
        face.lineStyle(radius * 0.13, 0xffffff, 1);
        face.strokeCircle(-radius * 0.42, -radius * 0.28, radius * 0.17);
        face.strokeCircle(radius * 0.42, -radius * 0.28, radius * 0.17);
        face.fillRect(-radius * 0.08, radius * 0.02, radius * 0.16, radius * 0.25);
        face.fillRoundedRect(-radius * 0.3, radius * 0.25, radius * 0.6, radius * 0.16, 2);
    } else if (icon === 'gear') {
        face.lineStyle(radius * 0.22, 0xffffff, 1);
        for (let i = 0; i < 8; i++) {
            const a = (i * Math.PI) / 4;
            face.lineBetween(Math.cos(a) * radius * 0.35, Math.sin(a) * radius * 0.35,
                Math.cos(a) * radius * 0.68, Math.sin(a) * radius * 0.68);
        }
        face.fillCircle(0, 0, radius * 0.42);
        face.fillStyle(color, 1);
        face.fillCircle(0, 0, radius * 0.18);
    }
    face.baseY = 0;

    c.add([base, face]);
    c.setSize(radius * 2 + 12, radius * 2 + 12);
    c.setInteractive({ useHandCursor: true });
    makePressable(c, [face], lip, onClick);
    return c;
}

// Dimmed modal with a chunky panel. Returns { objs, close, panel: {x, y, w, h} }.
export function modal(scene, { depth = 700, width = 320, height = 360, title = '', fade = true } = {}) {
    const { w: W, h: H } = view(scene);
    const pw = Math.min(width, W - 28);
    const ph = height;
    const px = W / 2 - pw / 2;
    const py = H / 2 - ph / 2;
    const objs = [];
    const add = (o) => { objs.push(o); return o; };

    // Swallows taps so nothing underneath reacts
    add(scene.add.rectangle(W / 2, H / 2, W, H, 0x05030c, 0.78).setDepth(depth).setInteractive());

    const g = add(scene.add.graphics().setDepth(depth + 1));
    g.fillStyle(0x000000, 0.4);
    g.fillRoundedRect(px + 4, py + 8, pw, ph, 24);
    g.fillStyle(0x2a1c52, 1);
    g.fillRoundedRect(px, py, pw, ph + 8, 24);
    g.fillStyle(0x1b1238, 1);
    g.fillRoundedRect(px, py, pw, ph, 24);
    g.lineStyle(4, OUTLINE, 1);
    g.strokeRoundedRect(px, py, pw, ph + 8, 24);
    g.lineStyle(2, 0x6366f1, 0.6);
    g.strokeRoundedRect(px + 6, py + 6, pw - 12, ph - 12, 20);

    if (title) {
        add(scene.add.text(W / 2, py + 40, title, {
            fontFamily: 'Righteous', fontSize: '32px', color: '#ffd23f',
            stroke: '#1b0f2e', strokeThickness: 6
        }).setOrigin(0.5).setDepth(depth + 2));
    }

    if (fade) {
        g.setAlpha(0);
        scene.tweens.add({ targets: g, alpha: 1, duration: 160 });
    }

    return {
        objs,
        add,
        depth: depth + 2,
        panel: { x: px, y: py, w: pw, h: ph, cx: W / 2 },
        close: () => objs.forEach((o) => o.destroy())
    };
}

function toggleRow(scene, m, y, label, valueText, isOn, onTap) {
    const { panel, depth } = m;
    m.add(scene.add.text(panel.x + 28, y, label, {
        fontFamily: 'Righteous', fontSize: '20px', color: '#e5e3ff'
    }).setOrigin(0, 0.5).setDepth(depth));
    m.add(chunkyButton(scene, panel.x + panel.w - 72, y, valueText, isOn ? 0x22c55e : 0x6b7280, onTap,
        { width: 96, height: 36, fontSize: 16, depth, enter: false }));
}

// Settings panel. onClose(languageChanged) runs after it closes.
export function openSettings(scene, { depth = 720, onClose } = {}) {
    const startLang = lang();
    const startGraphics = settings.get('graphics');
    let m = null;

    const render = () => {
        const first = !m;
        if (m) m.close();
        const ROW = 52;
        m = modal(scene, { depth, height: 100 + ROW * 7 + 76, title: t('settings'), fade: first });
        const { panel } = m;
        let y = panel.y + 96;
        ['music', 'sfx', 'vibration'].forEach((key) => {
            const on = settings.get(key);
            toggleRow(scene, m, y, t(key), on ? t('on') : t('off'), on, () => {
                settings.set(key, !on);
                render();
            });
            y += ROW;
        });
        toggleRow(scene, m, y, t('language'), lang().toUpperCase(), true, () => {
            settings.set('lang', lang() === 'pt' ? 'en' : 'pt');
            render();
        });
        y += ROW;
        // Sharp HiDPI rendering costs GPU fill: NORMAL renders at 1x for weaker phones (applied on reload)
        const high = settings.get('graphics') !== 'normal';
        toggleRow(scene, m, y, t('graphics'), high ? t('high') : t('normal'), high, () => {
            settings.set('graphics', high ? 'normal' : 'high');
            render();
        });
        y += ROW;
        // Accessibility: high contrast pieces (applies to the next game) and less motion
        const hc = !!settings.get('highContrast');
        toggleRow(scene, m, y, t('highContrast'), hc ? t('high') : t('normal'), hc, () => {
            settings.set('highContrast', !hc);
            render();
        });
        y += ROW;
        const calm = !!settings.get('reduceMotion');
        toggleRow(scene, m, y, t('reduceMotion'), calm ? t('less') : t('full'), !calm, () => {
            settings.set('reduceMotion', !calm);
            render();
        });
        m.add(chunkyButton(scene, panel.cx, panel.y + panel.h - 42, t('close'), 0x6366f1, () => {
            m.close();
            if (settings.get('graphics') !== startGraphics) {
                window.location.reload();
                return;
            }
            if (onClose) onClose(lang() !== startLang);
        }, { width: 180, height: 50, fontSize: 22, depth: m.depth, enter: false }));
    };
    render();
}
