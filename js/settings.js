// Player settings (persisted per device) + debug flag.

const KEY = 'mm-settings';
const DEFAULTS = {
    music: true, sfx: true, vibration: true, lang: 'auto', graphics: 'high',
    highContrast: false,   // thick outlines + bigger, bolder labels on the pieces
    reduceMotion: false    // no camera shake / flash, calmer backgrounds
};

function load() {
    try {
        return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
    } catch {
        return { ...DEFAULTS };
    }
}

let state = load();
const listeners = new Set();

export const settings = {
    get(key) {
        return state[key];
    },
    set(key, value) {
        state = { ...state, [key]: value };
        try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* private mode */ }
        listeners.forEach((fn) => fn(key, value));
    },
    onChange(fn) {
        listeners.add(fn);
        return () => listeners.delete(fn);
    }
};

export function vibrate(pattern) {
    if (state.vibration && navigator.vibrate) navigator.vibrate(pattern);
}

// One pattern per kind of event, so the hand can tell what happened without looking.
// (navigator.vibrate exists on Android; iPhones ignore it.)
const HAPTICS = {
    tap: 8,
    success: [12, 30, 18],
    fail: [45, 35, 45],
    combo: [10, 25, 10, 25, 24],
    bomb: [70, 30, 120],
    special: [18, 20, 18],
    levelUp: [20, 40, 20, 40, 60],
    toast: [20, 30, 20],
    record: [30, 30, 30, 30, 80],
    gameOver: [100, 60, 200],
    tick: 6
};

export function haptic(kind) {
    vibrate(HAPTICS[kind] || 10);
}

// Debug tools (perf HUD, TEST PERF) are hidden from players.
// Turn on with ?debug=1 (off with ?debug=0) or 5 taps on the version text in the menu.
const DEBUG_KEY = 'mm-debug';
const param = new URLSearchParams(location.search).get('debug');
try {
    if (param === '1') localStorage.setItem(DEBUG_KEY, '1');
    if (param === '0') localStorage.removeItem(DEBUG_KEY);
} catch { /* ignore */ }

export function isDebug() {
    try { return localStorage.getItem(DEBUG_KEY) === '1'; } catch { return param === '1'; }
}

export function toggleDebug() {
    const on = !isDebug();
    try {
        if (on) localStorage.setItem(DEBUG_KEY, '1');
        else localStorage.removeItem(DEBUG_KEY);
    } catch { /* ignore */ }
    return on;
}
