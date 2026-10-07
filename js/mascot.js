// Bica, the mascot: a Portuguese espresso cup (art in assets/mascot/web, made by tools/art/key_mascot.py).
// Poses for the menu, the tutorial, the pause and the end of a game; accessories bought in the shop
// are worn in the waving pose (their place is measured on that picture).
import { currentItem } from './progress.js';

export const POSES = ['happy', 'think', 'cheer', 'sad', 'point', 'sleep', 'wow'];

// x, y: centre of the accessory and w: its width, all as fractions of the "happy" picture
export const ACC_PLACE = {
    cap: { x: 0.53, y: 0.25, w: 0.62 },
    crown: { x: 0.54, y: 0.2, w: 0.42 },
    glasses: { x: 0.55, y: 0.585, w: 0.44 },
    scarf: { x: 0.54, y: 0.83, w: 0.64 },
    party: { x: 0.57, y: 0.12, w: 0.3 },
    headphones: { x: 0.54, y: 0.42, w: 0.82 }
};

export function preloadMascot(scene, poses = POSES) {
    poses.forEach((p) => {
        const key = `bica_${p}`;
        if (!scene.textures.exists(key)) scene.load.image(key, `assets/mascot/web/bica-${p}.webp`);
    });
    Object.keys(ACC_PLACE).forEach((id) => {
        const key = `acc_${id}`;
        if (!scene.textures.exists(key)) scene.load.image(key, `assets/mascot/web/acc-${id}.webp`);
    });
}

// A container with the mascot (and, in the waving pose, the accessory in use), `height` px tall.
// Origin at the bottom centre, so it stands on (x, y).
export function addMascot(scene, x, y, pose = 'happy', { height = 110, depth = 20, accessory } = {}) {
    const key = `bica_${pose}`;
    const c = scene.add.container(x, y).setDepth(depth);
    if (!scene.textures.exists(key)) return c;
    const img = scene.add.image(0, 0, key).setOrigin(0.5, 1);
    const k = height / img.height;
    img.setScale(k);
    c.add(img);
    const acc = accessory !== undefined ? accessory : currentItem('acc');
    const place = ACC_PLACE[acc];
    if (pose === 'happy' && place && scene.textures.exists(`acc_${acc}`)) {
        const w = img.width * k;
        const h = img.height * k;
        const a = scene.add.image(-w / 2 + place.x * w, -h + place.y * h, `acc_${acc}`);
        a.setScale((place.w * w) / a.width);
        c.add(a);
    }
    c.body = img;
    return c;
}

// Gentle idle bob
export function bob(scene, c, amount = 4) {
    scene.tweens.add({ targets: c, y: c.y - amount, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
}

// Speech bubble next to the mascot. side: 'right' puts the bubble to the right of (x, y).
export function say(scene, x, y, text, { depth = 21, width = 220, side = 'right' } = {}) {
    const label = scene.add.text(0, 0, text, {
        fontFamily: 'Righteous', fontSize: '16px', color: '#1b0f2e', align: 'center', wordWrap: { width: width - 24 }
    }).setOrigin(0.5);
    const bw = Math.min(width, label.width + 26);
    const bh = label.height + 18;
    const bx = side === 'right' ? x + bw / 2 : x - bw / 2;
    const g = scene.add.graphics();
    g.fillStyle(0xfff7e6, 1);
    g.fillRoundedRect(-bw / 2, -bh / 2, bw, bh, 14);
    g.lineStyle(3, 0x1b0f2e, 1);
    g.strokeRoundedRect(-bw / 2, -bh / 2, bw, bh, 14);
    // little tail pointing at the mascot
    const tx = side === 'right' ? -bw / 2 : bw / 2;
    g.fillStyle(0xfff7e6, 1);
    g.fillTriangle(tx, 4, tx + (side === 'right' ? -12 : 12), 12, tx, 14);
    const c = scene.add.container(bx, y, [g, label]).setDepth(depth).setScale(0.6).setAlpha(0);
    scene.tweens.add({ targets: c, scale: 1, alpha: 1, duration: 220, ease: 'Back.easeOut' });
    return c;
}
