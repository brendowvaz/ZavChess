import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { Chess, type Color, type Move, type PieceSymbol } from 'chess.js';
import type { AnalysisFact, AnalysisLine, CoachScore, DrawReason, EngineAnalysis, MoveAnalysis, MoveClassification, PositionAssessment } from './analysis-contract';

const names: Record<PieceSymbol, string> = { p: 'peão', n: 'cavalo', b: 'bispo', r: 'torre', q: 'dama', k: 'rei' };
const side = (color: Color) => color === 'w' ? 'brancas' : 'pretas';
const opposite = (color: Color): Color => color === 'w' ? 'b' : 'w';
const uciPattern = /^[a-h][1-8][a-h][1-8][qrbn]?$/;
export const COACH_THRESHOLDS = { goodMaxCp: 50, inaccuracyMaxCp: 100, mistakeMaxCp: 250 } as const;

export function validateAnalysisDepth(depth: number) {
  if (!Number.isInteger(depth) || depth < 1 || depth > 18) throw new BadRequestException('Profundidade deve ser um inteiro entre 1 e 18.');
}

export function parseAnalysisPosition(fen: string): Chess {
  try {
    if (typeof fen !== 'string' || fen.length > 200 || /[\r\n\0]/.test(fen)) throw new Error();
    const game = new Chess(fen);
    const pieces = game.board().flat().filter(piece => piece !== null);
    const otherKing = pieces.find(piece => piece.type === 'k' && piece.color !== game.turn())!;
    // chess.js validates FEN syntax but allows the king of the previous mover in check.
    if (game.isAttacked(otherKing.square, game.turn())) throw new Error();
    for (const color of ['w', 'b'] as const) {
      if (pieces.filter(piece => piece.color === color).length > 16 || pieces.filter(piece => piece.color === color && piece.type === 'p').length > 8) throw new Error();
      const rank = color === 'w' ? '1' : '8';
      const rights = game.getCastlingRights(color);
      if (rights.k || rights.q) {
        const king = game.get(`e${rank}`);
        if (king?.type !== 'k' || king.color !== color) throw new Error();
      }
      for (const [right, file] of [[rights.k, 'h'], [rights.q, 'a']] as const) {
        if (!right) continue;
        const rook = game.get(`${file}${rank}`);
        if (rook?.type !== 'r' || rook.color !== color) throw new Error();
      }
    }
    return game;
  } catch { throw new BadRequestException('Posição FEN inválida ou incompatível com uma partida legal.'); }
}

export function playAnalysisMove(game: Chess, uci: string): Move {
  try {
    if (typeof uci !== 'string' || !uciPattern.test(uci) || game.isGameOver()) throw new Error();
    const piece = game.get(uci.slice(0, 2) as Parameters<Chess['get']>[0]);
    const reachesLastRank = piece?.type === 'p' && /[18]$/.test(uci.slice(2, 4));
    if ((uci.length === 5) !== reachesLastRank) throw new Error();
    return game.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), ...(uci[4] ? { promotion: uci[4] } : {}) });
  } catch { throw new BadRequestException('Lance UCI inválido ou ilegal nesta posição.'); }
}

export function terminalScore(game: Chess, perspective: Color): CoachScore | null {
  // Checkmate takes precedence even when the halfmove clock has reached 100.
  if (game.isCheckmate()) return { type: 'mate', value: 0, winner: opposite(game.turn()) };
  let reason: DrawReason | undefined;
  if (game.isStalemate()) reason = 'stalemate';
  else if (game.isInsufficientMaterial()) reason = 'insufficient-material';
  else if (game.isThreefoldRepetition()) reason = 'threefold-repetition';
  else if (game.isDrawByFiftyMoves()) reason = 'fifty-move';
  else if (game.isDraw()) reason = 'draw';
  return reason ? { type: 'draw', value: 0, reason } : null;
}

const drawNames: Record<DrawReason, string> = {
  stalemate: 'afogamento', 'insufficient-material': 'material insuficiente', 'fifty-move': 'regra dos 50 lances',
  'threefold-repetition': 'repetição tripla', draw: 'regra de empate',
};

