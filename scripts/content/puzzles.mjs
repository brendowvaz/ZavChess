import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Readable, Transform } from 'node:stream';
import { createInterface } from 'node:readline';
import { createZstdDecompress } from 'node:zlib';
import { UPSTREAM, fetchOfficial, httpMetadata, json, parseCsvLine, readJson, replay, sha256, writeStable } from './lib.mjs';

export const PUZZLE_URL = 'https://database.lichess.org/lichess_db_puzzle.csv.zst';
export const SAMPLE_SEED = 'zav-chess-content-v1';
export const MAX_ROWS = 75_000;
export const MAX_COMPRESSED_BYTES = 8 * 1024 * 1024;
export const MAX_DECOMPRESSED_BYTES = 32 * 1024 * 1024;
export const BANDS = [
  { level: 'beginner', min: 400, max: 899, count: 500 },
  { level: 'beginner', min: 900, max: 1399, count: 500 },
  { level: 'intermediate', min: 1400, max: 1699, count: 500 },
  { level: 'intermediate', min: 1700, max: 1999, count: 500 },
  { level: 'advanced', min: 2000, max: 2399, count: 500 },
  { level: 'advanced', min: 2400, max: 3200, count: 500 },
];

// pzstd prepends a standard Zstandard skippable metadata frame. Node 24's
// decoder can finish at that frame without decoding the following data frame.
// Strip ONLY leading skippable frames; never scan arbitrary compressed bytes.
export function skipLeadingZstdMetadata() {
  let pending = Buffer.alloc(0);
  let started = false;
  return new Transform({ transform(chunk, encoding, done) {
    if (started) return done(null, chunk);
    pending = Buffer.concat([pending, chunk]);
    while (pending.length >= 8) {
      const magic = pending.readUInt32LE(0);
      if (magic < 0x184d2a50 || magic > 0x184d2a5f) {
        if (magic !== 0xfd2fb528) return done(new Error('Cabeçalho Zstandard inválido'));
        started = true;
        const data = pending;
        pending = Buffer.alloc(0);
        return done(null, data);
      }
      const size = pending.readUInt32LE(4);
      if (size > 1024 * 1024) return done(new Error('Metadados Zstandard excessivos'));
      if (pending.length < 8 + size) break;
      pending = pending.subarray(8 + size);
    }
    done();
  }, flush(done) {
    done(started ? undefined : new Error('Nenhum frame de dados Zstandard recebido'));
  } });
}

export function puzzleFromCsv(header, line) {
  const values = parseCsvLine(line);
  assert.equal(values.length, header.length, 'Quantidade de colunas do puzzle divergente');
  const row = Object.fromEntries(header.map((key, index) => [key, values[index]]));
  for (const key of ['PuzzleId', 'FEN', 'Moves', 'Rating', 'Themes']) assert.ok(row[key], `Campo ausente: ${key}`);
  assert.match(row.PuzzleId, /^[A-Za-z0-9]+$/);
  assert.match(row.Rating, /^\d+$/);
  return {
    id: row.PuzzleId, rating: Number(row.Rating), themes: row.Themes.split(' '),
    // Preserve the official FEN byte for byte, BEFORE the opponent's first move.
    fen: row.FEN, moves: row.Moves.split(' '), sourceUrl: `https://lichess.org/training/${row.PuzzleId}`,
  };
}

// Sorted, bounded reservoir: smallest deterministic SHA-256 priorities per band.
// Insertions are O(log quota) comparisons and O(quota) shifts, with quota = 500.
export function offerCandidate(bucket, candidate, capacity) {
  if (bucket.length === capacity && candidate.key >= bucket.at(-1).key) return;
  let low = 0;
  let high = bucket.length;
  while (low < high) {
    const mid = (low + high) >>> 1;
    if (bucket[mid].key < candidate.key) low = mid + 1;
    else high = mid;
  }
  bucket.splice(low, 0, candidate);
  if (bucket.length > capacity) bucket.pop();
}

