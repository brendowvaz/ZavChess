import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();
const seedDirectory = resolve(fileURLToPath(new URL('.', import.meta.url)), '../../../data');
const read = (name) => JSON.parse(readFileSync(resolve(seedDirectory, `${name}.json`), 'utf8'));

async function upsertInBatches(rows, operation) {
  for (let offset = 0; offset < rows.length; offset += 250) {
    await operation(rows.slice(offset, offset + 250));
  }
}

async function seed() {
  const lessons = [...read('lessons'), ...read('lesson-extensions')];
  const openings = read('openings');
  const openingGuides = read('opening-guides').guides;
  const puzzles = read('puzzles');
  const endgames = read('endgames');

  const openingFamilies = new Set(openings.map(({ family }) => family));
  const lessonIds = new Set(lessons.map(({ id }) => id));
  for (const guide of openingGuides) {
    if (!openingFamilies.has(guide.family)) throw new Error(`Guia sem família no catálogo: ${guide.family}`);
    for (const lessonId of guide.lessonIds) {
      if (!lessonIds.has(lessonId)) throw new Error(`Guia ${guide.family} aponta para aula inexistente: ${lessonId}`);
    }
  }

  for (const row of lessons) await db.lesson.upsert({ where: { id: row.id }, create: row, update: row });
  for (const row of endgames) await db.endgame.upsert({ where: { id: row.id }, create: row, update: row });
  for (const guide of openingGuides) {
    const persistedGuide = {
      family: guide.family,
      overview: guide.overview,
      whitePlan: guide.whitePlan,
      blackPlan: guide.blackPlan,
      commonMistakes: guide.commonMistakes,
      lessonIds: guide.lessonIds,
    };
    await db.openingGuide.upsert({ where: { family: guide.family }, create: persistedGuide, update: persistedGuide });
  }
  // Bulk imports preserve student progress and are safe to repeat.
  await upsertInBatches(openings, (data) => db.opening.createMany({ data, skipDuplicates: true }));
  await upsertInBatches(puzzles, (data) => db.puzzle.createMany({ data, skipDuplicates: true }));

  console.log({
    lessons: await db.lesson.count(),
    openings: await db.opening.count(),
    openingGuides: await db.openingGuide.count(),
    puzzles: await db.puzzle.count(),
    endgames: await db.endgame.count(),
  });
}

seed()
  .catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(() => db.$disconnect());
