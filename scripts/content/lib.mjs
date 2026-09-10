import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

export const ROOT = fileURLToPath(new URL('../../', import.meta.url));
export const DATA = resolve(ROOT, 'data');
export const UPSTREAM = resolve(DATA, 'upstream');
const require = createRequire(import.meta.url);
// The isolated directory is only a fallback; this script never installs packages.
let chess;
let chessRequire = require;
try {
  chess = require('chess.js');
} catch (error) {
  if (error.code !== 'MODULE_NOT_FOUND') throw error;
  try {
    chessRequire = createRequire(resolve(ROOT, '.local/content-tools/package.json'));
    chess = chessRequire('chess.js');
  } catch {
    throw new Error('chess.js ausente. Instale na raiz pelo workspace ou em .local/content-tools. Consulte docs/CONTENT.md.');
  }
}
export const { Chess, DEFAULT_POSITION } = chess;
export const CHESS_VERSION = JSON.parse(readFileSync(resolve(dirname(chessRequire.resolve('chess.js')), '../../package.json'), 'utf8')).version;
export const sha256 = (value) => createHash('sha256').update(value).digest('hex');
export const json = (value) => `${JSON.stringify(value, null, 2)}\n`;
export const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));

export async function writeStable(path, value) {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(value);
  try {
    if ((await readFile(path)).equals(bytes)) return;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.tmp-${process.pid}`;
  await writeFile(temporary, bytes);
  await rename(temporary, path);
}

export function playUci(game, uci) {
  assert.match(uci, /^[a-h][1-8][a-h][1-8][qrbn]?$/, `UCI inválido: ${uci}`);
  return game.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), ...(uci[4] ? { promotion: uci[4] } : {}) });
}

export function legalPosition(fen) {
  assert.equal(fen.split(' ').length, 6, 'FEN deve conter seis campos');
  const game = new Chess(fen);
  const pieces = game.board().flat().filter(Boolean);
  for (const color of ['w', 'b']) {
    assert.equal(pieces.filter((p) => p.type === 'k' && p.color === color).length, 1);
    assert.ok(pieces.filter((p) => p.type === 'p' && p.color === color).length <= 8);
    assert.ok(pieces.filter((p) => p.color === color).length <= 16);
  }
  // A FEN parser alone can accept an impossible position: the side that just
  // moved must not have left its own king in check (also rejects adjacent kings).
  const previousColor = game.turn() === 'w' ? 'b' : 'w';
  const king = pieces.find((p) => p.color === previousColor && p.type === 'k');
  assert.ok(!game.isAttacked(king.square, game.turn()), 'Rei do lado sem a vez está em xeque');
  return game;
}

export function replay(fen, moves) {
  const game = legalPosition(fen);
  for (const [index, move] of moves.entries()) {
    try { playUci(game, move); } catch (error) {
      throw new Error(`Lance ${index + 1} (${move}) ilegal em ${game.fen()}: ${error.message}`);
    }
  }
  return game;
}

export function parseCsvLine(line) {
  const fields = [];
  let field = '';
  let quoted = false;
  let closed = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (quoted) {
      if (char === '"' && line[i + 1] === '"') { field += '"'; i++; }
      else if (char === '"') { quoted = false; closed = true; }
      else field += char;
    } else if (char === ',') {
      fields.push(field); field = ''; closed = false;
    } else if (char === '"' && field === '' && !closed) quoted = true;
    else {
      assert.ok(!closed && char !== '"', 'CSV malformado');
      field += char;
    }
  }
  assert.ok(!quoted, 'CSV com aspas abertas ou campo multilinha não suportado');
  fields.push(field);
  return fields;
}

export function httpMetadata(response) {
  return {
    resolvedUrl: response.url,
    status: response.status,
    etag: response.headers.get('etag'),
    lastModified: response.headers.get('last-modified'),
    contentLength: response.headers.get('content-length'),
    contentRange: response.headers.get('content-range'),
  };
}

export async function fetchOfficial(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { 'User-Agent': 'ZavChess-content-import/1.0', ...options.headers },
    signal: options.signal ?? AbortSignal.timeout(60_000),
  });
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(`HTTP ${response.status}: ${url}`);
  }
  return response;
}

export async function cachedDownload(file, url, { refresh = false, offline = false, license, licenseUrl } = {}) {
  const path = resolve(UPSTREAM, file);
  const metadataPath = `${path}.meta.json`;
  if (!refresh) {
    try {
      const metadata = await readJson(metadataPath);
      const bytes = await readFile(path);
      assert.equal(metadata.url, url, `URL do cache divergente: ${file}`);
      assert.equal(sha256(bytes), metadata.sha256, `Hash do cache divergente: ${file}`);
      return { bytes, metadata };
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  assert.ok(!offline, `Cache ausente em modo offline: ${file}`);
  const downloadedAt = new Date().toISOString();
  const response = await fetchOfficial(url);
  const bytes = Buffer.from(await response.arrayBuffer());
  assert.ok(bytes.length < 8 * 1024 * 1024, `Fonte pequena excedeu 8 MiB: ${url}`);
  const metadata = {
    file: `data/upstream/${file}`, url, license, licenseUrl,
    downloadedAt, completedAt: new Date().toISOString(),
    ...httpMetadata(response), bytes: bytes.length, sha256: sha256(bytes), hashScope: 'complete-response-body',
  };
  await writeStable(path, bytes);
  await writeStable(metadataPath, json(metadata));
  return { bytes, metadata };
}
