import assert from 'node:assert/strict';
import test from 'node:test';
import {
  annotationToneFromModifiers,
  arrowGeometry,
  toggleArrowAnnotation,
  toggleSquareAnnotation,
} from '../src/chess/annotations.ts';

const files = 'abcdefgh'.split('');
const ranks = [8, 7, 6, 5, 4, 3, 2, 1];

test('escolhe a cor da marcação pelos modificadores', () => {
  assert.equal(annotationToneFromModifiers({}), 'green');
  assert.equal(annotationToneFromModifiers({ shiftKey: true }), 'red');
  assert.equal(annotationToneFromModifiers({ ctrlKey: true }), 'yellow');
  assert.equal(annotationToneFromModifiers({ altKey: true }), 'blue');
});

test('alterna marcações e substitui sua cor sem duplicar', () => {
  assert.deepEqual(toggleSquareAnnotation([], 'e4', 'green'), [{ square: 'e4', tone: 'green' }]);
  assert.deepEqual(toggleSquareAnnotation([{ square: 'e4', tone: 'green' }], 'e4', 'green'), []);
  assert.deepEqual(toggleArrowAnnotation([{ from: 'e2', to: 'e4', tone: 'green' }], 'e2', 'e4', 'red'), [{ from: 'e2', to: 'e4', tone: 'red' }]);
});

test('desenha o movimento do cavalo em L pelo eixo mais longo primeiro', () => {
  const geometry = arrowGeometry('g8', 'f6', files, ranks, 100);
  assert.equal(geometry?.knight, true);
  assert.deepEqual(geometry?.turn, { x: 650, y: 250 });
  assert.equal(arrowGeometry('e2', 'e4', files, ranks, 100)?.turn, undefined);
});
