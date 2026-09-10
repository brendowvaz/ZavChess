import { Chess } from 'chess.js';

export const UCI_PATTERN = /^[a-h][1-8][a-h][1-8][qrbn]?$/;

export function playUci(chess: Chess, uci: string) {
  if (!UCI_PATTERN.test(uci)) throw new Error('Lance UCI inválido.');
  return chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
}

export function puzzlePosition(fen: string, line: string[]) {
  const chess = new Chess(fen);
  playUci(chess, line[0]); // Lichess stores the position BEFORE the opponent's setup move.
  return chess;
}

export type PuzzleResult = {
  status: 'correct' | 'incorrect' | 'solved';
  fen: string;
  reply?: string;
  expectedMove?: string;
};

export function validatePuzzle(fen: string, line: string[], studentMoves: string[]): PuzzleResult {
  const chess = puzzlePosition(fen, line);
  let cursor = 1;
  let reply: string | undefined;
  for (let index = 0; index < studentMoves.length; index++) {
    if (!line[cursor]) throw new Error('A solução já terminou.');
    if (studentMoves[index] !== line[cursor]) return { status: 'incorrect', fen: chess.fen() };
    playUci(chess, studentMoves[index]);
    cursor++;
    reply = undefined;
    if (cursor < line.length) {
      reply = line[cursor++];
      playUci(chess, reply);
    }
  }
  return { status: cursor >= line.length ? 'solved' : 'correct', fen: chess.fen(), reply, expectedMove: line[cursor] };
}

export function dayInSaoPaulo(date: Date) {
  return date.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

export function calculateStreak(dates: Date[], now = new Date()) {
  const days = new Set(dates.map(dayInSaoPaulo));
  const cursor = new Date(`${dayInSaoPaulo(now)}T12:00:00Z`);
  if (!days.has(dayInSaoPaulo(cursor))) cursor.setUTCDate(cursor.getUTCDate() - 1);
  let streak = 0;
  while (days.has(dayInSaoPaulo(cursor))) { streak++; cursor.setUTCDate(cursor.getUTCDate() - 1); }
  return streak;
}
