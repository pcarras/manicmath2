import { GameScene, TAP_RADIUS_SQ } from './GameScene.js';
import { ensureTextures, TEX_PX } from '../textures.js';
import { Sfx } from '../sfx.js';
import { INV, view, setupCamera } from '../display.js';
import { createBackdrop } from '../backdrops.js';
import { t } from '../i18n.js';
import { haptic } from '../settings.js';
import { MusicDirector } from '../music.js';
import { logEquation } from '../analysis.js';
import { currentItem } from '../progress.js';

// TEAM mode on the second phone: no physics here. The room creator's phone runs the board and
// streams it (GameScene.sendSnapshot); this scene draws exactly that, smoothly, and sends taps.
// Same HUD, the player's own equation slots, and the team score.
export class GuestScene extends GameScene {
    constructor() {
        super({ key: 'GuestScene' });
    }

    init(data) {
        super.init(data);
        // The host-only code paths in GameScene look at this.link: keep the link under another name
        this.peer = this.link;
        this.link = null;
        this.sprites = new Map();     // piece id -> { img, ice, tx, ty, rot, sel, key }
        this.keys = {};
        this.mySlots = [-1, -1, -1];
        this.slotImgs = [null, null, null];
        this.hintIds = [];
    }

    create() {
        setupCamera(this);
        const size = view(this);
        this.w = size.w;
        this.h = size.h;
        this.time.paused = false;
        ensureTextures(this);
        this.bg = createBackdrop(this, currentItem('scene'));
        this.createFx();
        this.buildHud();
        this.createRings();

        this.input.on('pointerdown', this.onGuestDown, this);
        this.sound.stopAll();
        this.music = new MusicDirector(this);
        this.sfx = new Sfx(this);
        this.beanChain = 0;
        this.lastBeanAt = 0;
        this.music.setLevel(1);
        this.events.once('shutdown', () => {
            if (this.music) this.music.stop();
            if (this.sfx) this.sfx.stopAll();
            setTimeout(() => this.peer.close(), 1500);
        });

        this.peer.onMessage((msg) => this.onHost(msg));
        this.peer.onClose(() => { if (!this.gameOver) this.endGame('left'); });
        this.setupMulti();
        this.gameStarted = true;
    }

    // ------------------------------------------------------------------ from the host

    onHost(msg) {
        if (msg.s) this.applySnapshot(msg);
        else if (msg.fx) this.playFx(msg);
        else if (msg.over && !this.gameOver) this.endGame(msg.reason === 'board' ? 'mateOver' : 'left');
    }

    applySnapshot(m) {
        Object.assign(this.keys, m.k);
        const seen = new Set();
        const f = m.s;
        for (let i = 0; i < f.length; i += 7) {
            const [id, x, y, rot, k, ice, sel] = f.slice(i, i + 7);
            seen.add(id);
            const key = this.keys[k];
            let s = this.sprites.get(id);
            if (!s) {
                if (!key || !this.textures.exists(key)) continue;
                const img = this.add.image(x, y, key).setDepth(10).setScale(INV);
                s = { img, ice: null, tx: x, ty: y, rot: rot / 100, sel, key };
                this.sprites.set(id, s);
            }
            s.tx = x;
            s.ty = y;
            s.rot = rot / 100;
            s.sel = sel;
            if (key && key !== s.key && this.textures.exists(key)) {
                s.key = key;
                s.img.setTexture(key);
            }
            if (ice > 0 && !s.ice) s.ice = this.add.image(s.img.x, s.img.y, 'ice').setDepth(11).setScale(INV);
            if (s.ice) s.ice.setAlpha(ice / 100);
            if (ice === 0 && s.ice) { s.ice.destroy(); s.ice = null; }
        }
        // Pieces gone on the host: pop them here too
        for (const [id, s] of this.sprites) {
            if (seen.has(id)) continue;
            this.burst.setParticleTint(0xffffff);
            this.burst.emitParticleAt(s.img.x, s.img.y, 8);
            s.img.destroy();
            if (s.ice) s.ice.destroy();
            this.sprites.delete(id);
        }

        if (m.t !== this.target) this.setTarget(m.t);
        if (m.sc) {
            const mine = m.sc[1];
            if (mine !== this.score) {
                this.score = mine;
                this.scoreText.setText(String(mine));
                this.tweens.add({ targets: this.scoreText, scale: 1.25, duration: 120, yoyo: true });
            }
            this.mate.score = m.sc[0];
            this.mate.solved = m.so[0];
            this.solved = m.so[0] + m.so[1];
            this.updateMpHud();
        }
        if (m.lv && m.lv !== this.level) {
            const up = m.lv > this.level;
            this.level = m.lv;
            this.music.setLevel(this.level);
            if (up) this.showLevelUp(null);
        }
        this.updateLevelHud();
        this.timerBadge.setVisible(m.tm > 0);
        if (m.tm > 0) this.timerBadge.label.setText(String(m.tm));
        this.hintBadge.setVisible(m.hn > 0);
        if (m.hn > 0) this.hintBadge.label.setText(String(m.hn));
        this.hintIds = m.hp || [];
        this.syncSlots(m.gs || [-1, -1, -1]);
    }

