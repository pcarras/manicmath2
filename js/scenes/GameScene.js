
import { COLORS, CONSTANTS, PIECE_BODY, LEVELS, SCORING } from '../constants.js';
import { ensureTextures, preloadPieceAssets, pieceTextureKey, TEX_PX, JUNK_SIDE, SHEEN_FRAMES, POP_FX } from '../textures.js';
import { Sfx } from '../sfx.js';
import { DRILLS } from '../drills.js';
import { INV, RES, view, setupCamera } from '../display.js';
import { createBackdrop, preloadBackdrop } from '../backdrops.js';
import { safeAreaTop, safeAreaBottom } from '../pwa.js';
import { t } from '../i18n.js';
import { settings, haptic, isDebug } from '../settings.js';
import { chunkyButton, roundButton, modal, openSettings } from '../ui.js';
import { stats, daily, todayKey, modeBest } from '../stats.js';
import { report, achievementText, drawMedal } from '../achievements.js';
import { MusicDirector } from '../music.js';
import { logEquation } from '../analysis.js';
import { preloadMascot, addMascot, bob } from '../mascot.js';
import { track, addBeans, completeDaily, missionText, currentItem } from '../progress.js';
import { submitScore, shareText, share } from '../ranking.js';

const {
    RADIUS: R, DIAMETER, TIMER_POWERUP_MS, HINT_POWERUP_MS,
    ICE_CHANCE, ICE_FREEZE_MS, DANGER_MS, DAILY_MS, SPRINT_MS, HEAT_THAW_MS, START_PIECES
} = CONSTANTS;

const OPS = ['+', '-', '×', '÷'];
export const TAP_RADIUS_SQ = (R * 1.2) ** 2;

export function calc(a, op, b) {
    switch (op) {
        case '+': return a + b;
        case '-': return a - b;
        case '×': return a * b;
        case '÷': return b !== 0 && a % b === 0 ? a / b : null;
    }
    return null;
}

export class GameScene extends Phaser.Scene {
    constructor(config) {
        super(config || { key: 'GameScene' });
    }

    init(data) {
        this.tutorial = !!(data && data.tutorial);
        // Daily challenge: same pieces and targets for everyone today (separate seeded streams so one
        // player's actions never shift the sequence), time attack, all operators from the start
        this.daily = !this.tutorial && !!(data && data.daily);
        // tutorial | daily | classic, or a two-player game: team | duel (see net.js)
        const asked = data && data.mode;
        this.mode = this.tutorial ? 'tutorial' : this.daily ? 'daily' : (asked === 'team' || asked === 'duel') ? asked : 'classic';
        // Zen and Sprint were retired; the flags stay false so the shared code paths read simply
        this.zen = false;
        this.sprint = false;
        this.timed = this.daily || this.sprint;
        this.dailyKey = todayKey();
        this.dailyRemaining = this.sprint ? SPRINT_MS : DAILY_MS;
        this.lastDailySecs = -1;
        this.solvedOps = [];               // operator of each equation, for the share grid
        this.beansEarned = 0;              // coffee beans won during this game (paid as they come)
        // Options being tested (settings > TESTS), fixed for the whole game
        this.energyOn = !this.tutorial && !!settings.get('energy');
        this.energy = 0;                   // 0..1
        this.chooser = null;
        // Two players (net.js): the room seed gives both phones the same pieces, numbered in order
        this.room = (this.mode === 'team' || this.mode === 'duel') && data && data.room ? data.room : null;
        this.multi = !!this.room;
        if (!this.multi && (this.mode === 'team' || this.mode === 'duel')) this.mode = 'classic';
        this.team = this.multi && this.mode === 'team';
        this.duel = this.multi && this.mode === 'duel';
        this.seqN = 0;              // order number of each seeded piece (the same piece on both phones)
        this.round = 0;             // team: equations solved by the team so far
        this.lastSolve = null;      // team: my last solve { round, target, i } to settle ties
        this.mate = { score: 0, solved: 0 };   // the other player's points and equations
        // TEAM: one shared board. The room creator's phone runs it (this scene) and streams it over a
        // direct link (p2p.js) to the other phone (GuestScene), which sends back its taps.
        this.link = this.team && data && data.link ? data.link : null;
        this.pidN = 0;
        this.guestSlots = [null, null, null];
        this.snapAcc = 0;
        this.keyIdx = new Map();
        const seedKey = this.daily ? `mm-${this.dailyKey}` : this.multi ? `mm-room-${this.room.seed}` : null;
        this.pieceRng = seedKey ? new Phaser.Math.RandomDataGenerator([`${seedKey}-pieces`]) : null;
        this.targetRng = seedKey ? new Phaser.Math.RandomDataGenerator([`${seedKey}-targets`]) : null;
        this.level = 1;
        this.solved = 0;
        this.combo = 0;
        this.bestCombo = 0;
        this.lastSuccessAt = -Infinity;
        this.quick = 0;
        this.streak = 0;
        this.toastQueue = [];
        this.toasting = false;
        this.spawnDelay = this.levelSpawnDelay(1);
        this.tutPieces = [];
        this.tutStep = -1;
        this.tutTarget = null;
        this.tutBubble = null;
        this.hand = null;

        this.score = 0;
        this.target = 0;
        this.pieces = [];                  // plain objects: { type, value|special, color, body, img, ice, selected, slot, alive, dangerMs }
        this.slots = [null, null, null];   // pieces placed in the equation
        this.slotDisplays = [null, null, null];
        this.validating = false;
        this.spawnTimer = 0;
        this.spawnQueue = [];
        this.gameOver = false;
        this.gameStarted = false;
        this.needsWake = false;

        this.timerRemaining = 0;
        this.hintRemaining = 0;
        this.hintPieces = [];
        this.hintRefresh = 0;
        this.lastTimerSecs = -1;
        this.lastHintSecs = -1;

        this.dangerAcc = 0;
        this.dangerTween = null;   // must reset: the old tween dies with the previous run on restart
        this.solveAcc = 0;
        this.forceQueue = false;
        this.physMs = 0;
        this.hudAcc = 0;

        this.paused = false;
        this.pauseUI = null;
        this.hudObjs = [];         // everything rebuilt on resize / language change
        this.upcoming = null;      // next random piece (shown in the NEXT preview)
        this.nextKey = null;
    }

    preload() {
        preloadBackdrop(this, currentItem('scene'));
        preloadMascot(this);
        this.load.audio('explosionSound', 'sounds/explosion1.mp3');
        this.load.audio('clickbutton', 'sounds/clickbutton.mp3');
        this.load.audio('timeSound', 'sounds/snd_time.mp3');
        this.load.audio('sparksSound', 'sounds/sparks.mp3');
        this.load.audio('dropSound', 'sounds/drop.mp3');
        this.load.audio('popSound', 'sounds/pop.mp3');
        this.load.audio('bonusSound', 'sounds/snd_bonus1.mp3');
        this.load.audio('impactSound', 'sounds/pop2.mp3');
        preloadPieceAssets(this);
    }

    create() {
        setupCamera(this);
        const size = view(this);
        this.w = size.w;
        this.h = size.h;

        const { Body, Sleeping } = Phaser.Physics.Matter.Matter;
        this.Body = Body;
        this.Sleeping = Sleeping;

        this.debug = isDebug();
        this.time.paused = false;
        this.tweens.resumeAll();

        ensureTextures(this);
        this.bg = createBackdrop(this, currentItem('scene'));

        // Walls reach far above the screen so pieces spawned off-screen stay inside; no ceiling.
        // The floor sits a little above the screen edge so taps never start where Android's
        // home swipe lives (no app can block that gesture).
        this.floorGap = 14 + Math.round(safeAreaBottom());
        this.matter.world.setBounds(0, -this.h, this.w, this.h * 2 - this.floorGap, 200, true, true, false, true);
        this.matter.world.on('beforeupdate', () => { this.physStart = performance.now(); });
        this.matter.world.on('afterupdate', () => {
            this.physMs = this.physMs * 0.9 + (performance.now() - this.physStart) * 0.1;
        });
        this.lastImpactAt = 0;
        this.matter.world.on('collisionstart', (event) => this.onImpact(event));

        this.createFx();
        this.buildHud();
        this.createRings();
        if (this.tutorial) this.hand = this.add.image(0, 0, 'hand').setDepth(160).setVisible(false).setScale(INV);

        this.input.on('pointerdown', this.onPointerDown, this);


        this.sound.stopAll();
        // Synthesized tracks that speed up with the levels (see music.js)
        this.music = new MusicDirector(this);
        this.sfx = new Sfx(this);
        this.beanChain = 0;
        this.lastBeanAt = 0;
        this.music.setLevel(this.level);

        // Auto-pause when the app goes to the background (call, notification, app switch)
        this.game.events.on(Phaser.Core.Events.HIDDEN, this.pauseGame, this);
        // Leaving full screen (Android bottom swipe in a browser) pauses the game
        const onFs = () => { if (!document.fullscreenElement) this.pauseGame(); };
        document.addEventListener('fullscreenchange', onFs);
        this.events.once('shutdown', () => document.removeEventListener('fullscreenchange', onFs));
        this.scale.on('resize', this.onResize, this);
        const offSettings = settings.onChange((key) => {
            if (key === 'music' && this.music && !this.gameOver) this.music.refresh();
        });
        this.events.once('shutdown', () => {
            this.game.events.off(Phaser.Core.Events.HIDDEN, this.pauseGame, this);
            this.scale.off('resize', this.onResize, this);
            clearTimeout(this.hudTimer);
            offSettings();
            if (this.music) this.music.stop();
            if (this.sfx) this.sfx.stopAll();
        });

        if (this.tutorial) {
            this.startTutorial();
            this.gameStarted = true;
        } else if (this.multi) {
            // The lobby already counted down together: go straight in
            this.prefill();
            this.newTarget();
            this.setupMulti();
            this.gameStarted = true;
        } else {
            this.prefill();
            this.newTarget();
            this.countdown(() => { this.gameStarted = true; }, true);
        }
    }

    // ------------------------------------------------------------------ layout

    computeLayout() {
        const w = this.w;
        const s = Math.round(Phaser.Math.Clamp((w - 32) / 5.6, 48, 96));
        const gap = Math.round(s * 0.12);
        const eqW = s * 0.55;
        const targetW = s * 1.5;
        const total = 3 * s + 4 * gap + eqW + targetW;

        // Keep the HUD below notches / the iOS status bar when installed full screen
        // On the second TEAM phone the layout copies the host's (hostTop), so both boards match
        const top = Math.round(this.hostTop !== undefined ? this.hostTop : safeAreaTop());
        this.uiTop = top;
        this.slotSize = s;
        this.eqY = top + 50 + s / 2;
        this.uiHeight = top + 50 + s + 16;
        this.deathY = this.uiHeight;
        this.slotScale = ((s * 0.94) / DIAMETER) * INV;

        let x = (w - total) / 2;
        this.slotPos = [];
        for (let i = 0; i < 3; i++) {
            this.slotPos.push({ x: x + s / 2, y: this.eqY });
            x += s + gap;
        }
        this.equalsX = x + eqW / 2;
        x += eqW + gap;
        this.targetX = x + targetW / 2;
    }

    // TEAM host: the size of this board, so the other phone can fit exactly the same board on its screen
    hostMeta() {
        return { w: this.w, h: this.h, top: Math.round(safeAreaTop()) };
    }

    // Rebuilds the whole HUD for the current size / language, keeping the game state
    buildHud() {
        this.hudObjs.forEach((o) => o.destroy());
        this.hudObjs = [];
        if (this.dangerTween) {
            this.dangerTween.remove();
            this.dangerTween = null;
        }

        this.computeLayout();
        this.createUI();

        this.scoreText.setText(String(this.score));
        this.targetText.setText(String(this.target));
        this.timerBadge.setVisible(this.timerRemaining > 0);
        this.hintBadge.setVisible(this.hintRemaining > 0);
        this.lastTimerSecs = -1;
        this.lastHintSecs = -1;
        if (this.timerRemaining > 0) this.timerOverlay.setAlpha(0.1);
        this.nextKey = null;
        this.updateLevelHud();
        this.updateEnergyHud();

        for (let i = 0; i < 3; i++) {
            const d = this.slotDisplays[i];
            if (!d) continue;
            const targets = d.ice ? [d.img, d.ice] : [d.img];
            this.tweens.killTweensOf(targets);
            targets.forEach((o) => o.setPosition(this.slotPos[i].x, this.slotPos[i].y).setScale(this.slotScale));
        }
    }

    createUI() {
        const w = this.w;
        const h = this.h;
        const s = this.slotSize;
        const top = this.uiTop;
        const hud = (o) => {
            this.hudObjs.push(o);
            return o;
        };

        const panel = hud(this.add.graphics().setDepth(100));
        panel.fillStyle(0x000000, 0.45);
        panel.fillRoundedRect(6, 8, w - 12, this.uiHeight - 4, 20);
        panel.fillStyle(0x10112a, 0.96);
        panel.fillRoundedRect(8, 6, w - 16, this.uiHeight - 10, 18);
        panel.lineStyle(3, 0x140a24, 1);
        panel.strokeRoundedRect(8, 6, w - 16, this.uiHeight - 10, 18);
        panel.lineStyle(1.5, 0x6366f1, 0.45);
        panel.strokeRoundedRect(12, 10, w - 24, this.uiHeight - 18, 15);

        const scoreLabel = hud(this.add.text(22, top + 13, t('score'), {
            fontFamily: 'Righteous', fontSize: '11px', color: '#7c7ff5', letterSpacing: 2
        }).setDepth(101));
        this.scoreText = hud(this.add.text(22, top + 25, '0', {
            fontFamily: 'Righteous', fontSize: '20px', color: '#ffffff'
        }).setDepth(101));
        this.levelText = hud(this.add.text(22 + scoreLabel.width + 8, top + 13, '', {
            fontFamily: 'Righteous', fontSize: '11px', color: '#ffd23f', letterSpacing: 1
        }).setDepth(101));

        // NEXT piece preview (Suika / Tetris / Threes all show what comes next)
        const nextX = Math.round(Phaser.Math.Clamp(w * 0.4, 140, 175));
        this.nextLabel = hud(this.add.text(nextX, top + 13, t('next'), {
            fontFamily: 'Righteous', fontSize: '9px', color: '#7c7ff5', letterSpacing: 1
        }).setOrigin(0.5, 0).setDepth(101));
        this.nextIcon = hud(this.add.image(nextX, top + 36, '__DEFAULT').setScale(24 / TEX_PX).setDepth(101));

        // Equation slots: [NUM] [OP] [NUM] = TARGET, centred. Inset look + a faint hint of what goes in each.
        this.slotPos.forEach((pos, i) => {
            const g = hud(this.add.graphics().setDepth(101));
            g.fillStyle(0x070818, 1);
            g.fillRoundedRect(pos.x - s / 2, pos.y - s / 2, s, s, s * 0.24);
            g.fillStyle(0x000000, 0.45);
            g.fillRoundedRect(pos.x - s / 2, pos.y - s / 2, s, s * 0.22, { tl: s * 0.24, tr: s * 0.24, bl: 0, br: 0 });
            g.lineStyle(2, 0x4a4a8e, 0.9);
            g.strokeRoundedRect(pos.x - s / 2, pos.y - s / 2, s, s, s * 0.24);
            g.lineStyle(1, 0xffffff, 0.08);
            g.lineBetween(pos.x - s / 2 + s * 0.24, pos.y + s / 2 - 1, pos.x + s / 2 - s * 0.24, pos.y + s / 2 - 1);
            hud(this.add.text(pos.x, pos.y, i === 1 ? '±' : '?', {
                fontFamily: 'Righteous', fontSize: `${Math.round(s * 0.5)}px`, color: '#8b8bd8'
            }).setOrigin(0.5).setAlpha(0.22).setDepth(101));
        });

        hud(this.add.text(this.equalsX, this.eqY, '=', {
            fontFamily: 'Righteous', fontSize: `${Math.round(s * 0.8)}px`, color: '#c7c9ff'
        }).setOrigin(0.5).setDepth(101));

        this.targetText = hud(this.add.text(this.targetX, this.eqY, '0', {
            fontFamily: 'Righteous', fontSize: `${Math.round(s * 1.0)}px`, color: '#FFB347',
            stroke: '#3b1d00', strokeThickness: 4,
            shadow: { offsetX: 0, offsetY: 0, color: '#FF8C00', blur: 12, fill: true }
        }).setOrigin(0.5).setDepth(101));

        // Pause button + power-up badges (top right)
        hud(roundButton(this, w - 32, top + 29, 'pause', () => (this.multi ? this.confirmLeave() : this.pauseGame()), { radius: 16 }));
        this.timerBadge = hud(this.createBadge(w - 92, 'piece_special_timer', '#60a5fa'));
        this.hintBadge = hud(this.createBadge(w - 152, 'piece_special_hint', '#34D399'));

        // Playfield: a dark glass tank with neon edges and a lit floor, so the pile sits in something
        const field = hud(this.add.graphics().setDepth(2));
        const fy = this.deathY + 2;
        field.fillStyle(0x0a0c22, 0.38);
        field.fillRoundedRect(4, fy, w - 8, h - fy + 20, 18);
        field.lineStyle(2, 0x6366f1, 0.22);
        field.strokeRoundedRect(4, fy, w - 8, h - fy + 20, 18);
        field.lineStyle(6, 0x6366f1, 0.06);
        field.strokeRoundedRect(4, fy, w - 8, h - fy + 20, 18);
        if (this.textures.exists('nebula')) {
            hud(this.add.image(w / 2, h + 30, 'nebula').setTint(0x6d5bff).setDisplaySize(w * 1.4, 220)
                .setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.32).setDepth(3));
        }

