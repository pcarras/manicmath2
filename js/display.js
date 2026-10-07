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

// On a computer the game runs inside a phone-sized frame (390 x 844, an average modern phone),
// so two browser windows side by side can test multiplayer like two phones.
// ?phone=1 forces the frame, ?phone=0 turns it off.
const phoneParam = new URLSearchParams(location.search).get('phone');
const looksDesktop = window.matchMedia('(pointer: fine)').matches && !('ontouchstart' in window) && window.innerWidth > 700;
export const PHONE = phoneParam === '0' ? null : (phoneParam === '1' || looksDesktop) ? { w: 390, h: 844 } : null;

// CSS size the game is drawn at
export function screenSize() {
    return PHONE ? { w: PHONE.w, h: PHONE.h } : { w: window.innerWidth, h: window.innerHeight };
}

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
