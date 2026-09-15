import test from 'node:test';
import assert from 'node:assert/strict';
import { Chess, DEFAULT_POSITION } from 'chess.js';
import { analyzeMoveWithEngine, compareAssessments, legalAnalysisLine, normalizeAssessment, parseAnalysisPosition, terminalScore } from '../src/engine/analysis-coach.ts';
import { parseExactUciInfo } from '../src/engine/analysis-uci.ts';
import type { CoachScore, EngineAnalysis, EngineScore } from '../src/engine/analysis-contract.ts';

function raw(fen: string, score: EngineScore, moves?: string[]): EngineAnalysis {
  const game = new Chess(fen);
  const pv = moves ?? [game.moves({ verbose: true })[0]!.lan];
  return { fen: game.fen(), score, pv, bestMove: pv[0] ?? null, depth: 10, engine: 'Test UCI' };
}

test('white move: before +120, opponent score -40 means after +40 and loss 80', async () => {
  const calls: string[] = [];
  const result = await analyzeMoveWithEngine(DEFAULT_POSITION, 'e2e4', 12, async (fen, depth) => {
    assert.equal(depth, 12); calls.push(fen);
    return calls.length === 1 ? raw(fen, { type: 'cp', value: 120 }, ['d2d4', 'd7d5']) : raw(fen, { type: 'cp', value: -40 }, ['e7e5', 'g1f3']);
  });
  assert.equal(calls.length, 2);
  assert.equal(calls[1], result.afterFen);
  assert.equal(result.perspective, 'w');
  assert.deepEqual(result.before.score, { type: 'cp', value: 120 });
  assert.deepEqual(result.after.score, { type: 'cp', value: 40 });
  assert.equal(result.loss.centipawns, 80);
  assert.equal(result.classification, 'inaccuracy');
  assert.equal(result.bestMove, 'd2d4');
  assert.equal(result.alternative.initialFen, result.fen);
  assert.equal(result.continuation.initialFen, result.afterFen);
  assert.deepEqual(result.continuation.sans, ['e5', 'Nf3']);
  assert.match(result.explanation[0]!, /perspectiva das brancas/);
});

test('black move: evaluations stay in the black mover perspective, independent of board orientation', async () => {
  const game = new Chess(); game.move('e4');
  let count = 0;
  const result = await analyzeMoveWithEngine(game.fen(), 'e7e5', 10, async fen => ++count === 1
    ? raw(fen, { type: 'cp', value: 80 }, ['c7c5'])
    : raw(fen, { type: 'cp', value: 70 }, ['g1f3']));
  assert.equal(result.perspective, 'b');
  assert.deepEqual(result.before.score, { type: 'cp', value: 80 });
  assert.deepEqual(result.after.score, { type: 'cp', value: -70 });
  assert.equal(result.loss.centipawns, 150);
  assert.equal(result.classification, 'mistake');
});

test('normalization flips positive and negative mate scores for either color', () => {
  for (const turn of ['w', 'b'] as const) {
    const game = new Chess(); if (turn === 'b') game.move('e4');
    const perspective = turn === 'w' ? 'b' : 'w';
    for (const value of [-3, 3]) {
      const result = normalizeAssessment(game, raw(game.fen(), { type: 'mate', value }), perspective);
      assert.deepEqual(result.score, { type: 'mate', value: -value, winner: value > 0 ? turn : perspective });
    }
  }
});

test('classification boundaries, bestmove precedence and search drift are explicit', () => {
  for (const [cp, expected] of [[0, 'good'], [50, 'good'], [51, 'inaccuracy'], [100, 'inaccuracy'], [101, 'mistake'], [250, 'mistake'], [251, 'blunder']] as const) {
    const result = compareAssessments({ type: 'cp', value: cp }, { type: 'cp', value: 0 }, 'w', false);
    assert.equal(result.classification, expected);
  }
  const better = compareAssessments({ type: 'cp', value: 20 }, { type: 'cp', value: 50 }, 'w', false);
  assert.equal(better.loss.centipawns, 0);
  assert.equal(better.loss.signedCentipawns, -30);
  const best = compareAssessments({ type: 'cp', value: 120 }, { type: 'cp', value: 10 }, 'w', true);
  assert.equal(best.classification, 'best');
  assert.equal(best.loss.centipawns, 110); // Never forge zero loss merely because bestmove matched.
});

test('mate transitions never use fictitious centipawns or penalize distance shifts', () => {
  const winning: CoachScore = { type: 'mate', value: 3, winner: 'w' };
  const losing: CoachScore = { type: 'mate', value: -3, winner: 'b' };
  const cp: CoachScore = { type: 'cp', value: 0 };
  const cases = [
    [cp, losing, 'allowed', 'blunder'], [winning, cp, 'missed', 'mistake'],
    [winning, losing, 'allowed', 'blunder'], [winning, { ...winning, value: 9 }, 'kept', 'good'],
    [losing, { ...losing, value: -1 }, 'still-losing', 'good'], [losing, cp, 'escaped', 'good'],
    [cp, winning, 'found', 'good'],
  ] as const;
  for (const [before, after, mate, classification] of cases) {
    const result = compareAssessments(before, after, 'w', false);
    assert.equal(result.loss.mate, mate);
    assert.equal(result.classification, classification);
    assert.equal(result.loss.centipawns, null);
    assert.equal(result.loss.signedCentipawns, null);
  }
  assert.equal(compareAssessments(cp, losing, 'w', true).classification, 'blunder');
});

