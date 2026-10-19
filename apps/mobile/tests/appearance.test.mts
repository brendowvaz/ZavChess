import assert from 'node:assert/strict';
import test from 'node:test';
import { defaultAppearance, parseAppearance } from '../src/appearance/themes.ts';

test('restaura escolhas independentes e recupera configurações antigas ou corrompidas', () => {
  for (const raw of [null, '{', 'null', '42', '[]', '{"boardTheme":"__proto__"}']) {
    assert.deepEqual(parseAppearance(raw), defaultAppearance);
  }
  assert.deepEqual(parseAppearance('{"pieceStyle":"rounded","boardTheme":"removed"}'), { ...defaultAppearance, pieceStyle: 'rounded' });
  assert.deepEqual(parseAppearance('{"pieceStyle":"removed","boardTheme":"blue"}'), { ...defaultAppearance, boardTheme: 'blue' });
  assert.deepEqual(parseAppearance('{"pieceStyle":"sculpted","boardTheme":"wood"}'), { ...defaultAppearance, pieceStyle: 'sculpted', boardTheme: 'wood' });
  const saved = { ...defaultAppearance, autoAdvance: false, colorBlind: true, vibration: true, showLegalMoves: false, learningTrack: 'start' };
  assert.deepEqual(parseAppearance(JSON.stringify(saved)), saved);
  assert.equal(parseAppearance('{"autoAdvance":"false"}').autoAdvance, true);
});
