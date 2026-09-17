import { createHash } from 'node:crypto';
import { Chess } from 'chess.js';

export type CourseSide = 'w' | 'b';
export type OpeningRow = { id: string; name: string; family: string; eco: string; moves: unknown };

type CourseSpec = {
  id: string; title: string; subtitle: string; side: CourseSide; level: 'beginner' | 'intermediate';
  families: string[]; choices: string[]; goals: string[];
};

export const repertoireSpecs: CourseSpec[] = [
  {
    id: 'italiana-essencial', title: 'Italiana essencial', subtitle: 'Um repertório de brancas baseado em desenvolvimento rápido, roque e pressão sobre f7.',
    side: 'w', level: 'beginner', families: ['Italian Game'],
    choices: ['Giuoco Pianissimo, Normal', 'Classical Variation, Center Attack', 'Two Knights Defense, Knight Attack, Normal Variation', 'Hungarian Defense, Tartakower Variation'],
    goals: ['Desenvolver sem bloquear as próprias peças.', 'Reconhecer as respostas mais comuns das pretas.', 'Chegar ao meio-jogo sabendo onde jogar d4.'],
  },
  {
    id: 'caro-kann-pratica', title: 'Caro-Kann prática', subtitle: 'Um repertório sólido de pretas contra 1.e4, com estruturas claras e poucos riscos iniciais.',
    side: 'b', level: 'beginner', families: ['Caro-Kann Defense'],
    choices: ['Advance, Short Variation', 'Exchange Variation, Rubinstein Variation', 'Classical Variation, Main Line', 'Panov Attack, Main Line'],
    goals: ['Atacar o centro com ...d5.', 'Desenvolver o bispo de c8 antes de fechar a estrutura.', 'Responder às principais escolhas das brancas.'],
  },
  {
    id: 'gambito-da-dama', title: 'Gambito da Dama essencial', subtitle: 'Planos de brancas contra as respostas mais frequentes depois de 1.d4 e 2.c4.',
    side: 'w', level: 'intermediate', families: ["Queen's Gambit", "Queen's Gambit Declined", "Queen's Gambit Accepted", 'Slav Defense'],
    choices: ['Exchange Variation', 'Classical Defense, Main Line', 'Slav Defense: Modern Line', 'Three Knights Variation'],
    goals: ['Construir presença central.', 'Recuperar o peão sem pressa quando ele for aceito.', 'Entender o desenvolvimento antes de memorizar ramificações.'],
  },
  {
    id: 'siciliana-de-pretas', title: 'Siciliana de pretas', subtitle: 'Respostas práticas contra as principais formações das brancas em 1.e4 c5.',
    side: 'b', level: 'intermediate', families: ['Sicilian Defense'],
    choices: ['Open', 'Alapin Variation, Barmen Defense', 'Closed, Traditional', 'Bowdler Attack'],
    goals: ['Criar contrajogo na coluna c.', 'Distinguir Siciliana aberta e sistemas fechados.', 'Não atacar antes de concluir o desenvolvimento.'],
  },
];

export function normalizedFen(fen: string) {
  return fen.split(' ').slice(0, 4).join(' ');
}

export function openingPositionKey(fen: string) {
  return createHash('sha256').update(normalizedFen(fen)).digest('hex');
}

export function explainDecision(san: string, uci: string, ply: number) {
  if (/O-O/.test(san)) return 'Coloque o rei em segurança e conecte as torres antes de abrir mais linhas.';
  if (/^[NB]/.test(san) && ['1', '8'].includes(uci[1]!)) return 'Desenvolva uma peça com tempo e aumente o controle das casas centrais.';
  if (/^[a-h]x/.test(san) || san.includes('x')) return 'Resolva a tensão concreta sem abandonar o desenvolvimento e a segurança do rei.';
  if (['e2e4', 'd2d4', 'e7e5', 'd7d5', 'c7c5', 'c2c4'].includes(uci)) return 'Dispute o centro para dar espaço às peças e limitar o plano adversário.';
  if (san.includes('+')) return 'Use o xeque como lance de desenvolvimento ou ganho de tempo, verificando a resposta forçada.';
  return ply < 8
    ? 'Continue o plano da abertura: desenvolva, controle o centro e prepare um rei seguro.'
    : 'Este lance conecta a abertura ao plano de meio-jogo; observe a estrutura antes de jogar de memória.';
}

export function lineDecisions(row: OpeningRow, side: CourseSide) {
  const moves = Array.isArray(row.moves) ? row.moves.filter((move): move is string => typeof move === 'string') : [];
  const game = new Chess();
  return moves.flatMap((uci, ply) => {
    const fen = game.fen();
    if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci)) throw new Error('Lance UCI inválido no repertório.');
    const move = game.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
    if (ply % 2 !== (side === 'w' ? 0 : 1)) return [];
    return [{ key: openingPositionKey(fen), fen, ply, uci, san: move.san, explanation: explainDecision(move.san, uci, ply) }];
  });
}

function moveCount(row: OpeningRow) {
  return Array.isArray(row.moves) ? row.moves.length : 0;
}

export function buildRepertoireCourses(rows: OpeningRow[]) {
  return repertoireSpecs.map(spec => {
    const familyRows = rows.filter(row => spec.families.includes(row.family));
    const selected = spec.choices.flatMap(choice => {
      const matches = familyRows.filter(row => row.name.toLocaleLowerCase().includes(choice.toLocaleLowerCase()));
      const useful = matches.filter(row => moveCount(row) >= 8 && moveCount(row) <= 16);
      const exact = (row: OpeningRow) => row.name.toLocaleLowerCase().endsWith(`: ${choice.toLocaleLowerCase()}`) ? 1 : 0;
      return (useful.length ? useful : matches).sort((a, b) => exact(b) - exact(a) || moveCount(a) - moveCount(b) || a.name.localeCompare(b.name)).slice(0, 1);
    });
    if (!selected.length && familyRows.length) selected.push(...familyRows.sort((a, b) => moveCount(b) - moveCount(a)).slice(0, 3));
    const lines = [...new Map(selected.map(row => [row.id, row])).values()].map(row => ({
      openingId: row.id, name: row.name, eco: row.eco, moveCount: moveCount(row), decisions: lineDecisions(row, spec.side),
    }));
    const positions = new Set(lines.flatMap(line => line.decisions.map(decision => decision.key)));
    return { ...spec, lineCount: lines.length, positionCount: positions.size, lines };
  });
}

export function repertoireSpec(id: string) {
  return repertoireSpecs.find(spec => spec.id === id);
}
