import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROOT, DATA, CHESS_VERSION, Chess, legalPosition, playUci, readJson, replay, sha256, parseCsvLine } from './lib.mjs';
import { parseOpenings } from './openings.mjs';
import { BANDS, puzzleFromCsv } from './puzzles.mjs';
import { ENDGAME_SEEDS } from './endgames.mjs';
import { buildLessons } from './lessons.mjs';
import { buildAdvancedLessons } from './advanced-lessons.mjs';

export function exactFields(value, keys) {
  assert.deepEqual(Object.keys(value).sort(), [...keys].sort(), 'Campos divergentes do contrato');
}
export function validatePuzzle(puzzle) {
  exactFields(puzzle, ['id', 'rating', 'themes', 'fen', 'moves', 'sourceUrl']);
  assert.ok(Number.isInteger(puzzle.rating) && puzzle.rating >= 400);
  assert.ok(Array.isArray(puzzle.themes) && puzzle.themes.length > 0);
  assert.equal(new Set(puzzle.themes).size, puzzle.themes.length);
  for (const theme of puzzle.themes) assert.match(theme, /^[A-Za-z][A-Za-z0-9]*$/);
  assert.ok(puzzle.moves.length >= 2 && puzzle.moves.length % 2 === 0, 'Linha deve incluir preparação e terminar no aluno');
  assert.equal(puzzle.sourceUrl, `https://lichess.org/training/${puzzle.id}`);
  const game = replay(puzzle.fen, puzzle.moves);
  if (puzzle.themes.includes('mate')) assert.ok(game.isCheckmate(), `Linha de mate não termina em mate: ${puzzle.id}`);
  const presented = new Chess(puzzle.fen);
  const opponentColor = presented.turn();
  playUci(presented, puzzle.moves[0]);
  assert.notEqual(presented.turn(), opponentColor);
  assert.ok(presented.moves().length > 0, 'Aluno precisa ter um lance legal');
}

