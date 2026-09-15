import test from 'node:test';
import assert from 'node:assert/strict';
import { Chess, DEFAULT_POSITION } from 'chess.js';
import { LatestAnalysisRequest, coachScoreText, lastReviewTarget, replayPositions, validateReviewResponse } from '../../mobile/src/features/analysis/analysis-session.ts';
import { analyzeMoveWithEngine, legalAnalysisLine } from '../src/engine/analysis-coach.ts';

test('reset, undo and unmount cancellation reject a late result even after the same FEN is revisited', async () => {
  for (const action of ['reset', 'undo', 'unmount']) {
    const requests = new LatestAnalysisRequest();
    const old = requests.begin();
    let resolve!: (value: string) => void;
    let rendered = '';
    const work = new Promise<string>(done => { resolve = done; }).then(value => { if (requests.isCurrent(old)) rendered = value; });
    requests.cancel();
    assert.equal(old.controller.signal.aborted, true, action);
    const current = requests.begin();
    resolve('stale result'); await work;
    assert.equal(rendered, '', action);
    assert.equal(requests.finish(old), false, action);
    assert.equal(requests.isCurrent(current), true, action);
    assert.equal(requests.finish(current), true, action);
  }
});

test('overlapping requests and failures cannot clear the new request loading state', () => {
  const requests = new LatestAnalysisRequest();
  const first = requests.begin();
  const second = requests.begin();
  assert.equal(requests.isCurrent(first), false);
  assert.equal(first.controller.signal.aborted, true);
  assert.equal(requests.finish(first), false);
  assert.equal(requests.isCurrent(second), true);
  assert.equal(requests.finish(second), true);
  assert.equal(requests.finish(second), false);
  const retry = requests.begin();
  assert.ok(retry.id > second.id);
  assert.equal(requests.isCurrent(retry), true);
});

test('review targets use the pre-move FEN for both engine reply and player move; undo rebuilds it', () => {
  const history = ['e2e4', 'e7e5', 'g1f3', 'b8c6'];
  assert.equal(lastReviewTarget([]), null);
  const engine = lastReviewTarget(history)!;
  const player = lastReviewTarget(history, 'w')!;
  assert.equal(engine.move, 'b8c6'); assert.equal(engine.color, 'b'); assert.equal(engine.ply, 4);
  assert.equal(player.move, 'g1f3'); assert.equal(player.color, 'w'); assert.equal(player.ply, 3);
  assert.equal(engine.fen, player.afterFen);
  assert.equal(lastReviewTarget(history.slice(0, -2), 'w')!.fen, DEFAULT_POSITION);
  assert.equal(lastReviewTarget(['e2e4'], 'b'), null);
  const promotion = lastReviewTarget(['a7a8n'], undefined, '7k/P7/8/8/8/8/8/7K w - - 0 1')!;
  assert.equal(promotion.san, 'a8=N');
  assert.equal(new Chess(promotion.afterFen).get('a8')?.type, 'n');
});

test('mate zero preserves winner in the mobile presentation; draw and cp zero differ', () => {
  assert.equal(coachScoreText({ type: 'mate', value: 0, winner: 'b' }, 'b'), 'Xeque-mate a favor');
  assert.equal(coachScoreText({ type: 'mate', value: 0, winner: 'b' }, 'w'), 'Xeque-mate contra');
  assert.equal(coachScoreText({ type: 'mate', value: -3, winner: 'b' }, 'w'), 'Mate contra em 3');
  assert.equal(coachScoreText({ type: 'draw', value: 0, reason: 'stalemate' }, 'w'), 'Empate');
  assert.equal(coachScoreText({ type: 'cp', value: 0 }, 'w'), '+0.00');
});

test('replay starts on the correct black fullmove number and never modifies the game history', () => {
  const game = new Chess(); game.move('e4');
  const fen = game.fen();
  const line = legalAnalysisLine(fen, ['e7e5', 'g1f3'], 'continuation-pv');
  const replay = replayPositions(line);
  assert.deepEqual(replay.labels, ['1… e5', '2. Nf3']);
  assert.deepEqual(replay.positions, line.positions);
  assert.equal(game.fen(), fen);
  assert.throws(() => replayPositions({ ...line, moves: ['e7e4'] }));
});

test('feature contract accepts the API result and rejects another move, wrong perspective or replay corruption', async () => {
  const target = lastReviewTarget(['e2e4'])!;
  const result = await analyzeMoveWithEngine(target.fen, target.move, 8, async fen => {
    const bestMove = new Chess(fen).turn() === 'w' ? 'd2d4' : 'e7e5';
    return { fen, score: { type: 'cp', value: 10 }, depth: 8, bestMove, pv: [bestMove], engine: 'Test' };
  });
  assert.doesNotThrow(() => validateReviewResponse(result, target));
  assert.throws(() => validateReviewResponse({ ...result, move: 'd2d4' }, target));
  assert.throws(() => validateReviewResponse({ ...result, perspective: 'b' }, target));
  assert.throws(() => validateReviewResponse({ ...result, continuation: { ...result.continuation, positions: [target.fen] } }, target));
});
