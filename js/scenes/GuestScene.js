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
        this.sprites = new Map();     // piece id -> { img, ice, key, alive }
        this.snaps = [];              // received board frames, oldest first
        this.keys = {};
        this.mySlots = [-1, -1, -1];
        this.slotImgs = [null, null, null];
        this.hintIds = [];
        this.clock = undefined;
        this.timerOn = false;
        this.hintOn = false;
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
        if (msg.keys) Object.assign(this.keys, msg.keys);
        else if (msg.s) this.queueSnapshot(msg);
        else if (msg.fx) this.playFx(msg);
        else if (msg.over && !this.gameOver) this.endGame(msg.reason === 'board' ? 'mateOver' : 'left');
    }

    // The board arrives about 30 times a second. It is not drawn the moment it arrives: it goes in a
    // small buffer and the screen shows the board as it was ~100 ms ago, blending between the two
    // frames around that moment. That hides network jitter, so pieces glide instead of stepping.
    queueSnapshot(m) {
        const now = performance.now();
        const d = now - m.ts;
        if (this.clock === undefined) this.clock = d;
        else if (d < this.clock) this.clock = d;                 // a faster delivery: trust it at once
        else this.clock += (d - this.clock) * 0.01;              // slower ones only nudge the estimate
        const map = new Map();
        const f = m.s;
        for (let i = 0; i < f.length; i += 7) map.set(f[i], f.slice(i + 1, i + 7));
        this.snaps.push({ ts: m.ts, map, hud: m, applied: false });
        if (this.snaps.length > 40) this.snaps.shift();
    }

    // Applies what is not about pieces (score, target, level, power-ups, my slots) from a frame
    applyHud(m) {
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
        // Timer power-up: the same sound, music pause, tick-tock and tint as on the other phone
        if (m.tm > 0 && !this.timerOn) {
            this.timerOn = true;
            this.playSound('timeSound', 0.8);
            this.music.hold(true);
            this.sfx.startTickTock();
            this.tweens.killTweensOf(this.timerOverlay);
            this.tweens.add({ targets: this.timerOverlay, alpha: 0.1, duration: 400 });
        } else if (m.tm === 0 && this.timerOn) {
            this.timerOn = false;
            this.sfx.stopTickTock();
            if (!this.gameOver) this.music.hold(false);
            this.tweens.killTweensOf(this.timerOverlay);
            this.tweens.add({ targets: this.timerOverlay, alpha: 0, duration: 400 });
        }
        this.timerBadge.setVisible(m.tm > 0);
        if (m.tm > 0) this.timerBadge.label.setText(String(m.tm));
        if (m.hn > 0 && !this.hintOn) {
            this.hintOn = true;
            this.playSound('bonusSound', 0.7);
        } else if (m.hn === 0) this.hintOn = false;
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

    // Everything the host did that has something to see or hear, shown the same way here
    playFx(m) {
        switch (m.fx) {
            case 'boom':
                this.boomFx(m.x, m.y);
                break;
            case 'fuse': {
                const s = this.sprites.get(m.id);
                if (s) this.fuseVisual(s, m.ms);
                break;
            }
            case 'heat': {
                const { reach, travel } = this.heatFx(m.x, m.y);
                for (const [, sp] of this.sprites) {
                    if (!sp.ice) continue;
                    const d = Phaser.Math.Distance.Between(m.x, m.y, sp.img.x, sp.img.y);
                    this.time.delayedCall((d / reach) * travel, () => { if (sp.alive) this.thawFx(sp.img.x, sp.img.y, sp.img); });
                }
                break;
            }
            case 'recycle':
                this.recycleFx(m.x, m.y, m.ends, false);
                break;
            case 'ice':
                this.crackIceFx(m.x, m.y);
                break;
            case 'jdmg':
                this.sparks.emitParticleAt(m.x, m.y, 6);
                if (m.hp <= 0) {
                    this.shards.emitParticleAt(m.x, m.y, 16);
                    this.sparks.emitParticleAt(m.x, m.y, 10);
                    this.sfx.metalBreak();
                } else {
                    this.sfx.clank(m.hp === 2 ? 1 : 0.85);
                    this.shards.emitParticleAt(m.x, m.y, 3);
                }
                break;
            case 'jdrop':
                this.time.delayedCall(450, () => this.sfx.clank(0.7));
                break;
            case 'solved':
                this.playSound('popSound', 0.6);
                this.mpNotice(`${this.mateName()} +${m.pts}`, '#4ade80');
                break;
            case 'taken':
                this.mpNotice(t('partnerTaken'), '#ffd9a8');
                break;
            case 'res':
                this.showResult(m);
                break;
            default:
        }
    }

    showResult(m) {
        logEquation(m.a, m.o, m.b, m.target, m.ok);
        if (m.ok) {
            this.playSound('popSound', 0.8);
            this.sfx.rise(3);
            haptic('success');
            this.flash(160, 40, 160, 90);
            this.createFloatingText(this.targetX, this.eqY + this.slotSize * 0.6, `+${m.pts}`, 0x4ade80);
            this.slotImgs.forEach((img) => { if (img) this.burst.emitParticleAt(img.x, img.y, 12); });
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

    removeSprite(id, s) {
        this.clearFuse(s);
        s.alive = false;
        this.burst.setParticleTint(0xffffff);
        this.burst.emitParticleAt(s.img.x, s.img.y, 8);
        s.img.destroy();
        if (s.ice) s.ice.destroy();
        this.sprites.delete(id);
    }

    update() {
        const snaps = this.snaps;
        this.selRings.forEach((r) => r.setVisible(false));
        this.mateRings.forEach((r) => r.setVisible(false));
        this.hintRings.forEach((r) => r.setVisible(false));
        this.hintGlows.forEach((r) => r.setVisible(false));
        if (!snaps.length) return;

        // The host's clock now, minus the delay that keeps a frame ahead of the one being shown
        const rt = performance.now() - this.clock - 100;
        // Frames the screen has moved past: apply their score/target/etc. once, then forget old ones
        for (const sn of snaps) {
            if (sn.ts <= rt && !sn.applied) {
                sn.applied = true;
                this.applyHud(sn.hud);
            }
        }
        while (snaps.length > 2 && snaps[1].ts <= rt) snaps.shift();
        const A = snaps[0];
        const B = snaps.length > 1 ? snaps[1] : snaps[0];
        const span = B.ts - A.ts;
        const k = span > 0 ? Phaser.Math.Clamp((rt - A.ts) / span, 0, 1) : 1;

        let mine = 0;
        let mate = 0;
        for (const [id, to] of B.map) {
            const key = this.keys[to[3]];
            let sp = this.sprites.get(id);
            if (!sp) {
                if (!key || !this.textures.exists(key)) continue;
                const from0 = A.map.get(id) || to;
                const img = this.add.image(from0[0], from0[1], key).setDepth(10).setScale(INV);
                sp = { img, ice: null, key, alive: true };
                this.sprites.set(id, sp);
            }
            const from = A.map.get(id) || to;
            const x = from[0] + (to[0] - from[0]) * k;
            const y = from[1] + (to[1] - from[1]) * k;
            sp.img.setPosition(x, y);
            if (key && key !== sp.key && this.textures.exists(key)) {
                sp.key = key;
                sp.img.setTexture(key);
            }
            if (key && key.includes('junk')) sp.img.rotation = (from[2] + (to[2] - from[2]) * k) / 100;
            const ice = from[4] + (to[4] - from[4]) * k;
            if (ice > 0 && !sp.ice) sp.ice = this.add.image(x, y, 'ice').setDepth(11).setScale(INV);
            if (sp.ice) {
                sp.ice.setPosition(x, y).setAlpha(ice / 100);
                if (to[4] === 0 && from[4] === 0) { sp.ice.destroy(); sp.ice = null; }
            }
            if (to[5] === 2 && mine < 3) this.selRings[mine++].setVisible(true).setPosition(x, y);
            else if (to[5] === 1 && mate < 3) this.mateRings[mate++].setVisible(true).setPosition(x, y);
            const h = this.hintIds.indexOf(id);
            if (h >= 0 && h < 3) {
                this.hintRings[h].setVisible(true).setPosition(x, y);
                this.hintGlows[h].setVisible(true).setPosition(x, y);
            }
        }
        // Pieces that are gone in the newer frame pop once the blend is past halfway
        if (k >= 0.5) {
            for (const [id, sp] of [...this.sprites]) if (!B.map.has(id)) this.removeSprite(id, sp);
        }
    }
}
