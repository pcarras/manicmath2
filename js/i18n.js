// PT / EN strings. Language follows the phone unless chosen in the settings.
import { settings } from './settings.js';

const STR = {
    pt: {
        subtitle: 'Combina números e operadores',
        level: 'Nível',
        levelShort: 'NV',
        levelUp: 'NÍVEL {n}!',
        unlocked: '{op} desbloqueado!',
        faster: 'Mais rápido!',
        combo: 'COMBO',
        newRecord: 'NOVO RECORDE!',
        best: 'RECORDE',
        tut1: 'Toca no 3',
        tut2: 'Agora toca no +',
        tut3: 'E no 5:  3 + 5 = 8 !',
        tutDoneTitle: 'BOA!',
        tutDone: ['Faz contas antes que a pilha', 'chegue à linha vermelha.', 'Peças especiais:'],
        letsPlay: 'JOGAR!',
        play: 'JOGAR',
        tutorial: 'COMO JOGAR',
        install: 'INSTALAR',
        fullscreen: 'ECRÃ INTEIRO',
        score: 'PONTOS',
        next: 'A SEGUIR',
        gameOver: 'FIM DE JOGO',
        finalScore: 'PONTUAÇÃO FINAL',
        restart: 'RECOMEÇAR',
        menu: 'MENU',
        paused: 'PAUSA',
        resume: 'CONTINUAR',
        settings: 'DEFINIÇÕES',
        music: 'Música',
        sfx: 'Efeitos',
        vibration: 'Vibração',
        language: 'Idioma',
        achievements: 'CONQUISTAS',
        daily: 'DESAFIO DIÁRIO',
        today: 'Hoje',
        timeUp: 'TEMPO!',
        dailyBest: 'MELHOR HOJE',
        achievementUnlocked: 'CONQUISTA!',
        graphics: 'Gráficos',
        high: 'ALTA',
        normal: 'NORMAL',
        on: 'SIM',
        off: 'NÃO',
        close: 'FECHAR',
        back: 'VOLTAR',
        go: 'JÁ!',
        debugOn: 'MODO DEBUG LIGADO',
        debugOff: 'MODO DEBUG DESLIGADO',
        howTo: [
            'Toca em 2 NÚMEROS e 1 OPERADOR,',
            'por qualquer ordem, para fazer o',
            'RESULTADO do topo.',
            'Toca outra vez numa peça para a tirar.',
            'Não deixes a pilha chegar à linha vermelha!'
        ],
        specials: {
            bomb: 'Bomba: rebenta as peças à volta',
            timer: 'Pára a queda durante 20s',
            hint: 'Mostra uma solução durante 20s',
            recycle: 'Recicla peças ao acaso',
            ice: 'Gelo: esconde o número aos poucos'
        },
        // Bica Games overlays
        tapToSkip: 'TOCA PARA SALTAR',
        tagline: '☕ EXPRESSO GAMES · PORTUGAL',
        newVersion: 'NOVA VERSÃO!',
        double: 'DUPLO',
        espresso: 'EXPRESSO',
        brewing: 'A TIRAR UM DUPLO...',
        ready: 'PRONTO! ☕☕',
        updated: 'ATUALIZADO!',
        iosTitle: 'INSTALAR',
        iosSteps: [
            'Toca em <b>Partilhar</b> {share}',
            'Escolhe <b>Adicionar ao ecrã principal</b>',
            'Abre o <b>Manic Math</b> pelo ícone: fica em ecrã inteiro'
        ]
    },
    en: {
        subtitle: 'Combine Numbers & Operators',
        level: 'Level',
        levelShort: 'LV',
        levelUp: 'LEVEL {n}!',
        unlocked: '{op} unlocked!',
        faster: 'Faster!',
        combo: 'COMBO',
        newRecord: 'NEW RECORD!',
        best: 'BEST',
        tut1: 'Tap the 3',
        tut2: 'Now tap the +',
        tut3: 'And the 5:  3 + 5 = 8 !',
        tutDoneTitle: 'NICE!',
        tutDone: ['Solve equations before the pile', 'reaches the red line.', 'Special pieces:'],
        letsPlay: 'PLAY!',
        play: 'PLAY',
        tutorial: 'HOW TO PLAY',
        install: 'INSTALL',
        fullscreen: 'FULLSCREEN',
        score: 'SCORE',
        next: 'NEXT',
        gameOver: 'GAME OVER',
        finalScore: 'FINAL SCORE',
        restart: 'RESTART',
        menu: 'MENU',
        paused: 'PAUSED',
        resume: 'RESUME',
        settings: 'SETTINGS',
        music: 'Music',
        sfx: 'Sound FX',
        vibration: 'Vibration',
        language: 'Language',
        achievements: 'ACHIEVEMENTS',
        daily: 'DAILY CHALLENGE',
        today: 'Today',
        timeUp: 'TIME UP!',
        dailyBest: "TODAY'S BEST",
        achievementUnlocked: 'ACHIEVEMENT!',
        graphics: 'Graphics',
        high: 'HIGH',
        normal: 'NORMAL',
        on: 'ON',
        off: 'OFF',
        close: 'CLOSE',
        back: 'BACK',
        go: 'GO!',
        debugOn: 'DEBUG MODE ON',
        debugOff: 'DEBUG MODE OFF',
        howTo: [
            'Tap 2 NUMBERS and 1 OPERATOR,',
            'in any order, to make the',
            'TARGET at the top.',
            'Tap a piece again to remove it.',
            "Don't let the pile reach the red line!"
        ],
        specials: {
            bomb: 'Bomb: blows up nearby pieces',
            timer: 'Stops pieces falling for 20s',
            hint: 'Shows a solution for 20s',
            recycle: 'Recycles random pieces',
            ice: 'Ice: slowly hides the number'
        },
        tapToSkip: 'TAP TO SKIP',
        tagline: '☕ ESPRESSO GAMES · PORTUGAL',
        newVersion: 'NEW VERSION!',
        double: 'DOUBLE',
        espresso: 'ESPRESSO',
        brewing: 'BREWING A DOUBLE...',
        ready: 'READY! ☕☕',
        updated: 'UPDATED!',
        iosTitle: 'INSTALL',
        iosSteps: [
            'Tap <b>Share</b> {share}',
            'Choose <b>Add to Home Screen</b>',
            'Open <b>Manic Math</b> from the icon: it runs full screen'
        ]
    }
};

export function lang() {
    const chosen = settings.get('lang');
    if (chosen === 'pt' || chosen === 'en') return chosen;
    return (navigator.language || 'en').toLowerCase().startsWith('pt') ? 'pt' : 'en';
}

export function t(key, vars) {
    const table = STR[lang()];
    let value = key in table ? table[key] : STR.en[key];
    if (vars && typeof value === 'string') {
        Object.entries(vars).forEach(([k, v]) => { value = value.replace(`{${k}}`, v); });
    }
    return value;
}
