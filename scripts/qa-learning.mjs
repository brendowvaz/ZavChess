import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { lessonDeck, startLesson, sessionCard, sessionDone, answerLesson, advanceLesson } from '../apps/mobile/src/features/lessons/lesson-session.ts';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const require = createRequire(resolve(root, 'apps/api/package.json'));
require('dotenv').config({ path: resolve(root, 'apps/api/.env'), quiet: true });
const { PrismaClient } = require('@prisma/client');
const { Chess } = require('chess.js');
const db = new PrismaClient();
const base = process.env.QA_API_URL ?? 'http://127.0.0.1:3001/api';
const users = []; const groups = []; const report = {};
const uiCleanupEmail = process.argv[2];
if (uiCleanupEmail) assert.match(uiCleanupEmail, /^qa-ui-\d+@example\.invalid$/);
async function call(path, body, token, expected = 200) {
  const response = await fetch(`${base}${path}`, { method: body === undefined ? 'GET' : 'POST', signal: AbortSignal.timeout(60000),
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const payload = await response.json();
  assert.equal(response.status, expected, `${path}: ${response.status} ${JSON.stringify(payload.message ?? '')}`);
  return payload;
}
try {
  assert.equal((await call('/health')).database, 'connected');
  const lessons = await call('/lessons'); let decisions = 0; let examples = 0;
  for (const summary of lessons) {
    const lesson = await call(`/lessons/${summary.id}`);
    const cards = lessonDeck(lesson, lesson.category === 'fundamentals' ? 'guided' : 'challenge');
    assert.ok(cards.some(card => card.kind === 'choice'), `${lesson.id}: pergunta ausente`);
    examples += lesson.challenges?.length ?? 0;
    for (const card of cards) {
      const game = new Chess(card.fen);
      for (const move of card.moves) game.move({ from: move.slice(0, 2), to: move.slice(2, 4), promotion: move[4] });
    }
    let state = startLesson(cards, 'challenge');
    for (let count = 0; !sessionDone(state) && count < 1000; count++) {
      const card = sessionCard(state, cards); assert.ok(card);
      state = advanceLesson(answerLesson(state, card, card.kind === 'choice' ? card.answer : card.kind === 'square' ? card.square : card.moves[state.ply]), card);
      decisions++;
    }
    assert.ok(sessionDone(state), lesson.id);
  }
  report.lessons = { count: lessons.length, decisions, complementaryPositions: examples };
  const password = `Qa-${randomUUID()}!`;
  for (let i = 0; i < 2; i++) {
    const session = await call('/auth/register', { name: `QA Zav ${i + 1}`, email: `qa-${randomUUID()}@example.invalid`, password }, undefined, 201);
    users.push(session);
  }
  const [first, second] = users;
  const requestId = randomUUID();
  const body = { mistakes: 0, hintUsed: false, requestId };
  const completed = await call(`/lessons/${lessons[0].id}/board-complete`, body, first.token, 201);
  const retry = await call(`/lessons/${lessons[0].id}/board-complete`, body, first.token, 201);
  assert.deepEqual(retry, completed); assert.equal((await call('/auth/me', undefined, first.token)).xp, 25);
  report.lessonSave = 'idempotent';
  const selection = await call('/puzzles?minRating=800&maxRating=1000&pageSize=1'); const puzzle = selection.items[0]; assert.ok(puzzle);
  const solution = await call(`/puzzles/${puzzle.id}/solution`);
  const ownMoves = solution.moves.filter((_, i) => i % 2 === 0);
  assert.equal((await call(`/puzzles/${puzzle.id}/check`, { moves: ownMoves, hintUsed: false }, undefined, 201)).status, 'solved');
  const clean = await call(`/puzzles/${puzzle.id}/attempt`, { moves: ownMoves, hintUsed: false, requestId: randomUUID(), practiceId: randomUUID() }, first.token, 201);
  const assisted = await call(`/puzzles/${puzzle.id}/attempt`, { moves: ownMoves, hintUsed: true, requestId: randomUUID(), practiceId: randomUUID() }, second.token, 201);
  assert.equal(clean.xpEarned, assisted.xpEarned);
  assert.equal((await call('/auth/me', undefined, first.token)).rating, (await call('/auth/me', undefined, second.token)).rating);
  report.puzzles = 'guest validation, solution and neutral hints';
  const group = await call('/community/groups', { name: 'QA temporário' }, first.token, 201); groups.push(group.id);
  await call(`/community/groups/${group.id}`, undefined, second.token, 404);
  await call('/community/join', { inviteCode: group.inviteCode }, second.token, 201);
  const board = await call(`/community/groups/${group.id}`, undefined, second.token);
  assert.equal(board.leaderboard.length, 2); assert.ok(board.leaderboard.every(member => !Object.hasOwn(member, 'email')));
  await call(`/community/groups/${group.id}/leave`, {}, second.token, 201);
  await call(`/community/groups/${group.id}`, undefined, second.token, 404);
  report.groups = 'membership, invitation, leaderboard and privacy';
  const moves = ['e2e4', 'e7e5', 'f1c4', 'b8c6', 'd1h5', 'g8f6', 'h5f7'];
  const fixture = await db.openingGameImport.create({ data: { userId: first.user.id, platform: 'lichess', username: 'qa-zav', gameExternalId: `qa-${randomUUID()}`,
    color: 'w', summary: 'Partida composta para teste automatizado.', initialFen: new Chess().fen(), moves, opponent: 'QA', result: 'win', speed: 'blitz' } });
  await call(`/learning/games/${fixture.id}`, undefined, second.token, 404);
  assert.equal((await call(`/learning/games/${fixture.id}`, undefined, first.token)).moves.length, moves.length);
  const reviewed = await call(`/learning/games/${fixture.id}/review`, { ply: 6 }, first.token, 201);
  assert.equal(reviewed.classification, 'best');
  assert.deepEqual(await call(`/learning/games/${fixture.id}/review`, { ply: 6 }, first.token, 201), reviewed);
  report.games = 'full replay, ownership and cached checkmate review';
  const analysis = await call('/analysis', { fen: new Chess().fen(), depth: 10, multipv: 3 }, undefined, 201);
  assert.equal(analysis.variations.length, 3);
  for (const candidate of analysis.variations) { const board = new Chess(analysis.fen); for (const move of candidate.pv) board.move({ from: move.slice(0, 2), to: move.slice(2, 4), promotion: move[4] }); }
  report.analysis = 'three legal candidate lines';
  const dashboard = await call('/dashboard', undefined, first.token);
  assert.ok(dashboard.activeDates.length); assert.equal(dashboard.completedLessons, 1);
  const repertoires = await call('/learning/repertoires', undefined, first.token);
  assert.ok(repertoires.every(course => typeof course.rank === 'string' && course.maxPoints === course.positionCount * 10));
  report.progress = 'calendar, weekly activity and mastery contracts';
  const plan = await call('/learning/plan?track=improve', undefined, first.token);
  const recommendation = plan.items.find(item => item.kind === 'lesson' && !item.dueAt);
  assert.ok(recommendation && lessons.find(lesson => lesson.id === recommendation.contentId)?.category !== 'fundamentals');
  console.log(JSON.stringify({ ok: true, ...report }, null, 2));
} finally {
  // Exact IDs created by this run only. User accounts and history are untouched.
  if (groups.length) await db.studyGroup.deleteMany({ where: { id: { in: groups } } });
  if (users.length) await db.user.deleteMany({ where: { id: { in: users.map(session => session.user.id) } } });
  if (uiCleanupEmail) {
    const uiUser = await db.user.findUnique({ where: { email: uiCleanupEmail } });
    if (uiUser) {
      assert.equal(uiUser.name, 'QA Interface Zav', 'Conta fora do escopo do teste de interface');
      await db.user.delete({ where: { id: uiUser.id } });
    }
  }
  await db.$disconnect();
}
