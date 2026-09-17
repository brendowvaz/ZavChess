import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRepertoireCourses, lineDecisions, openingPositionKey } from '../src/learning/repertoires.ts';

test('deduplica posições transpostas pela posição normalizada', () => {
  const first = openingPositionKey('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
  const same = openingPositionKey('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 19 42');
  assert.equal(first, same);
});

test('cria decisões apenas para a cor estudada e inclui o motivo', () => {
  const row = { id: 'italian', family: 'Italian Game', name: 'Italian Game: Giuoco Piano', eco: 'C50', moves: ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'f8c5'] };
  const white = lineDecisions(row, 'w');
  assert.deepEqual(white.map(item => item.uci), ['e2e4', 'g1f3', 'f1c4']);
  assert.ok(white.every(item => item.explanation.length > 20));
  assert.equal(new Set(white.map(item => item.key)).size, 3);
});

test('monta o curso curado sem duplicar uma mesma linha', () => {
  const rows = [
    { id: 'a', family: 'Italian Game', name: 'Italian Game: Giuoco Piano', eco: 'C50', moves: ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'f8c5'] },
    { id: 'b', family: 'Italian Game', name: 'Italian Game: Giuoco Pianissimo', eco: 'C50', moves: ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'f8c5', 'd2d3'] },
  ];
  const course = buildRepertoireCourses(rows).find(item => item.id === 'italiana-essencial')!;
  assert.equal(course.lines.length, 2);
  assert.ok(course.positionCount < course.lines.reduce((sum, line) => sum + line.decisions.length, 0));
});