function moveFacts(move: Move, game: Chess, source: AnalysisFact['source'], ply: number): AnalysisFact[] {
  const facts: AnalysisFact[] = [];
  const add = (kind: AnalysisFact['kind'], text: string) => facts.push({ kind, text, source, ply, fen: game.fen(), uci: move.lan });
  add('move', `${move.san}: ${names[move.piece]} das ${side(move.color)} de ${move.from} para ${move.to}.`);
  if (move.captured) add('capture', `${move.san} captura ${names[move.captured]} das ${side(opposite(move.color))}${move.isEnPassant() ? ` em ${move.to[0]}${move.from[1]}, en passant` : ` em ${move.to}`}.`);
  if (move.isKingsideCastle() || move.isQueensideCastle()) add('castle', `${move.san} realiza o roque ${move.isKingsideCastle() ? 'curto' : 'longo'} das ${side(move.color)}.`);
  if (move.promotion) add('promotion', `${move.san} promove o peão a ${names[move.promotion]} em ${move.to}.`);
  const terminal = terminalScore(game, move.color);
  if (terminal?.type === 'mate') add('checkmate', `${move.san} dá xeque-mate: o rei das ${side(game.turn())} está em xeque e não há lance legal.`);
  else if (terminal?.type === 'draw') add('draw', `${move.san} termina em empate por ${drawNames[terminal.reason]}.`);
  else if (game.isCheck()) add('check', `${move.san} dá xeque ao rei das ${side(game.turn())}.`);
  return facts;
}

/** Only legal prefixes are evidence. Never splice a bestmove onto a different PV. */
export function legalAnalysisLine(fen: string, moves: string[], source: AnalysisFact['source']): AnalysisLine {
  const game = new Chess(fen);
  const line: AnalysisLine = { initialFen: game.fen(), moves: [], sans: [], positions: [game.fen()], facts: [], truncated: false };
  for (const uci of moves.slice(0, 24)) {
    try {
      const move = playAnalysisMove(game, uci);
      line.moves.push(uci); line.sans.push(move.san); line.positions.push(game.fen());
      line.facts.push(...moveFacts(move, game, source, line.moves.length));
    } catch { break; }
  }
  line.truncated = line.moves.length !== moves.length;
  return line;
}

export function normalizeAssessment(game: Chess, raw: EngineAnalysis, perspective: Color): PositionAssessment {
  if (new Chess(raw.fen).fen() !== game.fen()) throw new ServiceUnavailableException('O motor retornou uma avaliação para outra posição.');
  let score = terminalScore(game, perspective);
  if (!score) {
    if (!raw.score || !['mate', 'cp'].includes(raw.score.type) || !Number.isSafeInteger(raw.score.value) || (raw.score.type === 'mate' && raw.score.value === 0)) {
      throw new ServiceUnavailableException('O motor não retornou uma avaliação válida.');
    }
    const value = (game.turn() === perspective ? raw.score.value : -raw.score.value) || 0;
    score = raw.score.type === 'cp' ? { type: 'cp', value }
      : { type: 'mate', value, winner: raw.score.value > 0 ? game.turn() : opposite(game.turn()) };
  }
  return { fen: game.fen(), turn: game.turn(), score, depth: raw.depth, engine: raw.engine };
}

