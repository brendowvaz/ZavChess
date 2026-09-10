import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { publicUser } from '../auth/auth.service';
import { calculateStreak, puzzlePosition, validatePuzzle } from '../chess/chess-rules';

type Quiz = { question: string; options: string[]; answer: number; explanation: string };

@Injectable()
export class ContentService {
  constructor(private readonly db: PrismaService) {}

  lessons() {
    return this.db.lesson.findMany({ orderBy: { sortOrder: 'asc' }, select: { id: true, slug: true, title: true, category: true, level: true, description: true, sortOrder: true, minutes: true } });
  }

  async lesson(id: string) {
    const lesson = await this.db.lesson.findUnique({ where: { id } });
    if (!lesson) throw new NotFoundException('Aula não encontrada.');
    const quiz = lesson.quiz as unknown as Quiz;
    return { ...lesson, quiz: { question: quiz.question, options: quiz.options } };
  }

  async completeLesson(userId: string, lessonId: string, answer: number) {
    const lesson = await this.db.lesson.findUnique({ where: { id: lessonId } });
    if (!lesson) throw new NotFoundException('Aula não encontrada.');
    const quiz = lesson.quiz as unknown as Quiz;
    if (answer >= quiz.options.length) throw new BadRequestException('Alternativa inválida.');
    if (quiz.answer !== answer) return { correct: false, explanation: quiz.explanation, xpEarned: 0 };
    try {
      await this.db.$transaction(async (tx) => {
        await tx.lessonProgress.create({ data: { userId, lessonId } });
        await tx.user.update({ where: { id: userId }, data: { xp: { increment: 25 } } });
        await tx.activity.create({ data: { userId, type: 'lesson', title: lesson.title } });
      });
      return { correct: true, explanation: quiz.explanation, xpEarned: 25 };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return { correct: true, explanation: quiz.explanation, xpEarned: 0 };
      throw error;
    }
  }

  async openings(search: string, page: number, pageSize: number) {
    const where: Prisma.OpeningWhereInput = search ? { OR: [{ name: { contains: search } }, { eco: { contains: search } }] } : {};
    const [items, total] = await Promise.all([
      this.db.opening.findMany({ where, orderBy: [{ eco: 'asc' }, { name: 'asc' }], skip: (page - 1) * pageSize, take: pageSize }),
      this.db.opening.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  async opening(id: string) {
    const opening = await this.db.opening.findUnique({ where: { id } });
    if (!opening) throw new NotFoundException('Abertura não encontrada.');
    return opening;
  }

  async puzzles(minRating: number, maxRating: number, theme: string, page: number, pageSize: number) {
    if (minRating > maxRating) throw new BadRequestException('A dificuldade mínima deve ser menor que a máxima.');
    const where: Prisma.PuzzleWhereInput = { rating: { gte: minRating, lte: maxRating }, ...(theme ? { themes: { array_contains: theme } } : {}) };
    const [rows, total] = await Promise.all([
      this.db.puzzle.findMany({ where, orderBy: [{ rating: 'asc' }, { id: 'asc' }], skip: (page - 1) * pageSize, take: pageSize }),
      this.db.puzzle.count({ where }),
    ]);
    const items = rows.map(({ moves, ...row }) => ({ ...row, fen: puzzlePosition(row.fen, moves as string[]).fen() }));
    return { items, total, page, pageSize };
  }

  async attemptPuzzle(userId: string, puzzleId: string, moves: string[], hintUsed: boolean) {
    const puzzle = await this.db.puzzle.findUnique({ where: { id: puzzleId } });
    if (!puzzle) throw new NotFoundException('Puzzle não encontrado.');
    let result;
    try { result = validatePuzzle(puzzle.fen, puzzle.moves as string[], moves); }
    catch { throw new BadRequestException('Sequência de lances inválida.'); }
    const { expectedMove, ...publicResult } = result;
    const where = { userId_puzzleId: { userId, puzzleId } };
    // A hint is saved immediately, so omitting hintUsed in a later request cannot restore XP.
    await this.db.puzzleAttempt.upsert({
      where,
      create: { userId, puzzleId, hintUsed, mistakes: result.status === 'incorrect' ? 1 : 0 },
      update: { ...(hintUsed ? { hintUsed: true } : {}), ...(result.status === 'incorrect' ? { mistakes: { increment: 1 } } : {}) },
    });
    if (result.status !== 'solved') return { ...publicResult, ...(hintUsed ? { expectedMove } : {}) };

    const xpEarned = await this.db.$transaction(async (tx) => {
      const changed = await tx.puzzleAttempt.updateMany({ where: { userId, puzzleId, solved: false }, data: { solved: true, solvedAt: new Date() } });
      if (!changed.count) return 0;
      const attempt = await tx.puzzleAttempt.findUniqueOrThrow({ where });
      const earned = attempt.hintUsed ? 0 : attempt.mistakes > 0 ? 5 : 15;
      const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
      // This is a local training estimate, never a Lichess/FIDE rating.
      const expected = 1 / (1 + 10 ** ((puzzle.rating - user.rating) / 400));
      const performance = attempt.hintUsed ? 0 : attempt.mistakes > 0 ? 0.5 : 1;
      const ratingChange = Math.round(20 * (performance - expected));
      await tx.user.update({ where: { id: userId }, data: { xp: { increment: earned }, rating: { increment: ratingChange } } });
      await tx.activity.create({ data: { userId, type: 'puzzle', title: `Puzzle ${puzzle.id} · ${puzzle.rating}` } });
      return earned;
    });
    return { ...publicResult, xpEarned };
  }

  async progress(userId: string) {
    const [lessons, puzzles] = await Promise.all([
      this.db.lessonProgress.findMany({ where: { userId }, select: { lessonId: true } }),
      this.db.puzzleAttempt.findMany({ where: { userId, solved: true }, select: { puzzleId: true } }),
    ]);
    return { completedLessonIds: lessons.map((row) => row.lessonId), solvedPuzzleIds: puzzles.map((row) => row.puzzleId) };
  }

  async dashboard(user: User) {
    const [completedLessons, solvedPuzzles, recentActivity, days, lessons, openings, puzzles, endgames] = await Promise.all([
      this.db.lessonProgress.count({ where: { userId: user.id } }),
      this.db.puzzleAttempt.count({ where: { userId: user.id, solved: true } }),
      this.db.activity.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' }, take: 6, select: { id: true, type: true, title: true, createdAt: true } }),
      this.db.activity.findMany({ where: { userId: user.id }, select: { createdAt: true } }),
      this.db.lesson.count(), this.db.opening.count(), this.db.puzzle.count(), this.db.endgame.count(),
    ]);
    return { user: publicUser(user), completedLessons, solvedPuzzles, recentActivity, streak: calculateStreak(days.map((row) => row.createdAt)), counts: { lessons, openings, puzzles, endgames } };
  }
}
