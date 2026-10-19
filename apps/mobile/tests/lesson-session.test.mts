import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { Chess } from 'chess.js';
import { linePositions } from '../src/chess/logic.ts';
import { advanceLesson, answerLesson, hintLesson, lessonDeck, lessonTrack, oppositeExercise, restoreLesson, sessionCard, sessionDone, sessionFen, startLesson } from '../src/features/lessons/lesson-session.ts';
import type { LessonDetail } from '../src/api/types.ts';
const lessons: LessonDetail[] = [...JSON.parse(readFileSync(new URL('../../../data/lessons.json', import.meta.url), 'utf8')), ...JSON.parse(readFileSync(new URL('../../../data/lesson-extensions.json', import.meta.url), 'utf8'))];
const rookLesson = lessons.find(item => item.slug === 'movimento-da-torre')!;

test('todas as aulas viram prática legal com recuperação sem ajuda e pergunta conceitual', () => {
  for (const lesson of lessons) for (const mode of ['guided', 'challenge'] as const) {
    const cards = lessonDeck(lesson, mode);
    assert.ok(cards.length >= 3, lesson.id);
    assert.ok(cards.some(card => card.kind === 'choice'), lesson.id);
    for (const card of cards) linePositions(card.moves, card.fen);
    assert.ok(cards.some(card => card.kind === 'move' && !card.assisted));
    let session = startLesson(cards, mode);
    for (let safety = 0; !sessionDone(session) && safety < 200; safety++) {
      const card = sessionCard(session, cards)!;
      const answer = card.kind === 'move' ? card.moves[session.ply]! : card.kind === 'square' ? card.square! : card.answer!;
      session = advanceLesson(answerLesson(session, card, answer), card);
    }
    assert.ok(sessionDone(session), lesson.id);
    assert.equal(session.mastered.length, cards.length);
    assert.equal(session.mistakes, 0);
  }
});
test('a trilha de iniciação contém apenas alfabetização enxadrística; defesa é treinada pela cor correta', () => {
  assert.equal(lessonTrack(lessons.find(item => item.slug === 'mapa-do-tabuleiro')!), 'start');
  const sicilian = lessons.find(item => item.slug === 'siciliana')!;
  assert.equal(lessonTrack(sicilian), 'improve');
  const first = lessonDeck(sicilian, 'challenge')[0]!;
  assert.equal(first.fen.split(' ')[1], 'b');
  assert.equal(first.moves[0], 'c7c5');
});
test('erro mantém a decisão, exige correção e reaparece no fim sem marcar domínio prematuro', () => {
  const cards = lessonDeck(rookLesson, 'challenge'); const card = cards[0]!;
  let state = startLesson(cards, 'challenge');
  state = answerLesson(state, card, 'd4h4');
  assert.equal(state.feedback?.kind, 'wrong');
  state = advanceLesson(state, card);
  assert.equal(state.cursor, 0); assert.equal(state.ply, 0);
  state = advanceLesson(answerLesson(state, card, card.moves[0]!), card);
  assert.equal(state.queue.at(-1), card.id);
  assert.equal(state.mastered.includes(card.id), false);
  assert.equal(state.mistakes, 1);
});
test('dica permite executar o lance sem botão continuar e preserva revisão posterior', () => {
  const cards = lessonDeck(rookLesson, 'challenge'); const card = cards[0]!;
  let state = hintLesson(startLesson(cards, 'challenge'), card);
  state = answerLesson(state, card, card.moves[0]!);
  assert.equal(state.feedback?.kind, 'correct');
  state = advanceLesson(state, card);
  assert.equal(state.hints, 1); assert.equal(state.queue.at(-1), card.id);
});
test('um lance de aluno aplica a resposta adversária só uma vez e bloqueia toques durante o feedback', () => {
  const lesson = lessons.find(item => item.slug === 'mate-em-dois')!;
  const cards = lessonDeck(lesson, 'challenge'); const card = cards[0]!;
  const state = answerLesson(startLesson(cards, 'challenge'), card, card.moves[0]!);
  assert.deepEqual(answerLesson(state, card, card.moves[0]!), state);
  const next = advanceLesson(state, card);
  assert.equal(next.ply, 2);
  assert.equal(sessionFen(next, card), linePositions(card.moves, card.fen).positions[2]);
});
test('retomada ignora arquivos corrompidos e não pula um lance que estava em animação', () => {
  const cards = lessonDeck(rookLesson, 'challenge');
  const start = startLesson(cards, 'challenge');
  for (const raw of ['null', '{', '{}', JSON.stringify({ ...start, ply: 99 }), JSON.stringify({ ...start, cursor: 99 }), JSON.stringify({ ...start, queue: ['missing'] })]) {
    assert.deepEqual(restoreLesson(raw, cards, 'challenge'), start);
  }
  const feedback = answerLesson(start, cards[0]!, cards[0]!.moves[0]!);
  assert.equal(restoreLesson(JSON.stringify(feedback), cards, 'challenge').feedback, null);
});
test('troca de cores preserva roque, promoção e en passant', () => {
  for (const slug of ['roque-com-seguranca', 'captura-en-passant', 'escolha-da-promocao']) {
    const card = lessonDeck(lessons.find(item => item.slug === slug)!, 'guided')[0]!;
    const flipped = oppositeExercise(card.fen, card.moves);
    const game = new Chess(flipped.fen);
    for (const move of flipped.moves) game.move({ from: move.slice(0, 2), to: move.slice(2, 4), promotion: move.slice(4) || undefined });
    assert.notEqual(flipped.fen, card.fen);
  }
});
