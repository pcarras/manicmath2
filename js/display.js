// HiDPI rendering. Phaser 3.60 has no resolution option, so the canvas is created at RES x the CSS size
// and every scene's camera zooms by RES: game code keeps working in CSS ("logical") pixels while
// phones with 2x/3x screens get sharp edges and text.
import { settings } from './settings.js';

const dpr = window.devicePixelRatio || 1;
// ?res=1|2|3 forces a resolution (testing HiDPI on a 1x screen)
const forced = Number(new URLSearchParams(location.search).get('res'));

// 'normal' graphics (setting) renders at 1x for weak phones; otherwise up to 2x (3x costs too much fill)
export const RES = [1, 2, 3].includes(forced) ? forced
    : settings.get('graphics') === 'normal' ? 1 : Math.max(1, Math.min(2, dpr));
export const INV = 1 / RES;

// Logical (CSS pixel) size of the game
export function view(scene) {
    return { w: scene.scale.width / RES, h: scene.scale.height / RES };
}

// Call first in every scene's create()
export function setupCamera(scene) {
    scene.cameras.main.setOrigin(0, 0).setZoom(RES);
}

// Every Text renders its glyphs at RES so labels stay crisp under the camera zoom
if (RES !== 1) {
    const factory = Phaser.GameObjects.GameObjectFactory.prototype;
    const makeText = factory.text;
    factory.text = function (...args) {
        return makeText.apply(this, args).setResolution(RES);
    };
}