for (const [fen, move, winner] of [
  ['7k/8/5KQ1/8/8/8/8/8 w - - 99 1', 'g6g7', 'w'],
  ['8/8/8/8/8/5kq1/8/7K b - - 99 1', 'g3g2', 'b'],
] as const) test(`delivered ${winner} mate 0 overrides the 50-move clock and needs no after search`, async () => {
  let calls = 0;
  const result = await analyzeMoveWithEngine(fen, move, 10, async position => {
    calls++; return raw(position, { type: 'mate', value: 1 }, [move]);
  });
  assert.equal(calls, 1);
  assert.equal(result.classification, 'best');
  assert.deepEqual(result.after.score, { type: 'mate', value: 0, winner });
  assert.equal(result.loss.mate, 'delivered');
  assert.equal(result.loss.centipawns, null);
  assert.deepEqual(result.continuation.moves, []);
  assert.equal(result.lesson.concept, 'Xeque-mate');
  assert.ok(result.facts.some(fact => fact.kind === 'checkmate'));
});

for (const [fen, move, reason] of [
  ['7k/5K2/8/6Q1/8/8/8/8 w - - 0 1', 'g5g6', 'stalemate'],
  ['7k/P7/8/8/8/8/8/7K w - - 0 1', 'a7a8n', 'insufficient-material'],
  ['7k/8/8/8/8/8/R7/K7 w - - 99 1', 'a2b2', 'fifty-move'],
] as const) test(`${reason}: terminal score is a draw, not mate or missing data`, async () => {
  let calls = 0;
  const result = await analyzeMoveWithEngine(fen, move, 10, async position => {
    calls++; return raw(position, { type: 'cp', value: 330 }, [move]);
  });
  assert.equal(calls, 1);
  assert.deepEqual(result.after.score, { type: 'draw', value: 0, reason });
  assert.equal(result.loss.centipawns, 330);
  assert.equal(result.after.depth, 0);
  assert.equal(result.continuation.moves.length, 0);
  assert.ok(result.facts.some(fact => fact.kind === 'draw'));
});

test('a lost forced mate can become a draw without being classified as a blunder', () => {
  const result = compareAssessments({ type: 'mate', value: -2, winner: 'b' }, { type: 'draw', value: 0, reason: 'stalemate' }, 'w', false);
  assert.equal(result.loss.mate, 'escaped');
  assert.equal(result.classification, 'good');
  assert.equal(result.loss.centipawns, null);
});

test('repetition is recognized only where the actual history is present', () => {
  const game = new Chess();
  for (const move of ['Nf3', 'Nf6', 'Ng1', 'Ng8', 'Nf3', 'Nf6', 'Ng1', 'Ng8']) game.move(move);
  assert.deepEqual(terminalScore(game, 'w'), { type: 'draw', value: 0, reason: 'threefold-repetition' });
  assert.equal(terminalScore(new Chess(game.fen()), 'w'), null);
});

test('illegal move, malformed UCI, bad depth, invalid FEN and finished positions fail before invoking engine', async () => {
  const fixtures: [string, string, number][] = [
    [DEFAULT_POSITION, 'e2e5', 10], [DEFAULT_POSITION, 'e7e5', 10], [DEFAULT_POSITION, 'e4', 10],
    [DEFAULT_POSITION, '0000', 10], [DEFAULT_POSITION, 'e2e4q', 10], [DEFAULT_POSITION, 'e2e4\ngo infinite', 10],
    [DEFAULT_POSITION, 'e2e4', 0], [DEFAULT_POSITION, 'e2e4', 19], [DEFAULT_POSITION, 'e2e4', 1.5],
    ['invalid', 'e2e4', 10], ['8/8/8/8/8/8/8/8 w - - 0 1', 'a1a2', 10],
    ['7k/6Q1/5K2/8/8/8/8/8 b - - 1 1', 'h8h7', 10],
    ['7k/8/8/8/8/8/8/K7 w - - 0 1', 'a1a2', 10],
    ['7k/8/8/8/8/8/R7/K7 w - - 100 1', 'a2b2', 10],
    ['7k/P7/8/8/8/8/8/7K w - - 0 1', 'a7a8', 10],
  ];
  for (const [fen, move, depth] of fixtures) {
    await assert.rejects(analyzeMoveWithEngine(fen, move, depth, async () => assert.fail('Engine must not be called')), error => (error as { getStatus(): number }).getStatus() === 400);
  }
  assert.throws(() => parseAnalysisPosition('7k/6Q1/5K2/8/8/8/8/8 w - - 0 1'));
  assert.throws(() => parseAnalysisPosition('7k/8/8/8/8/8/8/4K3 w K - 0 1'));
});

