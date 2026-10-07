// Sticker album: mathematicians from around the world, each with one true curiosity a child can
// enjoy. No random packs: the player picks the sticker they want. Each 3-star mini game gives one
// free sticker; the others cost beans.
import { lang } from './i18n.js';
import { DRILLS, drillProgress } from './drills.js';

const KEY = 'mm-album';
export const STICKER_PRICE = 60;

export const STICKERS = [
    { id: 'pythagoras', name: 'Pitágoras', nameEn: 'Pythagoras', when: 'c. 570 a.C.', whenEn: 'c. 570 BC', where: 'Grécia', whereEn: 'Greece', sym: 'a²+b²', color: 0x2563eb,
        pt: 'Num triângulo retângulo, o quadrado do lado maior é igual à soma dos quadrados dos outros dois. Experimenta: 3² + 4² = 5², porque 9 + 16 = 25.',
        en: 'In a right triangle, the square of the longest side equals the sum of the squares of the other two. Try it: 3² + 4² = 5², because 9 + 16 = 25.' },
    { id: 'euclid', name: 'Euclides', nameEn: 'Euclid', when: 'c. 300 a.C.', whenEn: 'c. 300 BC', where: 'Alexandria', whereEn: 'Alexandria', sym: '△', color: 0x0891b2,
        pt: 'Escreveu os Elementos, um livro de geometria que foi usado nas escolas durante mais de 2000 anos.',
        en: 'He wrote the Elements, a geometry book that was used in schools for more than 2000 years.' },
    { id: 'archimedes', name: 'Arquimedes', nameEn: 'Archimedes', when: 'c. 287 a.C.', whenEn: 'c. 287 BC', where: 'Siracusa', whereEn: 'Syracuse', sym: 'π', color: 0xd97706,
        pt: 'Desenhou polígonos com 96 lados à volta de um círculo e descobriu que o π fica entre 3,1408 e 3,1429.',
        en: 'He drew polygons with 96 sides around a circle and found that π is between 3.1408 and 3.1429.' },
    { id: 'hypatia', name: 'Hipátia', nameEn: 'Hypatia', when: 'c. 370', whenEn: 'c. 370', where: 'Alexandria', whereEn: 'Alexandria', sym: '★', color: 0x9333ea,
        pt: 'É a primeira mulher matemática de quem conhecemos bem a vida. Era professora e vinham alunos de muito longe para a ouvir.',
        en: 'She is the first woman mathematician whose life we know well. She was a teacher, and students came from far away to hear her.' },
    { id: 'brahmagupta', name: 'Brahmagupta', nameEn: 'Brahmagupta', when: '598', whenEn: '598', where: 'Índia', whereEn: 'India', sym: '0', color: 0xea580c,
        pt: 'Em 628 escreveu as primeiras regras para fazer contas com o zero, por exemplo: um número vezes zero dá zero.',
        en: 'In 628 he wrote the first rules for doing sums with zero, for example: any number times zero is zero.' },
    { id: 'khwarizmi', name: 'Al-Khwarizmi', nameEn: 'Al-Khwarizmi', when: 'c. 780', whenEn: 'c. 780', where: 'Bagdade', whereEn: 'Baghdad', sym: 'x=?', color: 0x16a34a,
        pt: 'A palavra "algoritmo" vem do nome dele, e a palavra "álgebra" vem do título do seu livro, Al-Jabr.',
        en: 'The word "algorithm" comes from his name, and the word "algebra" comes from the title of his book, Al-Jabr.' },
    { id: 'fibonacci', name: 'Fibonacci', nameEn: 'Fibonacci', when: 'c. 1170', whenEn: 'c. 1170', where: 'Itália', whereEn: 'Italy', sym: '1 1 2 3 5', color: 0xdb2777,
        pt: 'Ajudou a Europa a trocar os numerais romanos pelos algarismos que usamos hoje. Inventou um problema de coelhos que dá a sequência 1, 1, 2, 3, 5, 8...',
        en: 'He helped Europe swap Roman numerals for the digits we use today. His rabbit puzzle gives the sequence 1, 1, 2, 3, 5, 8...' },
    { id: 'nunes', name: 'Pedro Nunes', nameEn: 'Pedro Nunes', when: '1502', whenEn: '1502', where: 'Portugal', whereEn: 'Portugal', sym: '90°', color: 0x15803d,
        pt: 'Matemático português que inventou o nónio, uma escala para medir pedacinhos de grau. Ajudou os navegadores a orientarem-se no mar.',
        en: 'Portuguese mathematician who invented the nonius, a scale for measuring tiny parts of a degree. He helped sailors find their way at sea.' },
    { id: 'descartes', name: 'René Descartes', nameEn: 'René Descartes', when: '1596', whenEn: '1596', where: 'França', whereEn: 'France', sym: '(x,y)', color: 0x0284c7,
        pt: 'Teve a ideia de marcar qualquer ponto com dois números (x, y). É por isso que se chamam coordenadas cartesianas.',
        en: 'He had the idea of marking any point with two numbers (x, y). That is why they are called Cartesian coordinates.' },
    { id: 'pascal', name: 'Blaise Pascal', nameEn: 'Blaise Pascal', when: '1623', whenEn: '1623', where: 'França', whereEn: 'France', sym: '1+1', color: 0x7c3aed,
        pt: 'Aos 19 anos inventou uma máquina de calcular para ajudar o pai, que fazia contas de impostos. Chama-se Pascalina.',
        en: 'At 19 he invented a calculating machine to help his father, who worked with taxes. It is called the Pascaline.' },
    { id: 'newton', name: 'Isaac Newton', nameEn: 'Isaac Newton', when: '1643', whenEn: '1643', where: 'Inglaterra', whereEn: 'England', sym: 'F=ma', color: 0xb91c1c,
        pt: 'Explicou que a força que faz cair uma maçã é a mesma que mantém a Lua a andar à volta da Terra: a gravidade.',
        en: 'He explained that the force that makes an apple fall is the same one that keeps the Moon going around the Earth: gravity.' },
    { id: 'euler', name: 'Leonhard Euler', nameEn: 'Leonhard Euler', when: '1707', whenEn: '1707', where: 'Suíça', whereEn: 'Switzerland', sym: 'e', color: 0x0d9488,
        pt: 'Escreveu mais de 800 livros e artigos. Mesmo depois de ficar cego continuou a fazer matemática de cabeça e a ditar as ideias.',
        en: 'He wrote more than 800 books and papers. Even after going blind he kept doing maths in his head and dictating his ideas.' },
    { id: 'gauss', name: 'Carl F. Gauss', nameEn: 'Carl F. Gauss', when: '1777', whenEn: '1777', where: 'Alemanha', whereEn: 'Germany', sym: '5050', color: 0x4f46e5,
        pt: 'Conta-se que, aos 10 anos, somou de 1 a 100 num instante: juntou 1+100, 2+99, 3+98... São 50 pares de 101, ou seja 5050.',
        en: 'The story goes that at 10 he added 1 to 100 in a flash: 1+100, 2+99, 3+98... That is 50 pairs of 101, so 5050.' },
    { id: 'germain', name: 'Sophie Germain', nameEn: 'Sophie Germain', when: '1776', whenEn: '1776', where: 'França', whereEn: 'France', sym: 'p', color: 0xc026d3,
        pt: 'Naquele tempo as raparigas não podiam estudar na universidade, por isso escrevia aos grandes matemáticos com o nome Monsieur Le Blanc.',
        en: 'In her time girls could not study at university, so she wrote to great mathematicians using the name Monsieur Le Blanc.' },
    { id: 'lovelace', name: 'Ada Lovelace', nameEn: 'Ada Lovelace', when: '1815', whenEn: '1815', where: 'Inglaterra', whereEn: 'England', sym: '{ }', color: 0x059669,
        pt: 'Em 1843 escreveu o primeiro programa para uma máquina de calcular que ainda nem tinha sido construída. É considerada a primeira programadora.',
        en: 'In 1843 she wrote the first program for a calculating machine that had not even been built yet. She is seen as the first programmer.' },
    { id: 'ramanujan', name: 'S. Ramanujan', nameEn: 'S. Ramanujan', when: '1887', whenEn: '1887', where: 'Índia', whereEn: 'India', sym: '1729', color: 0xca8a04,
        pt: 'Um amigo chegou num táxi com o número 1729 e achou-o aborrecido. Ramanujan respondeu logo: é o menor número que é soma de dois cubos de duas maneiras!',
        en: 'A friend arrived in taxi number 1729 and found it dull. Ramanujan replied at once: it is the smallest number that is a sum of two cubes in two ways!' },
    { id: 'noether', name: 'Emmy Noether', nameEn: 'Emmy Noether', when: '1882', whenEn: '1882', where: 'Alemanha', whereEn: 'Germany', sym: '↻', color: 0xbe123c,
        pt: 'Descobriu que cada simetria da natureza esconde uma quantidade que nunca muda. Einstein elogiou muito o seu trabalho.',
        en: 'She found that every symmetry in nature hides a quantity that never changes. Einstein praised her work highly.' },
    { id: 'turing', name: 'Alan Turing', nameEn: 'Alan Turing', when: '1912', whenEn: '1912', where: 'Inglaterra', whereEn: 'England', sym: '0101', color: 0x334155,
        pt: 'Imaginou como funcionaria um computador antes de existir um, e ajudou a decifrar mensagens secretas na Segunda Guerra Mundial.',
        en: 'He imagined how a computer would work before one existed, and helped crack secret messages in the Second World War.' },
    { id: 'johnson', name: 'Katherine Johnson', nameEn: 'Katherine Johnson', when: '1918', whenEn: '1918', where: 'EUA', whereEn: 'USA', sym: '3,2,1', color: 0x1d4ed8,
        pt: 'Calculava viagens de foguetões na NASA. Em 1962 o astronauta John Glenn só aceitou partir depois de ela confirmar as contas.',
        en: 'She calculated rocket flights at NASA. In 1962 astronaut John Glenn only agreed to fly after she checked the numbers.' },
    { id: 'mirzakhani', name: 'Maryam Mirzakhani', nameEn: 'Maryam Mirzakhani', when: '1977', whenEn: '1977', where: 'Irão', whereEn: 'Iran', sym: '∞', color: 0x9d174d,
        pt: 'Em 2014 foi a primeira mulher a ganhar a Medalha Fields, o prémio mais famoso da matemática, por estudar superfícies curvas.',
        en: 'In 2014 she became the first woman to win the Fields Medal, the most famous prize in maths, for her work on curved surfaces.' }
];

export function stickerText(s) {
    const pt = lang() === 'pt';
    return { name: pt ? s.name : s.nameEn, when: pt ? s.when : s.whenEn, where: pt ? s.where : s.whereEn, fact: pt ? s.pt : s.en };
}

function load() {
    try {
        const a = JSON.parse(localStorage.getItem(KEY) || '{}');
        return { owned: a.owned || [], freeUsed: a.freeUsed || 0 };
    } catch {
        return { owned: [], freeUsed: 0 };
    }
}

function save(a) {
    try { localStorage.setItem(KEY, JSON.stringify(a)); } catch { /* private mode */ }
}

export function ownedStickers() {
    return load().owned;
}

// One free sticker per mini game finished with 3 stars
export function freeStickers() {
    const earned = DRILLS.filter((d) => drillProgress(d.id).stars >= 3).length;
    return Math.max(0, earned - load().freeUsed);
}

export function claimSticker(id, { free }) {
    const a = load();
    if (a.owned.includes(id) || !STICKERS.some((s) => s.id === id)) return false;
    if (free) {
        if (freeStickers() <= 0) return false;
        a.freeUsed += 1;
    }
    a.owned = [...a.owned, id];
    save(a);
    return true;
}
