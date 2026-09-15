import { Chess, DEFAULT_POSITION } from 'chess.js';
import type { Color, PieceSymbol, Square } from 'chess.js';

export { DEFAULT_POSITION };
export const pieceNames: Record<PieceSymbol, string> = { p: 'peão', n: 'cavalo', b: 'bispo', r: 'torre', q: 'dama', k: 'rei' };
export const sideName = (side: Color) => side === 'w' ? 'brancas' : 'pretas';
export function normalizeCastlingTarget(game: Chess, from: Square, target: Square): Square {
  const king = game.get(from);
  const rook = game.get(target);
  if (king?.type !== 'k' || rook?.type !== 'r' || king.color !== rook.color || from[1] !== target[1]) return target;

  const destinationFile = target[0] === 'h' ? 'g' : target[0] === 'a' ? 'c' : null;
  if (!destinationFile) return target;
  const destination = `${destinationFile}${from[1]}` as Square;
  return game.moves({ square: from, verbose: true }).some(move => move.to === destination) ? destination : target;
}
export function moveUci(game: Chess, uci: string) {
  if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci)) throw new Error(`Lance UCI inválido: ${uci}`);
  return game.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), ...(uci[4] ? { promotion: uci[4] } : {}) });
}
export function linePositions(moves: string[], initialFen = DEFAULT_POSITION) {
  const game = new Chess(initialFen);
  const positions = [game.fen()];
  const sans: string[] = [];
  for (const move of moves) { sans.push(moveUci(game, move).san); positions.push(game.fen()); }
  return { positions, sans };
}
export function gameFromHistory(initialFen: string, moves: string[]) {
  const game = new Chess(initialFen);
  moves.forEach(move => moveUci(game, move));
  return game;
}
export function positionStatus(game: Chess): string {
  if (game.isCheckmate()) return `Xeque-mate. Vitória das ${sideName(game.turn() === 'w' ? 'b' : 'w')}.`;
  if (game.isStalemate()) return 'Empate por afogamento.';
  if (game.isThreefoldRepetition()) return 'Empate por repetição tripla.';
  if (game.isInsufficientMaterial()) return 'Empate por material insuficiente.';
  if (game.isDrawByFiftyMoves()) return 'Empate pela regra dos 50 lances.';
  if (game.isDraw()) return 'Partida empatada.';
  return `${game.isCheck() ? 'Xeque. ' : ''}Vez das ${sideName(game.turn())}.`;
}
export function pvToSan(fen: string, pv: string[]) {
  const game = new Chess(fen);
  const sans: string[] = [];
  for (const uci of pv) { try { sans.push(moveUci(game, uci).san); } catch { break; } }
  return sans.join('  ');
}
export function whiteScore(score: { type: 'cp' | 'mate'; value: number }, turn: Color) {
  const value = score.value * (turn === 'w' ? 1 : -1);
  return score.type === 'mate' ? `M${value > 0 ? '+' : ''}${value}` : `${value > 0 ? '+' : ''}${(value / 100).toFixed(2)}`;
}
