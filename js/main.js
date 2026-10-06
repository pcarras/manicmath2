import { RES, INV } from './display.js';
import { COLORS, MATTER_CONFIG } from './constants.js';
import { GameScene } from './scenes/GameScene.js';
import { MenuScene } from './scenes/MenuScene.js';
import { TestScene } from './scenes/TestScene.js';
import { AchievementsScene } from './scenes/AchievementsScene.js';
import { ShopScene } from './scenes/ShopScene.js';
import { RankingScene } from './scenes/RankingScene.js';
import { initPWA } from './pwa.js';
import { playIntro } from './bica.js';

initPWA();

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

const config = {
    type: Phaser.AUTO,
    // Canvas at RES x the CSS size, shown at CSS size (zoom) — cameras zoom back by RES
    width: Math.round(window.innerWidth * RES),
    height: Math.round(window.innerHeight * RES),
    backgroundColor: COLORS.bg,
    parent: 'game-container',
    disableContextMenu: true,
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
    scene: [MenuScene, GameScene, AchievementsScene, ShopScene, RankingScene, TestScene]
};

window.game = new Phaser.Game(config);

// Scale.NONE does not follow the window, so resize the canvas ourselves (address bar, rotation, fullscreen)
let resizeTimer = null;
const fit = () => {
    const w = Math.round(window.innerWidth * RES);
    const h = Math.round(window.innerHeight * RES);
    if (w > 0 && h > 0 && (w !== window.game.scale.width || h !== window.game.scale.height)) {
        window.game.scale.resize(w, h);
    }
};
window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(fit, 60);
});
