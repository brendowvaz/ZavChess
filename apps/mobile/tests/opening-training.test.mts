import assert from 'node:assert/strict';
import test from 'node:test';
import {
  advanceOpeningTraining,
  beginOpeningTraining,
  completedOpeningAttempt,
  hintOpeningTraining,
  moveOpeningTraining,
  openingTrainingCounts,
  trainingFinished,
} from '../src/features/openings/training.ts';

test('ensina a linha antes de cobrar os lances do aluno', () => {
  let state = beginOpeningTraining(['e2e4', 'e7e5', 'g1f3', 'b8c6'], 'w', 'request-1');
  assert.equal(state.phase, 'learn');
  assert.deepEqual(state.studentPlies, [0, 2]);
  assert.equal(state.index, 0);

  state = advanceOpeningTraining(state);
  assert.equal(state.phase, 'learn');
  assert.equal(state.index, 2);
  state = advanceOpeningTraining(state);
  assert.equal(state.phase, 'practice');
  assert.equal(state.index, 0);
});

test('leva erros ao fim da fila e só conclui depois da correção', () => {
  let state = beginOpeningTraining(['e2e4', 'e7e5', 'g1f3', 'b8c6'], 'w', 'request-2');
  state = advanceOpeningTraining(advanceOpeningTraining(state));

  state = moveOpeningTraining(state, 'd2d4');
  assert.equal(state.outcome, 'wrong');
  assert.deepEqual(openingTrainingCounts(state), { todo: 1, wrong: 1, correct: 0 });
  state = advanceOpeningTraining(state);
  state = moveOpeningTraining(state, 'g1f3');
  state = advanceOpeningTraining(state);
  assert.equal(state.phase, 'review');
  assert.equal(state.index, 0);

  state = moveOpeningTraining(state, 'e2e4');
  state = advanceOpeningTraining(state);
  assert.equal(trainingFinished(state), true);
  assert.deepEqual(openingTrainingCounts(state), { todo: 0, wrong: 0, correct: 2 });
  assert.deepEqual(completedOpeningAttempt(state), {
    moves: ['e2e4', 'g1f3'], plies: [0, 2], side: 'w', hintUsed: false, mistakes: 1, positionMistakes: [1, 0], requestId: 'request-2',
  });
});

test('não sei revela a resposta e registra revisão difícil', () => {
  let state = beginOpeningTraining(['e2e4', 'e7e5'], 'b', 'request-3');
  state = advanceOpeningTraining(state);
  state = hintOpeningTraining(state);
  assert.equal(state.outcome, 'dont-know');
  assert.equal(state.hintUsed, true);
  assert.equal(state.mistakes, 1);
  assert.equal(state.status[1], 'wrong');
});

test('revisão focada cobra e registra somente a posição agendada', () => {
  let state = beginOpeningTraining(['e2e4', 'e7e5', 'g1f3', 'b8c6'], 'w', 'request-focus', 2);
  assert.deepEqual(state.studentPlies, [2]);
  assert.equal(state.index, 2);
  state = advanceOpeningTraining(state);
  state = moveOpeningTraining(state, 'g1f3');
  state = advanceOpeningTraining(state);
  assert.deepEqual(completedOpeningAttempt(state), {
    moves: ['g1f3'], plies: [2], side: 'w', hintUsed: false, mistakes: 0, positionMistakes: [0], requestId: 'request-focus',
  });
});
