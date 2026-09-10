import assert from 'node:assert/strict';
import test from 'node:test';
import { Chess } from 'chess.js';
import { DEFAULT_POSITION, gameFromHistory, linePositions, moveUci, positionStatus, pvToSan, whiteScore } from '../src/chess/logic.ts';
import { categoryLabel, invertCategory } from '../src/chess/tablebase.ts';

test('aplica lances UCI legais e rejeita entradas ilegais', () => {
  const game = new Chess();
  assert.equal(moveUci(game, 'e2e4').san, 'e4');
  assert.throws(() => moveUci(game, 'e7e4'));
  assert.throws(() => moveUci(game, 'e7-e5'));
});

test('reconstrói replay, histórico e notação sem inventar continuação', () => {
  const moves = ['e2e4', 'e7e5', 'g1f3'];
  const line = linePositions(moves);
  assert.deepEqual(line.sans, ['e4', 'e5', 'Nf3']);
  assert.equal(line.positions.length, moves.length + 1);
  assert.equal(gameFromHistory(DEFAULT_POSITION, moves).fen(), line.positions.at(-1));
  assert.equal(pvToSan(DEFAULT_POSITION, [...moves, 'a1a8']), 'e4  e5  Nf3');
});

test('descreve estados finais e converte a avaliação para as brancas', () => {
  const mate = gameFromHistory(DEFAULT_POSITION, ['f2f3', 'e7e5', 'g2g4', 'd8h4']);
  assert.equal(positionStatus(mate), 'Xeque-mate. Vitória das pretas.');
  assert.equal(whiteScore({ type: 'cp', value: 35 }, 'w'), '+0.35');
  assert.equal(whiteScore({ type: 'cp', value: 35 }, 'b'), '-0.35');
});

test('trata resultados condicionados pela regra dos 50 lances', () => {
  assert.equal(invertCategory('cursed-win'), 'blessed-loss');
  assert.match(categoryLabel('cursed-win'), /regra dos 50 lances/);
  assert.equal(invertCategory('draw'), 'draw');
});