export async function validateData() {
  const content = {};
  for (const name of ['openings', 'puzzles', 'lessons', 'endgames']) {
    content[name] = await readJson(resolve(DATA, `${name}.json`));
    assert.ok(Array.isArray(content[name]), `${name} deve ser um array`);
    assert.equal(new Set(content[name].map((row) => row.id)).size, content[name].length, `IDs duplicados em ${name}`);
  }
  const { openings, puzzles, lessons, endgames } = content;
  const sources = await readJson(resolve(DATA, 'sources.json'));
  exactFields(sources, ['schemaVersion', 'generator', 'hashAlgorithm', 'validation', 'openings', 'puzzles', 'endgames', 'lessons', 'stockfish', 'artifacts']);
  assert.equal(sources.schemaVersion, 1);
  assert.equal(sources.generator, 'scripts/content/import.mjs');
  assert.equal(sources.hashAlgorithm, 'SHA-256');
  assert.equal(sources.validation.library, 'chess.js');
  assert.equal(sources.validation.version, CHESS_VERSION);
  assert.equal(sources.validation.scope, 'Legalidade de posições e lances; não avalia a qualidade editorial nem a melhor jogada.');
  assert.deepEqual(sources.artifacts.map((artifact) => artifact.file).sort(),
    ['data/endgames.json', 'data/lessons.json', 'data/openings.json', 'data/puzzles.json']);
  for (const artifact of sources.artifacts) {
    exactFields(artifact, ['file', 'count', 'bytes', 'sha256']);
    const bytes = await readFile(resolve(ROOT, artifact.file));
    assert.equal(sha256(bytes), artifact.sha256);
    assert.equal(bytes.length, artifact.bytes);
    assert.equal(JSON.parse(bytes).length, artifact.count);
  }
  const downloads = [...sources.openings.sources, sources.puzzles, ...sources.endgames.evidence.map((e) => e.source)];
  assert.equal(new Set(downloads.map((metadata) => metadata.file)).size, downloads.length, 'Fontes repetidas em sources.json');
  for (const metadata of downloads) {
    const downloadedAt = Date.parse(metadata.downloadedAt);
    const completedAt = Date.parse(metadata.completedAt);
    assert.ok(Number.isFinite(downloadedAt) && Number.isFinite(completedAt));
    assert.ok(completedAt >= downloadedAt, `Timestamp final anterior ao inicial: ${metadata.file}`);
    assert.match(metadata.file, /^data\/upstream\//);
    assert.match(metadata.url, /^https:\/\//);
    assert.match(metadata.resolvedUrl, /^https:\/\//);
    assert.ok(Number.isInteger(metadata.status) && metadata.status >= 200 && metadata.status < 300);
    assert.match(metadata.sha256, /^[a-f0-9]{64}$/);
    assert.ok(Number.isInteger(metadata.bytes) && metadata.bytes > 0);
    const bytes = await readFile(resolve(ROOT, metadata.file));
    assert.equal(sha256(bytes), metadata.sha256, metadata.file);
    assert.equal(bytes.length, metadata.bytes);
  }
  assert.equal(sources.openings.license, 'CC0-1.0');
  assert.match(sources.openings.licenseUrl, new RegExp(`/${sources.openings.revision}/COPYING\\.txt$`));
  assert.equal(sources.openings.sources.length, 7, 'Esperados commit, licença e cinco volumes de aberturas');
  const commitSource = sources.openings.sources.find((source) => source.file === 'data/upstream/openings-commit.json');
  assert.equal((await readJson(resolve(ROOT, commitSource.file))).sha, sources.openings.revision);
  const licenseSource = sources.openings.sources.find((source) => source.file === 'data/upstream/openings-CC0.txt');
  assert.ok(licenseSource, 'Licença CC0 das aberturas ausente');
  const originalOpenings = [];
  for (const volume of 'abcde') {
    const source = sources.openings.sources.find((s) => s.file === `data/upstream/${volume}.tsv`);
    assert.ok(source.url.includes(sources.openings.revision));
    const rows = parseOpenings(await readFile(resolve(ROOT, source.file)), `https://github.com/lichess-org/chess-openings/blob/${sources.openings.revision}/${volume}.tsv`);
    assert.equal(rows.length, sources.openings.counts[volume]);
    originalOpenings.push(...rows);
  }
  assert.deepEqual(openings, originalOpenings, 'Catálogo precisa preservar todas as linhas dos cinco TSVs');
  for (const opening of openings) exactFields(opening, ['id', 'eco', 'name', 'family', 'pgn', 'fen', 'moves', 'sourceUrl']);

  const [headerLine, ...rawPuzzles] = (await readFile(resolve(ROOT, sources.puzzles.file), 'utf8')).trimEnd().split(/\r?\n/);
  const header = parseCsvLine(headerLine);
  assert.equal(sources.puzzles.license, 'CC0-1.0');
  assert.equal(sources.puzzles.status, 206, 'A proveniência dos puzzles não comprova HTTP Range');
  assert.equal(Number(sources.puzzles.contentLength), sources.puzzles.sampling.maxCompressedBytes);
  assert.match(sources.puzzles.contentRange ?? '', new RegExp(`^bytes 0-${sources.puzzles.sampling.maxCompressedBytes - 1}\\/\\d+$`));
  assert.deepEqual(puzzles, rawPuzzles.map((line) => puzzleFromCsv(header, line)), 'FEN e lances devem ser idênticos à fonte RAW');
  assert.equal(puzzles.length, 3000);
  for (const puzzle of puzzles) validatePuzzle(puzzle);
  const bands = BANDS.map((band) => {
    const count = puzzles.filter((p) => p.rating >= band.min && p.rating <= band.max).length;
    assert.equal(count, band.count);
    return { ...band, count };
  });
  const themes = {};
  for (const puzzle of puzzles) for (const theme of puzzle.themes) themes[theme] = (themes[theme] ?? 0) + 1;
  assert.ok(Object.keys(themes).length >= 35, 'Diversidade mínima de 35 temas não atingida');
  const sampling = sources.puzzles.sampling;
  assert.equal(sampling.scannedRows, 75000);
  assert.equal(sampling.stopReason, 'row-limit');
  assert.deepEqual(sampling.bands.map(({ eligibleInPrefix, ...band }) => band), BANDS);
  for (const band of sampling.bands) assert.ok(band.eligibleInPrefix >= band.count);
  assert.match(sampling.compressedPrefixSha256, /^[a-f0-9]{64}$/);
  assert.match(sampling.scannedRowsSha256, /^[a-f0-9]{64}$/);
  assert.ok(sampling.compressedBytes <= sampling.maxCompressedBytes);
  assert.ok(sampling.decompressedBytes <= sampling.maxDecompressedBytes);

  assert.ok(endgames.length >= 12);
  assert.deepEqual(endgames, ENDGAME_SEEDS);
  assert.equal(sources.endgames.evidence.length, endgames.length);
  assert.deepEqual(sources.endgames.evidence.map((evidence) => evidence.id).sort(), endgames.map((endgame) => endgame.id).sort());
  assert.equal(new Set(sources.endgames.evidence.map((evidence) => evidence.id)).size, endgames.length);
  const endgameResults = {};
  for (const endgame of endgames) {
    exactFields(endgame, ['id', 'slug', 'title', 'description', 'fen', 'goal', 'level', 'side', 'tips']);
    const game = legalPosition(endgame.fen);
    assert.equal(endgame.side, game.turn());
    assert.ok(!game.isGameOver());
    assert.ok(game.board().flat().filter(Boolean).length <= 7);
    const evidence = sources.endgames.evidence.find((e) => e.id === endgame.id);
    assert.ok(evidence.source.license.startsWith('Tablebase facts'));
    assert.equal(evidence.source.licenseUrl, 'https://github.com/syzygy1/tb#terms-of-use');
    assert.equal(evidence.fenSha256, sha256(endgame.fen));
    assert.equal(new URL(evidence.source.url).searchParams.get('fen'), endgame.fen);
    const probe = await readJson(resolve(ROOT, evidence.source.file));
    assert.equal(evidence.category, probe.category);
    assert.deepEqual(probe.moves.map((m) => m.uci).sort(), game.moves({ verbose: true }).map((m) => `${m.from}${m.to}${m.promotion ?? ''}`).sort());
    for (const move of probe.moves) assert.equal(playUci(new Chess(endgame.fen), move.uci).san, move.san);
    if (['bispo-peao-torre', 'peao-torre-canto'].includes(endgame.slug)) assert.equal(probe.category, 'draw');
    if (/Dar .*mate|dar mate|vencer o final|Promover o peão mantendo|Promover e converter/.test(endgame.goal)) assert.equal(probe.category, 'win');
    endgameResults[endgame.slug] = probe.category;
  }
  assert.ok(lessons.length >= 50);
  const generatedLessons = buildLessons(openings, puzzles, endgames);
  assert.deepEqual(lessons, generatedLessons.lessons);
  const { editorialFiles, ...lessonProvenance } = sources.lessons;
  assert.deepEqual(lessonProvenance, generatedLessons.provenance, 'Proveniência editorial das aulas divergente');
  assert.equal(new Set(sources.lessons.origins.map((origin) => origin.id)).size, lessons.length);
  assert.deepEqual(sources.lessons.origins.map((origin) => origin.id).sort(), lessons.map((lesson) => lesson.id).sort());
  const categories = {};
  let lessonLines = 0;
  for (const [index, lesson] of lessons.entries()) {
    exactFields(lesson, ['id', 'slug', 'title', 'category', 'level', 'description', 'sortOrder', 'minutes', 'steps', 'quiz']);
    assert.ok(['fundamentals', 'tactics', 'openings', 'endgames'].includes(lesson.category));
    assert.ok(['beginner', 'intermediate', 'advanced'].includes(lesson.level));
    assert.equal(lesson.sortOrder, index + 1);
    assert.ok(Number.isInteger(lesson.minutes) && lesson.minutes > 0);
    assert.ok(lesson.description.length > 20);
    assert.ok(lesson.steps.length >= 2);
    for (const step of lesson.steps) {
      assert.ok(step.title.length > 0 && step.text.length > 30);
      assert.ok(Object.keys(step).every((key) => ['title', 'text', 'fen', 'moves'].includes(key)));
      if (step.fen) legalPosition(step.fen);
      if (step.moves) { assert.ok(step.fen); replay(step.fen, step.moves); lessonLines++; }
    }
    exactFields(lesson.quiz, ['question', 'options', 'answer', 'explanation']);
    assert.ok(lesson.quiz.question.length > 10 && lesson.quiz.explanation.length > 20);
    assert.ok(lesson.quiz.options.length >= 3 && lesson.quiz.options.every((option) => typeof option === 'string' && option.length > 0));
    assert.equal(new Set(lesson.quiz.options).size, lesson.quiz.options.length);
    assert.ok(Number.isInteger(lesson.quiz.answer) && lesson.quiz.answer >= 0 && lesson.quiz.answer < lesson.quiz.options.length);
    categories[lesson.category] = (categories[lesson.category] ?? 0) + 1;
  }
  assert.deepEqual(editorialFiles.map((file) => file.file).sort(), ['scripts/content/endgames.mjs', 'scripts/content/lessons.mjs']);
  for (const file of editorialFiles) assert.equal(sha256(await readFile(resolve(ROOT, file.file))), file.sha256);
  const extensions = await readJson(resolve(DATA, 'lesson-extensions.json'));
  assert.deepEqual(extensions, buildAdvancedLessons(puzzles), 'Extensões precisam ser reproduzíveis a partir do acervo atribuído');
  assert.equal(new Set([...lessons, ...extensions].map(lesson => lesson.id)).size, lessons.length + extensions.length);
  for (const lesson of extensions) {
    categories[lesson.category] = (categories[lesson.category] ?? 0) + 1;
    assert.ok(lesson.steps.filter(step => step.moves?.length).length > 0, lesson.id);
    for (const step of lesson.steps) if (step.moves) { replay(step.fen, step.moves); lessonLines++; }
    assert.equal(new Set(lesson.quiz.options).size, 4);
    assert.ok(lesson.quiz.options[lesson.quiz.answer]);
  }
  assert.equal(sources.stockfish.sourceUrl, 'https://stockfishchess.org/');
  assert.equal(sources.stockfish.license, 'GPL-3.0');
  assert.equal(sources.stockfish.localEngineExecuted, false);
  assert.equal(sources.stockfish.textValidatedByEngine, false);
  assert.equal(sources.stockfish.downloadTimestamp, null);
  assert.equal(sources.stockfish.hash, null);
  const report = {
    openings: openings.length, openingMoves: openings.reduce((sum, o) => sum + o.moves.length, 0),
    puzzles: puzzles.length, puzzleMoves: puzzles.reduce((sum, p) => sum + p.moves.length, 0),
    ratingMin: Math.min(...puzzles.map((p) => p.rating)), ratingMax: Math.max(...puzzles.map((p) => p.rating)),
    bands, themeCount: Object.keys(themes).length, themes,
    lessons: lessons.length + extensions.length, baseLessons: lessons.length, extensionLessons: extensions.length, categories, lessonLines, endgames: endgames.length, endgameResults,
    compressedBytes: sampling.compressedBytes, scannedRows: sampling.scannedRows,
  };
  return report;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(await validateData(), null, 2));
}
