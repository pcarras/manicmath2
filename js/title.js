// Menu title: "MANIC / MATH" in hot chrome letters that drop in one by one, land with a squash
// and a puff of dust, then breathe in a slow wave while a glint sweeps across now and then.
// Plus a slow rain of translucent game pieces behind the menu. All tweens, no per-frame code.
import { TEX_PX } from './textures.js';

const LINES = ['MANIC', 'MATH'];
const STOPS = [[0, '#ffffff'], [0.32, '#fff1b8'], [0.52, '#ffb238'], [0.78, '#ff5e5b'], [1, '#c2185b']];

function letter(scene, ch, size, shine) {
    const t = scene.add.text(0, 0, ch, {
        fontFamily: 'Righteous',
        fontSize: `${size}px`,
        color: '#ffffff',
        stroke: shine ? undefined : '#1b0f2e',
        strokeThickness: shine ? 0 : Math.round(size * 0.13),
        shadow: shine ? undefined : { offsetX: 0, offsetY: Math.round(size * 0.09), color: '#7b2cbf', blur: 0, fill: true, stroke: true },
        padding: { x: 6, y: 6 }
    }).setOrigin(0.5);
    if (!shine) {
        // Gradient fill in the text's own canvas space (Phaser applies the resolution scale itself)
        const g = t.context.createLinearGradient(0, t.height * 0.18, 0, t.height * 0.82);
        STOPS.forEach(([at, col]) => g.addColorStop(at, col));
        t.setFill(g);
    } else {
        t.setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
    }
    return t;
}

// Returns the y just below the title
export function createTitle(scene, cx, y1, size, { intro = true, calm = false } = {}) {
    const letters = [];
    LINES.forEach((word, li) => {
        const y = y1 + li * size * 0.94;
        const parts = [...word].map((ch) => {
            const c = scene.add.container(0, y).setDepth(3);
            const main = letter(scene, ch, size, false);
            const glint = letter(scene, ch, size, true);
            c.add([main, glint]);
            c.glint = glint;
            c.home = y;
            c.w = main.width - size * 0.16;
            return c;
        });
        const total = parts.reduce((a, p) => a + p.w, 0);
        let x = cx - total / 2;
        parts.forEach((p) => {
            p.x = x + p.w / 2;
            x += p.w;
            letters.push(p);
        });
    });

    // Soft purple glow behind the words
    const glow = scene.add.image(cx, y1 + size * 0.47, 'nebula').setTint(0x7c3aed)
        .setDisplaySize(size * 6.2, size * 3).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0).setDepth(2);
    scene.tweens.add({ targets: glow, alpha: 0.42, duration: 900, delay: intro ? 600 : 0 });
    if (!calm) scene.tweens.add({ targets: glow, alpha: 0.25, duration: 2600, yoyo: true, repeat: -1, delay: 1600, ease: 'Sine.easeInOut' });

    const dust = scene.add.particles(0, 0, 'particle', {
        speed: { min: 30, max: 110 }, angle: { min: 180, max: 360 }, scale: { start: 0.6, end: 0 },
        alpha: { start: 0.5, end: 0 }, lifespan: 450, tint: 0xc4b5fd, emitting: false
    }).setDepth(2);

    const idle = (c, i) => {
        if (calm) return;
        scene.tweens.add({
            targets: c, y: c.home - size * 0.06, duration: 1500, yoyo: true, repeat: -1,
            ease: 'Sine.easeInOut', delay: i * 110
        });
    };

    letters.forEach((c, i) => {
        if (!intro || calm) {
            c.setAlpha(0);
            scene.tweens.add({ targets: c, alpha: 1, duration: 300, delay: i * 30, onComplete: () => idle(c, i) });
            return;
        }
        c.y = -size * 2 - i * 30;
        scene.tweens.add({
            targets: c, y: c.home, duration: 620, delay: 150 + i * 85, ease: 'Bounce.easeOut',
            onComplete: () => {
                scene.tweens.add({ targets: c, scaleY: 0.8, scaleX: 1.14, duration: 80, yoyo: true, ease: 'Quad.easeOut' });
                dust.emitParticleAt(c.x, c.home + size * 0.42, 6);
                if (i === letters.length - 1) scene.cameras.main.shake(140, 0.004);
                idle(c, i);
            }
        });
    });

    // Glint: a white copy of each letter flashes left to right
    const sweep = () => letters.forEach((c, i) => {
        scene.tweens.add({ targets: c.glint, alpha: 0.75, duration: 140, delay: i * 60, yoyo: true, ease: 'Sine.easeOut' });
    });
    scene.time.delayedCall(intro && !calm ? 1300 : 600, sweep);
    if (!calm) scene.time.addEvent({ delay: 4200, loop: true, callback: sweep });

    return y1 + size * 1.5;
}

// Translucent game pieces drifting down behind the menu
export function createPieceRain(scene, w, h, count = 9) {
    const keys = ['piece_num_3', 'piece_num_7', 'piece_num_5', 'piece_num_9', 'piece_op_plus', 'piece_op_times',
        'piece_op_minus', 'piece_op_divide', 'piece_num_2', 'piece_num_8'].filter((k) => scene.textures.exists(k));
    if (!keys.length) return;
    for (let i = 0; i < count; i++) {
        const near = Math.random();
        const img = scene.add.image(0, 0, Phaser.Utils.Array.GetRandom(keys))
            .setScale((32 + near * 34) / TEX_PX)
            .setAlpha(0.1 + near * 0.16)
            .setDepth(0.5 + near * 0.4);
        const fall = (first) => {
            img.x = 20 + Math.random() * (w - 40);
            img.y = first ? Math.random() * h : -50;
            img.angle = Phaser.Math.Between(-18, 18);   // small tilt: numbers stay readable
            const dur = (first ? (h - img.y) / h : 1) * (16000 - near * 6000);
            scene.tweens.add({
                targets: img, y: h + 50, angle: img.angle + Phaser.Math.Between(-25, 25), duration: dur, ease: 'Linear',
                onComplete: () => fall(false)
            });
        };
        fall(true);
    }
}

