// Achievements: lifetime counters + unlocked set, persisted per device.
import { lang } from './i18n.js';

const KEY = 'mm-achievements';

// tier: 0 bronze, 1 silver, 2 gold. `glyph` is drawn on the medal.
export const ACHIEVEMENTS = [
    { id: 'first', tier: 0, glyph: '1', pt: ['Primeira conta', 'Resolve a tua primeira conta'], en: ['First sum', 'Solve your first equation'] },
    { id: 'eq100', tier: 1, glyph: '100', pt: ['Calculadora humana', '100 contas no total'], en: ['Human calculator', '100 equations in total'] },
    { id: 'eq1000', tier: 2, glyph: '1K', pt: ['Mestre da tabuada', '1000 contas no total'], en: ['Times-table master', '1000 equations in total'] },
    { id: 'combo3', tier: 0, glyph: 'x2', pt: ['Em chamas', 'Chega a um combo x2'], en: ['On fire', 'Reach a x2 combo'] },
    { id: 'combo7', tier: 2, glyph: 'x4', pt: ['Imparável', 'Chega a um combo x4'], en: ['Unstoppable', 'Reach a x4 combo'] },
    { id: 'level5', tier: 1, glyph: '5', pt: ['Nível 5', 'Chega ao nível 5'], en: ['Level 5', 'Reach level 5'] },
    { id: 'level10', tier: 2, glyph: '10', pt: ['Nível 10', 'Chega ao nível 10'], en: ['Level 10', 'Reach level 10'] },
    { id: 'score10k', tier: 1, glyph: '10K', pt: ['Dez mil', '10 000 pontos num jogo'], en: ['Ten grand', '10,000 points in one game'] },
    { id: 'score50k', tier: 2, glyph: '50K', pt: ['Lenda', '50 000 pontos num jogo'], en: ['Legend', '50,000 points in one game'] },
    { id: 'div25', tier: 1, glyph: '÷', pt: ['Divisor', 'Resolve 25 divisões'], en: ['Divider', 'Solve 25 divisions'] },
    { id: 'ice25', tier: 1, glyph: '❄', pt: ['Quebra-gelo', 'Usa 25 peças geladas'], en: ['Icebreaker', 'Use 25 frozen pieces'] },
    { id: 'bomb6', tier: 1, glyph: '💥', pt: ['Demolição', 'Rebenta 6 peças com uma bomba'], en: ['Demolition', 'Blow up 6 pieces with one bomb'] },
    { id: 'streak15', tier: 2, glyph: '15', pt: ['Perfeição', '15 contas seguidas sem errar'], en: ['Flawless', '15 equations in a row, no mistakes'] },
    { id: 'daily1', tier: 0, glyph: '☕', pt: ['Desafio aceite', 'Completa um desafio diário'], en: ['Challenge accepted', 'Finish a daily challenge'] },
    { id: 'daily7', tier: 2, glyph: '7', pt: ['Viciado em bica', 'Completa 7 desafios diários'], en: ['Espresso addict', 'Finish 7 daily challenges'] },
    { id: 'games25', tier: 1, glyph: '25', pt: ['Habitué', 'Joga 25 jogos'], en: ['Regular', 'Play 25 games'] }
];

export const TIER_COLORS = [0xcd7f32, 0xc0c7d6, 0xffd23f];

function load() {
    try {
        const s = JSON.parse(localStorage.getItem(KEY) || '{}');
        return { unlocked: s.unlocked || {}, counters: { eq: 0, div: 0, ice: 0, games: 0, daily: 0, ...(s.counters || {}) } };
    } catch {
        return { unlocked: {}, counters: { eq: 0, div: 0, ice: 0, games: 0, daily: 0 } };
    }
}

function save(state) {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* private mode */ }
}

export function achievementText(a) {
    return a[lang()] || a.en;
}

export function achievementState() {
    return load();
}

// Feed game events; returns the achievements unlocked by this event (to show a toast).
// solve: { op, combo, level, score, iced, streak } · bomb: { destroyed } · level: { level }
// gameOver: { score, level, daily }
export function report(event, data = {}) {
    const state = load();
    const c = state.counters;
    const want = new Set();

    if (event === 'solve') {
        c.eq++;
        if (data.op === '÷') c.div++;
        c.ice += data.iced || 0;
        want.add('first');
        if (c.eq >= 100) want.add('eq100');
        if (c.eq >= 1000) want.add('eq1000');
        if (data.combo >= 3) want.add('combo3');
        if (data.combo >= 7) want.add('combo7');
        if (data.streak >= 15) want.add('streak15');
        if (c.div >= 25) want.add('div25');
        if (c.ice >= 25) want.add('ice25');
        if (data.score >= 10000) want.add('score10k');
        if (data.score >= 50000) want.add('score50k');
    } else if (event === 'level') {
        if (data.level >= 5) want.add('level5');
        if (data.level >= 10) want.add('level10');
    } else if (event === 'bomb') {
        if (data.destroyed >= 6) want.add('bomb6');
    } else if (event === 'gameOver') {
        c.games++;
        if (c.games >= 25) want.add('games25');
        if (data.daily) {
            c.daily++;
            want.add('daily1');
            if (c.daily >= 7) want.add('daily7');
        }
    }

    const fresh = ACHIEVEMENTS.filter((a) => want.has(a.id) && !state.unlocked[a.id]);
    fresh.forEach((a) => { state.unlocked[a.id] = Date.now(); });
    save(state);
    return fresh;
}

// Medal drawn with Phaser Graphics + Text (crisp at any resolution). Returns the objects created.
export function drawMedal(scene, x, y, r, a, unlocked, depth = 10) {
    const g = scene.add.graphics().setDepth(depth);
    const color = unlocked ? TIER_COLORS[a.tier] : 0x3a3458;
    g.fillStyle(0x000000, 0.35);
    g.fillCircle(x + 2, y + 3, r);
    g.fillStyle(color, 1);
    g.fillCircle(x, y, r);
    g.fillStyle(0xffffff, unlocked ? 0.25 : 0.06);
    g.fillCircle(x - r * 0.25, y - r * 0.3, r * 0.45);
    g.lineStyle(3, 0x140a24, 1);
    g.strokeCircle(x, y, r);
    g.lineStyle(2, 0xffffff, unlocked ? 0.5 : 0.1);
    g.strokeCircle(x, y, r * 0.78);
    const text = scene.add.text(x, y + 1, unlocked ? a.glyph : '?', {
        fontFamily: 'Righteous', fontSize: `${Math.round(r * (a.glyph.length > 2 ? 0.62 : 0.85))}px`,
        color: unlocked ? '#2b160b' : '#8a84b0'
    }).setOrigin(0.5).setDepth(depth);
    return [g, text];
}
