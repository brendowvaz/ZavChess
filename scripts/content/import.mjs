import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { ROOT, DATA, CHESS_VERSION, json, sha256, writeStable } from './lib.mjs';
import { importOpenings } from './openings.mjs';
import { importPuzzles } from './puzzles.mjs';
import { importEndgames } from './endgames.mjs';
import { buildLessons } from './lessons.mjs';
import { buildAdvancedLessons } from './advanced-lessons.mjs';

const args = process.argv.slice(2);
if (args.includes('--help')) {
  console.log('Uso: node scripts/content/import.mjs [--offline | --refresh]\nSem flags: reutiliza cache verificado; baixa apenas fontes ausentes.');
  process.exit(0);
}
if (args.some((arg) => !['--refresh', '--offline'].includes(arg)) || (args.includes('--refresh') && args.includes('--offline'))) {
  throw new Error('Uso: node scripts/content/import.mjs [--offline | --refresh]');
}
const options = { refresh: args.includes('--refresh'), offline: args.includes('--offline') };
const openings = await importOpenings(options);
const puzzles = await importPuzzles(options);
const endgames = await importEndgames(options);
const lessons = buildLessons(openings.openings, puzzles.puzzles, endgames.endgames);
await writeStable(resolve(DATA, 'lesson-extensions.json'), json(buildAdvancedLessons(puzzles.puzzles)));
const artifacts = [];
for (const [name, rows] of Object.entries({ openings: openings.openings, puzzles: puzzles.puzzles, endgames: endgames.endgames, lessons: lessons.lessons })) {
  const bytes = json(rows);
  await writeStable(resolve(DATA, `${name}.json`), bytes);
  artifacts.push({ file: `data/${name}.json`, count: rows.length, bytes: Buffer.byteLength(bytes), sha256: sha256(bytes) });
}
const editorialFiles = [];
for (const name of ['lessons.mjs', 'endgames.mjs']) {
  const file = `scripts/content/${name}`;
  editorialFiles.push({ file, sha256: sha256(await readFile(resolve(ROOT, file))) });
}
const sources = {
  schemaVersion: 1,
  generator: 'scripts/content/import.mjs',
  hashAlgorithm: 'SHA-256',
  validation: { library: 'chess.js', version: CHESS_VERSION, scope: 'Legalidade de posições e lances; não avalia a qualidade editorial nem a melhor jogada.' },
  openings: openings.provenance,
  puzzles: puzzles.provenance,
  endgames: endgames.provenance,
  lessons: { ...lessons.provenance, editorialFiles },
  stockfish: {
    sourceUrl: 'https://stockfishchess.org/', license: 'GPL-3.0',
    licenseUrl: 'https://github.com/official-stockfish/Stockfish/blob/master/Copying.txt',
    use: 'Proveniência indireta: o Lichess documenta análise Stockfish NNUE na geração dos puzzles oficiais.',
    evidenceUrl: 'https://database.lichess.org/#puzzles',
    localEngineExecuted: false, textValidatedByEngine: false,
    downloadTimestamp: null, hash: null, reason: 'Nenhum binário Stockfish foi baixado ou redistribuído por estes scripts.',
  },
  artifacts,
};
await writeStable(resolve(DATA, 'sources.json'), json(sources));
console.log(JSON.stringify(Object.fromEntries(artifacts.map((a) => [a.file, a.count])), null, 2));
