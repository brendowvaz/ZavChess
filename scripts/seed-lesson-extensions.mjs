import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const require = createRequire(resolve(root, 'apps/api/package.json'));
require('dotenv').config({ path: resolve(root, 'apps/api/.env'), quiet: true });
const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();
try {
  const lessons = JSON.parse(readFileSync(resolve(root, 'data/lesson-extensions.json'), 'utf8'));
  await db.$transaction(lessons.map(lesson => db.lesson.upsert({ where: { id: lesson.id }, create: lesson, update: lesson })));
  console.log(JSON.stringify({ lessonsAddedOrUpdated: lessons.length, totalLessons: await db.lesson.count() }));
} finally { await db.$disconnect(); }
