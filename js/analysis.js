// Learning analysis: every equation of the main game and every answer in the mini games is
// counted per skill, and wrong answers are sorted into kinds of mistake, so the ANÁLISE screen
// can show where the player struggles and what to practise. Stored only on this device.
import { todayKey } from './stats.js';
import { lang } from './i18n.js';

const KEY = 'mm-analysis';
const OPS = ['+', '-', '×', '÷'];
const KINDS = ['order', 'wrongOp', 'nearMiss', 'notWhole', 'fact', 'other'];

function empty() {
    return {
        ops: Object.fromEntries(OPS.map((o) => [o, { ok: 0, bad: 0 }])),
        kinds: Object.fromEntries(KINDS.map((k) => [k, 0])),
        facts: {},          // multiplication / division facts that went wrong, e.g. "7×8": 3
        drills: {},         // id -> { ok, bad, items: { "×3": 2, ... } }
        days: {}            // date -> { ok, bad } (last 60 days)
    };
}

function load() {
    try {
        const a = JSON.parse(localStorage.getItem(KEY) || 'null');
        if (!a) return empty();
        const e = empty();
        return { ...e, ...a, ops: { ...e.ops, ...a.ops }, kinds: { ...e.kinds, ...a.kinds } };
    } catch {
        return empty();
    }
}

function save(a) {
    const keys = Object.keys(a.days).sort();
    if (keys.length > 60) keys.slice(0, keys.length - 60).forEach((k) => delete a.days[k]);
    try { localStorage.setItem(KEY, JSON.stringify(a)); } catch { /* private mode */ }
}

function day(a, ok) {
    const k = todayKey();
    const d = a.days[k] || { ok: 0, bad: 0 };
    d[ok ? 'ok' : 'bad']++;
    a.days[k] = d;
}

const calc = (a, op, b) => {
    if (op === '+') return a + b;
    if (op === '-') return a - b;
    if (op === '×') return a * b;
    if (op === '÷') return b !== 0 && a % b === 0 ? a / b : null;
    return null;
};

// Which kind of mistake a wrong equation "a op b" for `target` is
export function mistakeKind(a, op, b, target) {
    const r = calc(a, op, b);
    if ((op === '-' || op === '÷') && calc(b, op, a) === target) return 'order';
    if (OPS.some((o) => o !== op && calc(a, o, b) === target)) return 'wrongOp';
    if (r === null) return 'notWhole';
    if (Math.abs(r - target) <= 2) return 'nearMiss';
    if (op === '×' || op === '÷') return 'fact';
    return 'other';
}

// Main game: one finished equation
export function logEquation(a, op, b, target, ok) {
    const s = load();
    if (!s.ops[op]) return;
    s.ops[op][ok ? 'ok' : 'bad']++;
    day(s, ok);
    if (!ok) {
        const kind = mistakeKind(a, op, b, target);
        s.kinds[kind]++;
        if (kind === 'fact' || (op === '×' && kind === 'nearMiss')) {
            // The fact the player was unsure of: the one that makes the target
            const key = op === '×' ? `${Math.min(a, b)}×${Math.max(a, b)}` : `${a}÷${b}`;
            s.facts[key] = (s.facts[key] || 0) + 1;
        }
    }
    save(s);
}

// Mini games: one answer; `item` names what was asked ("×3", "dobro de 7", "9", "24"...)
export function logDrill(id, ok, item) {
    const s = load();
    const d = s.drills[id] || { ok: 0, bad: 0, items: {} };
    d[ok ? 'ok' : 'bad']++;
    if (!ok && item) d.items[item] = (d.items[item] || 0) + 1;
    s.drills[id] = d;
    day(s, ok);
    save(s);
}

const rate = ({ ok, bad }) => (ok + bad > 0 ? ok / (ok + bad) : null);

// Everything the screen needs, already worked out
export function analysis() {
    const s = load();
    const ops = OPS.map((o) => ({ op: o, ...s.ops[o], rate: rate(s.ops[o]) }));
    const tot = { ok: 0, bad: 0 };
    ops.forEach((o) => { tot.ok += o.ok; tot.bad += o.bad; });
    Object.values(s.drills).forEach((d) => { tot.ok += d.ok; tot.bad += d.bad; });

    const keys = Object.keys(s.days).sort();
    const sum = (list) => list.reduce((acc, k) => ({ ok: acc.ok + s.days[k].ok, bad: acc.bad + s.days[k].bad }), { ok: 0, bad: 0 });
    const today = todayKey();
    const cut = (n) => { const d = new Date(`${today}T00:00:00Z`); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };
    const thisWeek = sum(keys.filter((k) => k > cut(7)));
    const lastWeek = sum(keys.filter((k) => k > cut(14) && k <= cut(7)));
    const last7 = Array.from({ length: 7 }, (_, i) => { const k = cut(6 - i); return { day: k, ...(s.days[k] || { ok: 0, bad: 0 }) }; });

    const kinds = KINDS.map((k) => ({ kind: k, n: s.kinds[k] })).filter((k) => k.n > 0).sort((a, b) => b.n - a.n);
    const facts = Object.entries(s.facts).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([f, n]) => ({ fact: f, n }));
    const drills = Object.entries(s.drills).map(([id, d]) => ({
        id, ok: d.ok, bad: d.bad, rate: rate(d),
        hard: Object.entries(d.items).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([item]) => item)
    }));
    return { total: tot, rate: rate(tot), ops, kinds, facts, drills, thisWeek: rate(thisWeek), lastWeek: rate(lastWeek), last7 };
}

export function resetAnalysis() {
    try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}

// A short tip for the weakest area (with the mini game that trains it)
export function tipFor(a) {
    const pt = lang() === 'pt';
    const weakOp = a.ops.filter((o) => o.ok + o.bad >= 5).sort((x, y) => x.rate - y.rate)[0];
    const kind = a.kinds[0] && a.kinds[0].kind;
    if (kind === 'order') return pt ? 'Na subtração e na divisão a ordem conta: o número maior vem primeiro (7 − 3, não 3 − 7).' : 'In subtraction and division order matters: the bigger number comes first (7 − 3, not 3 − 7).';
    if (kind === 'wrongOp') return pt ? 'Antes de escolher o sinal, pergunta: o resultado tem de ser maior ou menor do que os números?' : 'Before picking the sign, ask: must the answer be bigger or smaller than the numbers?';
    if (kind === 'fact' || (weakOp && weakOp.op === '×' && weakOp.rate < 0.75)) return pt ? 'A tabuada ainda falha às vezes. Experimenta o mini jogo Tabuada relâmpago.' : 'Times tables still slip sometimes. Try the Times-table flash mini game.';
    if (kind === 'nearMiss') return pt ? 'Muitas vezes ficas a 1 ou 2 do alvo. Confirma a conta antes da última peça.' : 'You often land 1 or 2 away from the target. Check the sum before the last piece.';
    if (kind === 'notWhole') return pt ? 'A divisão tem de dar certo: 12 ÷ 4 = 3, mas 12 ÷ 5 não dá número inteiro.' : 'Division must come out exact: 12 ÷ 4 = 3, but 12 ÷ 5 is not a whole number.';
    if (weakOp && weakOp.op === '+') return pt ? 'Treina as somas com o mini jogo Amigos do 10.' : 'Practise sums with the Friends of 10 mini game.';
    return pt ? 'Continua assim! Joga os mini jogos para treinar cada tema.' : 'Keep it up! Play the mini games to train each topic.';
}
