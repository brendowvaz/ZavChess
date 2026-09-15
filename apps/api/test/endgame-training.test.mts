import test from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import {
  CATEGORIES, LESSONS, LIMITS, THEMES, TrainingCore, TrainingError, candidatePool, evaluatedPosition,
  invertCategory, legalPosition, moveFeedback, outcome, play, replay, terminalPosition,
  type Category, type RawEvaluation, type Theme,
} from '../src/endgame-training/domain.ts';

const QUEEN = '7k/8/8/8/8/3Q4/8/K7 w - - 0 1';
const ROOK = '7k/8/8/8/3R4/8/8/K7 w - - 0 1';
const NEAR_MATE = '7k/5K2/6Q1/8/8/8/8/8 w - - 0 1';
function rng(seed: number) { return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }; }
// Synthetic complete responses exercise control flow; they are not evidence of chess evaluations.
function fixture(fen: string, category: Category = 'win', choices: Record<string, Category> = {}): RawEvaluation {
  return { category, dtz: category === 'draw' ? 0 : 5, dtm: null, moves: new Chess(fen).moves({ verbose: true }).map(move => ({
    uci: move.lan, san: move.san, category: invertCategory(choices[move.lan] || category), dtz: -4,
  })) };
}
for (const theme of THEMES) test(`${theme}: varied legal boards, both colors, correct material and no ended games`, () => {
  const seen = new Set<string>(); const turns = new Set<string>();
  for (const seed of [7, 41, 123]) {
    const pool = candidatePool(theme, rng(seed));
    assert.equal(pool.length, LIMITS.candidates);
    for (const fen of pool) {
      const game = legalPosition(fen); const pieces = game.board().flat().filter(Boolean);
      assert.equal(game.isGameOver(), false);
      assert.equal(fen.split(' ').slice(2).join(' '), '- - 0 1');
      assert.ok(pieces.length >= 3 && pieces.length <= 5);
      assert.equal(pieces.filter(piece => piece!.type === 'k').length, 2);
      assert.ok(pieces.every(piece => piece!.type !== 'p' || !/[18]$/.test(piece!.square)));
      const idle = pieces.find(piece => piece!.type === 'k' && piece!.color !== game.turn())!;
      assert.equal(game.isAttacked(idle.square, game.turn()), false);
      if (theme === 'queen') assert.equal(pieces.filter(piece => piece!.type === 'q').length, 1);
      if (theme === 'rook') assert.ok(pieces.some(piece => piece!.type === 'r'));
      if (theme === 'pawn' || theme === 'promotion') assert.ok(pieces.every(piece => ['k', 'p'].includes(piece!.type)));
      if (theme === 'promotion') assert.ok(game.moves({ verbose: true }).some(move => move.promotion));
      turns.add(game.turn()); seen.add(fen);
    }
  }
  assert.ok(seen.size > 250); assert.equal(turns.size, 2);
});

test('constant random source cannot cause an infinite sampling loop', () => {
  for (const theme of THEMES) assert.ok(candidatePool(theme, () => 0).length <= 1);
});

test('strict legality rejects adjacent kings, idle king in check, edge pawns, castling and ended roots', () => {
  for (const fen of [
    '8/8/8/8/8/8/4k3/4KQ2 w - - 0 1',
    '7k/8/8/8/3Q4/8/8/K7 w - - 0 1',
    'P6k/8/8/8/8/8/8/K7 w - - 0 1',
    '7k/8/8/8/8/8/8/K6p w - - 0 1',
    '4k3/8/8/8/8/8/8/4K2R w K - 0 1',
    '7k/8/8/8/8/8/8/K7 w - - 0 1',
    '7k/6Q1/5K2/8/8/8/8/8 b - - 0 1',
    '7k/5K2/6Q1/8/8/8/8/8 b - - 0 1',
    QUEEN.replace('0 1', '100 1'),
    '8/8/8/8/8/8/8/K7 w - - 0 1',
    new Chess().fen(),
  ]) assert.throws(() => legalPosition(fen), TrainingError, fen);
  assert.doesNotThrow(() => legalPosition('7k/8/8/8/3Q4/8/8/K7 b - - 0 1')); // Active king may be in check.
});