    // My equation: the pieces the host has in my three slots
    syncSlots(ids) {
        for (let i = 0; i < 3; i++) {
            if (ids[i] === this.mySlots[i]) continue;
            this.mySlots[i] = ids[i];
            const old = this.slotImgs[i];
            if (old) {
                this.tweens.killTweensOf(old);
                old.destroy();
                this.slotImgs[i] = null;
            }
            const s = ids[i] >= 0 ? this.sprites.get(ids[i]) : null;
            if (!s) continue;
            const img = this.add.image(s.img.x, s.img.y, s.key).setDepth(150).setScale(INV);
            this.slotImgs[i] = img;
            this.tweens.add({ targets: img, x: this.slotPos[i].x, y: this.slotPos[i].y, scale: this.slotScale, duration: 300, ease: 'Back.easeOut' });
        }
    }

    playFx(m) {
        if (m.fx === 'boom') {
            this.playSound('explosionSound', 0.9);
            this.shake(320, 0.02);
            haptic('bomb');
            this.sparks.emitParticleAt(m.x, m.y, 30);
            const wave = this.add.image(m.x, m.y, 'ring').setTint(0xffaa33).setDepth(190).setScale(0.4 * INV);
            this.tweens.add({ targets: wave, scale: 6 * INV, alpha: 0, duration: 380, ease: 'Cubic.easeOut', onComplete: () => wave.destroy() });
        } else if (m.fx === 'solved') {
            this.playSound('popSound', 0.6);
            this.mpNotice(`${this.mateName()} +${m.pts}`, '#4ade80');
        } else if (m.fx === 'taken') {
            this.mpNotice(t('partnerTaken'), '#ffd9a8');
        } else if (m.fx === 'res') {
            logEquation(m.a, m.o, m.b, m.target, m.ok);
            if (m.ok) {
                this.playSound('popSound', 0.8);
                this.sfx.rise(3);
                haptic('success');
                this.flash(160, 40, 160, 90);
                this.createFloatingText(this.targetX, this.eqY + this.slotSize * 0.6, `+${m.pts}`, 0x4ade80);
                this.slotImgs.forEach((img) => {
                    if (!img) return;
                    this.burst.emitParticleAt(img.x, img.y, 12);
                });
            } else {
                this.playSound('dropSound', 0.8);
                haptic('fail');
                this.shake(220, 0.012);
                this.flash(140, 200, 50, 50);
                const shown = m.o === '-' ? '−' : m.o;
                const made = m.made === null ? `${m.a} ${shown} ${m.b} ${t('notWhole')}` : `${m.a} ${shown} ${m.b} = ${m.made}  ≠ ${m.target}`;
                this.mpNotice(made, '#ffb4b4');
            }
        }
    }

    // ------------------------------------------------------------------ my taps go to the host

    onGuestDown(pointer, over) {
        if (this.gameOver || (over && over.length)) return;
        const x = pointer.worldX;
        const y = pointer.worldY;
        if (y < this.uiHeight) {
            const half = this.slotSize / 2 + 6;
            for (let i = 0; i < 3; i++) {
                const pos = this.slotPos[i];
                if (this.mySlots[i] >= 0 && Math.abs(x - pos.x) < half && Math.abs(y - pos.y) < half) {
                    this.playClick();
                    this.peer.send({ untap: i });
                    return;
                }
            }
            return;
        }
        let best = null;
        let bestD = TAP_RADIUS_SQ;
        for (const [id, s] of this.sprites) {
            const dx = s.img.x - x;
            const dy = s.img.y - y;
            const d = dx * dx + dy * dy;
            if (d < bestD) { bestD = d; best = id; }
        }
        if (best === null) return;
        this.playClick();
        const s = this.sprites.get(best);
        this.tweens.add({ targets: s.img, scale: 1.1 * INV, duration: 70, yoyo: true });
        this.peer.send({ tap: best });
    }

    endGame(reason) {
        if (reason === 'quit') this.peer.send({ quit: true });
        super.endGame(reason);
    }

    // ------------------------------------------------------------------ smooth drawing

    update(time, delta) {
        const k = Math.min(1, delta / 55);
        let mine = 0;
        let mate = 0;
        this.selRings.forEach((r) => r.setVisible(false));
        this.mateRings.forEach((r) => r.setVisible(false));
        this.hintRings.forEach((r) => r.setVisible(false));
        this.hintGlows.forEach((r) => r.setVisible(false));
        for (const [id, s] of this.sprites) {
            s.img.x += (s.tx - s.img.x) * k;
            s.img.y += (s.ty - s.img.y) * k;
            if (s.key && s.key.includes('junk')) s.img.rotation = s.rot;
            if (s.ice) s.ice.setPosition(s.img.x, s.img.y);
            if (s.sel === 2 && mine < 3) this.selRings[mine++].setVisible(true).setPosition(s.img.x, s.img.y);
            else if (s.sel === 1 && mate < 3) this.mateRings[mate++].setVisible(true).setPosition(s.img.x, s.img.y);
            const h = this.hintIds.indexOf(id);
            if (h >= 0 && h < 3) {
                this.hintRings[h].setVisible(true).setPosition(s.img.x, s.img.y);
                this.hintGlows[h].setVisible(true).setPosition(s.img.x, s.img.y);
            }
        }
    }
}