test('PV evidence is a legal prefix; castling, promotion, checks and en passant are board facts', () => {
  const truncated = legalAnalysisLine(DEFAULT_POSITION, ['e2e4', 'e7e5', 'd1h5', 'a8a1', 'h5f7'], 'alternative-pv');
  assert.deepEqual(truncated.moves, ['e2e4', 'e7e5', 'd1h5']);
  assert.equal(truncated.truncated, true);
  assert.equal(truncated.positions.length, 4);
  assert.ok(truncated.facts.every(fact => fact.ply <= 3));
  assert.ok(!truncated.facts.some(fact => fact.kind === 'capture'));
  const castle = legalAnalysisLine('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1', ['e1g1'], 'played-move');
  assert.ok(castle.facts.some(fact => fact.kind === 'castle'));
  const enPassant = legalAnalysisLine('7k/8/8/3pP3/8/8/8/K7 w - d6 0 1', ['e5d6'], 'played-move');
  assert.match(enPassant.facts.find(fact => fact.kind === 'capture')!.text, /d5, en passant/);
  const promotion = legalAnalysisLine('7k/P7/8/8/8/8/8/7K w - - 0 1', ['a7a8r'], 'played-move');
  assert.ok(promotion.facts.some(fact => fact.kind === 'promotion' && /torre/.test(fact.text)));
  assert.ok(promotion.facts.some(fact => fact.kind === 'check'));
});

test('PV stops at a terminal draw even if the engine emitted more moves', () => {
  const line = legalAnalysisLine('7k/P7/8/8/8/8/8/7K w - - 0 1', ['a7a8n', 'h8g8'], 'continuation-pv');
  assert.deepEqual(line.moves, ['a7a8n']);
  assert.equal(line.truncated, true);
});

test('inconsistent bestmove/PV never attaches unrelated moves or invents tactical causes', async () => {
  let count = 0;
  const result = await analyzeMoveWithEngine(DEFAULT_POSITION, 'e2e4', 8, async fen => {
    const response = ++count === 1 ? raw(fen, { type: 'cp', value: 10 }, ['d2d4', 'd7d5']) : raw(fen, { type: 'cp', value: 0 }, ['e7e5']);
    if (count === 1) response.bestMove = 'g1f3';
    return response;
  });
  assert.deepEqual(result.alternative.moves, ['g1f3']);
  assert.equal(result.alternative.truncated, true);
  assert.ok(result.method.limitations.some(text => text.includes('FEN não contém o histórico')));
  assert.doesNotMatch(result.explanation.join(' '), /perde.*dama|garfo|cravada|desprotege|centro|ganha material/i);
  for (const line of [result.alternative, result.continuation]) {
    for (const fact of line.facts) assert.equal(fact.fen, line.positions[fact.ply]);
  }
});

test('missing score, mate zero on a live board, mismatched FEN or illegal bestmove is never neutral feedback', async () => {
  const game = new Chess();
  assert.throws(() => normalizeAssessment(game, raw(game.fen(), { type: 'mate', value: 0 }), 'w'));
  assert.throws(() => normalizeAssessment(game, raw(game.fen(), { type: 'cp', value: Number.NaN }), 'w'));
  const other = new Chess(); other.move('e4');
  assert.throws(() => normalizeAssessment(game, raw(other.fen(), { type: 'cp', value: 0 }), 'w'));
  await assert.rejects(analyzeMoveWithEngine(DEFAULT_POSITION, 'e2e4', 10, async fen => raw(fen, { type: 'cp', value: 0 }, ['a1a8'])));
  await assert.rejects(analyzeMoveWithEngine(DEFAULT_POSITION, 'e2e4', 10, async () => { throw new Error('Engine offline'); }), /Engine offline/);
});

test('UCI parser ignores bounds, info strings, partial reports and non-primary MultiPV', () => {
  assert.deepEqual(parseExactUciInfo('info depth 12 seldepth 19 multipv 1 score cp -81 nodes 123 pv e2e4 e7e5'), { depth: 12, score: { type: 'cp', value: -81 }, pv: ['e2e4', 'e7e5'] });
  assert.deepEqual(parseExactUciInfo('info depth 5 score mate -2 pv g1f3'), { depth: 5, score: { type: 'mate', value: -2 }, pv: ['g1f3'] });
  for (const line of [
    'info depth 12 score cp 120 lowerbound pv e2e4', 'info depth 12 score mate 3 upperbound pv e2e4',
    'info depth 12 multipv 2 score cp 90 pv d2d4', 'info depth 12 score cp 0',
    'info score cp 0 pv e2e4', 'info string depth 12 score cp 0 pv e2e4',
  ]) assert.equal(parseExactUciInfo(line), null);
});
