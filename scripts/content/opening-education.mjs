import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Chess, DATA, UPSTREAM, json, sha256, writeStable } from './lib.mjs';
import { families, lessonIds } from './opening-education-families.mjs';
import { variations } from './opening-education-variations.mjs';

const prefixOf = (prefix, moves) => prefix.length <= moves.length && prefix.every((move, i) => moves[i] === move);
export function buildOpeningEducation() {
  const openings = JSON.parse(readFileSync(resolve(DATA, 'openings.json'), 'utf8'));
  const revision = JSON.parse(readFileSync(resolve(UPSTREAM, 'openings-commit.json'), 'utf8')).sha;
  const volumes = new Map();
  for (const volume of 'abcde') {
    const bytes = readFileSync(resolve(UPSTREAM, `${volume}.tsv`));
    const metadata = JSON.parse(readFileSync(resolve(UPSTREAM, `${volume}.tsv.meta.json`), 'utf8'));
    assert.equal(sha256(bytes), metadata.sha256, `Upstream alterado: ${volume}`);
    assert.ok(metadata.url.includes(`/${revision}/`), 'A fonte deve apontar para a revisão fixa');
    volumes.set(volume, bytes.toString('utf8').split(/\r?\n/));
  }
  const source = row => {
    const lines = volumes.get(row.eco[0].toLowerCase());
    const index = lines.indexOf(`${row.eco}\t${row.name}\t${row.pgn}`);
    assert.ok(index > 0, `Linha ausente na fonte primária: ${row.name}`);
    return { title: 'Lichess chess-openings · registro CC0', url: `${row.sourceUrl}#L${index + 1}`, scope: 'identity-and-moves', openingId: row.id };
  };
  const line = (row, notes = []) => {
    const game = new Chess();
    const sans = row.moves.map(move => game.move({ from: move.slice(0, 2), to: move.slice(2, 4), promotion: move[4] }).san);
    assert.equal(game.fen(), row.fen);
    return { openingId: row.id, name: row.name, pgn: row.pgn, moves: [...row.moves], fen: row.fen,
      annotations: notes.map(([ply, text]) => {
        assert.ok(Number.isInteger(ply) && ply > 0 && ply <= row.moves.length, `Anotação inválida: ${row.name} ${ply}`);
        return { ply, uci: row.moves[ply - 1], san: sans[ply - 1], text };
      }) };
  };
  const shortest = rows => [...rows].sort((a, b) => a.moves.length - b.moves.length || a.id.localeCompare(b.id))[0];
  const guides = families.map(([family, displayName, overview, whitePlan, blackPlan, commonMistakes, audit]) => {
    const members = openings.filter(row => row.family === family);
    const row = shortest(members.filter(row => row.name === family)) ?? shortest(members);
    assert.ok(row, `Família ausente: ${family}`);
    return { family, displayName, aliases: [displayName, displayName.replace(/^(Defesa|Abertura|Sistema|Ataque) /, '')],
      overview, whitePlan, blackPlan, commonMistakes, lessonIds: lessonIds[family] ?? [],
      scope: family === "Queen's Pawn Game" ? 'broad-family' : 'family',
      reviewStatus: 'human-review-pending', audit, sources: [source(row)], referenceLine: line(row) };
  });
  const variationGuides = variations.map(({ notes, ...guide }) => {
    const row = shortest(openings.filter(row => row.name === guide.name));
    assert.ok(row, `Variante ausente: ${guide.name}`);
    const members = openings.filter(member => member.family === row.family && (member.name === guide.name || member.name.startsWith(`${guide.name}, `)));
    // Minimize prefixes without inventing transpositions. Exact names remain a
    // separate allowlist, so an overlapping word never grants membership.
    const prefixes = [];
    for (const member of [...members].sort((a, b) => a.moves.length - b.moves.length)) {
      if (!prefixes.some(prefix => prefixOf(prefix, member.moves))) prefixes.push([...member.moves]);
    }
    return { ...guide, family: row.family, reviewStatus: 'human-review-pending',
      match: { exactNames: [...new Set(members.map(member => member.name))].sort(), uciPrefixes: prefixes },
      sources: members.filter(member => prefixes.some(prefix => prefix.length === member.moves.length && prefixOf(prefix, member.moves))).map(source),
      line: line(row, notes) };
  });
  const guided = new Set(guides.map(guide => guide.family));
  const allFamilies = [...new Set(openings.map(row => row.family))].sort();
  const meta = { schemaVersion: 1, revision, reviewedAt: '2026-09-10',
    authorship: 'Zav Chess · rascunho assistido por IA, sem atribuição a mestre ou revisor humano',
    sourceScope: 'Fontes primárias verificam identidade e lances. Planos e anotações são análise editorial original da posição, ainda sem revisão humana.',
    coverage: { catalogFamilies: allFamilies.length, guidedFamilies: guides.length, originalGuidesRevised: 30,
      variationGuides: variationGuides.length, uncoveredFamilies: allFamilies.filter(family => !guided.has(family)), humanReview: 'pending' } };
  return { families: { ...meta, guides }, variations: { ...meta, variations: variationGuides } };
}

export async function writeOpeningEducation() {
  const built = buildOpeningEducation();
  await writeStable(resolve(DATA, 'opening-guides.json'), json(built.families));
  await writeStable(resolve(DATA, 'opening-variations.json'), json(built.variations));
  return built.families.coverage;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  console.log(JSON.stringify(await writeOpeningEducation(), null, 2));
}