test('all ten categories invert without changing certainty or treating ambiguity as a draw', () => {
  for (const value of CATEGORIES) {
    assert.equal(invertCategory(invertCategory(value)), value);
    const expected = value === 'win' || value === 'loss' ? value : ['draw', 'cursed-win', 'blessed-loss'].includes(value) ? 'draw' : null;
    assert.equal(outcome(value), expected);
  }
});

test('response selection inverts child perspective and does not blindly use moves[0]', () => {
  const raw = fixture(QUEEN, 'win');
  raw.moves[0].category = 'win'; // Losing for the actor.
  raw.moves[1].category = 'draw';
  raw.moves[2].category = 'loss';
  const position = evaluatedPosition(new Chess(QUEEN), raw);
  assert.equal(position.moves[0].outcome, 'loss');
  assert.equal(position.moves[2].outcome, 'win');
  assert.equal(position.bestMove, raw.moves[2].uci);
});

test('draw categories preserve provider tie ordering; unknown/ambiguous results are not certified', () => {
  for (const value of ['draw', 'cursed-win', 'blessed-loss'] as const) {
    const raw = fixture(ROOK, value);
    const pos = evaluatedPosition(new Chess(ROOK), raw);
    assert.equal(pos.outcome, 'draw'); assert.equal(pos.bestMove, raw.moves[0].uci);
  }
  for (const value of ['unknown', 'maybe-win', 'maybe-loss', 'syzygy-win', 'syzygy-loss'] as const) {
    const pos = evaluatedPosition(new Chess(QUEEN), fixture(QUEEN, value));
    assert.equal(pos.outcome, null); assert.equal(pos.bestMove, null);
  }
});

test('malformed tablebase data never supplies a hint or an automatic move', () => {
  const raw = fixture(QUEEN);
  assert.throws(() => evaluatedPosition(new Chess(QUEEN), { ...raw, category: 'invented' }), TrainingError);
  assert.throws(() => evaluatedPosition(new Chess(QUEEN), { ...raw, moves: raw.moves.slice(1) }), TrainingError);
  assert.throws(() => evaluatedPosition(new Chess(QUEEN), { ...raw, moves: [...raw.moves, raw.moves[0]] }), TrainingError);
  assert.throws(() => evaluatedPosition(new Chess(QUEEN), { ...raw, moves: [{ ...raw.moves[0], uci: 'a1a8' }, ...raw.moves.slice(1)] }), TrainingError);
});

test('only a certified win/draw can become an exercise; rejects losing and uncertain pool entries', async () => {
  const pool = candidatePool('queen', rng(8)).slice(0, 5); let calls = 0;
  const core = new TrainingCore({ evaluateEndgame: async fen => fixture(fen, ['loss', 'unknown', 'syzygy-win', 'win'][calls++] as Category) }, () => pool);
  const exercise = await core.generate('queen');
  assert.equal(calls, 4); assert.equal(exercise.objective, 'win');
  assert.equal(exercise.fen, pool[3]); assert.equal(exercise.source.kind, 'generated');
  assert.equal(exercise.tablebase.source.url, `https://tablebase.lichess.ovh/standard?fen=${encodeURIComponent(exercise.fen)}`);
});

test('successive generation skips recent/excluded FENs, duplicates and finite exhausted pools', async () => {
  let calls = 0;
  const pool = [QUEEN, QUEEN, ROOK];
  const core = new TrainingCore({ evaluateEndgame: async fen => { calls++; return fixture(fen); } }, () => pool);
  const a = await core.generate('queen'); const b = await core.generate('queen', a.fen);
  assert.notEqual(a.fen, b.fen); assert.equal(calls, 2);
  await assert.rejects(core.generate('queen'), /lote limitado/); assert.equal(calls, 2);
  const excluded = new TrainingCore({ evaluateEndgame: async () => { throw new Error('should not call'); } }, () => [QUEEN]);
  await assert.rejects(excluded.generate('queen', QUEEN), /lote limitado/);
});

test('evaluation budget is six calls even when every candidate is rejected', async () => {
  let calls = 0; const pool = candidatePool('queen', rng(55));
  const core = new TrainingCore({ evaluateEndgame: async fen => { calls++; return fixture(fen, 'unknown'); } }, () => pool);
  await assert.rejects(core.generate('queen'), /lote limitado/); assert.equal(calls, LIMITS.probes);
});

