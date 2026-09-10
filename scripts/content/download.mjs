// Optional first phase: acquire and validate the upstream data before editing lessons.
import { importOpenings } from './openings.mjs';
import { importPuzzles } from './puzzles.mjs';
import { importEndgames } from './endgames.mjs';

const args = process.argv.slice(2);
if (args.some((arg) => !['--refresh', '--offline'].includes(arg)) || (args.includes('--refresh') && args.includes('--offline'))) {
  throw new Error('Uso: node scripts/content/download.mjs [--refresh | --offline]');
}
const options = { refresh: args.includes('--refresh'), offline: args.includes('--offline') };
await importOpenings(options);
await importPuzzles(options);
await importEndgames(options);
