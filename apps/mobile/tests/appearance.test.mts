import assert from 'node:assert/strict';
import test from 'node:test';
import { defaultAppearance, parseAppearance } from '../src/appearance/themes.ts';

test('restaura escolhas independentes e recupera configurações antigas ou corrompidas', () => {
  for (const raw of [null, '{', 'null', '42', '[]', '{"boardTheme":"__proto__"}']) {
    assert.deepEqual(parseAppearance(raw), defaultAppearance);
  }
  assert.deepEqual(parseAppearance('{"pieceStyle":"rounded","boardTheme":"removed"}'), { pieceStyle: 'rounded', boardTheme: 'sage' });
  assert.deepEqual(parseAppearance('{"pieceStyle":"removed","boardTheme":"blue"}'), { pieceStyle: 'geometric', boardTheme: 'blue' });
  assert.deepEqual(parseAppearance('{"pieceStyle":"sculpted","boardTheme":"wood"}'), { pieceStyle: 'sculpted', boardTheme: 'wood' });
});
