import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { linePositions } from '../src/chess/logic.ts';
import { lessonBoardExercises } from '../src/features/lessons/board-exercises.ts';

type LessonFile = { id: string; steps: { title: string; text: string; fen?: string; moves?: string[] }[] }[];
const lessonsPath = fileURLToPath(new URL('../../../data/lessons.json', import.meta.url));
const lessons = [...JSON.parse(readFileSync(lessonsPath, 'utf8')), ...JSON.parse(readFileSync(new URL('../../../data/lesson-extensions.json', import.meta.url), 'utf8'))] as LessonFile;

test('todas as aulas têm ao menos uma prática do aluno no tabuleiro', () => {
  for (const lesson of lessons) {
    const editorial = lesson.steps.some(step => step.moves?.length && !/lance adversário|último lance adversário/i.test(`${step.title} ${step.text}`));
    assert.ok(editorial || lessonBoardExercises[lesson.id], `${lesson.id} ficou sem exercício de tabuleiro`);
  }
});

test('exercícios complementares contêm somente sequências legais', () => {
  for (const [id, exercise] of Object.entries(lessonBoardExercises)) {
    const line = linePositions(exercise.moves, exercise.fen);
    assert.equal(line.positions.length, exercise.moves.length + 1, id);
    assert.equal(line.sans.length, exercise.moves.length, id);
  }
});
