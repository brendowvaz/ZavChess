import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  findVariationGuide,
  openingEducation,
  openingSearchTerms,
  type FamilyEducationFile,
  type VariationEducationFile,
} from '../src/content/opening-education.ts';

const read = <T>(name: string): T => JSON.parse(readFileSync(fileURLToPath(new URL(`../../../data/${name}.json`, import.meta.url)), 'utf8')) as T;
const families = read<FamilyEducationFile>('opening-guides');
const variations = read<VariationEducationFile>('opening-variations');

test('the education catalog exposes explicit coverage', () => {
  assert.equal(families.guides.length, 42);
  assert.equal(variations.variations.length, 21);
  assert.ok(families.guides.every(guide => guide.reviewStatus === 'human-review-pending'));
  assert.ok(variations.variations.every(guide => guide.reviewStatus === 'human-review-pending'));
  assert.match(families.guides.find(guide => guide.family === 'Vienna Game')!.overview, /2\.Nc3/);
  assert.doesNotMatch(families.guides.find(guide => guide.family === 'Vienna Game')!.overview, /começa com 1\.e4 e5 2\.Nf3/);
});

test('a variation requires an allowlisted name and a verified move prefix', () => {
  const najdorf = {
    family: 'Sicilian Defense',
    name: 'Sicilian Defense: Najdorf Variation',
    moves: ['e2e4', 'c7c5', 'g1f3', 'd7d6', 'd2d4', 'c5d4', 'f3d4', 'g8f6', 'b1c3', 'a7a6'],
  };
  assert.equal(findVariationGuide(najdorf, variations)?.id, 'siciliana-najdorf');
  assert.equal(findVariationGuide({ ...najdorf, name: 'Sicilian Defense: Dragon Variation' }, variations), null);
  assert.equal(findVariationGuide({ ...najdorf, moves: najdorf.moves.slice(0, -1) }, variations), null);
  const overlay = openingEducation(najdorf, families, variations);
  assert.equal(overlay.coverage, 'variation');
  assert.equal(overlay.notice, 'Guia desta variante com linha de referência. A fonte verifica nomes e lances, não certifica os planos.');
});

test('Portuguese aliases expand search without fuzzy misclassification', () => {
  assert.ok(openingSearchTerms('Defesa Siciliana', families, variations).includes('Sicilian Defense'));
  assert.ok(openingSearchTerms('Dragão Acelerado', families, variations).includes('Sicilian Defense: Accelerated Dragon'));
  assert.deepEqual(openingSearchTerms('drag', families, variations), ['drag']);
});