export function compareAssessments(before: CoachScore, after: CoachScore, perspective: Color, matchesBestMove: boolean) {
  const wonMate = (score: CoachScore) => score.type === 'mate' && score.winner === perspective;
  const lostMate = (score: CoachScore) => score.type === 'mate' && score.winner !== perspective;
  const signedCentipawns = before.type !== 'mate' && after.type !== 'mate' ? before.value - after.value : null;
  const loss: MoveAnalysis['loss'] = { centipawns: signedCentipawns === null ? null : Math.max(0, signedCentipawns), signedCentipawns, mate: 'none' };
  let classification: MoveClassification;
  let reason: string;
  if (wonMate(after) && after.value === 0) {
    loss.mate = 'delivered'; classification = 'best'; reason = 'O lance dá xeque-mate no tabuleiro.';
  } else if (lostMate(after) && !lostMate(before)) {
    loss.mate = 'allowed'; classification = 'blunder'; reason = 'A busca depois do lance encontra mate contra quem jogou; a busca anterior não o indicava.';
  } else if (wonMate(before) && !wonMate(after)) {
    loss.mate = 'missed'; classification = 'mistake'; reason = 'A busca anterior indicava mate a favor; a busca depois do lance deixou de encontrá-lo.';
  } else {
    if (wonMate(before) && wonMate(after)) loss.mate = 'kept';
    else if (lostMate(before) && lostMate(after)) loss.mate = 'still-losing';
    else if (lostMate(before)) loss.mate = 'escaped';
    else if (wonMate(after)) loss.mate = 'found';
    if (matchesBestMove) { classification = 'best'; reason = 'O lance coincide com o melhor lance retornado na busca da posição anterior.'; }
    else if (loss.centipawns === null) { classification = 'good'; reason = 'O lance mantém o desfecho de mate previsto ou melhora a avaliação de mate nesta busca; distâncias de mate não viram centipeões.'; }
    else {
      const cp = loss.centipawns;
      classification = cp <= 50 ? 'good' : cp <= 100 ? 'inaccuracy' : cp <= 250 ? 'mistake' : 'blunder';
      reason = `Perda estimada de ${cp} cp. Faixas locais: bom ≤50; imprecisão 51–100; erro 101–250; erro grave >250 cp.`;
    }
  }
  return { loss, classification, classificationReason: reason };
}

function scoreDescription(score: CoachScore, perspective: Color) {
  if (score.type === 'draw') return `empate por ${drawNames[score.reason]}`;
  if (score.type === 'mate') return score.value === 0 ? `xeque-mate a favor das ${side(score.winner)}`
    : `mate ${score.winner === perspective ? 'a favor' : 'contra'} em ${Math.abs(score.value)} lance(s), segundo a busca`;
  return `${score.value >= 0 ? '+' : ''}${(score.value / 100).toFixed(2)} (${score.value} cp)`;
}

function lessonFor(facts: AnalysisFact[], continuation: AnalysisLine): MoveAnalysis['lesson'] {
  const find = (kind: AnalysisFact['kind']) => facts.find(fact => fact.kind === kind);
  const mate = find('checkmate');
  if (mate) return { concept: 'Xeque-mate', plan: 'Reproduza o lance indicado. Confira o xeque e procure capturas, bloqueios ou fugas legais do rei; nessa posição não há resposta.', evidence: [mate] };
  const draw = find('draw');
  if (draw) return { concept: 'Reconhecer empates', plan: 'Reproduza a posição de empate indicada e confira a regra descrita antes de escolher entre essa linha e outra continuação.', evidence: [draw] };
  const promotion = find('promotion');
  if (promotion) return { concept: 'Promoção', plan: 'Reproduza a promoção indicada e observe a peça escolhida. Antes de promover, confira xeques e possíveis empates na posição resultante.', evidence: [promotion] };
  const capture = find('capture');
  if (capture) return { concept: 'Capturas e recapturas', plan: 'Localize a captura indicada no replay. Depois procure recapturas e xeques legais; uma captura isolada não prova ganho líquido de material.', evidence: [capture] };
  const check = find('check');
  if (check) return { concept: 'Responder a xeques', plan: 'Reproduza o xeque indicado e compare as respostas legais: mover o rei, capturar a peça que dá xeque ou bloquear a linha, quando possível.', evidence: [check] };
  const castle = find('castle');
  if (castle) return { concept: 'Roque', plan: 'Observe as novas casas do rei e da torre após o roque. Confira as respostas do adversário antes de avaliar a segurança do rei.', evidence: [castle] };
  const next = continuation.facts.find(fact => fact.ply === 1);
  return { concept: 'Lances candidatos e resposta adversária', plan: next
    ? `Comece pela resposta ${continuation.sans[0]} no replay. Compare essa continuação com a alternativa da posição anterior e, a cada passo, procure xeques e capturas legais.`
    : 'Compare o lance jogado com a alternativa sugerida. Em cada posição, procure xeques e capturas legais antes de escolher seu próximo lance.', evidence: next ? [next] : facts.slice(0, 1) };
}