        // Death line with a soft red glow + red edge glow when the pile gets close
        this.dangerLine = hud(this.add.graphics().setDepth(99));
        this.dangerLine.lineStyle(8, 0xef4444, 0.18);
        this.dangerLine.lineBetween(12, this.deathY, w - 12, this.deathY);
        this.dangerLine.lineStyle(2.5, 0xff6b6b, 1);
        for (let x = 12; x < w - 12; x += 18) this.dangerLine.lineBetween(x, this.deathY, x + 10, this.deathY);
        this.dangerLine.setAlpha(0.4);
        this.vignette = hud(this.add.image(w / 2, h / 2, 'vignette').setDisplaySize(w, h).setDepth(95).setAlpha(0));

        // Blue tint while the timer power-up holds the spawn
        this.timerOverlay = hud(this.add.rectangle(w / 2, h / 2, w, h, 0x3b82f6, 1).setDepth(5).setAlpha(0));

        // Level progress ("XP bar") along the bottom of the panel; energy bar on its right (test option)
        this.levelBar = hud(this.add.graphics().setDepth(101));
        this.energyBar = this.energyOn ? hud(this.add.graphics().setDepth(101)) : null;

        if (this.debug) {
            this.perfText = hud(this.add.text(12, this.uiHeight + 6, '', {
                fontFamily: 'monospace', fontSize: '11px', color: '#00ff88'
            }).setDepth(2000).setAlpha(0.7));
        }
    }

    createBadge(x, iconKey, color) {
        const badge = this.add.container(x, this.uiTop + 29).setDepth(101).setVisible(false);
        const icon = this.add.image(-14, 0, iconKey).setScale(26 / TEX_PX);
        const text = this.add.text(4, 0, '20', {
            fontFamily: 'Righteous', fontSize: '18px', color
        }).setOrigin(0, 0.5);
        badge.add([icon, text]);
        badge.label = text;
        return badge;
    }

    createRings() {
        this.selRings = [0, 1, 2].map(() =>
            this.add.image(0, 0, 'ring').setTint(COLORS.selection).setDepth(12).setVisible(false).setScale(INV));
        // TEAM: the teammate's picks wear an orange ring
        this.mateRings = [0, 1, 2].map(() =>
            this.add.image(0, 0, 'ring').setTint(0xff9f43).setDepth(12).setVisible(false).setScale(INV));

        // Hint: a bright pulsing ring plus a green glow behind each piece of the solution
        // (the other pieces are dimmed while a hint shows, see update)
        this.hintRings = [0, 1, 2].map((i) => {
            const ring = this.add.image(0, 0, 'ring').setTint(0x5cffb8).setDepth(12).setVisible(false).setScale(1.08 * INV);
            this.tweens.add({
                targets: ring, scale: 1.3 * INV, alpha: 0.5,
                duration: 420, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: i * 140
            });
            return ring;
        });
        this.hintGlows = [0, 1, 2].map((i) => {
            const glow = this.add.image(0, 0, 'hintGlow').setDepth(9).setVisible(false)
                .setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(DIAMETER * 2.3, DIAMETER * 2.3);
            this.tweens.add({
                targets: glow, alpha: 0.55, duration: 420, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: i * 140
            });
            return glow;
        });
        this.dimmed = false;
        // Diagonal glint that sweeps across every piece now and then (off with "less motion")
        this.sheenOn = !settings.get('reduceMotion');
        this.sheenNext = 3000;
        this.sheenPos = null;
    }

    createFx() {
        // The burst when pieces pop: the effect chosen in the shop
        const fx = POP_FX[currentItem('pop')] || POP_FX.glow;
        this.popFx = fx;
        this.burst = this.add.particles(0, 0, fx.key, {
            speed: { min: 120, max: 300 },
            scale: fx.scale || { start: 0.9, end: 0 },
            alpha: fx.alpha || 1,
            rotate: fx.rotate ? { min: 0, max: 360 } : 0,
            blendMode: fx.add ? 'ADD' : 'NORMAL',
            lifespan: fx.lifespan || 420,
            gravityY: fx.gravity ?? 300,
            emitting: false
        }).setDepth(200);

        this.starBurst = this.add.particles(0, 0, 'starParticle', {
            speed: { min: 90, max: 200 },
            scale: { start: 0.6, end: 0 },
            lifespan: 500,
            emitting: false
        }).setDepth(200);

        this.sparks = this.add.particles(0, 0, 'spark', {
            speed: { min: 100, max: 420 },
            scale: { start: 2, end: 0 },
            blendMode: 'ADD',
            lifespan: 500,
            emitting: false
        }).setDepth(200);

        // Steel shards when junk breaks
        this.shards = this.add.particles(0, 0, 'shard', {
            speed: { min: 140, max: 380 },
            rotate: { start: 0, end: 720 },
            scale: { min: 0.9, max: 1.7 },
            lifespan: 900,
            gravityY: 800,
            tint: [0xc9d1dc, 0x8d97a6, 0x5d6674],
            emitting: false
        }).setDepth(200);

        // Steam rising off melting ice
        this.steamFx = this.add.particles(0, 0, 'steam', {
            speedY: { min: -90, max: -40 },
            speedX: { min: -25, max: 25 },
            scale: { start: 0.7, end: 1.8 },
            alpha: { start: 0.75, end: 0 },
            lifespan: 900,
            emitting: false
        }).setDepth(200);

        // One trail emitter per slot, follows the piece flying into the equation
        this.trails = [0, 1, 2].map(() => this.add.particles(0, 0, 'particle', {
            speed: { min: 5, max: 30 },
            scale: { start: 0.7, end: 0 },
            alpha: { start: 0.9, end: 0 },
            lifespan: 320,
            frequency: 12,
            blendMode: 'ADD',
            emitting: false
        }).setDepth(140));
    }

    // ------------------------------------------------------------------ loop

    update(time, delta) {
        if (this.paused) return;
        if (this.replay) delta = this.stepReplay(delta);

        // Sync sprites to bodies. Rotation is ignored on purpose: labels always stay upright (no 6/9 confusion).
        const pieces = this.pieces;
        for (let i = 0; i < pieces.length; i++) {
            const p = pieces[i];
            const pos = p.body.position;
            p.img.x = pos.x;
            p.img.y = pos.y;
            if (p.type === 'junk') p.img.rotation = p.body.angle;
            if (p.ice) {
                p.ice.x = pos.x;
                p.ice.y = pos.y;
            }
        }

        for (let i = 0; i < 3; i++) {
            const sel = this.slots[i];
            const ring = this.selRings[i];
            if (sel) ring.setVisible(true).setPosition(sel.img.x, sel.img.y);
            else ring.setVisible(false);

            const d = this.slotDisplays[i];
            if (d && d.ice && d.piece.ice) d.ice.alpha = d.piece.ice.alpha;
            if (this.link) {
                const g = this.guestSlots[i];
                if (g && g.alive) this.mateRings[i].setVisible(true).setPosition(g.img.x, g.img.y);
                else this.mateRings[i].setVisible(false);
            }

            const hp = this.hintPieces[i];
            const hring = this.hintRings[i];
            const hglow = this.hintGlows[i];
            if (hp && hp.alive) {
                hring.setVisible(true).setPosition(hp.img.x, hp.img.y);
                hglow.setVisible(true).setPosition(hp.img.x, hp.img.y);
            } else {
                hring.setVisible(false);
                hglow.setVisible(false);
            }
        }

        if (this.sheenOn) this.updateSheen(delta);

        // While a hint shows, everything that is not part of it steps back
        const dim = this.hintPieces.length > 0 && !this.gameOver;
        if (dim || this.dimmed) {
            for (let i = 0; i < pieces.length; i++) {
                const p = pieces[i];
                p.img.alpha = dim && !this.hintPieces.includes(p) ? 0.42 : 1;
            }
            this.dimmed = dim;
        }

        if (this.hand) {
            const tp = this.tutTarget;
            if (tp && tp.alive && !tp.selected) {
                this.hand.setVisible(true).setPosition(tp.img.x, tp.img.y - R - 30 + Math.sin(time / 150) * 6);
            } else {
                this.hand.setVisible(false);
            }
        }

        if (this.needsWake) {
            for (let i = 0; i < pieces.length; i++) this.Sleeping.set(pieces[i].body, false);
            this.needsWake = false;
        }

        if (this.debug) {
            this.hudAcc += delta;
            if (this.hudAcc >= 500) {
                this.hudAcc = 0;
                this.perfText.setText(
                    `${Math.round(this.game.loop.actualFps)} fps · física ${this.physMs.toFixed(2)} ms · ${pieces.length} peças`);
            }
        }

        if (this.gameOver || !this.gameStarted) return;

        if (this.timed) {
            this.dailyRemaining -= delta;
            const secs = Math.max(0, Math.ceil(this.dailyRemaining / 1000));
            if (secs !== this.lastDailySecs) {
                this.lastDailySecs = secs;
                this.updateLevelHud();
                if (secs > 0 && secs <= 10) {
                    if (settings.get('sfx') && this.cache.audio.exists('clickbutton')) {
                        this.sound.play('clickbutton', { volume: 0.4, detune: 600 });
                    }
                    haptic('tick');
                    this.tweens.add({ targets: this.levelText, scale: 1.35, duration: 120, yoyo: true });
                }
            }
            if (this.dailyRemaining <= 0) {
                this.endGame('time');
                return;
            }
        }

        const nextKey = this.tutorial ? null : pieceTextureKey(this.peekNext());
        this.nextIcon.setVisible(!this.tutorial);
        this.nextLabel.setVisible(!this.tutorial);
        if (nextKey && nextKey !== this.nextKey) {
            this.nextKey = nextKey;
            this.nextIcon.setTexture(nextKey).setScale(14 / TEX_PX);
            this.tweens.add({ targets: this.nextIcon, scale: 24 / TEX_PX, duration: 220, ease: 'Back.easeOut' });
        }

        if (this.multi) this.spawnDelay = this.levelSpawnDelay(this.mpStage());
        if (this.link) {
            this.snapAcc += delta;
            if (this.snapAcc >= 32) {
                this.snapAcc = 0;
                this.sendSnapshot();
            }
        }

        // Spawning never stops, except while the timer power-up is active
        if (this.timerRemaining > 0) {
            this.timerRemaining -= delta;
            const secs = Math.max(0, Math.ceil(this.timerRemaining / 1000));
            if (secs !== this.lastTimerSecs) {
                this.lastTimerSecs = secs;
                this.timerBadge.label.setText(String(secs));
            }
            // Spawn is frozen, except for pieces needed to keep the target solvable
            if (this.forceQueue && this.spawnQueue.length > 0) {
                this.spawnTimer += delta;
                if (this.spawnTimer >= this.spawnDelay) {
                    this.spawnTimer = 0;
                    this.spawnPiece();
                }
            }
            if (this.timerRemaining <= 0) this.endTimerPowerUp();
        } else if (!this.tutorial) {
            this.spawnTimer += delta;
            if (this.spawnTimer >= this.spawnDelay) {
                this.spawnTimer = 0;
                this.spawnPiece();
            }
        }

        if (this.hintRemaining > 0) {
            this.hintRemaining -= delta;
            const secs = Math.max(0, Math.ceil(this.hintRemaining / 1000));
            if (secs !== this.lastHintSecs) {
                this.lastHintSecs = secs;
                this.hintBadge.label.setText(String(secs));
            }
            this.hintRefresh -= delta;
            if (this.hintRefresh <= 0) {
                this.hintRefresh = 350;
                this.hintPieces = this.findSolution(this.target, this.reachablePieces()) || [];
            }
            if (this.hintRemaining <= 0) this.endHintPowerUp();
        }

        this.dangerAcc += delta;
        if (this.dangerAcc >= 100) {
            this.checkDanger(this.dangerAcc);
            this.dangerAcc = 0;
        }

        this.solveAcc += delta;
        if (this.solveAcc >= 1000) {
            this.solveAcc = 0;
            this.ensureSolvable();
        }
    }

    checkDanger(dt) {
        let worst = 0;
        let near = false;
        for (const p of this.pieces) {
            const top = p.body.position.y - R;
            const settled = p.body.isSleeping || p.body.speed < 0.35;
            if (settled && top < this.deathY + R) near = true;
            if (settled && top < this.deathY) {
                p.dangerMs += dt;
                if (p.dangerMs > worst) worst = p.dangerMs;
            } else {
                p.dangerMs = 0;
            }
        }

        if (near && !this.dangerTween) {
            this.dangerLine.setAlpha(0.4);
            this.vignette.setAlpha(0);
            this.dangerTween = this.tweens.add({
                targets: [this.dangerLine, this.vignette], alpha: 0.85, duration: 380, yoyo: true, repeat: -1,
                ease: 'Sine.easeInOut'
            });
            this.music.setDanger(true);
        } else if (!near && this.dangerTween) {
            this.dangerTween.remove();
            this.dangerTween = null;
            this.dangerLine.setAlpha(0.4);
            this.vignette.setAlpha(0);
            this.music.setDanger(false);
        }

        if (worst > DANGER_MS && !this.tutorial) {
            if (this.zen) this.zenOverflow();
            else this.endGame();
        }
    }

    // Zen has no game over: when the pile reaches the line, the pieces above it pop
    zenOverflow() {
        const limit = this.deathY + R * 1.5;
        let popped = 0;
        for (const p of [...this.pieces]) {
            if (p.selected || p.body.position.y - R > limit) continue;
            this.tintBurst(p.color);
            this.burst.emitParticleAt(p.img.x, p.img.y, 8);
            this.removePiece(p);
            popped++;
        }
        if (popped) {
            this.playSound('sparksSound', 0.5);
            this.shake(160, 0.005);
            this.combo = 0;
            this.ensureSolvable();
        }
    }

    // ------------------------------------------------------------------ sheen

    // A band along x + y crosses the screen in ~0.9 s every 5-7 s. Pieces inside the band show the
    // matching frame of the glint (pooled per piece, one shared texture). Idle frames cost one compare.
    updateSheen(delta, list = this.pieces) {
        if (this.sheenPos === null) {
            this.sheenNext -= delta;
            if (this.sheenNext > 0 || this.paused) return;
            this.sheenPos = -R * 3;
        }
        const end = this.w + this.h + R * 3;
        this.sheenPos += (end + R * 3) * (delta / 900);
        const span = R * 2.6;
        let active = this.sheenPos < end;
        for (const p of list) {
            if (p.type === 'junk') continue;
            const rel = (this.sheenPos - (p.img.x + p.img.y)) / span;   // -1..1 while the band crosses it
            if (active && rel > -1 && rel < 1) {
                const frame = Math.round(((rel + 1) / 2) * (SHEEN_FRAMES - 1));
                if (!p.sheen) {
                    p.sheen = this.add.image(0, 0, 'sheen', frame).setScale(INV).setDepth(11.5)
                        .setBlendMode(Phaser.BlendModes.ADD);
                }
                p.sheen.setFrame(frame).setPosition(p.img.x, p.img.y).setVisible(true).setAlpha(p.img.alpha);
            } else if (p.sheen && p.sheen.visible) {
                p.sheen.setVisible(false);
            }
        }
        if (!active) {
            this.sheenPos = null;
            this.sheenNext = 5000 + Math.random() * 2000;
        }
    }

    // ------------------------------------------------------------------ pieces

    // A game starts with a dozen pieces already tumbling in during the countdown, so every
    // opening is different. At most one special among them. Seeded in the daily challenge.
    prefill() {
        const cols = 5;
        const colW = (this.w - 2 * R - 8) / (cols - 1);
        let specials = 0;
        for (let i = 0; i < START_PIECES; i++) {
            let data = this.randomPieceData();
            while (data.type === 'special' && specials >= 1) data = this.randomPieceData();
            if (data.type === 'special') specials++;
            const row = Math.floor(i / cols);
            const x = R + 4 + (i % cols) * colW + (this.rand(this.pieceRng) - 0.5) * colW * 0.5;
            const y = -R * 2 - row * DIAMETER * 1.25 - this.rand(this.pieceRng) * R;
            this.createPiece(data, Phaser.Math.Clamp(x, R + 2, this.w - R - 2), y);
        }
    }

    randomPieceData() {
        const rng = this.pieceRng;
        const r = this.rand(rng);
        let data;
        if (r < 0.05) data = { type: 'special', special: 'bomb' };
        else if (r < 0.08) data = { type: 'special', special: 'timer' };
        else if (r < 0.11) data = { type: 'special', special: 'hint' };
        else if (r < 0.14) data = { type: 'special', special: 'recycle' };
        else if (r < 0.17) data = { type: 'special', special: 'heat' };
        else if (r < 0.62) data = { type: 'number', value: this.randInt(rng, 1, 9) };
        else data = { type: 'operator', value: this.pick(rng, this.allowedOps()) };
        if (data.type !== 'special') data.iceRoll = this.rand(rng) < ICE_CHANCE;
        data.fx = this.rand(rng);   // spawn column as a fraction of the width
        if (this.multi) data.seq = this.seqN++;
        return data;
    }

    // What spawnPiece() drops next: pending solvability pieces first, else the pre-rolled random one
    peekNext() {
        if (this.spawnQueue.length > 0) return this.spawnQueue[0];
        if (!this.upcoming) this.upcoming = this.randomPieceData();
        return this.upcoming;
    }

    spawnPiece() {
        let data;
        if (this.spawnQueue.length > 0) {
            data = this.spawnQueue.shift();
        } else {
            data = this.upcoming || this.randomPieceData();
            this.upcoming = null;
        }
        if (this.spawnQueue.length === 0) this.forceQueue = false;
        const fx = data.fx !== undefined ? data.fx : Math.random();
        const x = Math.round(R + 4 + fx * (this.w - 2 * R - 8));
        const y = -R * 2 - Math.random() * R;
        return this.createPiece(data, x, y);
    }

    createPiece(data, x, y) {
        const color = data.type === 'number' ? COLORS.numbers[data.value % COLORS.numbers.length]
            : data.type === 'operator' ? COLORS.operators[data.value]
                : data.type === 'junk' ? 0x6b6b78
                    : COLORS.specials[data.special];

        // Junk is heavy: it sinks into the pile and shoves pieces aside
        const body = data.type === 'junk'
            ? this.matter.add.rectangle(x, y, JUNK_SIDE, JUNK_SIDE,
                { ...PIECE_BODY, density: 0.005, friction: 0.12, frictionStatic: 0.5, chamfer: { radius: 6 }, label: 'piece' })
            : this.matter.add.circle(x, y, R, { ...PIECE_BODY, label: 'piece' });
        this.Body.setVelocity(body, { x: Phaser.Math.FloatBetween(-1.2, 1.2), y: 3 });

        const img = this.add.image(x, y, pieceTextureKey(data)).setDepth(10).setScale(INV);
        const p = { ...data, id: this.pidN++, color, body, img, ice: null, selected: false, slot: -1, alive: true, dangerMs: 0 };

        if (data.type === 'special') {
            this.tweens.add({
                targets: img, scale: 1.08 * INV, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
            });
        } else if (data.type !== 'junk' && !data.noIce && (data.iceRoll !== undefined ? data.iceRoll : Math.random() < ICE_CHANCE)
            && this.textures.exists('ice')) {
            // Ice cover fades in gradually: the label is readable at first, then hidden
            p.ice = this.add.image(x, y, 'ice').setDepth(11).setAlpha(0).setScale(INV);
            this.tweens.add({ targets: p.ice, alpha: 0.95, duration: ICE_FREEZE_MS, ease: 'Sine.easeIn' });
        }

        this.pieces.push(p);
        return p;
    }

    removePiece(p) {
        if (!p.alive) return;
        p.alive = false;
        if (p.gsel) {
            this.guestSlots[p.gslot] = null;
            p.gsel = false;
        }
        if (p.sheen) p.sheen.destroy();
        this.clearFuse(p);
        this.matter.world.remove(p.body);
        this.tweens.killTweensOf(p.img);
        p.img.destroy();
        if (p.ice) {
            this.tweens.killTweensOf(p.ice);
            p.ice.destroy();
        }
        const i = this.pieces.indexOf(p);
        if (i !== -1) this.pieces.splice(i, 1);
        // Sleeping bodies resting on a removed piece would float; wake the pile next frame
        this.needsWake = true;
    }

    // ------------------------------------------------------------------ input & selection

    onPointerDown(pointer, over) {
        if (!this.gameStarted || this.gameOver || this.validating || this.paused || this.replay) return;
        // Buttons (pause, the energy chooser) handle their own taps
        if (over && over.length) return;
        // world coordinates: the camera is zoomed by RES (see display.js)
        const x = pointer.worldX;
        const y = pointer.worldY;

        if (y < this.uiHeight) {
            const half = this.slotSize / 2 + 6;
            for (let i = 0; i < 3; i++) {
                const pos = this.slotPos[i];
                if (this.slots[i] && Math.abs(x - pos.x) < half && Math.abs(y - pos.y) < half) {
                    this.playClick();
                    this.deselect(i);
                    return;
                }
            }
            return;
        }

        let best = null;
        let bestD = TAP_RADIUS_SQ;
        for (const p of this.pieces) {
            const dx = p.body.position.x - x;
            const dy = p.body.position.y - y;
            const d = dx * dx + dy * dy;
            if (d < bestD) {
                bestD = d;
                best = p;
            }
        }
        if (best) this.selectPiece(best);
    }

    selectPiece(p) {
        if (p.type === 'special') {
            if (!p.lit) this.activateSpecial(p);
            return;
        }
        // Junk cannot be used: it just thuds
        if (p.type === 'junk') {
            this.tweens.add({ targets: p.img, scale: 0.9 * INV, duration: 70, yoyo: true });
            this.sfx.clank(1.2);
            haptic('tap');
            return;
        }

        // Interactive tutorial: only the highlighted piece reacts
        if (this.tutorial && this.tutTarget && p !== this.tutTarget) {
            this.tweens.add({ targets: p.img, scale: 0.88 * INV, duration: 70, yoyo: true });
            return;
        }

        this.playClick();
        if (p.ice && p.ice.alpha > 0.4) this.crackIce(p);

        // TEAM: a piece in the teammate's equation is theirs
        if (p.gsel) {
            this.tweens.add({ targets: p.img, scale: 0.88 * INV, duration: 70, yoyo: true });
            this.mpNotice(t('partnerTaken'), '#ffd9a8');
            return;
        }

        // Tapping a selected piece again deselects it
        if (p.selected) {
            this.deselect(p.slot);
            return;
        }

        // Numbers fill the first free number slot (replacing the second one if both are taken);
        // operators can be picked at any time and replace the current operator
        const slot = p.type === 'operator' ? 1 : (!this.slots[0] ? 0 : 2);
        if (this.slots[slot]) this.deselect(slot);

        this.slots[slot] = p;
        p.selected = true;
        p.slot = slot;
        this.flyToSlot(p, slot);
        if (this.tutorial && p === this.tutTarget) this.tutorialStep(this.tutStep + 1);

        if (this.slots[0] && this.slots[1] && this.slots[2]) {
            this.validating = true;
            this.time.delayedCall(260, () => this.validate());
        }
    }

    flyToSlot(p, i) {
        const dest = this.slotPos[i];
        const img = this.add.image(p.img.x, p.img.y, p.img.texture.key).setDepth(150).setScale(INV);
        const ice = p.ice ? this.add.image(p.img.x, p.img.y, 'ice').setDepth(151).setAlpha(p.ice.alpha).setScale(INV) : null;
        this.slotDisplays[i] = { img, ice, piece: p };

        const trail = this.trails[i];
        trail.setParticleTint(p.color);
        trail.startFollow(img);
        trail.start();

        this.tweens.add({
            targets: ice ? [img, ice] : img,
            x: dest.x,
            y: dest.y,
            scale: this.slotScale,
            duration: 320,
            ease: 'Back.easeOut',
            onComplete: () => trail.stop()
        });
    }

    deselect(i) {
        const p = this.slots[i];
        if (!p) return;
        this.slots[i] = null;
        p.selected = false;
        p.slot = -1;

        const d = this.slotDisplays[i];
        this.slotDisplays[i] = null;
        if (!d) return;

        this.trails[i].stop();
        const targets = d.ice ? [d.img, d.ice] : [d.img];
        this.tweens.killTweensOf(targets);
        const destroy = () => targets.forEach((t) => t.destroy());

        if (p.alive) {
            this.tweens.add({
                targets,
                x: p.img.x,
                y: p.img.y,
                scale: 0.4 * INV,
                alpha: 0,
                duration: 220,
                ease: 'Cubic.easeIn',
                onComplete: destroy
            });
        } else {
            destroy();
        }
    }

    validate() {
        const [a, o, b] = this.slots;
        if (!a || !o || !b) {
            this.validating = false;
            return;
        }
        const ok = calc(a.value, o.value, b.value) === this.target;
        if (!this.tutorial) logEquation(a.value, o.value, b.value, this.target, ok);
        if (ok) this.onSuccess();
        else this.onFail();
    }

    onSuccess() {
        const usedSeqs = this.slots.filter((p) => p && p.seq !== undefined).map((p) => p.seq);
        const scoreBefore = this.score;
        this.playSound('popSound', 0.8);
        this.sfx.rise(this.combo);   // combo before this equation: the chime climbs as the chain grows
        haptic('success');
        this.hitStop(70);
        this.scoreSuccess();
        this.flash(160, 40, 160, 90);

        for (let i = 0; i < 3; i++) {
            const p = this.slots[i];
            const d = this.slotDisplays[i];
            this.trails[i].stop();

            if (d) {
                const targets = d.ice ? [d.img, d.ice] : [d.img];
                this.tweens.killTweensOf(targets);
                this.tintBurst(p.color);
                this.burst.emitParticleAt(d.img.x, d.img.y, 14);
                this.starBurst.emitParticleAt(d.img.x, d.img.y, 4);
                this.tweens.add({
                    targets,
                    scale: this.slotScale * 1.8,
                    alpha: 0,
                    duration: 300,
                    delay: i * 60,
                    ease: 'Back.easeOut',
                    onComplete: () => targets.forEach((t) => t.destroy())
                });
            }

            if (p) {
                this.tintBurst(p.color);
                this.burst.emitParticleAt(p.img.x, p.img.y, 10);
                p.selected = false;
                this.removePiece(p);
            }
        }

        this.slots = [null, null, null];
        this.slotDisplays = [null, null, null];
        this.validating = false;
        if (this.tutorial) {
            this.finishTutorial();
            return;
        }
        this.crackJunk();
        if (this.energyOn) this.gainEnergy(this.combo >= 2 ? 0.3 : 0.2);
        this.newTarget();
        if (this.multi) this.sendSolve(usedSeqs, this.score - scoreBefore);
        this.checkLevelUp();
    }

    onFail() {
        this.playSound('dropSound', 0.8);
        haptic('fail');
        this.shake(220, 0.012);
        this.flash(140, 200, 50, 50);
        this.combo = 0;
        this.quick = 0;
        this.streak = 0;
        this.addScore(-SCORING.failPenalty, this.targetX, this.eqY + this.slotSize * 0.6, 0xef4444);
        if (!this.tutorial && settings.get('teachErrors')) this.explainMistake();
        if (!this.tutorial && settings.get('junk')) this.time.delayedCall(350, () => this.dropJunk(2));

        for (let i = 0; i < 3; i++) this.deselect(i);
        this.time.delayedCall(250, () => { this.validating = false; });
    }

    // Shows what the wrong equation actually makes: "7 × 3 = 21 ≠ 24"
    explainMistake() {
        const [a, o, b] = this.slots;
        if (!a || !o || !b) return;
        const r = calc(a.value, o.value, b.value);
        const shown = o.value === '-' ? '−' : o.value;
        const made = r === null ? `${a.value} ${shown} ${b.value} ${t('notWhole')}` : `${a.value} ${shown} ${b.value} = ${r}`;
        const y = this.uiHeight + 46;
        const label = this.add.text(this.w / 2, y, r === null ? made : `${made}  ≠ ${this.target}`, {
            fontFamily: 'Righteous', fontSize: '26px', color: '#ffb4b4', stroke: '#2a0a0a', strokeThickness: 6
        }).setOrigin(0.5).setDepth(215).setScale(0.6);
        this.tweens.add({ targets: label, scale: 1, duration: 200, ease: 'Back.easeOut' });
        this.tweens.add({ targets: label, alpha: 0, y: y - 16, delay: 1500, duration: 300, onComplete: () => label.destroy() });
    }

    // ------------------------------------------------------------------ junk ("trambolhos")

    dropJunk(n) {
        if (this.gameOver) return;
        for (let i = 0; i < n; i++) {
            const x = R + 4 + Math.random() * (this.w - 2 * R - 8);
            const p = this.createPiece({ type: 'junk', hp: 3 }, x, -R * 2 - i * DIAMETER);
            this.Body.setVelocity(p.body, { x: 0, y: 6 });
            this.Body.setAngularVelocity(p.body, Phaser.Math.FloatBetween(-0.05, 0.05));
        }
        this.fxSend({ fx: 'jdrop' });
        this.time.delayedCall(450, () => this.sfx.clank(0.7));
    }

    // Every correct equation batters all steel junk one step; the third hit breaks it (+25)
    crackJunk() {
        for (const p of [...this.pieces]) if (p.type === 'junk') this.damageJunk(p, 1);
    }

    // ------------------------------------------------------------------ energy bar (test option)

    gainEnergy(n) {
        if (this.chooser || this.gameOver) return;
        this.energy = Math.min(1, this.energy + n);
        this.updateEnergyHud();
        if (this.energy >= 1) this.showChooser();
    }

    updateEnergyHud() {
        const g = this.energyBar;
        if (!g) return;
        g.clear();
        const x = this.w * 0.62;
        const w = this.w - 24 - x;
        const y = this.uiHeight - 11;
        g.fillStyle(0x0b2a3a, 1);
        g.fillRoundedRect(x, y, w, 5, 2.5);
        if (this.energy > 0) {
            g.fillStyle(this.energy >= 1 ? 0x7dd3fc : 0x22d3ee, 1);
            g.fillRoundedRect(x, y, Math.max(5, w * this.energy), 5, 2.5);
        }
    }

    // Full bar: pick one of four specials; it drops into the pile from the top
    showChooser() {
        const kinds = ['bomb', 'heat', 'recycle', 'hint'];
        const size = 54;
        const pw = kinds.length * (size + 10) + 16;
        const ph = size + 46;
        const x0 = this.w / 2 - pw / 2;
        const y0 = this.uiHeight + 10;
        const box = this.add.container(0, 0).setDepth(640);
        const g = this.add.graphics();
        g.fillStyle(0x000000, 0.4);
        g.fillRoundedRect(x0 + 3, y0 + 5, pw, ph, 18);
        g.fillStyle(0x0b2a3a, 0.97);
        g.fillRoundedRect(x0, y0, pw, ph, 18);
        g.lineStyle(3, 0x7dd3fc, 1);
        g.strokeRoundedRect(x0, y0, pw, ph, 18);
        const title = this.add.text(this.w / 2, y0 + 16, t('pickSpecial'), {
            fontFamily: 'Righteous', fontSize: '14px', color: '#bae6fd'
        }).setOrigin(0.5);
        box.add([g, title]);
        kinds.forEach((kind, i) => {
            const icon = this.add.image(x0 + 16 + size / 2 + i * (size + 10), y0 + 30 + size / 2, `piece_special_${kind}`)
                .setScale(size / TEX_PX).setInteractive({ useHandCursor: true });
            icon.on('pointerdown', () => this.pickSpecial(kind));
            this.tweens.add({ targets: icon, scale: (size / TEX_PX) * 1.08, duration: 500, yoyo: true, repeat: -1, delay: i * 90 });
            box.add(icon);
        });
        box.setAlpha(0).setScale(0.9);
        this.tweens.add({ targets: box, alpha: 1, scale: 1, duration: 200, ease: 'Back.easeOut' });
        this.chooser = box;
        this.playSound('bonusSound', 0.6);
        haptic('combo');
    }

    pickSpecial(kind) {
        if (!this.chooser || this.paused) return;
        this.chooser.destroy();
        this.chooser = null;
        this.energy = 0;
        this.updateEnergyHud();
        this.playClick();
        this.createPiece({ type: 'special', special: kind }, this.w / 2 + Phaser.Math.Between(-60, 60), -R * 2);
    }

    // ------------------------------------------------------------------ targets & solver

    newTarget() {
        const pool = this.reachablePieces();
        const rng = this.targetRng;
        // Seeded target when it must match other phones: the daily, and the first target of a 2-player game
        const shared = this.daily || (this.multi && !this.gameStarted);
        let target = !shared && Math.random() < 0.7 ? this.targetFrom(pool) : null;
        if (target === null) {
            let r;
            do {
                r = calc(this.randInt(rng, 1, 9), this.pick(rng, this.allowedOps()), this.randInt(rng, 1, 9));
            } while (r === null || r < 1);
            target = r;
        }
        this.setTarget(target);
        // Only the pieces the pile is missing for this target are queued (often none)
        this.spawnQueue = this.missingPiecesFor(target, pool);
        this.forceQueue = false;
    }

    setTarget(target) {
        this.target = target;
        this.targetText.setText(String(target));
        this.tweens.killTweensOf(this.targetText);
        this.targetText.setScale(0.6);
        this.tweens.add({ targets: this.targetText, scale: 1, duration: 300, ease: 'Back.easeOut' });
        if (this.hintRemaining > 0) this.hintRefresh = 0;
    }

    // Pieces the player can actually use: anything below the panel, or still falling into view.
    // Pieces stuck behind the panel cannot be tapped.
    reachablePieces() {
        return this.pieces.filter((p) => p.body.position.y > this.uiHeight || p.body.speed > 0.5);
    }

    // Guarantees the current target can always be made. Pending queue items count as available.
    // Called every second and right after anything destroys pieces (bomb, recycle).
    ensureSolvable() {
        if (this.gameOver || this.tutorial) return;
        const pool = this.reachablePieces();
        if (this.findSolution(this.target, pool.concat(this.spawnQueue))) return;

        // While the timer power-up holds the spawn, prefer a new target the pile can already make
        // (not in the daily: its target sequence is shared by everyone)
        if (this.timerRemaining > 0 && !this.daily) {
            const t = this.targetFrom(pool);
            if (t !== null) {
                this.setTarget(t);
                this.spawnQueue = [];
                return;
            }
        }

        this.spawnQueue.unshift(...this.missingPiecesFor(this.target, pool));
        // Rare case: frozen spawn and no target possible from the pile -> let the missing pieces through
        if (this.timerRemaining > 0) this.forceQueue = true;
    }

    // Random target that the given pieces can make
    targetFrom(pool) {
        const nums = pool.filter((p) => p.type === 'number' && !p.selected);
        const ops = [...new Set(pool.filter((p) => p.type === 'operator').map((p) => p.value))];
        if (nums.length < 2 || ops.length === 0) return null;

        for (let t = 0; t < 40; t++) {
            const a = Phaser.Utils.Array.GetRandom(nums);
            const b = Phaser.Utils.Array.GetRandom(nums);
            if (a === b) continue;
            const r = calc(a.value, Phaser.Utils.Array.GetRandom(ops), b.value);
            if (r !== null && r >= 1) return r;
        }
        return null;
    }

    // Fewest pieces to add so the target becomes solvable with the given pool (shuffled, may be empty)
    missingPiecesFor(target, pool) {
        const numCount = {};
        const ops = new Set();
        for (const p of pool) {
            if (p.type === 'number') numCount[p.value] = (numCount[p.value] || 0) + 1;
            else if (p.type === 'operator') ops.add(p.value);
        }

        let best = null;
        for (const op of this.allowedOps()) {
            for (let a = 1; a <= 9; a++) {
                for (let b = 1; b <= 9; b++) {
                    if (calc(a, op, b) !== target) continue;
                    const missing = [];
                    if (a === b) {
                        for (let k = numCount[a] || 0; k < 2; k++) missing.push({ type: 'number', value: a });
                    } else {
                        if (!numCount[a]) missing.push({ type: 'number', value: a });
                        if (!numCount[b]) missing.push({ type: 'number', value: b });
                    }
                    if (!ops.has(op)) missing.push({ type: 'operator', value: op });
                    if (!best || missing.length < best.length || (missing.length === best.length && Math.random() < 0.3)) {
                        best = missing;
                    }
                }
            }
        }
        return Phaser.Utils.Array.Shuffle(best || []);
    }

    // Works on live pieces and on queued piece data alike (both have type/value)
    findSolution(target, pool) {
        const nums = [];
        const opPiece = {};
        for (const p of pool) {
            if (p.type === 'number') nums.push(p);
            else if (p.type === 'operator' && (!opPiece[p.value] || p.selected)) opPiece[p.value] = p;
        }
        for (const op of Object.keys(opPiece)) {
            for (const a of nums) {
                for (const b of nums) {
                    if (a !== b && calc(a.value, op, b.value) === target) return [a, opPiece[op], b];
                }
            }
        }
        return null;
    }

    // ------------------------------------------------------------------ specials

    activateSpecial(p) {
        if (p.special === 'bomb') {
            haptic('special');
            if (!this.tutorial) this.toastMissions(track('special'));
            this.lightFuse(p, 2000);
            return;
        }
        const { x, y } = p.body.position;
        this.tintBurst(p.color);
        this.burst.emitParticleAt(x, y, 12);
        this.removePiece(p);

        haptic('special');
        if (!this.tutorial) this.toastMissions(track('special'));
        if (p.special === 'bomb') this.explode(x, y);
        else if (p.special === 'timer') this.startTimerPowerUp();
        else if (p.special === 'hint') this.startHintPowerUp();
        else if (p.special === 'recycle') this.recycle(x, y);
        else if (p.special === 'heat') this.heatWave(x, y);
    }

    // Sound, shake, sparks and shock wave of a bomb (also played on the other phone in TEAM mode)
    boomFx(x, y) {
        const radius = R * 3.2 * 1.3;
        this.playSound('explosionSound', 0.9);
        this.sfx.duck(0.35, 600);
        this.shake(320, 0.02);
        haptic('bomb');
        this.sparks.emitParticleAt(x, y, 30);
        const wave = this.add.image(x, y, 'ring').setTint(0xffaa33).setDepth(190).setScale(0.4 * INV);
        this.tweens.add({
            targets: wave, scale: (radius * 2) / TEX_PX * 1.2, alpha: 0, duration: 380, ease: 'Cubic.easeOut',
            onComplete: () => wave.destroy()
        });
    }

    explode(x, y) {
        const radius = R * 3.2 * 1.3;   // +30% reach
        const pushRadius = radius * 2;
        this.fxSend({ fx: 'boom', x: Math.round(x), y: Math.round(y) });
        this.boomFx(x, y);
        this.hitStop(90);

        let destroyed = 0;
        for (const q of [...this.pieces]) {
            if (q.selected || !q.alive) continue;
            const dx = q.body.position.x - x;
            const dy = q.body.position.y - y;
            const d = Math.hypot(dx, dy) || 1;
            const isBomb = q.type === 'special' && q.special === 'bomb';
            if (d < radius && isBomb) {
                // Chain reaction: a bomb in the blast lights up with a shorter fuse
                if (!q.lit) this.lightFuse(q, 900);
            } else if (d < radius && q.type === 'junk') {
                // Steel survives the blast, one step more battered
                this.damageJunk(q, 1);
                this.Sleeping.set(q.body, false);
                this.Body.setVelocity(q.body, { x: (dx / d) * 6, y: (dy / d) * 6 - 3 });
            } else if (d < radius) {
                this.sparks.emitParticleAt(q.body.position.x, q.body.position.y, 8);
                this.removePiece(q);
                destroyed++;
            } else if (d < pushRadius) {
                const k = 9 * (1 - d / pushRadius);
                this.Sleeping.set(q.body, false);
                this.Body.setVelocity(q.body, {
                    x: q.body.velocity.x + (dx / d) * k,
                    y: q.body.velocity.y + (dy / d) * k - 2
                });
            }
        }
        if (destroyed > 0) this.addScore(destroyed * 10, x, y, 0xffaa33);
        if (!this.tutorial) this.toastAchievements(report('bomb', { destroyed }));
        this.ensureSolvable();
    }

    // TEAM: the host tells the other phone about every effect, so both screens show the same thing
    fxSend(msg) {
        if (this.link) this.link.send(msg);
    }

    // Branching lightning from the recycle piece to several pieces and to the target, which
    // scrambles and changes. Bolts flicker (re-generated a few times) before the hits land.
    recycle(x, y) {
        const pool = Phaser.Utils.Array.Shuffle(this.pieces.filter((q) => !q.selected && !q.lit));
        const hits = pool.slice(0, Math.min(pool.length, 5 + Math.floor(Math.random() * 3)));
        const ends = hits.map((q) => ({ x: Math.round(q.body.position.x), y: Math.round(q.body.position.y) }));
        ends.push({ x: Math.round(this.targetX), y: Math.round(this.eqY) });
        this.fxSend({ fx: 'recycle', x: Math.round(x), y: Math.round(y), ends });
        this.recycleFx(x, y, ends, true);
        // The pieces hit are removed a beat after the strike, as the bolts land
        hits.forEach((q, i) => this.time.delayedCall(260 + 90 + i * 45, () => this.removePiece(q)));
        this.time.delayedCall(260 + 90, () => this.scrambleTarget());
    }

    // The picture of the recycle: charge, flickering bolts, a ring on each hit, afterglow.
    // Runs on this phone and, in TEAM mode, on the other phone too.
    recycleFx(x, y, ends, host = false) {
        if (!host) this.time.delayedCall(260 + 90, () => this.scrambleFx());
        this.playSound('sparksSound', 0.85);
        // 1) Charge: a crackling orb gathers at the recycle piece
        const orb = this.add.image(x, y, 'hintGlow').setTint(0x7dd3fc).setBlendMode(Phaser.BlendModes.ADD)
            .setDepth(999).setDisplaySize(30, 30);
        this.tweens.add({ targets: orb, displayWidth: 150, displayHeight: 150, duration: 260, ease: 'Cubic.easeIn' });
        this.sparks.emitParticleAt(x, y, 10);
        haptic('special');

        // 2) Strike: bolts re-drawn every 65 ms for ~0.8 s so they crackle and dance
        const gfx = this.add.graphics().setDepth(1000).setBlendMode(Phaser.BlendModes.ADD);
        const strike = (power) => {
            gfx.clear();
            gfx.fillStyle(0xbae6fd, 0.35 * power);
            gfx.fillCircle(x, y, 34);
            gfx.fillStyle(0xffffff, 0.85 * power);
            gfx.fillCircle(x, y, 13);
            ends.forEach((e) => this.drawBolt(gfx, x, y, e.x, e.y, power));
        };
        const STRIKE_MS = 800;
        this.time.delayedCall(260, () => {
            this.flash(160, 140, 210, 255);
            this.shake(380, 0.011);
            haptic('bomb');
            this.playSound('sparksSound', 0.9);
            this.sfx.duck(0.4, 900);
            for (let k = 0; k * 65 < STRIKE_MS; k++) {
                this.time.delayedCall(k * 65, () => strike(1 - (k * 65) / STRIKE_MS * 0.35));
            }
            // Hits land a beat after the first strike, each with its own burst (the last end is the target)
            ends.slice(0, -1).forEach((e, i) => this.time.delayedCall(90 + i * 45, () => {
                this.sparks.emitParticleAt(e.x, e.y, 14);
                this.tintBurst(0x7dd3fc);
                this.burst.emitParticleAt(e.x, e.y, 12);
                const ring = this.add.image(e.x, e.y, 'ring').setTint(0x7dd3fc).setBlendMode(Phaser.BlendModes.ADD)
                    .setDepth(998).setScale(0.6 * INV);
                this.tweens.add({ targets: ring, scale: 1.6 * INV, alpha: 0, duration: 380, onComplete: () => ring.destroy() });
            }));
            // 3) Afterglow: the last bolts fade out slowly
            this.tweens.add({
                targets: [gfx, orb], alpha: 0, delay: STRIKE_MS, duration: 450,
                onComplete: () => { gfx.destroy(); orb.destroy(); }
            });
        });
    }

    // Target flickers through random numbers like a slot machine, then lands on a new one
    scrambleTarget() {
        this.scrambleFx();
        this.time.delayedCall(800, () => {
            if (this.gameOver) return;
            this.newTarget();
            this.ensureSolvable();
        });
    }

    scrambleFx() {
        const txt = this.targetText;
        this.tweens.killTweensOf(txt);
        txt.setScale(1.15);
        this.time.addEvent({
            delay: 50, repeat: 15,
            callback: () => { if (txt.active) txt.setText(String(1 + Math.floor(Math.random() * 45))); }
        });
    }

    // Jagged path by midpoint displacement: each split pushes the middle sideways by an amount
    // that halves with the segment, which gives the natural fractal look of real lightning
    boltPoints(x1, y1, x2, y2, roughness = 0.32) {
        const pts = [{ x: x1, y: y1 }];
        const split = (ax, ay, bx, by, disp) => {
            const len = Math.hypot(bx - ax, by - ay);
            if (len < 14) {
                pts.push({ x: bx, y: by });
                return;
            }
            const nx = -(by - ay) / len;
            const ny = (bx - ax) / len;
            const off = (Math.random() - 0.5) * disp;
            const mx = (ax + bx) / 2 + nx * off;
            const my = (ay + by) / 2 + ny * off;
            split(ax, ay, mx, my, disp / 2);
            split(mx, my, bx, by, disp / 2);
        };
        split(x1, y1, x2, y2, Math.hypot(x2 - x1, y2 - y1) * roughness);
        return pts;
    }

    strokeBolt(g, pts, width, power = 1) {
        [[width * 6, 0x38bdf8, 0.16], [width * 2.6, 0x7dd3fc, 0.5], [width, 0xffffff, 1]].forEach(([lw, color, a]) => {
            const alpha = a * power;
            g.lineStyle(lw, color, alpha);
            g.beginPath();
            g.moveTo(pts[0].x, pts[0].y);
            for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
            g.strokePath();
        });
    }

    drawBolt(g, x1, y1, x2, y2, power = 1) {
        const main = this.boltPoints(x1, y1, x2, y2);
        this.strokeBolt(g, main, 3, power);
        // 1-3 thinner forks that split off the main channel and die out
        const forks = 1 + Math.floor(Math.random() * 3);
        for (let f = 0; f < forks; f++) {
            const i = 2 + Math.floor(Math.random() * Math.max(1, main.length - 4));
            const p = main[Math.min(i, main.length - 1)];
            const dir = Math.atan2(y2 - y1, x2 - x1) + (Math.random() < 0.5 ? -1 : 1) * Phaser.Math.FloatBetween(0.35, 0.9);
            const len = Math.hypot(x2 - x1, y2 - y1) * Phaser.Math.FloatBetween(0.15, 0.3);
            this.strokeBolt(g, this.boltPoints(p.x, p.y, p.x + Math.cos(dir) * len, p.y + Math.sin(dir) * len, 0.4), 1.3, power);
        }
        g.fillStyle(0xe0f2fe, 0.6 * power);
        g.fillCircle(x2, y2, 12);
    }

    // Bomb fuse: sparks fly from the wick, the bomb flashes faster and faster, hisses, then blows
    lightFuse(p, ms) {
        p.lit = true;
        this.fxSend({ fx: 'fuse', id: p.id, ms });
        this.fuseVisual(p, ms);
        p.fuseTimer = this.time.delayedCall(ms, () => this.detonate(p));
    }

    // Sparks, sound and blinking of a lit bomb. `p` is a piece, or on the other phone a sprite entry
    // ({ img, alive }); the pieces of effect it creates are kept on it so clearFuse() can end them.
    fuseVisual(p, ms) {
        this.tweens.killTweensOf(p.img);
        p.img.setScale(INV);
        p.fuseFx = this.add.particles(0, 0, 'spark', {
            speed: { min: 40, max: 160 },
            angle: { min: 200, max: 340 },
            scale: { start: 1.3, end: 0 },
            lifespan: { min: 180, max: 380 },
            gravityY: 260,
            frequency: 22,
            blendMode: 'ADD',
            follow: p.img,
            followOffset: { x: R * 0.8, y: -R * 0.8 }
        }).setDepth(201);
        p.fuseSound = this.sfx.fuse();
        const start = this.time.now;
        const blink = () => {
            if (!p.alive) return;
            const left = Math.max(0, ms - (this.time.now - start));
            p.img.setTint(p.img.tintTopLeft === 0xffffff ? 0xff7a6a : 0xffffff);
            this.tweens.add({ targets: p.img, scale: 1.12 * INV, duration: 60, yoyo: true });
            p.fuseBlink = this.time.delayedCall(Math.max(60, left * 0.22), blink);
        };
        blink();
    }

    clearFuse(p) {
        if (p.fuseFx) p.fuseFx.destroy();
        if (p.fuseSound) p.fuseSound.stop();
        if (p.fuseTimer) p.fuseTimer.remove();
        if (p.fuseBlink) p.fuseBlink.remove();
        p.fuseFx = p.fuseSound = p.fuseTimer = p.fuseBlink = null;
    }

    detonate(p) {
        if (!p.alive || this.gameOver) return;
        const { x, y } = p.body.position;
        this.tintBurst(p.color);
        this.burst.emitParticleAt(x, y, 12);
        this.removePiece(p);
        this.explode(x, y);
    }

    // Steel junk loses one state per hit; at zero it breaks into shards
    damageJunk(p, n) {
        if (!p.alive) return;
        p.hp -= n;
        const { x, y } = p.body.position;
        this.fxSend({ fx: 'jdmg', x: Math.round(x), y: Math.round(y), hp: p.hp });
        this.sparks.emitParticleAt(x, y, 6);
        if (p.hp <= 0) {
            this.shards.emitParticleAt(x, y, 16);
            this.sparks.emitParticleAt(x, y, 10);
            this.sfx.metalBreak();
            this.removePiece(p);
            this.addScore(25, x, y, 0xc0c7d6);
            return;
        }
        this.sfx.clank(p.hp === 2 ? 1 : 0.85);
        this.shards.emitParticleAt(x, y, 3);
        p.img.setTexture(pieceTextureKey(p));
        this.tweens.add({ targets: p.img, scale: 1.1 * INV, duration: 70, yoyo: true });
    }

    // Heat wave: hot rings expand from the piece; when the front reaches a frozen piece its ice
    // melts in a puff of steam. The ice grows back slowly after HEAT_THAW_MS.
    heatWave(x, y) {
        const { reach, travel } = this.heatFx(x, y);
        this.fxSend({ fx: 'heat', x: Math.round(x), y: Math.round(y) });
        for (const p of this.pieces) {
            if (!p.ice) continue;
            const d = Phaser.Math.Distance.Between(x, y, p.body.position.x, p.body.position.y);
            this.time.delayedCall((d / reach) * travel, () => this.thaw(p));
        }
    }

    // The picture of a heat wave: sound, rings, warm air, sparks. Returns how far and how long it travels.
    heatFx(x, y) {
        this.sfx.heat();
        this.playSound('sparksSound', 0.3);
        const reach = Math.hypot(Math.max(x, this.w - x), Math.max(y, this.h - y)) + R;
        const travel = 950;
        for (let k = 0; k < 3; k++) {
            const ring = this.add.image(x, y, 'heatwave').setDepth(185).setBlendMode(Phaser.BlendModes.ADD)
                .setScale(0.05).setAlpha(1 - k * 0.28);
            this.tweens.add({
                targets: ring, scale: (reach * 2) / 256 * 1.08, duration: travel, delay: k * 150, ease: 'Linear',
                onComplete: () => ring.destroy()
            });
            this.tweens.add({ targets: ring, alpha: 0, delay: k * 150 + travel * 0.6, duration: travel * 0.4 });
        }
        // Warm air over the whole screen for a moment
        const warm = this.add.rectangle(this.w / 2, this.h / 2, this.w, this.h, 0xff7a1a, 1).setDepth(6).setAlpha(0);
        this.tweens.add({
            targets: warm, alpha: 0.12, duration: 250, yoyo: true, hold: 350, onComplete: () => warm.destroy()
        });
        this.tintBurst(0xff8a1f);
        this.burst.emitParticleAt(x, y, 20);
        this.sparks.emitParticleAt(x, y, 14);
        return { reach, travel };
    }

    // Steam puff and a little pulse where a frozen piece melts (the ice itself fades in the board stream)
    thawFx(x, y, img) {
        this.steamFx.emitParticleAt(x, y - R * 0.3, 7);
        this.tweens.add({ targets: img, scale: 1.12 * INV, duration: 90, yoyo: true });
    }

    thaw(p) {
        if (!p.alive || !p.ice) return;
        const ice = p.ice;
        this.tweens.killTweensOf(ice);
        const { x, y } = p.body.position;
        this.thawFx(x, y, p.img);
        this.tweens.add({ targets: ice, alpha: 0, duration: 300, ease: 'Cubic.easeOut' });
        this.time.delayedCall(HEAT_THAW_MS, () => {
            if (!p.alive || !p.ice) return;
            this.tweens.add({ targets: p.ice, alpha: 0.95, duration: ICE_FREEZE_MS * 1.4, ease: 'Sine.easeIn' });
        });
    }

    startTimerPowerUp() {
        this.playSound('timeSound', 0.8);
        this.music.hold(true);
        this.sfx.startTickTock();
        this.timerRemaining = TIMER_POWERUP_MS;
        this.lastTimerSecs = -1;
        this.timerBadge.setVisible(true);
        this.tweens.killTweensOf(this.timerOverlay);
        this.tweens.add({ targets: this.timerOverlay, alpha: 0.1, duration: 400 });
    }

    endTimerPowerUp() {
        this.timerRemaining = 0;
        this.sfx.stopTickTock();
        if (!this.gameOver) this.music.hold(false);
        this.spawnTimer = 0;
        this.timerBadge.setVisible(false);
        this.tweens.killTweensOf(this.timerOverlay);
        this.tweens.add({ targets: this.timerOverlay, alpha: 0, duration: 400 });
    }

    startHintPowerUp() {
        this.playSound('bonusSound', 0.7);
        this.hintRemaining = HINT_POWERUP_MS;
        this.lastHintSecs = -1;
        this.hintRefresh = 0;
        this.hintBadge.setVisible(true);
    }

    endHintPowerUp() {
        this.hintRemaining = 0;
        this.hintPieces = [];
        this.hintBadge.setVisible(false);
    }

    // ------------------------------------------------------------------ helpers

    playClick() {
        this.playSound('clickbutton', 0.6);
    }

    // Copies of the same sample started in the same instant stack up and clip: keep one per 60 ms
    playSound(key, volume) {
        if (!settings.get('sfx') || !this.cache.audio.exists(key)) return;
        const now = performance.now();
        this.lastPlay = this.lastPlay || {};
        if (now - (this.lastPlay[key] || 0) < 60) return;
        this.lastPlay[key] = now;
        this.sound.play(key, { volume });
    }

    // Camera shake / flash respect the "less motion" setting
    shake(duration, intensity) {
        if (!settings.get('reduceMotion')) this.cameras.main.shake(duration, intensity);
    }

    flash(duration, r, g, b) {
        if (!settings.get('reduceMotion')) this.cameras.main.flash(duration, r, g, b);
    }

    // A tiny physics freeze on big impacts makes them land harder
    hitStop(ms) {
        if (this.paused || this.gameOver) return;
        this.matter.world.pause();
        // scene clock: follows the game loop and waits while paused
        this.time.delayedCall(ms, () => {
            if (!this.paused && !this.gameOver) this.matter.world.resume();
        });
    }

    addScore(amount, x, y, color) {
        this.score = Math.max(0, this.score + amount);
        this.scoreText.setText(String(this.score));
        this.tweens.add({ targets: this.scoreText, scale: 1.25, duration: 120, yoyo: true });
        this.createFloatingText(x, y, (amount > 0 ? '+' : '') + amount, color);
        if (this.multi) {
            this.updateMpHud();
            this.queueScoreSync();
        }
    }

    createFloatingText(x, y, message, color) {
        const colorStr = '#' + color.toString(16).padStart(6, '0');
        const t = this.add.text(x, y, message, {
            fontFamily: 'Righteous', fontSize: '28px', color: colorStr,
            stroke: '#000000', strokeThickness: 4
        }).setOrigin(0.5).setDepth(200).setScale(0.5);

        this.tweens.add({
            targets: t,
            y: y + 50,
            scale: 1.2,
            alpha: 0,
            duration: 900,
            ease: 'Cubic.easeOut',
            onComplete: () => t.destroy()
        });
    }

    // Bonus round: the game slows down like a slow-motion replay until it stops, then this scene
    // pauses (physics, timers, tweens) and a drill runs on top of it. Coming back plays it in reverse.
    startBonus() {
        if (this.gameOver || this.paused || this.inBonus || this.replay) return;
        this.inBonus = true;
        for (let i = 0; i < 3; i++) this.deselect(i);
        this.sfx.stopTickTock();
        this.music.hold(true);   // the mini game brings its own music
        this.sfx.tape(true, 2.6);
        this.slowMo('in', () => {
            this.sfx.pauseLoops();
            const d = Phaser.Utils.Array.GetRandom(DRILLS);
            this.scene.pause();
            this.scene.launch('DrillScene', { id: d.id, bonus: true });
        });
    }

    // Called by DrillScene when the bonus round ends
    bonusDone(points) {
        this.scene.resume();
        this.sfx.tape(false, 2.2);
        this.slowMo('out', () => {
            this.inBonus = false;
            this.sfx.resumeLoops();
            if (this.timerRemaining <= 0) this.music.hold(false);
            if (this.timerRemaining > 0) this.sfx.startTickTock();
            if (points > 0) {
                this.addScore(points, this.w / 2, this.h * 0.42, 0xffd23f);
                this.earnBeans(Math.max(1, Math.round(points / 300)), this.w / 2, this.h * 0.42 + 40);
            }
        });
    }

    // ------------------------------------------------------------------ slow motion

    // 'in': speed eases from 1 to almost 0 while letterbox bars, a sepia wash and a REPLAY tag appear.
    // 'out': the same effect in reverse. Driven by real time in update(), so it is not slowed itself.
    slowMo(dir, done) {
        const { w, h } = this;
        let r = this.replay;
        if (!r) {
            const barH = Math.round(h * 0.09);
            const box = this.add.container(0, 0).setDepth(950);
            const wash = this.add.rectangle(0, 0, w, h, 0x3b1e0e, 1).setOrigin(0).setAlpha(0);
            const top = this.add.rectangle(0, 0, w, barH, 0x000000, 1).setOrigin(0, 1);
            const bottom = this.add.rectangle(0, h, w, barH, 0x000000, 1).setOrigin(0, 0);
            const rec = this.add.text(16, 0, '● REPLAY', {
                fontFamily: 'Righteous', fontSize: '15px', color: '#ff4d4d'
            }).setOrigin(0, 0.5);
            const speed = this.add.text(w - 16, 0, '', {
                fontFamily: 'Righteous', fontSize: '15px', color: '#ffffff'
            }).setOrigin(1, 0.5);
            const title = this.add.text(w / 2, h * 0.42, '', {
                fontFamily: 'Righteous', fontSize: '34px', color: '#ffd23f', stroke: '#1b0f2e', strokeThickness: 7, align: 'center'
            }).setOrigin(0.5).setAlpha(0);
            box.add([wash, top, bottom, rec, speed, title]);
            const cam = this.cameras.main;
            const fx = cam.postFX ? cam.postFX.addColorMatrix() : null;
            r = this.replay = { box, wash, top, bottom, rec, speed, title, barH, fx, k: 0 };
        }
        Object.assign(r, { dir, t: 0, dur: dir === 'in' ? 2600 : 2200, hold: dir === 'in' ? 800 : 0, done });
        r.title.setText(dir === 'in' ? t('slowMo') : t('backToGame'));
    }

    // Advances the effect by the real frame time; returns the slowed game time
    stepReplay(real) {
        const r = this.replay;
        r.t += real;
        const p = Phaser.Math.Clamp(r.t / r.dur, 0, 1);
        const k = r.dir === 'in' ? Phaser.Math.Easing.Sine.InOut(p) : 1 - Phaser.Math.Easing.Sine.InOut(p);
        r.k = k;
        const speed = 1 - 0.97 * k;
        this.matter.world.engine.timing.timeScale = speed;
        this.tweens.timeScale = speed;
        this.time.timeScale = speed;

        const { h } = this;
        r.top.y = r.barH * k;
        r.bottom.y = h - r.barH * k;
        r.rec.y = r.top.y - r.barH / 2;
        r.rec.setAlpha(Math.floor(r.t / 400) % 2 ? 0.35 : 1);
        r.speed.y = r.rec.y;
        r.speed.setText(`×${speed.toFixed(2)}`);
        r.wash.setAlpha(0.28 * k);
        // Title shows up while time is almost still
        const ta = r.dir === 'in' ? Phaser.Math.Clamp((p - 0.45) / 0.3, 0, 1) : Phaser.Math.Clamp(1 - p / 0.5, 0, 1);
        r.title.setAlpha(ta).setScale(0.9 + 0.1 * ta);
        if (r.fx) {
            r.fx.reset();
            r.fx.grayscale(0.8 * k);
        }

        if (this.gameOver) {
            this.endReplay();
            this.inBonus = false;
            return real;
        }
        if (r.done && r.t >= r.dur + r.hold) {
            const done = r.done;
            r.done = null;
            // 'in' stays on screen (frozen) under the drill until the way back
            if (r.dir === 'out') this.endReplay();
            done();
        }
        return real * speed;
    }

    endReplay() {
        const r = this.replay;
        if (!r) return;
        this.replay = null;
        this.matter.world.engine.timing.timeScale = 1;
        this.tweens.timeScale = 1;
        this.time.timeScale = 1;
        if (r.fx) this.cameras.main.postFX.remove(r.fx);
        r.box.destroy();
    }

    // Glow and bubbles take the piece colour; the other effects keep their own colours
    tintBurst(color) {
        const fx = this.popFx;
        this.burst.setParticleTint(fx && fx.tint !== undefined ? fx.tint : color);
    }

    // Coffee beans are banked straight away (quitting mid-game keeps them)
    earnBeans(n, x, y) {
        const won = this.zen ? Math.ceil(n / 2) : n;
        // The bling climbs while beans keep coming without a long pause
        this.beanChain = this.time.now - this.lastBeanAt < 6000 ? this.beanChain + 1 : 0;
        this.lastBeanAt = this.time.now;
        this.time.delayedCall(140, () => this.sfx.coin(this.beanChain));
        this.beansEarned += won;
        addBeans(won);
        const label = this.add.text(x, y, t('beanPlus', { n: won }), {
            fontFamily: 'Righteous', fontSize: '17px', color: '#ffd9a8', stroke: '#2b160b', strokeThickness: 4
        }).setOrigin(0.5).setDepth(205).setAlpha(0);
        this.tweens.add({ targets: label, alpha: 1, y: y - 10, duration: 160, delay: 180 });
        this.tweens.add({
            targets: label, alpha: 0, y: y - 34, delay: 820, duration: 320, onComplete: () => label.destroy()
        });
    }


    // ------------------------------------------------------------------ two players (net.js)

    mateName() {
        const o = this.room.other();
        return o ? o.name : '?';
    }

    setupMulti() {
        const room = this.room;
        this.mpText = this.add.text(this.w / 2, this.uiHeight + 14, '', {
            fontFamily: 'Righteous', fontSize: '14px', color: '#ffffff', stroke: '#1b0f2e', strokeThickness: 4,
            backgroundColor: 'rgba(11,6,32,0.55)', padding: { x: 8, y: 3 }
        }).setOrigin(0.5).setDepth(150);
        this.updateMpHud();
        if (this.team) this.watchRoute();
        room.pollMs = 0;
        const offEv = room.onEvent((ev) => this.onNet(ev));
        if (this.link) {
            this.link.send({ meta: this.hostMeta() });
            this.link.onMessage((msg) => this.onGuest(msg));
            this.link.onClose(() => { if (!this.gameOver) this.endGame('left'); });
        }
        const offState = room.onState(({ players, failures }) => {
            if (this.gameOver) return;
            const o = players[1 - room.me];
            if ((o && !o.here) || failures > 20) this.endGame('left');
        });
        room.start();
        this.events.once('shutdown', () => {
            offEv();
            offState();
            if (this.link) setTimeout(() => this.link.close(), 1500);
            clearTimeout(this.scoreSyncTimer);
            // Give the last event a moment to go out before leaving the room
            setTimeout(() => room.close(), 1500);
        });
    }

    // TEAM: a small line under the scores telling how the phones are linked (direct / relay, delay)
    watchRoute() {
        const lk = this.link || this.peer;
        if (!lk) return;
        this.routeText = this.add.text(this.w / 2, this.uiHeight + 32, '', {
            fontFamily: 'Roboto', fontSize: '10px', color: '#a5a8ff', stroke: '#0b0620', strokeThickness: 3
        }).setOrigin(0.5).setDepth(150);
        const tick = async () => {
            if (this.gameOver || !this.sys.isActive()) return;
            const r = await lk.route();
            if (r && this.routeText.active) {
                const kind = { lan: t('routeLan'), direct: t('routeDirect'), relay: t('routeRelay') }[r.kind];
                this.routeText.setText(`🔗 ${kind}${r.rtt !== null ? ` · ${r.rtt} ms` : ''}`);
            }
            this.time.delayedCall(3000, tick);
        };
        this.time.delayedCall(1500, tick);
    }

    updateMpHud() {
        if (!this.mpText) return;
        const me = t('you');
        const mate = this.mateName();
        this.mpText.setText(this.team
            ? `🤝 ${t('teamShort')} ${this.score + this.mate.score}  ·  ${me} ${this.score}  ·  ${mate} ${this.mate.score}`
            : `⚔️ ${me} ${this.score}   ${t('vs')}   ${mate} ${this.mate.score}`);
    }

    // The other phone shows my score: send it now and then (solves already carry it)
    queueScoreSync() {
        if (this.scoreSyncTimer || this.gameOver) return;
        this.scoreSyncTimer = setTimeout(() => {
            this.scoreSyncTimer = null;
            if (!this.gameOver) this.room.send({ type: 'score', score: this.score });
        }, 1500);
    }

    sendSolve(seqs, pts) {
        if (this.link) {
            this.link.send({ fx: 'solved', by: 0, pts });
            return;
        }
        if (this.team) {
            const round = this.round;
            this.round++;
            const mine = { round, target: this.target, i: Infinity };
            this.lastSolve = mine;
            this.room.send({ type: 'solve', round, seqs, target: this.target, pts, score: this.score }).then((i) => {
                if (i !== null) mine.i = i;
            });
        } else {
            // Duel: every equation sends steel junk to the other board (two on a hot combo)
            this.room.send({ type: 'junk', n: this.combo >= 3 ? 2 : 1, score: this.score });
            this.mpNotice(t('junkSent'), '#ffd23f');
        }
    }

    onNet(ev) {
        if (this.gameOver) return;
        if (ev.score !== undefined) this.mate.score = ev.score;
        if (ev.type === 'solve' && this.team) this.mateSolved(ev);
        else if (ev.type === 'junk' && this.duel) {
            this.dropJunk(ev.n || 1);
            this.mpNotice(t('junkFrom', { name: this.mateName() }), '#ff9a9a');
            haptic('fail');
        } else if (ev.type === 'over') this.endGame('mateOver');
        else if (ev.type === 'leave') this.endGame('left');
        this.updateMpHud();
    }

    // Team: the other player solved. Their pieces vanish here too and their next target is shared.
    mateSolved(ev) {
        this.mate.solved++;
        const used = new Set(ev.seqs || []);
        if (this.slots.some((p) => p && used.has(p.seq))) for (let i = 0; i < 3; i++) this.deselect(i);
        for (const p of [...this.pieces]) {
            if (p.seq !== undefined && used.has(p.seq)) {
                this.tintBurst(p.color);
                this.burst.emitParticleAt(p.img.x, p.img.y, 8);
                this.removePiece(p);
            }
        }
        const adopt = () => {
            if (ev.target && ev.target !== this.target) {
                this.setTarget(ev.target);
                this.spawnQueue = this.missingPiecesFor(ev.target, this.reachablePieces());
                this.forceQueue = false;
            }
        };
        if (ev.round === this.round) {
            this.round++;
            adopt();
        } else if (this.lastSolve && ev.round === this.lastSolve.round && ev.i < this.lastSolve.i) {
            // Both solved the same round: the one the server got first chooses the next target
            adopt();
        }
        this.mpNotice(`${this.mateName()} +${ev.pts || 0}`, '#4ade80');
        this.sfx.rise(3);
        // Team levels count everyone's equations
        this.solved++;
        this.checkLevelUp();
        this.ensureSolvable();
    }

    mpNotice(text, color) {
        const y = this.uiHeight + 42;
        const label = this.add.text(this.w / 2, y, text, {
            fontFamily: 'Righteous', fontSize: '18px', color, stroke: '#1b0f2e', strokeThickness: 5
        }).setOrigin(0.5).setDepth(216).setAlpha(0);
        this.tweens.add({ targets: label, alpha: 1, y: y + 6, duration: 180 });
        this.tweens.add({ targets: label, alpha: 0, delay: 1300, duration: 300, onComplete: () => label.destroy() });
    }

    confirmLeave() {
        if (this.gameOver || this.leaveUI) return;
        const m = modal(this, { depth: 700, height: 230, title: t('leaveGame') });
        this.leaveUI = m;
        const { panel, depth } = m;
        const bw = Math.min(120, (panel.w - 60) / 2);
        m.add(chunkyButton(this, panel.cx - bw / 2 - 8, panel.y + panel.h - 50, t('no'), 0x22c55e, () => { m.close(); this.leaveUI = null; },
            { width: bw, height: 48, fontSize: 20, depth, enter: false }));
        m.add(chunkyButton(this, panel.cx + bw / 2 + 8, panel.y + panel.h - 50, t('yes'), 0xef4444, () => {
            m.close();
            this.leaveUI = null;
            this.endGame('quit');
        }, { width: bw, height: 48, fontSize: 20, depth, enter: false }));
    }

    // Two-player end. reason: undefined (my board overflowed), 'quit', 'mateOver', 'left'
    endMulti(reason) {
        this.gameOver = true;
        this.endReason = reason;
        if (this.leaveUI) { this.leaveUI.close(); this.leaveUI = null; }
        const mine = reason === undefined || reason === 'quit';
        if (mine) this.room.send({ type: 'over', score: this.score });
        if (this.link) {
            this.sendSnapshot();
            this.link.send({ over: true, reason: reason === 'quit' ? 'mateQuit' : reason === 'left' ? 'left' : 'board' });
        }
        else if (this.scoreSyncTimer) clearTimeout(this.scoreSyncTimer);
        this.matter.world.pause();
        this.music.stop();
        this.sfx.stopAll();
        this.pieces.forEach((p) => this.clearFuse(p));
        haptic('gameOver');
        const bonus = Math.floor(this.score / 500);
        if (bonus) addBeans(bonus);
        const beans = this.beansEarned + bonus;
        let outcome;
        if (this.team) outcome = 'team';
        else outcome = mine ? 'lost' : 'won';
        this.toastMissions(track('gameOver', { score: this.score, level: this.level, mode: this.mode }));
        this.gameOverCascade(() => this.showMultiPanel(outcome, reason, beans));
    }

    showMultiPanel(outcome, reason, beans) {
        const m = modal(this, { depth: 700, height: 470 });
        const { panel, depth } = m;
        const D = (o) => m.add(o.setDepth(depth));
        const mate = this.mateName();
        m.add(addMascot(this, panel.x + panel.w - 40, panel.y + 24, outcome === 'lost' ? 'sad' : 'cheer', { height: 76, depth: depth + 1 }));
        const title = outcome === 'team' ? t('teamOver') : outcome === 'won' ? t('youWon') : t('youLost');
        D(this.add.text(panel.cx, panel.y + 46, title, {
            fontFamily: 'Righteous', fontSize: '34px', color: outcome === 'lost' ? '#f87171' : '#ffd23f',
            stroke: '#1b0f2e', strokeThickness: 7
        }).setOrigin(0.5));
        if (reason === 'left') {
            D(this.add.text(panel.cx, panel.y + 84, t('mateLeft', { name: mate }), {
                fontFamily: 'Roboto', fontSize: '13px', color: '#c4c6f5'
            }).setOrigin(0.5));
        }
        let y = panel.y + 120;
        if (outcome === 'team') {
            D(this.add.text(panel.cx, y, `${t('teamShort')}: ${this.score + this.mate.score}`, {
                fontFamily: 'Righteous', fontSize: '28px', color: '#ffffff'
            }).setOrigin(0.5));
            y += 46;
        }
        const rows = [[t('you'), this.score, this.solved - (this.team ? this.mate.solved : 0)], [mate, this.mate.score, this.mate.solved]];
        rows.forEach(([name, pts, eq]) => {
            D(this.add.text(panel.cx, y, name, { fontFamily: 'Righteous', fontSize: '17px', color: '#ffffff' }).setOrigin(0.5));
            const detail = this.team ? `${pts} ${t('ptsShort')}  ·  ${eq} ${t(eq === 1 ? 'eqOne' : 'eqShort')}` : `${pts} ${t('ptsShort')}`;
            D(this.add.text(panel.cx, y + 22, detail, { fontFamily: 'Righteous', fontSize: '16px', color: '#ffd9a8' }).setOrigin(0.5));
            y += 52;
        });
        if (outcome === 'team') {
            const diff = this.score - this.mate.score;
            const helper = diff === 0 ? t('helpedTie') : t('helpedMost', { name: diff > 0 ? t('you') : mate });
            D(this.add.text(panel.cx, y + 4, `🏅 ${helper}`, {
                fontFamily: 'Righteous', fontSize: '18px', color: '#4ade80', align: 'center', wordWrap: { width: panel.w - 40 }
            }).setOrigin(0.5));
        }
        if (beans > 0) {
            D(this.add.text(panel.cx, panel.y + panel.h - 112, t(beans === 1 ? 'earnedOne' : 'earned', { n: beans }), {
                fontFamily: 'Righteous', fontSize: '15px', color: '#e8b878'
            }).setOrigin(0.5));
        }
        if (outcome !== 'lost') this.celebrate();
        const bw = Math.min(140, (panel.w - 60) / 2);
        m.add(chunkyButton(this, panel.cx - bw / 2 - 8, panel.y + panel.h - 54, t('twoPlayersShort'), 0xf59e0b,
            () => this.scene.start('MultiScene'), { width: bw, height: 50, fontSize: 18, depth, enter: false }));
        m.add(chunkyButton(this, panel.cx + bw / 2 + 8, panel.y + panel.h - 54, t('menu'), 0x6366f1,
            () => this.scene.start('MenuScene'), { width: bw, height: 50, fontSize: 18, depth, enter: false }));
    }


    // ------------------------------------------------------------------ TEAM host: the shared board

    // Everything the other phone needs to draw the board, ~15 times a second
    sendSnapshot() {
        const flat = [];
        let fresh = null;
        for (const p of this.pieces) {
            const key = p.img.texture.key;
            let k = this.keyIdx.get(key);
            if (k === undefined) {
                k = this.keyIdx.size;
                this.keyIdx.set(key, k);
                (fresh = fresh || {})[k] = key;
            }
            const pos = p.body.position;
            flat.push(p.id, Math.round(pos.x * 2) / 2, Math.round(pos.y * 2) / 2,
                p.type === 'junk' ? Math.round(p.body.angle * 100) : 0, k,
                p.ice ? Math.round(p.ice.alpha * 100) : 0, p.selected ? 1 : p.gsel ? 2 : 0);
        }
        // New texture names go on the reliable channel (the board stream may lose frames)
        if (fresh) this.link.send({ keys: fresh });
        this.keyTick = (this.keyTick || 0) + 1;
        if (this.keyTick % 60 === 0 || this.sendAllKeys) this.sendKeys();
        this.link.sendFast({
            ts: Math.round(performance.now()), s: flat, t: this.target,
            sc: [this.score, this.mate.score], so: [this.solved - this.mate.solved, this.mate.solved],
            gs: this.guestSlots.map((q) => (q ? q.id : -1)), lv: this.level,
            tm: Math.max(0, Math.ceil(this.timerRemaining / 1000)), hn: Math.max(0, Math.ceil(this.hintRemaining / 1000)),
            hp: this.hintPieces.map((q) => q.id)
        });
    }

    // Every texture name the other phone may need (it can miss the first ones while its scene loads)
    sendKeys() {
        this.sendAllKeys = false;
        const all = {};
        this.keyIdx.forEach((k, key) => { all[k] = key; });
        this.link.send({ keys: all });
        this.link.send({ meta: this.hostMeta() });
    }

    onGuest(msg) {
        if (this.gameOver) return;
        if (msg.ready) { this.sendKeys(); return; }
        if (msg.tap !== undefined) this.guestTap(msg.tap);
        else if (msg.untap !== undefined) this.guestDeselect(msg.untap);
        else if (msg.quit) this.endGame('left');
    }

    guestTap(id) {
        if (this.guestValidating) return;
        const p = this.pieces.find((q) => q.id === id && q.alive);
        if (!p) return;
        if (p.type === 'special') {
            if (!p.lit) this.activateSpecial(p);
            return;
        }
        if (p.type === 'junk') {
            this.sfx.clank(1.2);
            return;
        }
        if (p.selected) {
            this.link.send({ fx: 'taken' });
            return;
        }
        if (p.ice && p.ice.alpha > 0.4) this.crackIce(p);
        if (p.gsel) {
            this.guestDeselect(p.gslot);
            return;
        }
        const gs = this.guestSlots;
        const slot = p.type === 'operator' ? 1 : (!gs[0] ? 0 : 2);
        if (gs[slot]) this.guestDeselect(slot);
        gs[slot] = p;
        p.gsel = true;
        p.gslot = slot;
        if (gs[0] && gs[1] && gs[2]) {
            this.guestValidating = true;
            this.time.delayedCall(260, () => this.guestValidate());
        }
    }

    guestDeselect(i) {
        const p = this.guestSlots[i];
        if (!p) return;
        this.guestSlots[i] = null;
        p.gsel = false;
        p.gslot = -1;
    }

    // The teammate completed an equation on the shared board
    guestValidate() {
        this.guestValidating = false;
        const [a, o, b] = this.guestSlots;
        if (!a || !o || !b || this.gameOver) return;
        const made = calc(a.value, o.value, b.value);
        const eq = { a: a.value, o: o.value, b: b.value, target: this.target };
        if (made === this.target) {
            const base = Math.round(SCORING.base[o.value] * (1 + (this.level - 1) * SCORING.levelBonus));
            const iced = [a, b].filter((q) => q.ice && q.ice.alpha > 0.3).length;
            const pts = base + iced * SCORING.iceBonus;
            for (const q of [a, o, b]) {
                this.tintBurst(q.color);
                this.burst.emitParticleAt(q.img.x, q.img.y, 12);
                q.gsel = false;
                this.removePiece(q);
            }
            this.guestSlots = [null, null, null];
            this.mate.score += pts;
            this.mate.solved++;
            this.solved++;
            this.sfx.rise(3);
            this.mpNotice(`${this.mateName()} +${pts}`, '#4ade80');
            this.link.send({ fx: 'res', ok: true, pts, ...eq });
            this.crackJunk();
            this.newTarget();
            this.checkLevelUp();
            this.updateMpHud();
        } else {
            this.link.send({ fx: 'res', ok: false, made, ...eq });
            for (let i = 0; i < 3; i++) this.guestDeselect(i);
            if (settings.get('junk')) this.time.delayedCall(350, () => this.dropJunk(2));
        }
    }

    // ------------------------------------------------------------------ pause

    pauseGame() {
        if (this.multi) return;   // the other player keeps playing: no pause (the button offers to leave)
        if (this.paused || this.gameOver || !this.gameStarted || this.replay) return;
        this.paused = true;
        this.matter.world.pause();
        // Pause only the running tweens: in Phaser 3.60 tweens.pauseAll() would also freeze the
        // pause menu and countdown tweens created afterwards (and survive a scene restart)
        this.frozenTweens = this.tweens.getTweens().filter((tw) => !tw.paused);
        this.frozenTweens.forEach((tw) => tw.pause());
        this.time.paused = true;
        this.sound.pauseAll();
        this.music.pause();
        this.sfx.stopTickTock();
        this.sfx.pauseLoops();
        this.pieces.forEach((p) => p.fuseFx && p.fuseFx.pause());
        this.showPauseMenu();
    }

    showPauseMenu() {
        const m = modal(this, { depth: 700, height: 400, title: t('paused') });
        this.pauseUI = m;
        const { panel } = m;
        // Bica naps on top of the pause panel
        m.add(addMascot(this, panel.x + panel.w - 46, panel.y + 18, 'sleep', { height: 74, depth: m.depth + 1 }));
        const bw = Math.min(240, panel.w - 48);
        const opts = { width: bw, height: 56, fontSize: 24, depth: m.depth, enter: false };
        // Resume first and biggest: it is what players want most of the time
        m.add(chunkyButton(this, panel.cx, panel.y + 112, t('resume'), 0x22c55e, () => this.resumeGame(), opts));
        m.add(chunkyButton(this, panel.cx, panel.y + 184, t('settings'), 0x6366f1, () => {
            openSettings(this, {
                depth: 760,
                onClose: (langChanged) => {
                    if (!langChanged) return;
                    this.closePauseMenu();
                    this.buildHud();
                    this.showPauseMenu();
                }
            });
        }, opts));
        m.add(chunkyButton(this, panel.cx, panel.y + 256, t('restart'), 0xf59e0b, () => this.scene.restart(this.restartData()), opts));
        // Zen never ends by itself: END shows the results (and pays the beans)
        if (this.zen) {
            m.add(chunkyButton(this, panel.cx, panel.y + 328, t('end'), 0xef4444, () => {
                this.closePauseMenu();
                this.paused = false;
                this.time.paused = false;
                (this.frozenTweens || []).forEach((tw) => tw.resume());
                this.frozenTweens = null;
                this.endGame('zen');
            }, opts));
        } else {
            m.add(chunkyButton(this, panel.cx, panel.y + 328, t('menu'), 0x8b5cf6, () => this.scene.start('MenuScene'), opts));
        }
    }

    restartData() {
        return { tutorial: this.tutorial, daily: this.daily, mode: this.mode };
    }

    closePauseMenu() {
        if (this.pauseUI) this.pauseUI.close();
        this.pauseUI = null;
    }

    // 3-2-1 before play resumes, so the player is not caught off guard
    resumeGame() {
        this.closePauseMenu();
        this.countdown(() => {
            this.paused = false;
            this.time.paused = false;
            (this.frozenTweens || []).forEach((tw) => tw.resume());
            this.frozenTweens = null;
            this.sound.resumeAll();
            this.matter.world.resume();
            this.music.resume();
            this.sfx.resumeLoops();
            this.pieces.forEach((p) => p.fuseFx && p.fuseFx.resume());
            if (this.timerRemaining > 0) this.sfx.startTickTock();
        });
    }

    // Big 3, 2, 1 (and GO! at the start of a game). Runs on tweens, which keep going while paused.
    countdown(onDone, withGo = false) {
        const label = this.add.text(this.w / 2, this.h / 2, '', {
            fontFamily: 'Righteous', fontSize: '96px', color: '#ffd23f',
            stroke: '#1b0f2e', strokeThickness: 10
        }).setOrigin(0.5).setDepth(650);
        const seq = withGo ? ['3', '2', '1', t('go')] : ['3', '2', '1'];

        const step = (i) => {
            if (i >= seq.length) {
                label.destroy();
                onDone();
                return;
            }
            const isGo = i === 3;
            label.setText(seq[i]).setScale(isGo ? 0.6 : 1.6).setAlpha(1).setColor(isGo ? '#4ade80' : '#ffd23f');
            if (settings.get('sfx') && this.cache.audio.exists(isGo ? 'bonusSound' : 'clickbutton')) {
                this.sound.play(isGo ? 'bonusSound' : 'clickbutton', { volume: 0.5, detune: isGo ? 0 : i * 200 });
            }
            // Each number pops in, holds so it can be read, then fades (about 0.8 s per beat)
            this.tweens.add({
                targets: label,
                scale: isGo ? 1.35 : 1,
                duration: isGo ? 380 : 340,
                ease: 'Back.easeOut',
                onComplete: () => this.tweens.add({
                    targets: label,
                    alpha: 0,
                    scale: isGo ? 1.6 : 0.85,
                    delay: isGo ? 300 : 220,
                    duration: isGo ? 320 : 240,
                    ease: 'Cubic.easeIn',
                    onComplete: () => step(i + 1)
                })
            });
        };
        step(0);
    }

    // ------------------------------------------------------------------ resize

    // Mobile browsers resize the page when the address bar shows/hides; rotation also lands here.
    // The pile moves with the floor so nothing floats or disappears.
    onResize(gameSize) {
        const w = Math.round(gameSize.width / RES);
        const h = Math.round(gameSize.height / RES);
        if (!w || !h || (w === this.w && h === this.h)) return;
        const dh = h - this.h;
        this.w = w;
        this.h = h;

        this.matter.world.setBounds(0, -h, w, h * 2 - this.floorGap, 200, true, true, false, true);
        for (const p of this.pieces) {
            const pos = p.body.position;
            this.Body.setPosition(p.body, { x: Phaser.Math.Clamp(pos.x, R + 1, w - R - 1), y: pos.y + dh });
            this.Sleeping.set(p.body, false);
        }
        if (this.bg) { if (this.bg.fit) this.bg.fit(w, h); else this.bg.setDisplaySize(w, h); }

        if (this.link) this.link.send({ meta: this.hostMeta() });
        clearTimeout(this.hudTimer);
        this.hudTimer = setTimeout(() => {
            if (!this.sys.isActive() && !this.paused) return;
            this.buildHud();
            if (this.pauseUI) {
                this.closePauseMenu();
                this.showPauseMenu();
            }
        }, 120);
    }

    // ------------------------------------------------------------------ feel

    onImpact(event) {
        if (!settings.get('sfx') || !this.cache.audio.exists('impactSound')) return;
        const now = performance.now();
        if (now - this.lastImpactAt < 70) return;
        for (const pair of event.pairs) {
            const a = pair.bodyA.velocity;
            const b = pair.bodyB.velocity;
            const speed = Math.abs(a.y - b.y) + Math.abs(a.x - b.x) * 0.5;
            if (speed > 3.5) {
                this.lastImpactAt = now;
                this.sound.play('impactSound', {
                    volume: Math.min(0.32, 0.05 + speed * 0.022),
                    detune: Phaser.Math.Between(-250, 150)
                });
                return;
            }
        }
    }

    // Tapping a frozen piece cracks the ice for a moment so the player can peek at it
    crackIce(p) {
        const ice = p.ice;
        this.tweens.killTweensOf(ice);
        this.fxSend({ fx: 'ice', x: Math.round(p.img.x), y: Math.round(p.img.y) });
        this.crackIceFx(p.img.x, p.img.y);
        this.tweens.add({ targets: ice, alpha: 0.15, duration: 120, ease: 'Cubic.easeOut' });
        this.tweens.add({ targets: ice, alpha: 0.95, duration: 900, delay: 820, ease: 'Sine.easeIn' });
    }

    crackIceFx(x, y) {
        this.tintBurst(0xbfe9ff);
        this.burst.emitParticleAt(x, y, 8);
        if (settings.get('sfx') && this.cache.audio.exists('clickbutton')) {
            this.sound.play('clickbutton', { volume: 0.4, detune: 900 });
        }
    }

    // ------------------------------------------------------------------ achievements

    toastAchievements(list) {
        if (!list || list.length === 0) return;
        this.toastQueue.push(...list.map((a) => ({ medal: a, head: t('achievementUnlocked'), title: achievementText(a)[0] })));
        if (!this.toasting) this.nextToast();
    }

    // Missions use the same banner, with a coffee-bean medal and the reward
    toastMissions(list) {
        if (!list || list.length === 0) return;
        this.toastQueue.push(...list.map((m) => ({
            medal: { tier: 1, glyph: '☕' },
            head: `${t('missionDone')}  +${m.beans}`,
            title: missionText(m)
        })));
        if (!this.toasting) this.nextToast();
    }

    // Banner that slides down from under the HUD (above everything, game over included)
    nextToast() {
        const item = this.toastQueue.shift();
        if (!item) {
            this.toasting = false;
            return;
        }
        this.toasting = true;
        const { medal: a, head: headText, title } = item;
        const bw = Math.min(this.w - 24, 330);
        const bh = 62;
        const x = this.w / 2 - bw / 2;
        const y = this.uiTop + 14;

        const box = this.add.container(0, -bh - y - 20).setDepth(900);
        const g = this.add.graphics();
        g.fillStyle(0x000000, 0.4);
        g.fillRoundedRect(x + 3, y + 5, bw, bh, 18);
        g.fillStyle(0x2a1c52, 1);
        g.fillRoundedRect(x, y, bw, bh, 18);
        g.lineStyle(3, 0x140a24, 1);
        g.strokeRoundedRect(x, y, bw, bh, 18);
        g.lineStyle(2, 0xffd23f, 0.9);
        g.strokeRoundedRect(x + 4, y + 4, bw - 8, bh - 8, 14);
        const medal = drawMedal(this, x + 34, y + bh / 2, 20, a, true, 900);
        const head = this.add.text(x + 64, y + 18, headText, {
            fontFamily: 'Righteous', fontSize: '12px', color: '#ffd23f', letterSpacing: 2
        }).setOrigin(0, 0.5);
        const name = this.add.text(x + 64, y + 40, title, {
            fontFamily: 'Righteous', fontSize: title.length > 26 ? '15px' : '19px', color: '#ffffff'
        }).setOrigin(0, 0.5);
        box.add([g, ...medal, head, name]);

        if (settings.get('sfx') && this.cache.audio.exists('bonusSound')) {
            this.sound.play('bonusSound', { volume: 0.6, detune: 300 });
        }
        haptic('toast');
        this.tweens.add({ targets: box, y: 0, duration: 380, ease: 'Back.easeOut' });
        this.tweens.add({
            targets: box, y: -bh - y - 20, alpha: 0, delay: 2400, duration: 300, ease: 'Cubic.easeIn',
            onComplete: () => {
                box.destroy();
                this.nextToast();
            }
        });
    }

    // ------------------------------------------------------------------ levels & scoring

    // Sprint lasts one minute, so pieces arrive faster to keep the player busy
    levelSpawnDelay(level) {
        const d = LEVELS.spawnDelay(level);
        return this.sprint ? Math.max(450, Math.round(d * 0.6)) : d;
    }

    allowedOps() {
        if (this.multi) return LEVELS.ops(this.mpStage());
        return this.tutorial || this.daily ? OPS : LEVELS.ops(this.level);
    }

    // Two players: operators and spawn speed follow the time since the shared start (every 40 s),
    // so both phones always draw the same pieces at the same pace
    mpStage() {
        if (!this.room || !this.room.startAt) return 1;
        return 1 + Math.max(0, Math.floor((this.room.serverNow() - this.room.startAt) / 40000));
    }

    // Random helpers that use a seeded stream in the daily challenge, Math.random otherwise
    rand(rng) {
        return rng ? rng.frac() : Math.random();
    }

    randInt(rng, a, b) {
        return a + Math.floor(this.rand(rng) * (b - a + 1));
    }

    pick(rng, arr) {
        return arr[Math.floor(this.rand(rng) * arr.length)];
    }

    // Points by operator and level, times the combo multiplier, plus a bonus per frozen piece used
    scoreSuccess() {
        const now = this.time.now;
        this.combo = now - this.lastSuccessAt <= SCORING.comboWindow ? this.combo + 1 : 1;
        this.quick = now - this.lastSuccessAt <= SCORING.quickWindow ? this.quick + 1 : 0;
        this.lastSuccessAt = now;
        this.bestCombo = Math.max(this.bestCombo, this.combo);
        this.solved++;

        const op = this.slots[1].value;
        const mult = Math.min(SCORING.comboMax, 1 + (this.combo - 1) * SCORING.comboStep);
        const iced = this.slots.filter((p) => p && p.ice && p.ice.alpha > 0.3).length;
        const base = Math.round(SCORING.base[op] * (1 + (this.level - 1) * SCORING.levelBonus));
        const points = Math.round(base * mult) + iced * SCORING.iceBonus;

        this.addScore(points, this.targetX, this.eqY + this.slotSize * 0.6, 0x4ade80);
        if (this.combo >= 2) {
            this.showCombo(mult);
            haptic('combo');
        }
        this.updateLevelHud();

        this.streak++;
        this.solvedOps.push(op);
        // A bean per equation, one more on a hot combo, one more for a quick answer,
        // and everything doubles on a run of quick answers
        if (!this.tutorial) {
            let beans = this.combo >= 3 ? 2 : 1;
            if (this.quick >= 1) beans += 1;
            const double = this.quick >= SCORING.doubleAfter;
            if (double) beans *= 2;
            if (this.quick >= 1) this.showCoffee(double);
            this.earnBeans(beans, this.w * 0.3, this.uiHeight + 28);
        }
        if (!this.tutorial) {
            this.toastAchievements(report('solve', {
                op, combo: this.combo, level: this.level, score: this.score, iced, streak: this.streak
            }));
            this.toastMissions(track('solve', { op, combo: this.combo, iced }));
        }
    }

    showCombo(mult) {
        const tiers = ['#4ade80', '#38bdf8', '#a855f7', '#f59e0b', '#ef4444'];
        const color = tiers[Math.min(tiers.length - 1, this.combo - 2)];
        const y = this.uiHeight + 70;
        const label = this.add.text(this.w / 2, y, `${t('combo')} x${mult}`, {
            fontFamily: 'Righteous', fontSize: `${30 + Math.min(5, this.combo) * 4}px`, color,
            stroke: '#1b0f2e', strokeThickness: 7
        }).setOrigin(0.5).setDepth(210).setScale(0.3);
        this.tweens.add({ targets: label, scale: 1, duration: 260, ease: 'Back.easeOut' });
        this.tweens.add({
            targets: label, alpha: 0, y: y - 34, delay: 650, duration: 350,
            onComplete: () => label.destroy()
        });
        this.starBurst.emitParticleAt(this.w / 2, y, 6 + this.combo * 2);
        if (settings.get('sfx') && this.cache.audio.exists('bonusSound')) {
            this.sound.play('bonusSound', { volume: 0.45, detune: Math.min(6, this.combo - 2) * 150 });
        }
    }

    // Coffee bonus for quick answers: one cup, or two cups ("double espresso") on a quick run
    showCoffee(double) {
        const y = this.uiHeight + (this.combo >= 2 ? 118 : 70);
        const label = this.add.text(this.w / 2, y, double ? t('doubleShot') : t('quickHit'), {
            fontFamily: 'Righteous', fontSize: double ? '30px' : '22px', color: double ? '#ffd23f' : '#ffd9a8',
            stroke: '#2b160b', strokeThickness: 7,
            shadow: double ? { offsetX: 0, offsetY: 0, color: '#ff8a00', blur: 14, fill: true } : undefined
        }).setOrigin(0.5).setDepth(211).setScale(0.3);
        this.tweens.add({ targets: label, scale: 1, angle: { from: -8, to: 0 }, duration: 300, ease: 'Back.easeOut' });
        this.tweens.add({ targets: label, alpha: 0, y: y - 30, delay: double ? 900 : 650, duration: 350, onComplete: () => label.destroy() });
        if (double) {
            this.sfx.fanfare();
            haptic('combo');
            if (this.starBurst) this.starBurst.emitParticleAt(this.w / 2, y, 14);
        } else {
            this.sfx.coin(4);
        }
    }

    checkLevelUp() {
        if (this.solved % LEVELS.EQUATIONS_PER_LEVEL !== 0) return;
        const before = LEVELS.ops(this.level);
        this.level++;
        if (!this.multi) this.spawnDelay = this.levelSpawnDelay(this.level);
        const newOp = this.daily || this.multi ? null : LEVELS.ops(this.level).find((op) => !before.includes(op));
        this.showLevelUp(newOp);
        this.updateLevelHud();
        this.music.setLevel(this.level);
        this.toastAchievements(report('level', { level: this.level }));
        this.earnBeans(3, this.w / 2, this.h * 0.42 + 90);
        this.toastMissions(track('level', { level: this.level }));
        // Every 3 levels of Classic / Zen: a 20 s themed bonus round
        if ((this.mode === 'classic' || this.zen) && this.level % 3 === 0) {
            this.time.delayedCall(1800, () => this.startBonus());
        }
    }

    showLevelUp(newOp) {
        this.playSound('bonusSound', 0.8);
        this.sfx.fanfare();
        haptic('levelUp');
        const cy = this.h * 0.42;
        const title = this.add.text(this.w / 2, cy, t('levelUp', { n: this.level }), {
            fontFamily: 'Righteous', fontSize: '52px', color: '#ffd23f',
            stroke: '#1b0f2e', strokeThickness: 9,
            shadow: { offsetX: 0, offsetY: 6, color: '#7b2cbf', blur: 0, fill: true, stroke: true }
        }).setOrigin(0.5).setDepth(220).setScale(0.2).setAlpha(0);
        const subText = newOp ? t('unlocked', { op: newOp === '-' ? '−' : newOp }) : t('faster');
        const sub = this.add.text(this.w / 2, cy + 50, subText, {
            fontFamily: 'Righteous', fontSize: '22px', color: '#ffffff',
            stroke: '#1b0f2e', strokeThickness: 6
        }).setOrigin(0.5).setDepth(220).setAlpha(0);

        this.tweens.add({ targets: title, scale: 1, alpha: 1, duration: 420, ease: 'Back.easeOut' });
        this.tweens.add({ targets: sub, alpha: 1, duration: 300, delay: 200 });
        this.tweens.add({
            targets: [title, sub], alpha: 0, y: '-=40', delay: 1400, duration: 400,
            onComplete: () => { title.destroy(); sub.destroy(); }
        });
        this.starBurst.emitParticleAt(this.w / 2, cy, 24);
        this.flash(180, 255, 210, 63);
    }

    updateLevelHud() {
        if (!this.levelText) return;
        if (this.timed) {
            const secs = Math.max(0, Math.ceil(this.dailyRemaining / 1000));
            this.levelText.setText(`⏱ ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`)
                .setColor(secs <= 10 ? '#ff5e5b' : '#ffd23f');
        } else {
            this.levelText.setText(this.tutorial ? '' : `${this.zen ? 'ZEN · ' : ''}${t('levelShort')} ${this.level}`);
        }
        const g = this.levelBar;
        g.clear();
        if (this.tutorial) return;
        const x = 24;
        const w = this.energyOn ? this.w * 0.62 - 32 : this.w - 48;
        const y = this.uiHeight - 11;
        g.fillStyle(0x2a1c52, 1);
        g.fillRoundedRect(x, y, w, 5, 2.5);
        const progress = (this.solved % LEVELS.EQUATIONS_PER_LEVEL) / LEVELS.EQUATIONS_PER_LEVEL;
        if (progress > 0) {
            g.fillStyle(0xffd23f, 1);
            g.fillRoundedRect(x, y, Math.max(5, w * progress), 5, 2.5);
        }
    }

    // ------------------------------------------------------------------ interactive tutorial

    startTutorial() {
        this.setTarget(8);
        this.spawnQueue = [];
        const plan = [
            [{ type: 'number', value: 3 }, 0.22],
            [{ type: 'operator', value: '+' }, 0.5],
            [{ type: 'number', value: 5 }, 0.78],
            [{ type: 'number', value: 2 }, 0.36],
            [{ type: 'operator', value: '×' }, 0.64]
        ];
        plan.forEach(([data, fx], i) => {
            this.time.delayedCall(i * 160, () => {
                this.tutPieces.push(this.createPiece({ ...data, noIce: true }, Math.round(fx * this.w), -R * 2));
            });
        });
        // Bica explains, pointing at the pieces
        this.tutBica = addMascot(this, 58, this.uiHeight + 150, 'happy', { height: 92, depth: 172, accessory: 'none' });
        this.tutBica.setAlpha(0);
        this.tweens.add({ targets: this.tutBica, alpha: 1, y: this.uiHeight + 140, duration: 400, ease: 'Back.easeOut' });
        this.showTutBubble(t('tutHello'));
        this.time.delayedCall(2600, () => {
            if (this.tutBica && this.tutBica.body) this.tutBica.body.setTexture('bica_point');
            this.tutorialStep(0);
        });
    }

    tutorialStep(i) {
        const keys = ['tut1', 'tut2', 'tut3'];
        this.tutStep = i;
        if (i >= keys.length) {
            this.tutTarget = null;
            this.hintPieces = [];
            this.showTutBubble(null);
            return;
        }
        this.tutTarget = this.tutPieces[i];
        this.hintPieces = [this.tutTarget];
        this.showTutBubble(t(keys[i]));
    }

    showTutBubble(text) {
        if (this.tutBubble) this.tutBubble.forEach((o) => o.destroy());
        this.tutBubble = null;
        if (!text) return;

        const y = this.uiHeight + 80;
        // With Bica on the left the bubble moves right to make room
        const cx = this.tutBica ? this.w / 2 + 44 : this.w / 2;
        const label = this.add.text(cx, y, text, {
            fontFamily: 'Righteous', fontSize: this.tutBica ? '20px' : '24px', color: '#ffffff',
            stroke: '#1b0f2e', strokeThickness: 6, align: 'center', wordWrap: { width: this.w - 140 }
        }).setOrigin(0.5).setDepth(171);
        const bw = Math.min(this.tutBica ? this.w - 112 : this.w - 32, label.width + 40);
        const bh = Math.max(58, label.height + 22);
        const x = cx - bw / 2;
        const g = this.add.graphics().setDepth(170);
        g.fillStyle(0x000000, 0.35);
        g.fillRoundedRect(x + 3, y - bh / 2 + 5, bw, bh, 18);
        g.fillStyle(0x2a1c52, 1);
        g.fillRoundedRect(x, y - bh / 2, bw, bh, 18);
        g.lineStyle(3, 0x140a24, 1);
        g.strokeRoundedRect(x, y - bh / 2, bw, bh, 18);
        g.lineStyle(2, 0xffd23f, 0.8);
        g.strokeRoundedRect(x + 4, y - bh / 2 + 4, bw - 8, bh - 8, 14);

        label.setScale(0.6);
        g.setAlpha(0);
        this.tweens.add({ targets: label, scale: 1, duration: 260, ease: 'Back.easeOut' });
        this.tweens.add({ targets: g, alpha: 1, duration: 180 });
        this.tutBubble = [g, label];
    }

    finishTutorial() {
        settings.set('tutorialDone', true);
        if (this.tutBica && this.tutBica.body) {
            this.tutBica.body.setTexture('bica_cheer');
            this.tweens.add({ targets: this.tutBica, y: this.tutBica.y - 16, duration: 180, yoyo: true, repeat: 2 });
        }
        this.tutTarget = null;
        this.hintPieces = [];
        this.showTutBubble(null);

        this.time.delayedCall(700, () => {
            const m = modal(this, { depth: 600, height: 550, title: t('tutDoneTitle') });
            const { panel } = m;
            let y = panel.y + 84;
            t('tutDone').forEach((line) => {
                m.add(this.add.text(panel.cx, y, line, {
                    fontFamily: 'Roboto', fontSize: '17px', color: '#e5e3ff'
                }).setOrigin(0.5).setDepth(m.depth));
                y += 24;
            });
            y += 16;
            const specials = t('specials');
            const rows = [
                ['piece_special_bomb', specials.bomb],
                ['piece_special_timer', specials.timer],
                ['piece_special_hint', specials.hint],
                ['piece_special_recycle', specials.recycle],
                ['piece_special_heat', specials.heat],
                ['piece_num_7', specials.ice, true],
                ['piece_junk_3', specials.junk]
            ];
            const left = panel.x + 26;
            rows.forEach(([key, text, iced]) => {
                m.add(this.add.image(left + 16, y, key).setScale(32 / TEX_PX).setDepth(m.depth));
                if (iced && this.textures.exists('ice')) {
                    m.add(this.add.image(left + 16, y, 'ice').setScale(32 / TEX_PX).setAlpha(0.7).setDepth(m.depth));
                }
                m.add(this.add.text(left + 42, y, text, {
                    fontFamily: 'Roboto', fontSize: '14px', color: '#d6d4f5', wordWrap: { width: panel.w - 80 }
                }).setOrigin(0, 0.5).setDepth(m.depth));
                y += 40;
            });
            m.add(chunkyButton(this, panel.cx, panel.y + panel.h - 48, t('letsPlay'), 0x22c55e,
                () => this.scene.restart({ tutorial: false }),
                { width: Math.min(220, panel.w - 48), height: 56, fontSize: 26, depth: m.depth, delay: 200 }));
        });
    }

    // ------------------------------------------------------------------ game over

    endGame(reason) {
        if (this.gameOver) return;
        if (this.multi) {
            this.endMulti(reason);
            return;
        }
        this.gameOver = true;
        this.endReason = reason;
        if (this.chooser) {
            this.chooser.destroy();
            this.chooser = null;
        }
        this.matter.world.pause();
        this.music.stop();
        this.sfx.stopAll();
        this.pieces.forEach((p) => this.clearFuse(p));
        haptic('gameOver');

        let result;
        if (this.daily) result = daily.record(this.dailyKey, this.score);
        else if (this.sprint) result = modeBest.record('sprint', this.score);
        else if (this.zen) result = { isRecord: false, best: 0 };
        else result = stats.record({ score: this.score, equations: this.solved, bestCombo: this.bestCombo, level: this.level });
        this.toastAchievements(report('gameOver', { score: this.score, level: this.level, daily: !!this.daily }));
        this.toastMissions(track('gameOver', { score: this.score, level: this.level, mode: this.mode }));

        // End bonus on top of the beans won during play (zen pays half: there is no pressure)
        const bonus = Math.round(Math.floor(this.score / 500) * (this.zen ? 0.5 : 1));
        if (bonus) addBeans(bonus);
        result.beans = this.beansEarned + bonus;

        if (this.daily) result.streak = completeDaily();
        // Fire and forget: the game over panel shows the rank when it arrives
        this.rankBoard = this.daily ? 'daily' : this.sprint ? 'sprint' : this.zen ? null : 'classic';
        if (this.rankBoard && this.score > 0) result.rankPromise = submitScore(this.rankBoard, this.score, this.dailyKey);

        this.gameOverCascade(() => this.showGameOverPanel(result));
    }

    // The pile pops piece by piece, top to bottom, before the results appear
    gameOverCascade(done) {
        for (let i = 0; i < 3; i++) this.deselect(i);
        this.hintPieces = [];
        const list = [...this.pieces].sort((a, b) => a.body.position.y - b.body.position.y);
        const stepMs = Math.max(12, Math.min(28, 900 / Math.max(1, list.length)));
        this.shake(400, 0.006);
        list.forEach((p, i) => {
            this.time.delayedCall(i * stepMs, () => {
                if (!p.img.active) return;
                this.tintBurst(p.color);
                this.burst.emitParticleAt(p.img.x, p.img.y, 6);
                if (i % 5 === 0) this.playSound('popSound', 0.25);
                // kill the ice freeze tween too, or it keeps pushing the ice alpha back up
                const targets = p.ice ? [p.img, p.ice] : [p.img];
                this.tweens.killTweensOf(targets);
                this.tweens.add({ targets, scale: 1.25 * INV, alpha: 0, duration: 160, ease: 'Cubic.easeOut' });
            });
        });
        this.time.delayedCall(list.length * stepMs + 250, done);
    }

    showGameOverPanel(result) {
        const extra = this.daily ? 118 : this.rankBoard ? 96 : 30;
        const m = modal(this, { depth: 500, height: 440 + extra });
        const { panel } = m;
        // Bica reacts: amazed on a record, happy after a good game, sad when it went badly
        const pose = result.isRecord ? 'wow' : this.score >= 300 ? 'cheer' : 'sad';
        const bica = m.add(addMascot(this, panel.x + panel.w - 40, panel.y + 26, pose, { height: 84, depth: 520 }));
        bob(this, bica, 3);

        const title = m.add(this.add.text(panel.cx, panel.y + 50, this.endReason === 'time' ? t('timeUp') : this.endReason === 'zen' ? t('zen') : t('gameOver'), {
            fontFamily: 'Righteous', fontSize: '42px', color: '#ffffff',
            stroke: '#1b0f2e', strokeThickness: 8,
            shadow: { offsetX: 0, offsetY: 0, color: '#ef4444', blur: 18, fill: true }
        }).setOrigin(0.5).setDepth(m.depth).setScale(2).setAlpha(0));
        this.tweens.add({ targets: title, alpha: 1, scale: 1, duration: 450, delay: 150, ease: 'Back.easeOut' });

        const label = m.add(this.add.text(panel.cx, panel.y + 104, t('finalScore'), {
            fontFamily: 'Righteous', fontSize: '15px', color: '#a5a8ff', letterSpacing: 3
        }).setOrigin(0.5).setDepth(m.depth).setAlpha(0));
        const scoreText = m.add(this.add.text(panel.cx, panel.y + 152, '0', {
            fontFamily: 'Righteous', fontSize: '60px', color: '#FFB347',
            stroke: '#3b1d00', strokeThickness: 6,
            shadow: { offsetX: 0, offsetY: 0, color: '#FF8C00', blur: 14, fill: true }
        }).setOrigin(0.5).setDepth(m.depth).setAlpha(0));
        this.tweens.add({ targets: [label, scoreText], alpha: 1, duration: 300, delay: 450 });

        const counter = { v: 0 };
        this.tweens.add({
            targets: counter, v: this.score, duration: 900, delay: 500, ease: 'Cubic.easeOut',
            onUpdate: () => {
                scoreText.setText(String(Math.round(counter.v)));
                const now = performance.now();
                if (this.score > 0 && now - (this.lastCountTick || 0) > 55) {
                    this.lastCountTick = now;
                    this.sfx.count(counter.v / this.score);
                }
            }
        });

        // Record line: celebration for a new best, otherwise the best to beat
        const bestLabel = this.daily ? t('dailyBest') : this.sprint ? t('sprintBest') : t('best');
        const recordText = this.zen ? t('zenDesc')
            : result.isRecord ? `🏆 ${t('newRecord')}` : `${bestLabel}: ${result.best}`;
        const record = m.add(this.add.text(panel.cx, panel.y + 206, recordText, {
            fontFamily: 'Righteous', fontSize: result.isRecord ? '24px' : this.zen ? '14px' : '17px',
            color: result.isRecord ? '#ffd23f' : '#8b8bc4',
            stroke: '#1b0f2e', strokeThickness: result.isRecord ? 6 : 0
        }).setOrigin(0.5).setDepth(m.depth).setAlpha(0));
        this.tweens.add({ targets: record, alpha: 1, duration: 300, delay: 1400 });
        if (result.isRecord) {
            this.tweens.add({ targets: record, scale: 1.12, duration: 420, yoyo: true, repeat: -1, delay: 1400, ease: 'Sine.easeInOut' });
            this.time.delayedCall(1400, () => this.celebrate());
        }

        const bestMult = this.bestCombo >= 2 ? Math.min(SCORING.comboMax, 1 + (this.bestCombo - 1) * SCORING.comboStep) : 1;
        const line = m.add(this.add.text(panel.cx, panel.y + 240, `${t('level')} ${this.level}   ·   ${t('combo')} x${bestMult}`, {
            fontFamily: 'Roboto', fontSize: '15px', color: '#c9c7ee'
        }).setOrigin(0.5).setDepth(m.depth).setAlpha(0));
        this.tweens.add({ targets: line, alpha: 1, duration: 300, delay: 1500 });

        // Coffee beans earned
        const beansLine = m.add(this.add.text(panel.cx, panel.y + 268, result.beans ? `☕ ${t(result.beans === 1 ? 'earnedOne' : 'earned', { n: result.beans })}` : '', {
            fontFamily: 'Righteous', fontSize: '16px', color: '#e8b878'
        }).setOrigin(0.5).setDepth(m.depth).setAlpha(0));
        this.tweens.add({ targets: beansLine, alpha: 1, duration: 300, delay: 1600 });

        let y = panel.y + 268;
        if (this.daily) y = this.dailyResults(m, result, y);
        else if (this.rankBoard) y = this.rankResults(m, result, y);

        const bw = Math.min(240, panel.w - 48);
        m.add(chunkyButton(this, panel.cx, y + 62, t('restart'), 0x22c55e, () => this.scene.restart(this.restartData()),
            { width: bw, height: 58, fontSize: 26, depth: m.depth, delay: 900 }));
        m.add(chunkyButton(this, panel.cx, y + 132, t('menu'), 0x8b5cf6, () => this.scene.start('MenuScene'),
            { width: bw, height: 50, fontSize: 22, depth: m.depth, delay: 1050 }));
    }

    // "Ranking: #N" once the server answers
    rankLine(m, result, y) {
        const line = m.add(this.add.text(m.panel.cx, y, '', {
            fontFamily: 'Righteous', fontSize: '15px', color: '#c4a7ff'
        }).setOrigin(0.5).setDepth(m.depth));
        if (!result.rankPromise) return;
        result.rankPromise.then((r) => {
            if (!line.active) return;
            if (r.ok && r.data.me) line.setText(`🏆 ${t('ranking')}: #${r.data.me.rank}`);
            else if (!r.ok) {
                line.setText(r.reason === 'soon' ? t('rankingSoon') : r.reason === 'name' ? t('name_refused') : t('rankingOffline'));
            }
        });
    }

    // Classic and sprint: rank + RANKING button. Returns the next free y.
    rankResults(m, result, y) {
        this.rankLine(m, result, y + 26);
        m.add(chunkyButton(this, m.panel.cx, y + 66, t('ranking'), 0xa855f7,
            () => this.scene.start('RankingScene', { board: this.rankBoard }),
            { width: Math.min(200, m.panel.w - 60), height: 42, fontSize: 18, depth: m.depth, delay: 1150 }));
        return y + 96;
    }

    // Daily extras on the game over panel: streak, rank, SHARE and RANKING. Returns the next free y.
    dailyResults(m, result, y) {
        const { panel } = m;
        const st = result.streak || { count: 0 };
        let streakText = `🔥 ${t('streakDays', { n: st.count })}`;
        if (st.reward) streakText += `  ·  ${t('streakReward', { b: st.reward.beans })}`;
        else if (st.usedFreezes) streakText += `  ·  ${t('spareUsed')}`;
        const streakLine = m.add(this.add.text(panel.cx, y + 28, streakText, {
            fontFamily: 'Righteous', fontSize: st.reward ? '13px' : '16px', color: '#ffb238',
            wordWrap: { width: panel.w - 32 }, align: 'center'
        }).setOrigin(0.5).setDepth(m.depth).setAlpha(0));
        this.tweens.add({ targets: streakLine, alpha: 1, duration: 300, delay: 1700 });
        if (st.extended && st.count > 1) {
            this.tweens.add({ targets: streakLine, scale: 1.15, duration: 260, yoyo: true, delay: 1800, ease: 'Back.easeOut' });
        }

        this.rankLine(m, result, y + 54);

        const half = Math.min(118, (panel.w - 60) / 2);
        const bestMult = this.bestCombo >= 2 ? Math.min(SCORING.comboMax, 1 + (this.bestCombo - 1) * SCORING.comboStep) : 1;
        const shareBtn = m.add(chunkyButton(this, panel.cx - half / 2 - 6, y + 98, t('share'), 0x0ea5e9, async () => {
            const text = shareText({
                date: this.dailyKey, score: this.score, level: this.level,
                comboMult: bestMult, ops: this.solvedOps, streak: st.count
            });
            const how = await share(text);
            if (how === 'copied' && shareBtn.active) shareBtn.label.setText(t('copied'));
        }, { width: half, height: 46, fontSize: 18, depth: m.depth, delay: 1100 }));
        m.add(chunkyButton(this, panel.cx + half / 2 + 6, y + 98, t('ranking'), 0xa855f7,
            () => this.scene.start('RankingScene', { board: 'daily' }),
            { width: half, height: 46, fontSize: 18, depth: m.depth, delay: 1150 }));
        return y + 118;
    }

    celebrate() {
        this.playSound('bonusSound', 0.9);
        haptic('record');
        const confetti = this.add.particles(0, -20, 'confetti', {
            x: { min: 0, max: this.w },
            speedY: { min: 120, max: 320 },
            speedX: { min: -90, max: 90 },
            rotate: { min: 0, max: 360 },
            scale: { min: 0.6, max: 1.1 },
            lifespan: 3200,
            gravityY: 160,
            tint: [0xffd23f, 0xff5e5b, 0x38bdf8, 0x4ade80, 0xa855f7, 0xff8a1f],
            quantity: 3,
            frequency: 40,
            duration: 1600
        }).setDepth(560);
        this.time.delayedCall(5200, () => confetti.destroy());
    }
}