async function downloadSample() {
  const downloadedAt = new Date().toISOString();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new Error('Tempo limite de 60 segundos no dump')), 60_000);
  const compressedHash = createHash('sha256');
  const scannedHash = createHash('sha256');
  let compressedBytes = 0;
  let decompressedBytes = 0;
  let scannedRows = 0;
  let stopReason = 'eof';
  let headerLine;
  let header;
  let failure;
  const buckets = BANDS.map(() => []);
  const eligibleCounts = BANDS.map(() => 0);
  const seen = new Set();
  let response, input, counter, metadataStripper, decoder, outputCounter, lines;
  try {
    response = await fetchOfficial(PUZZLE_URL, {
      headers: { Range: `bytes=0-${MAX_COMPRESSED_BYTES - 1}`, 'Accept-Encoding': 'identity' },
      signal: controller.signal,
    });
    assert.equal(response.status, 206, 'Servidor ignorou o HTTP Range; download interrompido para manter o limite');
    assert.equal(Number(response.headers.get('content-length')), MAX_COMPRESSED_BYTES, 'Tamanho do Range divergente');
    assert.match(
      response.headers.get('content-range') ?? '',
      new RegExp(`^bytes 0-${MAX_COMPRESSED_BYTES - 1}\\/\\d+$`),
      'Content-Range divergente',
    );
    input = Readable.fromWeb(response.body);
    counter = new Transform({ transform(chunk, encoding, done) {
      if (compressedBytes + chunk.length > MAX_COMPRESSED_BYTES) return done(new Error('Limite de bytes comprimidos atingido antes da amostra'));
      compressedBytes += chunk.length;
      compressedHash.update(chunk);
      done(null, chunk);
    } });
    metadataStripper = skipLeadingZstdMetadata();
    decoder = createZstdDecompress();
    outputCounter = new Transform({ transform(chunk, encoding, done) {
      decompressedBytes += chunk.length;
      if (decompressedBytes > MAX_DECOMPRESSED_BYTES) return done(new Error('Limite de descompressão excedido'));
      done(null, chunk);
    } });
    lines = createInterface({ input: outputCounter, crlfDelay: Infinity });
    // Destroy all stages on errors, so a failed upstream cannot leave readline waiting.
    for (const stream of [input, counter, metadataStripper, decoder, outputCounter]) {
      stream.on('error', (error) => {
        failure ??= error;
        lines.close();
        for (const other of [input, counter, metadataStripper, decoder, outputCounter]) if (other !== stream) other.destroy();
      });
    }
    input.pipe(counter).pipe(metadataStripper).pipe(decoder).pipe(outputCounter);
    for await (const line of lines) {
      assert.ok(line.length <= 16_384, 'Linha CSV excessivamente longa');
      if (!header) {
        headerLine = line;
        header = parseCsvLine(line);
        for (const field of ['PuzzleId', 'FEN', 'Moves', 'Rating', 'Themes']) assert.ok(header.includes(field));
        continue;
      }
      if (!line) continue;
      scannedRows++;
      scannedHash.update(`${line}\n`);
      const puzzle = puzzleFromCsv(header, line);
      assert.ok(!seen.has(puzzle.id), `Puzzle duplicado no prefixo: ${puzzle.id}`);
      seen.add(puzzle.id);
      const index = BANDS.findIndex((band) => puzzle.rating >= band.min && puzzle.rating <= band.max);
      if (index !== -1) {
        eligibleCounts[index]++;
        offerCandidate(buckets[index], { key: sha256(`${SAMPLE_SEED}:${puzzle.id}`), line, puzzle }, BANDS[index].count);
      }
      if (scannedRows === MAX_ROWS) { stopReason = 'row-limit'; break; }
    }
    if (failure) throw failure;
    assert.equal(scannedRows, MAX_ROWS, 'Dump terminou antes do prefixo configurado; nenhuma amostra parcial será publicada');
  } finally {
    lines?.close();
    for (const stream of [input, counter, metadataStripper, decoder, outputCounter]) stream?.destroy();
    controller.abort();
    clearTimeout(timeout);
  }
  for (const [index, bucket] of buckets.entries()) assert.equal(bucket.length, BANDS[index].count, `Amostra insuficiente na faixa ${index}`);
  const selected = buckets.flat().sort((a, b) => a.puzzle.id < b.puzzle.id ? -1 : 1);
  for (const { puzzle } of selected) replay(puzzle.fen, puzzle.moves);
  const bytes = Buffer.from(`${headerLine}\n${selected.map((item) => item.line).join('\n')}\n`);
  const metadata = {
    file: 'data/upstream/puzzles-sample.csv', url: PUZZLE_URL,
    license: 'CC0-1.0', licenseUrl: 'https://database.lichess.org/#puzzles',
    downloadedAt, completedAt: new Date().toISOString(), ...httpMetadata(response),
    bytes: bytes.length, sha256: sha256(bytes), hashScope: 'selected-original-csv-rows-with-header-LF',
    sampling: {
      method: 'smallest-sha256-priority-per-rating-band-from-bounded-prefix', seed: SAMPLE_SEED,
      maxRows: MAX_ROWS, scannedRows, maxCompressedBytes: MAX_COMPRESSED_BYTES, compressedBytes,
      maxDecompressedBytes: MAX_DECOMPRESSED_BYTES, decompressedBytes, stopReason,
      compressedPrefixSha256: compressedHash.digest('hex'),
      compressedHashScope: 'bytes-consumed-by-counter-before-abort; NOT the full dump',
      scannedRowsSha256: scannedHash.digest('hex'), scannedHashScope: 'first-75000-data-rows-normalized-LF-no-header',
      bands: BANDS.map((band, index) => ({ ...band, eligibleInPrefix: eligibleCounts[index] })),
      limitations: 'Amostra estratificada de um prefixo, sem representatividade global. Sem cotas por tema. O prefixo comprimido não é arquivado; preservamos as linhas selecionadas.',
    },
  };
  await writeStable(resolve(UPSTREAM, 'puzzles-sample.csv'), bytes);
  await writeStable(resolve(UPSTREAM, 'puzzles-sample.csv.meta.json'), json(metadata));
  return { bytes, metadata };
}