export async function analyzeMoveWithEngine(
  fen: string, uci: string, depth: number,
  evaluate: (fen: string, depth: number) => Promise<EngineAnalysis>,
): Promise<MoveAnalysis> {
  validateAnalysisDepth(depth);
  const beforeGame = parseAnalysisPosition(fen);
  const afterGame = new Chess(beforeGame.fen());
  const played = playAnalysisMove(afterGame, uci);
  const perspective = beforeGame.turn();
  const beforeRaw = await evaluate(beforeGame.fen(), depth);
  const terminal = terminalScore(afterGame, perspective);
  const afterRaw: EngineAnalysis = terminal
    ? { fen: afterGame.fen(), bestMove: null, score: { type: terminal.type === 'mate' ? 'mate' : 'cp', value: 0 }, depth: 0, pv: [], engine: 'Regras do xadrez: posição terminada' }
    : await evaluate(afterGame.fen(), depth);
  const before = normalizeAssessment(beforeGame, beforeRaw, perspective);
  const after = normalizeAssessment(afterGame, afterRaw, perspective);
  if (!beforeRaw.bestMove) throw new ServiceUnavailableException('O motor não informou uma alternativa legal.');
  const alternative = legalAnalysisLine(beforeGame.fen(), beforeRaw.pv[0] === beforeRaw.bestMove ? beforeRaw.pv : [beforeRaw.bestMove], 'alternative-pv');
  if (!alternative.moves.length) throw new ServiceUnavailableException('O motor não informou uma alternativa legal.');
  if (beforeRaw.pv[0] !== beforeRaw.bestMove) alternative.truncated = true;
  const continuation = legalAnalysisLine(afterGame.fen(), afterRaw.pv[0] === afterRaw.bestMove ? afterRaw.pv : afterRaw.bestMove ? [afterRaw.bestMove] : [], 'continuation-pv');
  if (!terminal && !continuation.moves.length) throw new ServiceUnavailableException('O motor não informou uma continuação legal.');
  if (!terminal && afterRaw.pv[0] !== afterRaw.bestMove) continuation.truncated = true;
  const facts = moveFacts(played, afterGame, 'played-move', 1);
  const matchesBestMove = beforeRaw.bestMove === uci;
  const comparison = compareAssessments(before.score, after.score, perspective, matchesBestMove);
  const limitations = [
    'Análise local do Stockfish com explicações por regras e fatos; não é um professor LLM.',
    'Os rótulos são heurísticas do Zav Chess, não anotações fornecidas pelo Stockfish.',
    'Buscas independentes, limitadas por tempo e profundidade, podem divergir; mesmo o melhor lance pode apresentar perda estimada. CP não mede material perdido.',
    'FEN não contém o histórico: repetição anterior à posição enviada não pode ser detectada. A regra dos 50 lances segue o contador do FEN.',
    'A PV é uma continuação sugerida, não uma sequência obrigatória. Fatos dessa linha não demonstram a causa completa da avaliação.',
  ];
  if (alternative.truncated || continuation.truncated) limitations.push('Replay limitado ao prefixo legal de até 24 meios-lances; o restante da PV foi omitido.');
  if (before.depth < depth || (!terminal && after.depth < depth)) limitations.push('O limite de tempo impediu atingir a profundidade solicitada em pelo menos uma busca.');
  const explanation = [
    `Na perspectiva das ${side(perspective)}: antes ${scoreDescription(before.score, perspective)}; depois ${scoreDescription(after.score, perspective)}.`,
    comparison.classificationReason,
    ...facts.filter(fact => fact.kind !== 'move').map(fact => fact.text),
  ];
  if (facts.length === 1) explanation.push(facts[0].text);
  return {
    version: 1, fen: beforeGame.fen(), afterFen: afterGame.fen(), move: uci, san: played.san, perspective,
    before, after, ...comparison, bestMove: beforeRaw.bestMove, matchesBestMove, alternative, continuation,
    explanation, facts, lesson: lessonFor([...facts, ...continuation.facts, ...alternative.facts], continuation),
    method: { name: 'stockfish-facts-v1', requestedDepth: depth, thresholds: { ...COACH_THRESHOLDS }, limitations },
  };
}
