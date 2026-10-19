import assert from 'node:assert/strict';
import test from 'node:test';
import { Chess } from 'chess.js';
import { gameMovePosition, resultForPlayer } from '../src/learning/game-review.ts';
import { parseExactMultiPv } from '../src/engine/analysis-uci.ts';
import { masteryPoints, masteryRank, nextReview } from '../src/learning/schedule.ts';

test('resultado da partida é sempre relativo à cor do jogador', () => {
  assert.equal(resultForPlayer('1-0', 'w'), 'win'); assert.equal(resultForPlayer('1-0', 'b'), 'loss');
  assert.equal(resultForPlayer('0-1', 'b'), 'win'); assert.equal(resultForPlayer('1/2-1/2', 'b'), 'draw');
  assert.equal(resultForPlayer('*', 'w'), 'unknown');
});
test('revisão usa a posição antes do lance e preserva uma posição inicial personalizada', () => {
  const moves = ['e2e4', 'e7e5', 'g1f3'];
  const game = new Chess(); game.move('e4'); game.move('e5');
  assert.deepEqual(gameMovePosition(moves, null, 2), { fen: game.fen(), move: 'g1f3' });
  assert.throws(() => gameMovePosition(moves, null, 3));
  const fen = '4k3/8/8/8/3R4/8/8/4K3 w - - 0 17';
  assert.equal(gameMovePosition(['d4d8'], fen, 0).fen, fen);
});
test('MultiPV mantém rank e profundidade e rejeita bounds e linhas incompletas', () => {
  const info = parseExactMultiPv('info depth 15 multipv 2 score cp -30 pv e2e4 e7e5');
  assert.equal(info?.rank, 2); assert.equal(info?.depth, 15); assert.equal(info?.score.value, -30);
  assert.equal(parseExactMultiPv('info depth 15 multipv 2 score cp -30 lowerbound pv e2e4'), null);
  assert.equal(parseExactMultiPv('info depth 15 multipv 4 score cp -30 pv e2e4'), null);
  assert.equal(parseExactMultiPv('info string depth 15 multipv 2 score cp -30 pv e2e4'), null);
});
test('dez pontos de domínio exigem revisões devidas, sem somar por repetição antecipada', () => {
  let now = new Date('2026-10-19T12:00:00Z'); let review = nextReview(null, 'good', now);
  assert.equal(masteryPoints(undefined), 0); assert.equal(masteryPoints(review), 1);
  assert.deepEqual(nextReview(review, 'good', now), review);
  for (let i = 0; i < 12; i++) { now = review.dueAt; review = nextReview(review, 'good', now); }
  assert.equal(masteryPoints(review), 10); assert.equal(masteryRank(100), 'Dominado');
});
