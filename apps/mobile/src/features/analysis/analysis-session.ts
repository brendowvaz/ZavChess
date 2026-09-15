import { Chess, DEFAULT_POSITION } from 'chess.js';
import type { AnalysisLine, AnalysisSide, CoachScore, MoveAnalysis } from './analysis-contract';

export interface AnalysisTicket { id: number; controller: AbortController }

/** Identity, not just FEN, matters when a reset returns to the same position. */
export class LatestAnalysisRequest {
  private sequence = 0;
  private active: AnalysisTicket | null = null;
  begin(): AnalysisTicket {
    this.cancel();
    const ticket = { id: ++this.sequence, controller: new AbortController() };
    this.active = ticket;
    return ticket;
  }
  isCurrent(ticket: AnalysisTicket) { return this.active === ticket && !ticket.controller.signal.aborted; }
  finish(ticket: AnalysisTicket) {
    if (!this.isCurrent(ticket)) return false;
    this.active = null;
    return true;
  }
  cancel() { this.active?.controller.abort(); this.active = null; }
}

export interface ReviewTarget { fen: string; afterFen: string; move: string; san: string; color: AnalysisSide; ply: number }

/** Reconstruct from history so engine replies, promotions and undo use the real pre-move FEN. */
export function lastReviewTarget(history: string[], color?: AnalysisSide, initialFen = DEFAULT_POSITION): ReviewTarget | null {
  const game = new Chess(initialFen);
  let target: ReviewTarget | null = null;
  history.forEach((uci, index) => {
    const fen = game.fen();
    const move = game.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), ...(uci[4] ? { promotion: uci[4] } : {}) });
    if (!color || move.color === color) target = { fen, afterFen: game.fen(), move: uci, san: move.san, color: move.color, ply: index + 1 };
  });
  return target;
}

export function coachScoreText(score: CoachScore, perspective: AnalysisSide): string {
  if (score.type === 'draw') return 'Empate';
  if (score.type === 'mate') {
    const favorable = score.winner === perspective;
    return score.value === 0 ? `Xeque-mate ${favorable ? 'a favor' : 'contra'}` : `Mate ${favorable ? 'a favor' : 'contra'} em ${Math.abs(score.value)}`;
  }
  return `${score.value >= 0 ? '+' : ''}${(score.value / 100).toFixed(2)}`;
}

export function replayPositions(line: AnalysisLine) {
  const game = new Chess(line.initialFen);
  const positions = [game.fen()];
  const labels: string[] = [];
  for (const uci of line.moves) {
    if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci) || game.isGameOver()) throw new Error('Continuação inválida.');
    const turn = game.turn();
    const number = game.moveNumber();
    const move = game.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), ...(uci[4] ? { promotion: uci[4] } : {}) });
    labels.push(`${number}${turn === 'w' ? '.' : '…'} ${move.san}`);
    positions.push(game.fen());
  }
  return { positions, labels };
}

export function validateReviewResponse(response: MoveAnalysis, target: ReviewTarget) {
  const invalid = () => { throw new Error('A avaliação recebida não corresponde ao lance solicitado. Tente novamente.'); };
  if (response.version !== 1 || response.move !== target.move || response.perspective !== target.color
    || response.fen !== target.fen || response.afterFen !== target.afterFen
    || response.before.fen !== target.fen || response.after.fen !== target.afterFen
    || response.alternative.initialFen !== target.fen || response.continuation.initialFen !== target.afterFen
    || response.alternative.moves[0] !== response.bestMove) invalid();
  // Validate replay data before displaying facts tied to those board positions.
  for (const line of [response.alternative, response.continuation]) {
    const replay = replayPositions(line);
    if (replay.positions.length !== line.positions.length || replay.positions.some((fen, i) => fen !== line.positions[i])) invalid();
  }
}
