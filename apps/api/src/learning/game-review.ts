import { Chess } from 'chess.js';
import type { MoveAnalysis } from '../engine/analysis-contract';

export function resultForPlayer(result: string | undefined, color: 'w' | 'b') {
  if (result === '1/2-1/2') return 'draw';
  if (result !== '1-0' && result !== '0-1') return 'unknown';
  return (result === '1-0') === (color === 'w') ? 'win' : 'loss';
}
export function gameMovePosition(moves: string[], initialFen: string | null, ply: number) {
  if (!Number.isInteger(ply) || ply < 0 || ply >= moves.length) throw new Error('Lance inexistente.');
  const game = new Chess(initialFen ?? undefined);
  for (const uci of moves.slice(0, ply)) game.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
  return { fen: game.fen(), move: moves[ply]! };
}
export function reviewEntries(review: unknown): Record<string, MoveAnalysis> {
  return review && typeof review === 'object' && !Array.isArray(review) ? review as Record<string, MoveAnalysis> : {};
}
