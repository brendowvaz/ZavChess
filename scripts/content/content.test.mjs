import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { resolve } from 'node:path';
import { Chess, DATA, DEFAULT_POSITION, legalPosition, parseCsvLine, readJson, replay } from './lib.mjs';
import { openingId } from './openings.mjs';
import { offerCandidate, skipLeadingZstdMetadata } from './puzzles.mjs';
import { exactFields, validateData, validatePuzzle } from './validate.mjs';

test('UCI rejeita lance ilegal e aceita roque, en passant e promoção', () => {
  assert.throws(() => replay(DEFAULT_POSITION, ['e2e5']));
  assert.throws(() => replay(DEFAULT_POSITION, ['e4']));
  const castle = replay(DEFAULT_POSITION, ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'g8f6', 'e1g1']);
  assert.equal(castle.get('g1').type, 'k');
  assert.equal(castle.get('f1').type, 'r');
  const ep = replay('4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 2', ['e5d6']);
  assert.equal(ep.get('d5'), undefined);
  assert.equal(ep.get('d6').type, 'p');
  const promoted = replay('8/2P3k1/4K3/8/8/8/8/8 w - - 0 1', ['c7c8n']);
  assert.equal(promoted.get('c8').type, 'n');
});

test('FEN rejeita reis adjacentes e rei sem a vez em xeque', () => {
  assert.throws(() => legalPosition('8/8/8/8/8/4k3/4K3/8 w - - 0 1'));
  assert.throws(() => legalPosition('4k3/8/8/8/8/8/8/4R1K1 w - - 0 1'));
});

test('CSV preserva vírgulas, aspas escapadas e colunas vazias', () => {
  assert.deepEqual(parseCsvLine('id,"a,b","a""b",,'), ['id', 'a,b', 'a"b', '', '']);
  assert.throws(() => parseCsvLine('id,"incompleto'));
});

test('IDs de abertura são determinísticos e distinguem linhas', () => {
  assert.equal(openingId('C20', 'Nome', '1. e4 e5'), openingId('C20', 'Nome', '1. e4 e5'));
  assert.notEqual(openingId('C20', 'Nome', '1. e4 e5'), openingId('C20', 'Nome', '1. e4 e5 2. Nf3'));
});

test('Reservatório é limitado e independente da ordem de chegada', () => {
  const a = [], b = [];
  for (const key of ['d', 'a', 'e', 'c', 'b']) offerCandidate(a, { key }, 3);
  for (const key of ['b', 'c', 'e', 'a', 'd']) offerCandidate(b, { key }, 3);
  assert.deepEqual(a, [{ key: 'a' }, { key: 'b' }, { key: 'c' }]);
  assert.deepEqual(a, b);
});

test('Cabeçalho pzstd dividido em chunks é retirado sem alterar o frame', async () => {
  const metadata = Buffer.from('502a4d180400000032028a00', 'hex');
  const frame = Buffer.from('28b52ffd000001020304', 'hex');
  const input = Buffer.concat([metadata, frame]);
  const chunks = [];
  for await (const chunk of Readable.from([...input].map((byte) => Buffer.from([byte]))).pipe(skipLeadingZstdMetadata())) chunks.push(chunk);
  assert.deepEqual(Buffer.concat(chunks), frame);
});

test('Contrato rejeita campos extras e FEN de puzzle já avançado', () => {
  assert.throws(() => exactFields({ id: 'x', extra: true }, ['id']));
  const game = new Chess();
  game.move('e4');
  assert.throws(() => validatePuzzle({ id: 'x', rating: 1000, themes: ['short'], fen: game.fen(), moves: ['e2e4', 'e7e5'], sourceUrl: 'https://lichess.org/training/x' }));
});

test('Guias de abertura só referenciam famílias e aulas existentes', async () => {
  const [openings, lessons, guideDocument] = await Promise.all([
    readJson(resolve(DATA, 'openings.json')),
    readJson(resolve(DATA, 'lessons.json')),
    readJson(resolve(DATA, 'opening-guides.json')),
  ]);
  assert.deepEqual(Object.keys(guideDocument), ['guides']);
  assert.equal(guideDocument.guides.length, 30);
  const families = new Set(openings.map((opening) => opening.family));
  const openingLessons = new Map(lessons.filter((lesson) => lesson.category === 'openings').map((lesson) => [lesson.id, lesson]));
  let coveredLines = 0;
  for (const guide of guideDocument.guides) {
    assert.deepEqual(Object.keys(guide).sort(), ['blackPlan', 'commonMistakes', 'family', 'lessonIds', 'overview', 'whitePlan'].sort());
    assert.ok(families.has(guide.family), `Família ausente do catálogo: ${guide.family}`);
    assert.ok(guide.overview.length >= 80);
    for (const field of ['whitePlan', 'blackPlan', 'commonMistakes']) {
      assert.ok(Array.isArray(guide[field]) && guide[field].length >= 2, `${guide.family}: ${field} insuficiente`);
      assert.ok(guide[field].every((item) => typeof item === 'string' && item.length >= 25));
    }
    for (const lessonId of guide.lessonIds) assert.ok(openingLessons.has(lessonId), `${guide.family}: aula de abertura inexistente: ${lessonId}`);
    coveredLines += openings.filter((opening) => opening.family === guide.family).length;
  }
  assert.ok(coveredLines >= 2800, 'Guias precisam cobrir a maior parte do catálogo');
});

test('Todos os artefatos correspondem às fontes e têm linhas legais', async () => {
  const report = await validateData();
  console.log(JSON.stringify({ openings: report.openings, puzzles: report.puzzles, lessons: report.lessons, endgames: report.endgames, themes: report.themeCount, openingMoves: report.openingMoves, puzzleMoves: report.puzzleMoves }));
});
