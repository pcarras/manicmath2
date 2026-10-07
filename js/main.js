import { RES, INV, PHONE, screenSize } from './display.js';
import { COLORS, MATTER_CONFIG } from './constants.js';
import { GameScene } from './scenes/GameScene.js';
import { MenuScene } from './scenes/MenuScene.js';
import { TestScene } from './scenes/TestScene.js';
import { AchievementsScene } from './scenes/AchievementsScene.js';
import { ShopScene } from './scenes/ShopScene.js';
import { RankingScene } from './scenes/RankingScene.js';
import { TrainingScene } from './scenes/TrainingScene.js';
import { DrillScene } from './scenes/DrillScene.js';
import { AlbumScene } from './scenes/AlbumScene.js';
import { MultiScene } from './scenes/MultiScene.js';
import { initPWA } from './pwa.js';
import { playIntro } from './bica.js';

initPWA();

// Desktop: show the game inside a phone frame, scaled down if the window is short
if (PHONE) {
    document.body.classList.add('phone-frame');
    const fitFrame = () => {
        const k = Math.min(1, (window.innerHeight - 32) / PHONE.h, (window.innerWidth - 32) / PHONE.w);
        document.documentElement.style.setProperty('--phone-k', k.toFixed(3));
    };
    fitFrame();
    window.addEventListener('resize', fitFrame);
}

// Piece labels are baked into textures once, so the web font must be ready first.
// The Bica Games intro plays meanwhile; the game starts when both are done.
const fontsReady = document.fonts && document.fonts.load
    ? Promise.race([
        Promise.all([
            document.fonts.load('40px Righteous'),
            document.fonts.load('16px "Press Start 2P"')   // Retro Pixel theme labels
        ]).catch(() => {}),
        new Promise((resolve) => setTimeout(resolve, 2500))
    ])
    : Promise.resolve();

await Promise.all([fontsReady, playIntro()]);

function makeAudioContext() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return undefined;
    try { return new AC({ latencyHint: 'balanced' }); } catch { return new AC(); }
}

const config = {
    type: Phaser.AUTO,
    // Canvas at RES x the CSS size, shown at CSS size (zoom) — cameras zoom back by RES
    width: Math.round(screenSize().w * RES),
    height: Math.round(screenSize().h * RES),
    backgroundColor: COLORS.bg,
    parent: 'game-container',
    disableContextMenu: true,
    // A slightly larger audio buffer than the default: phones under load stop dropping samples
    audio: { context: makeAudioContext() },
    render: {
        powerPreference: 'high-performance',
        antialias: true
    },
    scale: {
        mode: Phaser.Scale.NONE,
        zoom: INV
    },
    physics: {
        default: 'matter',
        matter: MATTER_CONFIG
    },
    scene: [MenuScene, GameScene, AchievementsScene, ShopScene, RankingScene, TrainingScene, DrillScene, AlbumScene, MultiScene, TestScene]
};

window.game = new Phaser.Game(config);

// Scale.NONE does not follow the window, so resize the canvas ourselves (address bar, rotation, fullscreen)
let resizeTimer = null;
const fit = () => {
    const w = Math.round(screenSize().w * RES);
    const h = Math.round(screenSize().h * RES);
    if (w > 0 && h > 0 && (w !== window.game.scale.width || h !== window.game.scale.height)) {
        window.game.scale.resize(w, h);
    }
};
window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(fit, 60);
});
