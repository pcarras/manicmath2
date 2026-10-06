// Player names typed for the public ranking. Used by the game and by api/leaderboard.js,
// so the same rules apply on the phone and on the server (which has the final word).

// Blocked when a word starts with one of these (catches plurals and verb forms)
const STEMS = [
    'fuck', 'shit', 'bitch', 'cunt', 'nigg', 'fagg', 'whore', 'slut', 'rapist', 'porn', 'hitler', 'nazi',
    'retard', 'caralh', 'foda', 'fodi', 'fode', 'merd', 'punhet', 'paneleir', 'panasc', 'buceta', 'broch',
    'otari', 'viad', 'estupid', 'idiot', 'porra', 'chupa', 'xupa', 'penis', 'vagina', 'pussy', 'putaria',
    'cabrao', 'cabroes', 'cornud', 'cornin', 'masturb', 'sexo', 'sexy', 'boob', 'tits'
];
// Blocked only as whole words (too short or too common inside innocent words, like "Cabral")
const WORDS = new Set([
    'cu', 'ass', 'sex', 'kkk', 'cock', 'dick', 'puta', 'putas', 'cona', 'conas', 'pila', 'pilas', 'cabra',
    'corno', 'cornos', 'mamas', 'rabo', 'preto', 'pretos', 'cigano', 'ciganos', 'gay', 'rape', 'anal', 'nude'
]);
// Leetspeak and look-alikes are folded before checking
const LEET = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', 8: 'b', '@': 'a', $: 's', '!': 'i' };

function fold(text) {
    return text.toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[0134578@$!]/g, (c) => LEET[c])
        .replace(/(.)\1{2,}/g, '$1$1');   // "fuuuck" -> "fuuck"
}

function blocked(name) {
    const f = fold(name);
    const words = f.split(/[^a-z]+/).filter(Boolean);
    for (const w of words) {
        if (WORDS.has(w) || WORDS.has(w.replace(/(.)\1+/g, '$1'))) return true;
        if (STEMS.some((s) => w.startsWith(s) || w.replace(/(.)\1+/g, '$1').startsWith(s))) return true;
    }
    // Spaced-out or glued tricks ("f u c k", "xfuckx") for the strongest words
    const glued = f.replace(/[^a-z]/g, '');
    return ['fuck', 'shit', 'cunt', 'nigg', 'caralh', 'foda', 'punhet', 'buceta', 'paneleir', 'hitler', 'whore']
        .some((s) => glued.includes(s));
}

export const NAME_MIN = 3;
export const NAME_MAX = 16;

// Returns { ok: true, name } with the tidied name, or { ok: false, reason: 'length' | 'chars' | 'blocked' }
export function checkName(raw) {
    const name = String(raw || '').replace(/\s+/g, ' ').trim();
    if (name.length < NAME_MIN || name.length > NAME_MAX) return { ok: false, reason: 'length' };
    if (!/^[\p{L}\p{N} ._-]+$/u.test(name) || (name.match(/\p{L}/gu) || []).length < 2) return { ok: false, reason: 'chars' };
    if (blocked(name)) return { ok: false, reason: 'blocked' };
    return { ok: true, name };
}