export async function importPuzzles({ refresh = false, offline = false } = {}) {
  let cached;
  if (!refresh) {
    try {
      const bytes = await readFile(resolve(UPSTREAM, 'puzzles-sample.csv'));
      const metadata = await readJson(resolve(UPSTREAM, 'puzzles-sample.csv.meta.json'));
      assert.equal(sha256(bytes), metadata.sha256, 'Hash da amostra divergente');
      assert.equal(metadata.url, PUZZLE_URL);
      assert.equal(metadata.sampling.seed, SAMPLE_SEED);
      assert.equal(metadata.sampling.maxRows, MAX_ROWS);
      assert.equal(metadata.status, 206, 'Cache não comprova resposta HTTP Range');
      assert.equal(Number(metadata.contentLength), MAX_COMPRESSED_BYTES, 'Cache tem Content-Length divergente');
      assert.match(metadata.contentRange ?? '', new RegExp(`^bytes 0-${MAX_COMPRESSED_BYTES - 1}\\/\\d+$`));
      assert.deepEqual(metadata.sampling.bands.map(({ eligibleInPrefix, ...band }) => band), BANDS);
      for (const band of metadata.sampling.bands) assert.ok(band.eligibleInPrefix >= band.count);
      cached = { bytes, metadata };
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  if (!cached) {
    assert.ok(!offline, 'Amostra de puzzles ausente em modo offline');
    cached = await downloadSample();
  }
  const [first, ...lines] = cached.bytes.toString('utf8').trimEnd().split(/\r?\n/);
  const header = parseCsvLine(first);
  const puzzles = lines.map((line) => puzzleFromCsv(header, line));
  assert.equal(puzzles.length, 3000);
  for (const puzzle of puzzles) replay(puzzle.fen, puzzle.moves);
  console.log(`Puzzles reais: ${puzzles.length}; prefixo examinado: ${cached.metadata.sampling.scannedRows} linhas`);
  return { puzzles, provenance: cached.metadata };
}
