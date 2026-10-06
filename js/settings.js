// Player settings (persisted per device) + debug flag.

const KEY = 'mm-settings';
const DEFAULTS = { music: true, sfx: true, vibration: true, lang: 'auto', graphics: 'high' };

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
