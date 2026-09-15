import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ENGINE_DIFFICULTIES,
  ENGINE_DIFFICULTY_PROFILES,
  emptyStrengthCapabilities,
  readStrengthOption,
  strengthSettings,
} from '../src/engine/engine-strength.ts';

test('reads the strength controls advertised by Stockfish', () => {
  let capabilities = emptyStrengthCapabilities();
  for (const line of [
    'option name Skill Level type spin default 20 min 0 max 20',
    'option name UCI_LimitStrength type check default false',
    'option name UCI_Elo type spin default 1320 min 1320 max 3190',
  ]) capabilities = readStrengthOption(line, capabilities);
  assert.deepEqual(capabilities, { limitStrength: true, skillLevel: true, eloRange: { min: 1320, max: 3190 } });
});

test('defines the requested rating targets in increasing order', () => {
  assert.equal(ENGINE_DIFFICULTIES.length, 11);
  assert.deepEqual(ENGINE_DIFFICULTIES.map(id => ENGINE_DIFFICULTY_PROFILES[id].estimatedRating), [
    { min: null, max: 499 },
    { min: 500, max: 600 },
    { min: 800, max: 800 },
    { min: 1_000, max: 1_200 },
    { min: 1_400, max: 1_500 },
    { min: 1_800, max: 1_800 },
    { min: 2_000, max: 2_100 },
    { min: 2_300, max: 2_400 },
    { min: 2_500, max: 2_600 },
    { min: 2_700, max: 2_800 },
    { min: 2_900, max: 3_000 },
  ]);
});

test('uses controlled inferior moves below the native Elo floor', () => {
  const capabilities = { limitStrength: true, skillLevel: true, eloRange: { min: 1320, max: 3190 } };
  const settings = strengthSettings('apprentice', capabilities)!;
  assert.equal(settings.elo, null);
  assert.equal(settings.depth, 5);
  assert.equal(settings.movetimeMs, 50);
  assert.deepEqual(settings.weakening, { multiPv: 64, bestMoveChance: 0.01, minLossCp: 500, maxLossCp: 2_000 });
  assert.deepEqual(settings.commands, [
    'setoption name UCI_LimitStrength value false',
    'setoption name Skill Level value 0',
    'setoption name MultiPV value 64',
  ]);
});

test('uses native UCI Elo for the seven higher levels', () => {
  const capabilities = { limitStrength: true, skillLevel: true, eloRange: { min: 1320, max: 3190 } };
  assert.equal(strengthSettings('advanced', capabilities)?.elo, 1_450);
  assert.equal(strengthSettings('candidate_master', capabilities)?.elo, 1_800);
  assert.equal(strengthSettings('master', capabilities)?.elo, 2_050);
  assert.equal(strengthSettings('international_master', capabilities)?.elo, 2_350);
  assert.equal(strengthSettings('grandmaster', capabilities)?.elo, 2_550);
  assert.equal(strengthSettings('world_champion', capabilities)?.elo, 2_750);
  assert.deepEqual(strengthSettings('machine', capabilities)?.commands, [
    'setoption name MultiPV value 1',
    'setoption name UCI_LimitStrength value true',
    'setoption name UCI_Elo value 2950',
  ]);
});

test('requires the controls used by each strategy', () => {
  const capabilities = { limitStrength: true, skillLevel: true, eloRange: { min: 1320, max: 3190 } };
  assert.equal(strengthSettings('apprentice', { ...capabilities, skillLevel: false }), null);
  assert.equal(strengthSettings('advanced', { ...capabilities, eloRange: null }), null);
});
