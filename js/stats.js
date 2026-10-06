// Personal records, persisted per device.
const KEY = 'mm-stats';
const DEFAULTS = { best: 0, games: 0, equations: 0, bestCombo: 0, bestLevel: 1 };

function load() {
    try {
        return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
    } catch {
        return { ...DEFAULTS };
    }
}

export const stats = {
    get() {
        return load();
    },
    // Saves a finished game; returns the previous best and whether this is a new record
    record({ score, equations, bestCombo, level }) {
        const s = load();
        const previousBest = s.best;
        const next = {
            best: Math.max(s.best, score),
            games: s.games + 1,
            equations: s.equations + equations,
            bestCombo: Math.max(s.bestCombo, bestCombo),
            bestLevel: Math.max(s.bestLevel, level)
        };
        try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* private mode */ }
        return { isRecord: score > previousBest && score > 0, previousBest, best: next.best };
    }
};

// Best score per extra mode (sprint). Zen has no score to beat.
const MODE_KEY = 'mm-mode-best';

export const modeBest = {
    get(mode) {
        try { return JSON.parse(localStorage.getItem(MODE_KEY) || '{}')[mode] || 0; } catch { return 0; }
    },
    record(mode, score) {
        let all = {};
        try { all = JSON.parse(localStorage.getItem(MODE_KEY) || '{}'); } catch { /* reset */ }
        const previousBest = all[mode] || 0;
        all[mode] = Math.max(previousBest, score);
        try { localStorage.setItem(MODE_KEY, JSON.stringify(all)); } catch { /* private mode */ }
        return { isRecord: score > previousBest && score > 0, previousBest, best: all[mode] };
    }
};

// Daily challenge: one shared seed per UTC day, so everyone plays the same challenge on the same day
export function todayKey() {
    return new Date().toISOString().slice(0, 10);
}

const DAILY_KEY = 'mm-daily';

export const daily = {
    best(dateKey = todayKey()) {
        try {
            const d = JSON.parse(localStorage.getItem(DAILY_KEY) || '{}');
            return d.date === dateKey ? d.best : 0;
        } catch {
            return 0;
        }
    },
    record(dateKey, score) {
        const previousBest = this.best(dateKey);
        const best = Math.max(previousBest, score);
        try { localStorage.setItem(DAILY_KEY, JSON.stringify({ date: dateKey, best })); } catch { /* private mode */ }
        return { isRecord: score > previousBest && score > 0, previousBest, best };
    }
};
