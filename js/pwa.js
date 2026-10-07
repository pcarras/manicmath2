// PWA plumbing: service worker + update overlay, install button state, safe area.
import { playDoubleEspresso, showInstallHelp, isOverlayOpen, isIntroPlaying, abortIntro } from './bica.js';
import { t } from './i18n.js';

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
            rememberFullscreen(true);
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

// Height taken by the home indicator / gesture bar at the bottom
export function safeAreaBottom() {
    const probe = document.createElement('div');
    probe.style.cssText = 'position:fixed;bottom:0;visibility:hidden;padding-bottom:env(safe-area-inset-bottom, 0px)';
    document.body.appendChild(probe);
    const v = parseFloat(getComputedStyle(probe).paddingBottom) || 0;
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

const bootAt = performance.now();

async function handleUpdate(isActive) {
    if (updating) return;
    updating = true;

    const from = self.APP_VERSION;
    const to = await fetch('version.js', { cache: 'no-store' })
        .then((r) => r.text())
        .then((text) => (text.match(/APP_VERSION\s*=\s*'([^']+)'/) || [])[1] || null)
        .catch(() => null);

    const ready = new Promise((resolve) => {
        const t0 = Date.now();
        const tick = () => ((isActive() || Date.now() - t0 > 8000) ? resolve() : setTimeout(tick, 150));
        tick();
    });

    // Found while the app is opening: show ONE animation. The double espresso replaces the
    // single bica intro instead of playing after it.
    if (isIntroPlaying() || performance.now() - bootAt < 6000) {
        await abortIntro();
        await playDoubleEspresso({ ready, from, to });
        // Opening the app after a deploy already loads the new code (network first): no reload needed
        if (to !== from) window.location.reload();
        else updating = false;
        return;
    }

    // Found later, while playing: a small "new coffee flavour" note in the menu, never an interruption
    showFlavourNote(async () => {
        await playDoubleEspresso({ ready, from, to });
        window.location.reload();
    });
}

// Menu note for an update found mid-session. Only visible on the main menu; tap to update.
export function showFlavourNote(onTaste) {
    if (document.querySelector('.mm-flavour')) return;
    const el = document.createElement('div');
    el.className = 'mm-flavour';
    el.innerHTML = `
        <div class="mm-flavour__cup">
            <svg viewBox="0 0 48 48" width="46" height="46" aria-hidden="true">
                <path class="mm-steam" d="M17 12c-3-3 3-5 0-8" />
                <path class="mm-steam mm-steam--2" d="M24 12c-3-3 3-5 0-8" />
                <path class="mm-steam mm-steam--3" d="M31 12c-3-3 3-5 0-8" />
                <path d="M9 17h28v11a12 12 0 0 1-12 12h-4A12 12 0 0 1 9 28z" fill="#f4efe6" stroke="#140a24" stroke-width="2.5"/>
                <path d="M11 19h24v3H11z" fill="#6b3a1e"/>
                <path d="M11 19h24v1.4H11z" fill="#c68a4a"/>
                <path d="M37 21h3a5 5 0 0 1 0 10h-3" fill="none" stroke="#f4efe6" stroke-width="3.5"/>
                <ellipse cx="23" cy="43" rx="17" ry="3" fill="#e8e1d4" stroke="#140a24" stroke-width="2"/>
                <circle cx="17" cy="27" r="1.6" fill="#140a24"/><circle cx="27" cy="27" r="1.6" fill="#140a24"/>
                <path d="M19 31c2 2 4 2 6 0" fill="none" stroke="#140a24" stroke-width="1.8" stroke-linecap="round"/>
            </svg>
        </div>
        <div class="mm-flavour__text">
            <b></b>
            <span></span>
        </div>
        <button class="mm-flavour__btn"></button>`;
    el.querySelector('b').textContent = t('newFlavour');
    el.querySelector('span').textContent = t('newFlavourSub');
    el.querySelector('button').textContent = t('taste');
    let taken = false;
    const taste = () => {
        if (taken) return;
        taken = true;
        clearInterval(watch);
        el.classList.add('mm-flavour--out');
        setTimeout(() => el.remove(), 250);
        onTaste();
    };
    el.addEventListener('click', taste);
    document.body.appendChild(el);
    // Visible only while the main menu is on screen (hidden during games and other screens)
    const watch = setInterval(() => {
        const g = window.game;
        const onMenu = g && g.scene && g.scene.isActive('MenuScene') && !isOverlayOpen();
        el.classList.toggle('mm-flavour--hidden', !onMenu);
    }, 400);
}

// ------------------------------------------------------------------ keep full screen

// Android never lets a page (or app) block the bottom swipe: it shows the system bars and, in a
// browser, can drop full screen. Once the player chose full screen, the next tap brings it back.
const FS_KEY = 'mm-fullscreen';

function rememberFullscreen(on) {
    try { localStorage.setItem(FS_KEY, on ? '1' : '0'); } catch { /* private mode */ }
}

function wantsFullscreen() {
    try { return localStorage.getItem(FS_KEY) === '1'; } catch { return false; }
}

function restoreFullscreen() {
    if (!wantsFullscreen() || isStandalone() || !document.fullscreenEnabled || document.fullscreenElement) return;
    document.documentElement.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
}

// pointerup / touchend count as a user gesture for the Fullscreen API (pointerdown does not on touch)
window.addEventListener('pointerup', restoreFullscreen, true);
window.addEventListener('touchend', restoreFullscreen, true);