test('finite empty pools and infinite duplicate iterables terminate without extra probes', async () => {
  let calls = 0;
  const engine = { evaluateEndgame: async (fen: string) => { calls++; return fixture(fen, 'unknown'); } };
  await assert.rejects(new TrainingCore(engine, () => []).generate('pawn'), /lote limitado/);
  function* duplicates() { for (;;) yield QUEEN; }
  await assert.rejects(new TrainingCore(engine, duplicates).generate('queen'), /lote limitado/);
  assert.equal(calls, 1);
});

test('network errors fail fast, timeouts are bounded and dangling requests keep a concurrency slot', async () => {
  let calls = 0;
  const failed = new TrainingCore({ evaluateEndgame: async () => { calls++; throw new Error('offline'); } }, () => [QUEEN, ROOK]);
  await assert.rejects(failed.generate('queen'), /indisponível/); assert.equal(calls, 1);
  const pending = new TrainingCore({ evaluateEndgame: async () => { calls++; return new Promise(() => {}); } }, () => [QUEEN], 15);
  await assert.rejects(pending.position({ initialFen: QUEEN, history: [] }), /demorou/);
  await assert.rejects(pending.position({ initialFen: QUEEN, history: [] }), /demorou/);
  await assert.rejects(pending.position({ initialFen: QUEEN, history: [] }), /limite/);
  assert.equal(calls, 3);
});

test('feedback covers loss of win, loss of draw, preserved outcomes and uncertainty', () => {
  assert.equal(moveFeedback('win', 'draw').code, 'lost-win');
  assert.equal(moveFeedback('win', 'loss').code, 'lost-win');
  assert.equal(moveFeedback('draw', 'loss').code, 'lost-draw');
  assert.equal(moveFeedback('win', 'win').code, 'preserved');
  assert.equal(moveFeedback('draw', 'draw').code, 'preserved');
  assert.equal(moveFeedback(null, 'loss').code, 'uncertain');
});

test('student stalemate loses a win; mate ends without requesting a reply', async () => {
  let calls = 0;
  const core = new TrainingCore({ evaluateEndgame: async fen => { calls++; return fixture(fen); } });
  const stale = await core.turn({ initialFen: NEAR_MATE, history: [], move: 'g6f5' });
  assert.equal(stale.reply, null); assert.equal(stale.feedback.code, 'lost-win'); assert.equal(stale.position.terminal, 'stalemate');
  assert.equal(calls, 1);
  const mate = await core.turn({ initialFen: NEAR_MATE, history: [], move: 'g6g7' });
  assert.equal(mate.reply, null); assert.equal(mate.feedback.code, 'preserved'); assert.equal(mate.position.terminal, 'checkmate');
  assert.equal(calls, 2);
});

test('a full turn applies precisely one legal best reply and keeps input immutable', async () => {
  let calls = 0;
  const core = new TrainingCore({ evaluateEndgame: async fen => { calls++; return fixture(fen, new Chess(fen).turn() === 'w' ? 'win' : 'loss'); } });
  const input = { initialFen: QUEEN, history: [], move: 'd3d4' };
  const result = await core.turn(input);
  assert.equal(result.history.length, 2); assert.ok(result.reply); assert.equal(result.position.turn, 'w');
  assert.equal(replay({ initialFen: QUEEN, history: result.history }).fen(), result.position.fen);
  assert.deepEqual(input.history, []); assert.equal(result.feedback.code, 'preserved'); assert.equal(calls, 3);
});

test('black student receives lost-draw feedback from the correct perspective', async () => {
  const fen = ROOK.replace(' w ', ' b '); let calls = 0;
  const core = new TrainingCore({ evaluateEndgame: async current => fixture(current, calls++ === 0 ? 'draw' : new Chess(current).turn() === 'w' ? 'win' : 'loss') });
  const result = await core.turn({ initialFen: fen, history: [], move: 'h8g8' });
  assert.equal(result.feedback.code, 'lost-draw'); assert.equal(result.position.turn, 'b');
});

test('failure during automatic response returns no partial turn and retry starts from identical history', async () => {
  let calls = 0;
  const core = new TrainingCore({ evaluateEndgame: async fen => { if (++calls === 2) throw new Error('offline'); return fixture(fen, new Chess(fen).turn() === 'w' ? 'win' : 'loss'); } });
  const input = { initialFen: QUEEN, history: [], move: 'd3d4' };
  await assert.rejects(core.turn(input), /preservada/); assert.deepEqual(input.history, []);
  const result = await core.turn(input); assert.equal(result.history.length, 2);
});

