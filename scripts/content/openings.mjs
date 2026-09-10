import assert from 'node:assert/strict';
import { Chess, DEFAULT_POSITION, cachedDownload, replay, sha256 } from './lib.mjs';

export const OPENINGS_REPO = 'https://github.com/lichess-org/chess-openings';
export function openingId(eco, name, pgn) {
  return `opening-${sha256(JSON.stringify([eco, name, pgn])).slice(0, 24)}`;
}

export function parseOpenings(bytes, sourceUrl) {
  const [header, ...lines] = bytes.toString('utf8').trimEnd().split(/\r?\n/);
  assert.equal(header, 'eco\tname\tpgn');
  return lines.map((line) => {
    const columns = line.split('\t');
    assert.equal(columns.length, 3);
    const [eco, name, pgn] = columns;
    assert.match(eco, /^[A-E]\d{2}$/);
    const game = new Chess();
    game.loadPgn(pgn, { strict: true });
    const moves = game.history({ verbose: true }).map((move) => `${move.from}${move.to}${move.promotion ?? ''}`);
    assert.ok(moves.length > 0);
    const fen = game.fen();
    assert.equal(replay(DEFAULT_POSITION, moves).fen(), fen);
    return { id: openingId(eco, name, pgn), eco, name, family: name.split(':')[0], pgn, fen, moves, sourceUrl };
  });
}

export async function importOpenings(options) {
  const commit = await cachedDownload('openings-commit.json', 'https://api.github.com/repos/lichess-org/chess-openings/commits/master', options);
  const revision = JSON.parse(commit.bytes).sha;
  assert.match(revision, /^[a-f0-9]{40}$/);
  const licenseUrl = `${OPENINGS_REPO}/blob/${revision}/COPYING.txt`;
  const sources = [commit.metadata];
  const license = await cachedDownload('openings-CC0.txt', `https://raw.githubusercontent.com/lichess-org/chess-openings/${revision}/COPYING.txt`, { ...options, license: 'CC0-1.0', licenseUrl });
  sources.push(license.metadata);
  const openings = [];
  const counts = {};
  for (const volume of 'abcde') {
    const downloaded = await cachedDownload(`${volume}.tsv`, `https://raw.githubusercontent.com/lichess-org/chess-openings/${revision}/${volume}.tsv`, { ...options, license: 'CC0-1.0', licenseUrl });
    const rows = parseOpenings(downloaded.bytes, `${OPENINGS_REPO}/blob/${revision}/${volume}.tsv`);
    openings.push(...rows);
    counts[volume] = rows.length;
    sources.push(downloaded.metadata);
    console.log(`Aberturas ${volume.toUpperCase()}: ${rows.length}`);
  }
  assert.equal(new Set(openings.map((o) => o.id)).size, openings.length, 'ID de abertura duplicado');
  return { openings, provenance: { revision, license: 'CC0-1.0', licenseUrl, counts, sources } };
}
