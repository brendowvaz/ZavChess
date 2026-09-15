import assert from 'node:assert/strict';
import test from 'node:test';
import { defaultEngineDifficulty, engineDifficulties, parseEngineDifficulty } from '../src/features/analysis/engine-difficulty.ts';

test('restores all eleven supported named difficulties', () => {
  assert.equal(engineDifficulties.length, 11);
  assert.deepEqual(engineDifficulties.map(level => level.label), [
    'Aprendiz',
    'Iniciante',
    'Casual',
    'Intermediário',
    'Avançado',
    'Candidato a mestre',
    'Mestre',
    'Mestre internacional',
    'Grande mestre',
    'Campeão mundial',
    'Máquina',
  ]);
  for (const level of engineDifficulties) assert.equal(parseEngineDifficulty(level.id), level.id);
  for (const value of [null, '', '1800', '__proto__']) assert.equal(parseEngineDifficulty(value), defaultEngineDifficulty);
});

test('migrates preferences saved by the previous difficulty scale', () => {
  assert.equal(parseEngineDifficulty('expert'), 'grandmaster');
  assert.equal(parseEngineDifficulty('maximum'), 'machine');
});
