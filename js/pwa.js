// PWA plumbing: service worker + update overlay, install button state, safe area.
import { playDoubleEspresso, showInstallHelp, isOverlayOpen } from './bica.js';

const listeners = new Set();
const notify = () => listeners.forEach((fn) => {
    try { fn(); } catch (e) { console.error(e); }
});

// index.html may have caught the event before this module loaded
let deferredPrompt = window.__installPrompt || null;

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    notify();
});
window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    notify();
});
document.addEventListener('fullscreenchange', notify);

export function isStandalone() {
    return window.matchMedia('(display-mode: fullscreen)').matches
        || window.matchMedia('(display-mode: standalone)').matches
        || navigator.standalone === true;
}

export function isIOS() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent)
        || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

// 'prompt' (Android/desktop Chrome install), 'ios' (show instructions), 'fullscreen' (plain browser), or null
export function installMode() {
    if (isStandalone()) return null;
    if (deferredPrompt) return 'prompt';
    if (isIOS()) return 'ios';
    if (document.fullscreenEnabled && !document.fullscreenElement) return 'fullscreen';
    return null;
}

export async function install() {
    const mode = installMode();
    if (mode === 'prompt') {
        const prompt = deferredPrompt;
        deferredPrompt = null;
        prompt.prompt();
        try { await prompt.userChoice; } catch { /* dismissed */ }
    } else if (mode === 'ios') {
        showInstallHelp();
    } else if (mode === 'fullscreen') {
        try {
            await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
            if (screen.orientation && screen.orientation.lock) await screen.orientation.lock('portrait');
        } catch { /* not allowed on this browser */ }
    }
    notify();
}

export function onInstallChange(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
}

// Height hidden by a notch / status bar (iOS black-translucent, Android cutouts)
export function safeAreaTop() {
    const probe = document.createElement('div');
    probe.style.cssText = 'position:fixed;top:0;visibility:hidden;padding-top:env(safe-area-inset-top, 0px)';
    document.body.appendChild(probe);
    const v = parseFloat(getComputedStyle(probe).paddingTop) || 0;
    probe.remove();
    return v;
}

// ------------------------------------------------------------------ updates

let updating = false;

export function initPWA() {
    if (!('serviceWorker' in navigator)) return;

    // No controller = first install, which is not an "update"
    const hadController = !!navigator.serviceWorker.controller;
    let controllerChanged = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => { controllerChanged = true; });

    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then((reg) => {
        const onFound = () => {
            if (hadController) handleUpdate(() => controllerChanged);
        };
        if (reg.installing) onFound();
        reg.addEventListener('updatefound', onFound);

        // Long-lived PWAs: check again every 30 min and whenever the app comes back to the foreground
        setInterval(() => reg.update().catch(() => {}), 30 * 60 * 1000);
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') reg.update().catch(() => {});
        });
    }).catch((err) => console.error('SW registration failed:', err));
}

async function handleUpdate(isActive) {
    if (updating) return;
    updating = true;

    const from = self.APP_VERSION;
    const to = await fetch('version.js', { cache: 'no-store' })
        .then((r) => r.text())
        .then((text) => (text.match(/APP_VERSION\s*=\s*'([^']+)'/) || [])[1] || null)
        .catch(() => null);

    await waitUntilIdle();

    const ready = new Promise((resolve) => {
        const t0 = Date.now();
        const tick = () => ((isActive() || Date.now() - t0 > 8000) ? resolve() : setTimeout(tick, 150));
        tick();
    });
    await playDoubleEspresso({ ready, from, to });
    // Opening the app after a deploy already loads the new code (network first): no reload needed
    if (to !== from) window.location.reload();
    else updating = false;
}

// Never interrupt a running game or the intro: wait for the menu / game over screen
function waitUntilIdle() {
    return new Promise((resolve) => {
        const check = () => {
            const gs = window.game && window.game.scene && window.game.scene.getScene('GameScene');
            const playing = gs && gs.sys.isActive() && !gs.gameOver;
            if (playing || isOverlayOpen()) setTimeout(check, 1000);
            else resolve();
        };
        check();
    });
}
