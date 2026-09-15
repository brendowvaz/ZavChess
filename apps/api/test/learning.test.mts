import test from 'node:test';
import assert from 'node:assert/strict';
import { nextReview, studyDate, trainingBand } from '../src/learning/schedule.ts';

test('review intervals grow only when due and recover after mistakes', () => {
  const now = new Date('2026-09-10T15:00:00Z');
  const first = nextReview(null, 'good', now);
  assert.equal(first.dueAt.toISOString(), '2026-09-11T15:00:00.000Z');
  assert.deepEqual(nextReview(first, 'good', now), first);
  const second = nextReview(first, 'good', first.dueAt);
  assert.equal(second.dueAt.toISOString(), '2026-09-14T15:00:00.000Z');
  const failed = nextReview(second, 'again', now);
  assert.equal(failed.stage, 0);
  assert.equal(failed.dueAt.toISOString(), '2026-09-10T15:10:00.000Z');
  assert.equal(nextReview(second, 'hard', now).dueAt.toISOString(), first.dueAt.toISOString());
});

test('recommendation bands and dates respect rating limits and São Paulo midnight', () => {
  assert.deepEqual(trainingBand(100), { min: 0, max: 300 });
  assert.deepEqual(trainingBand(3900), { min: 3700, max: 4000 });
  assert.equal(studyDate(new Date('2026-09-11T02:59:00Z')), '2026-09-10');
  assert.equal(studyDate(new Date('2026-09-11T03:00:00Z')), '2026-09-11');
});
