// Shared by api/leaderboard.js and api/room.js (the leading underscore keeps it from becoming a route).
// Redis keys of the rankings. A week runs from Monday to Sunday, UTC.

// Monday (UTC) of the current week, or `back` weeks earlier
export function weekStart(back = 0) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7) - 7 * back);
    return d.toISOString().slice(0, 10);
}

export const NAMES = 'lbname';       // player id -> name, shared by every board
export const TEAM_NAMES = 'lbteam';  // duo "idA-idB" -> "Name & Name"
export const WEEK_TTL = 60 * 60 * 24 * 22;   // weekly boards are kept three weeks: last week is still readable

export const weekKey = (back = 0) => `lb:week:${weekStart(back)}`;
export const duelWeekKey = () => `lb:duel:${weekStart()}`;
export const DUEL_ALL_KEY = 'lb:duelall';
export const teamWeekKey = () => `lb:team:${weekStart()}`;
export const teamGamesKey = () => `lbteamn:${weekStart()}`;
