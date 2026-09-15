import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import { config } from 'dotenv';

const requireFromApi = createRequire(resolve('apps/api/package.json'));
const { PrismaClient } = requireFromApi('@prisma/client');
const { Chess } = requireFromApi('chess.js');

config({ path: resolve('apps/api/.env'), quiet: true });

const apiUrl = process.env.ZAV_API_URL || 'http://127.0.0.1:3001/api';
const db = new PrismaClient();
const email = `qa-${Date.now()}-${Math.random().toString(36).slice(2)}@zav.local`;
const password = `Qa-${randomUUID()}`;
let userId;
let token;

async function request(path, options = {}) {
  const response = await fetch(`${apiUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`${options.method || 'GET'} ${path}: HTTP ${response.status} ${JSON.stringify(body)}`);
  return body;
}

const post = (path, body) => request(path, { method: 'POST', body: JSON.stringify(body) });

try {
  const health = await request('/health');
  assert.deepEqual(health, { status: 'ok', database: 'connected' });

  const session = await post('/auth/register', { name: 'Verificação Zav', email, password });
  userId = session.user.id;
  token = session.token;

  const initialPlan = await request('/learning/plan');
  assert.equal(initialPlan.rating, session.user.rating);
  assert.ok(initialPlan.items.some(item => item.kind === 'lesson'));
  assert.ok(initialPlan.items.some(item => item.kind === 'puzzle'));
  assert.ok(initialPlan.items.some(item => item.kind === 'opening'));

  const lesson = await db.lesson.findFirstOrThrow({ orderBy: { sortOrder: 'asc' } });
  const quiz = lesson.quiz;
  const wrongAnswer = (quiz.answer + 1) % quiz.options.length;
  const wrongLessonId = randomUUID();
  const wrongLesson = await post(`/lessons/${lesson.id}/complete`, { answer: wrongAnswer, requestId: wrongLessonId });
  const repeatedWrongLesson = await post(`/lessons/${lesson.id}/complete`, { answer: wrongAnswer, requestId: wrongLessonId });
  assert.equal(wrongLesson.correct, false);
  assert.equal(repeatedWrongLesson.reviewId, wrongLesson.reviewId);

  await db.studyReview.update({ where: { id: wrongLesson.reviewId }, data: { dueAt: new Date(Date.now() - 60_000) } });
  const correctLessonId = randomUUID();
  const [correctLesson, repeatedCorrectLesson] = await Promise.all([
    post(`/lessons/${lesson.id}/complete`, { answer: quiz.answer, requestId: correctLessonId }),
    post(`/lessons/${lesson.id}/complete`, { answer: quiz.answer, requestId: correctLessonId }),
  ]);
  assert.equal(correctLesson.correct, true);
  assert.equal(repeatedCorrectLesson.reviewId, correctLesson.reviewId);
  assert.equal((await request('/auth/me')).xp, 25);
  assert.equal(await db.studyEvent.count({ where: { userId, requestId: correctLessonId } }), 1);

  const puzzleCandidates = await db.puzzle.findMany({ orderBy: [{ rating: 'asc' }, { id: 'asc' }], take: 60 });
  const puzzle = puzzleCandidates.find(candidate => {
    const game = new Chess(candidate.fen);
    const line = candidate.moves;
    game.move({ from: line[0].slice(0, 2), to: line[0].slice(2, 4), promotion: line[0][4] });
    return game.moves({ verbose: true }).some(move => move.lan !== line[1]);
  });
  assert.ok(puzzle, 'O catálogo precisa de um puzzle com pelo menos dois lances legais.');
  const solution = puzzle.moves.filter((_, index) => index % 2 === 1);
  const puzzleGame = new Chess(puzzle.fen);
  puzzleGame.move({ from: puzzle.moves[0].slice(0, 2), to: puzzle.moves[0].slice(2, 4), promotion: puzzle.moves[0][4] });
  const wrongMove = puzzleGame.moves({ verbose: true }).map(move => move.lan).find(move => move !== solution[0]);
  assert.ok(wrongMove);
  const practiceId = randomUUID();
  const wrongPuzzleId = randomUUID();
  const wrongPuzzle = await post(`/puzzles/${puzzle.id}/attempt`, { moves: [wrongMove], hintUsed: false, practiceId, requestId: wrongPuzzleId });
  const repeatedWrongPuzzle = await post(`/puzzles/${puzzle.id}/attempt`, { moves: [wrongMove], hintUsed: false, practiceId, requestId: wrongPuzzleId });
  assert.equal(wrongPuzzle.status, 'incorrect');
  assert.deepEqual(repeatedWrongPuzzle, wrongPuzzle);
  assert.equal((await db.puzzlePractice.findUniqueOrThrow({ where: { userId_puzzleId_practiceId: { userId, puzzleId: puzzle.id, practiceId } } })).mistakes, 1);

  const solvedPuzzle = await post(`/puzzles/${puzzle.id}/attempt`, { moves: solution, hintUsed: false, practiceId, requestId: randomUUID() });
  assert.equal(solvedPuzzle.status, 'solved');
  assert.equal(solvedPuzzle.xpEarned, 5);
  const cleanRepeat = await post(`/puzzles/${puzzle.id}/attempt`, { moves: solution, hintUsed: false, practiceId: randomUUID(), requestId: randomUUID() });
  assert.equal(cleanRepeat.status, 'solved');
  assert.equal(cleanRepeat.xpEarned, 0);

  const opening = await db.opening.findFirstOrThrow({ where: { name: 'Italian Game' }, orderBy: { id: 'asc' } });
  const openingMoves = opening.moves.filter((_, index) => index % 2 === 0);
  const openingRequestId = randomUUID();
  const openingResult = await post(`/learning/openings/${opening.id}/attempt`, { moves: openingMoves, side: 'w', hintUsed: false, mistakes: 0, requestId: openingRequestId });
  const repeatedOpening = await post(`/learning/openings/${opening.id}/attempt`, { moves: openingMoves, side: 'w', hintUsed: false, mistakes: 0, requestId: openingRequestId });
  assert.equal(openingResult.completed, true);
  assert.equal(repeatedOpening.reviewId, openingResult.reviewId);

  await db.studyReview.update({ where: { id: openingResult.reviewId }, data: { dueAt: new Date(Date.now() - 60_000) } });
  const duePlan = await request('/learning/plan');
  assert.ok(duePlan.dueCount >= 1);
  assert.ok(duePlan.items.some(item => item.kind === 'opening' && item.contentId === opening.id && item.side === 'w'));

  const report = await request('/learning/report');
  assert.ok(report.sessions >= 5);
  assert.equal(report.solvedPuzzles, 1);
  assert.equal(report.studiedOpenings, 1);
  assert.ok(report.daily.some(day => day.sessions >= 1));

  const najdorf = await db.opening.findFirstOrThrow({ where: { name: 'Sicilian Defense: Najdorf Variation' }, orderBy: { id: 'asc' } });
  const educationalOpening = await request(`/openings/${najdorf.id}`);
  assert.equal(educationalOpening.education.variationGuide.id, 'siciliana-najdorf');
  assert.equal(educationalOpening.education.variationGuide.reviewStatus, 'human-review-pending');
  const translatedSearch = await request('/opening-families?search=Defesa%20Siciliana&page=1&pageSize=10');
  assert.ok(translatedSearch.items.some(item => item.family === 'Sicilian Defense'));

  const moveAnalysis = await post('/analysis/move', { fen: new Chess().fen(), move: 'e2e4', depth: 8 });
  assert.equal(moveAnalysis.move, 'e2e4');
  assert.equal(moveAnalysis.perspective, 'w');
  assert.ok(['best', 'good', 'inaccuracy', 'mistake', 'blunder'].includes(moveAnalysis.classification));

  const endgame = await request('/endgame-training/generate?theme=rook&lesson=lucena');
  assert.equal(endgame.theme, 'rook');
  assert.equal(endgame.objective, 'win');
  assert.equal(endgame.source.kind, 'reference');
  const endgameTurn = await post('/endgame-training/move', { initialFen: endgame.fen, history: [], move: endgame.tablebase.bestMove });
  assert.equal(endgameTurn.history[0], endgame.tablebase.bestMove);
  assert.ok(['preserved', 'lost-win', 'lost-draw', 'uncertain'].includes(endgameTurn.feedback.code));

  console.log(JSON.stringify({
    ok: true,
    idempotentLessonEvents: 1,
    lessonXp: 25,
    puzzleSolved: true,
    openingReview: true,
    reportSessions: report.sessions,
    stockfishClassification: moveAnalysis.classification,
    endgame: endgame.title,
    endgameReply: endgameTurn.reply,
  }));
} finally {
  if (userId) await db.user.delete({ where: { id: userId } }).catch(() => undefined);
  await db.$disconnect();
}
