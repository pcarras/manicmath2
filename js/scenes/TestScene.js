import { CONSTANTS, PIECE_BODY } from '../constants.js';
import { ensureTextures, preloadPieceAssets } from '../textures.js';
import { INV, view, setupCamera } from '../display.js';
import { createStarfield } from '../starfield.js';
import { chunkyButton } from '../ui.js';

const R = CONSTANTS.RADIUS;
const KEYS = ['piece_num_1', 'piece_num_5', 'piece_num_9', 'piece_op_plus', 'piece_op_times', 'piece_special_bomb'];

// Developer stress test (debug mode only): keeps dropping pieces and reports fps and physics time,
// so a phone can be checked against the 60 fps target with a full screen of pieces.
export class TestScene extends Phaser.Scene {
    constructor() {
        super({ key: 'TestScene' });
    }

    preload() {
        preloadPieceAssets(this);
    }

    create() {
        setupCamera(this);
        const { w, h } = view(this);
        this.w = w;
        ensureTextures(this);
        createStarfield(this);
        this.matter.world.setBounds(0, -h, w, h * 2, 200, true, true, false, true);
        this.pieces = [];
        this.acc = 0;
        this.hudAcc = 0;
        this.minFps = 999;
        this.physMs = 0;
        this.matter.world.on('beforeupdate', () => { this.t0 = performance.now(); });
        this.matter.world.on('afterupdate', () => {
            this.physMs = this.physMs * 0.9 + (performance.now() - this.t0) * 0.1;
        });

        this.hud = this.add.text(12, 12, '', {
            fontFamily: 'monospace', fontSize: '14px', color: '#00ff88', backgroundColor: '#000000aa', padding: { x: 6, y: 4 }
        }).setDepth(100);
        chunkyButton(this, w / 2, h - 46, 'MENU', 0x6366f1, () => this.scene.start('MenuScene'),
            { width: 160, height: 46, fontSize: 20, depth: 100 });
        // Tap anywhere to pop a piece (exercises the same remove + wake path as the game)
        this.input.on('pointerdown', (p) => {
            const hit = this.pieces.find((q) => Phaser.Math.Distance.Between(q.body.position.x, q.body.position.y, p.worldX, p.worldY) < R);
            if (hit) this.remove(hit);
        });
    }

    remove(q) {
        this.matter.world.remove(q.body);
        q.img.destroy();
        this.pieces.splice(this.pieces.indexOf(q), 1);
        this.pieces.forEach((o) => Phaser.Physics.Matter.Matter.Sleeping.set(o.body, false));
    }

    update(time, delta) {
        for (const q of this.pieces) {
            q.img.x = q.body.position.x;
            q.img.y = q.body.position.y;
        }
        this.acc += delta;
        if (this.acc > 250 && this.pieces.length < 80) {
            this.acc = 0;
            const x = R + Math.random() * (this.w - 2 * R);
            const body = this.matter.add.circle(x, -R * 2, R, { ...PIECE_BODY, label: 'piece' });
            const img = this.add.image(x, -R * 2, Phaser.Utils.Array.GetRandom(KEYS)).setScale(INV).setDepth(10);
            this.pieces.push({ body, img });
        }
        const fps = this.game.loop.actualFps;
        if (time > 3000) this.minFps = Math.min(this.minFps, fps);
        this.hudAcc += delta;
        if (this.hudAcc > 400) {
            this.hudAcc = 0;
            this.hud.setText(`${Math.round(fps)} fps (min ${Math.round(this.minFps)})\nphysics ${this.physMs.toFixed(2)} ms\n${this.pieces.length} pieces`);
        }
    }
}
