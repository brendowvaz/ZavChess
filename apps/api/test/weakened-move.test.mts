import assert from 'node:assert/strict';
import test from 'node:test';
import { chooseWeakenedMove, parseRankedEngineMove } from '../src/engine/weakened-move.ts';

test('parses exact MultiPV root candidates', () => {
  assert.deepEqual(
    parseRankedEngineMove('info depth 5 seldepth 7 multipv 3 score cp -125 nodes 50 pv g1f3 g8f6'),
    { move: 'g1f3', multipv: 3, depth: 5, score: { type: 'cp', value: -125 } },
  );
  assert.equal(parseRankedEngineMove('info depth 5 multipv 2 score cp 10 lowerbound pv e2e4'), null);
  assert.equal(parseRankedEngineMove('info string NNUE evaluation'), null);
});

const candidates = [
  { move: 'e2e4', multipv: 1, depth: 5, score: { type: 'cp' as const, value: 100 } },
  { move: 'd2d4', multipv: 2, depth: 5, score: { type: 'cp' as const, value: 0 } },
  { move: 'f2f3', multipv: 3, depth: 5, score: { type: 'cp' as const, value: -400 } },
];

test('occasionally keeps the best move and otherwise targets a configured loss', () => {
  assert.equal(chooseWeakenedMove(candidates, {
    multiPv: 3, bestMoveChance: 0.1, minLossCp: 300, maxLossCp: 500,
  }, () => 0), 'e2e4');

  const rolls = [0.5, 1];
  assert.equal(chooseWeakenedMove(candidates, {
    multiPv: 3, bestMoveChance: 0.1, minLossCp: 300, maxLossCp: 500,
  }, () => rolls.shift()!), 'f2f3');
});

test('returns a legal candidate even when only one line was reported', () => {
  assert.equal(chooseWeakenedMove(candidates.slice(0, 1), {
    multiPv: 20, bestMoveChance: 0, minLossCp: 500, maxLossCp: 1_000,
  }, () => 1), 'e2e4');
  assert.equal(chooseWeakenedMove([], {
    multiPv: 20, bestMoveChance: 0, minLossCp: 500, maxLossCp: 1_000,
  }), null);
});
