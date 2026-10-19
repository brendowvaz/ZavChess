import { Chess } from 'chess.js';
import type { MoveAnalysis } from '../analysis/analysis-contract';

export const moveLabels = { best: 'Melhor', good: 'Bom', inaccuracy: 'Imprecisão', mistake: 'Erro', blunder: 'Erro grave' };
export function gamePhase(fen: string, ply: number): 'Abertura' | 'Meio-jogo' | 'Final' {
  const pieces = new Chess(fen).board().flat().filter(Boolean).length;
  return pieces <= 12 ? 'Final' : ply < 20 ? 'Abertura' : 'Meio-jogo';
}
export function whiteGraphScore(result: MoveAnalysis): number {
  const score = result.after.score;
  if (score.type === 'draw') return 0;
  if (score.type === 'mate') return score.winner === 'w' ? 6 : -6;
  return Math.max(-6, Math.min(6, score.value / 100 * (result.perspective === 'w' ? 1 : -1)));
}
