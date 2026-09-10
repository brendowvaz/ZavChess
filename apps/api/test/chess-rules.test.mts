import test from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { calculateStreak, playUci, puzzlePosition, validatePuzzle } from '../src/chess/chess-rules.ts';
import { hashPassword, verifyPassword } from '../src/auth/password.ts';

test('Lichess setup and replies are replayed exactly once', () => {
  const fen = new Chess().fen();
  const line = ['e2e4', 'e7e5', 'g1f3', 'b8c6'];
  assert.equal(puzzlePosition(fen, line).turn(), 'b');
  const first = validatePuzzle(fen, line, ['e7e5']);
  assert.equal(first.status, 'correct');
  assert.equal(first.reply, 'g1f3');
  assert.equal(first.expectedMove, 'b8c6');
  assert.equal(validatePuzzle(fen, line, ['e7e5', 'b8c6']).status, 'solved');
  assert.equal(validatePuzzle(fen, line, ['e7e6']).status, 'incorrect');
  assert.equal(validatePuzzle(fen, line, ['e7e6']).fen, puzzlePosition(fen, line).fen());
  assert.throws(() => validatePuzzle(fen, line, ['e7e5', 'b8c6', 'f8c5']));
});

test('UCI supports underpromotion and rejects illegal moves', () => {
  const chess = new Chess('7k/P7/8/8/8/8/8/7K w - - 0 1');
  playUci(chess, 'a7a8n');
  assert.equal(chess.get('a8')?.type, 'n');
  assert.throws(() => playUci(new Chess(), 'e2e5'));
});

test('streak counts São Paulo dates without duplicate days', () => {
  const dates = ['2026-09-08T13:00:00Z', '2026-09-08T14:00:00Z', '2026-09-07T13:00:00Z'].map((value) => new Date(value));
  assert.equal(calculateStreak(dates, new Date('2026-09-09T12:00:00Z')), 2);
  assert.equal(calculateStreak(dates, new Date('2026-09-10T12:00:00Z')), 0);
});

test('password hashing uses salts and validates the original password', async () => {
  const first = await hashPassword('senha-de-teste-123');
  assert.notEqual(first, await hashPassword('senha-de-teste-123'));
  assert.equal(await verifyPassword('senha-de-teste-123', first), true);
  assert.equal(await verifyPassword('incorreta', first), false);
});