test('history validation prevents out-of-turn moves and spending network on illegal moves', async () => {
  let calls = 0;
  const core = new TrainingCore({ evaluateEndgame: async fen => { calls++; return fixture(fen); } });
  await assert.rejects(core.turn({ initialFen: QUEEN, history: [], move: 'a1a8' }), /ilegal/);
  await assert.rejects(core.turn({ initialFen: QUEEN, history: ['d3d4'], move: 'h8g8' }), /vez/);
  await assert.rejects(core.position({ initialFen: QUEEN, history: Array(401).fill('a1a2') }), /400/);
  await assert.rejects(core.generate('bad' as Theme), /Tema inválido/);
  assert.equal(calls, 0);
});

test('50-move clock is retained; terminal positions need no network and mate has precedence', async () => {
  const core = new TrainingCore({ evaluateEndgame: async () => { throw new Error('no network expected'); } });
  const draw = await core.position({ initialFen: QUEEN.replace('0 1', '99 1'), history: ['d3d4'] });
  assert.equal(draw.terminal, 'fifty-moves'); assert.equal(draw.halfmoveClock, 100); assert.equal(draw.source.kind, 'rules');
  const mate = await core.position({ initialFen: NEAR_MATE.replace('0 1', '99 1'), history: ['g6g7'] });
  assert.equal(mate.terminal, 'checkmate'); assert.equal(mate.outcome, 'loss');
  const game = new Chess(QUEEN.replace('0 1', '99 1'));
  const pos = evaluatedPosition(game, fixture(game.fen(), 'cursed-win'));
  assert.ok(pos.moves.every(move => move.outcome === 'draw'));
});

test('full replay recognizes threefold repetition and avoids winning lines that actually repeat', () => {
  const cycle = ['a1a2', 'h8g8', 'a2a1', 'g8h8'];
  const game = replay({ initialFen: ROOK, history: [...cycle, ...cycle.slice(0, 3)] });
  const pos = evaluatedPosition(game, fixture(game.fen(), 'win'));
  assert.equal(pos.moves.find(move => move.uci === 'g8h8')?.outcome, 'draw');
  play(game, 'g8h8');
  assert.equal(terminalPosition(game)?.terminal, 'threefold-repetition');
  assert.throws(() => replay({ initialFen: ROOK, history: [...cycle, ...cycle, 'a1a2'] }), /após o fim/);
});

test('all four promotions, captures and generated en passant reset the 50-move counter', () => {
  for (const piece of ['q', 'r', 'b', 'n']) {
    const game = replay({ initialFen: '7k/P7/8/8/8/8/8/7K w - - 99 1', history: [`a7a8${piece}`] });
    assert.equal(game.get('a8')?.type, piece); assert.equal(game.fen().split(' ')[4], '0');
    if (piece === 'b' || piece === 'n') assert.equal(terminalPosition(game)?.terminal, 'insufficient-material');
  }
  const capture = replay({ initialFen: '7k/8/8/8/3p4/3Q4/8/K7 w - - 99 1', history: ['d3d4'] });
  assert.equal(capture.fen().split(' ')[4], '0');
  const ep = replay({ initialFen: '7k/8/8/8/3p4/8/4P3/K7 w - - 50 1', history: ['e2e4', 'd4e3'] });
  assert.equal(ep.get('e4'), undefined); assert.equal(ep.get('e3')?.color, 'b'); assert.equal(ep.fen().split(' ')[4], '0');
});

test('classic labels apply only to exact cited positions and are revalidated at generation', async () => {
  for (const lesson of LESSONS) {
    legalPosition(lesson.fen);
    const core = new TrainingCore({ evaluateEndgame: async fen => fixture(fen, lesson.objective) });
    const exercise = await core.generate('rook', undefined, lesson.id);
    assert.equal(exercise.fen, lesson.fen); assert.equal(exercise.source.url, lesson.url); assert.equal(exercise.objective, lesson.objective);
  }
  const core = new TrainingCore({ evaluateEndgame: async fen => fixture(fen, 'loss') });
  await assert.rejects(core.generate('rook', undefined, 'lucena'), /lote limitado/);
  await assert.rejects(core.generate('pawn', undefined, 'lucena'), /Referência inválida/);
});
