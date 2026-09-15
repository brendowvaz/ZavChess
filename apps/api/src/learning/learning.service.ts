import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../database/prisma.service';
import { nextReview, studyDate, trainingBand, type Recall } from './schedule';

type StudyKind = 'lesson' | 'puzzle' | 'opening';
type StudyInput = { kind: StudyKind; contentId: string; side?: string; requestId?: string };
type Outcome = { response: object; completed: boolean; success: boolean; mistakes?: number; hintUsed?: boolean; recall: Recall | null };
type Suggestion = { kind: StudyKind; contentId: string; title: string; reason: string; dueAt?: string; side?: string };

@Injectable()
export class LearningService {
  constructor(private readonly db: PrismaService) {}

  async capture(userId: string, input: StudyInput, action: (tx: Prisma.TransactionClient) => Promise<Outcome>) {
    const requestId = input.requestId || randomUUID();
    return this.db.$transaction(async tx => {
      // Serialize study writes per student so retries and concurrent tabs cannot double-count XP or reviews.
      await tx.$queryRaw`SELECT id FROM User WHERE id = ${userId} FOR UPDATE`;
      const previous = await tx.studyEvent.findUnique({ where: { userId_requestId: { userId, requestId } } });
      if (previous) {
        if (previous.kind !== input.kind || previous.contentId !== input.contentId || previous.side !== (input.side || '')) {
          throw new BadRequestException('Este identificador de tentativa já foi usado em outro exercício.');
        }
        return previous.result;
      }
      const outcome = await action(tx);
      const now = new Date();
      let review: { id: string; dueAt: Date } | null = null;
      if (outcome.recall) {
        const key = { userId, kind: input.kind, contentId: input.contentId, side: input.side || '' };
        const previousReview = await tx.studyReview.findUnique({ where: { userId_kind_contentId_side: key } });
        const schedule = nextReview(previousReview, outcome.recall, now);
        review = await tx.studyReview.upsert({
          where: { userId_kind_contentId_side: key },
          create: { ...key, ...schedule, repetitions: 1, lastStudiedAt: now },
          update: { ...schedule, repetitions: { increment: 1 }, lastStudiedAt: now },
        });
      }
      const response = { ...outcome.response, ...(review ? { nextReviewAt: review.dueAt.toISOString(), reviewId: review.id } : {}) };
      const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
      await tx.studyEvent.create({ data: {
        userId, requestId, kind: input.kind, contentId: input.contentId, side: input.side || '',
        completed: outcome.completed, success: outcome.success, mistakes: outcome.mistakes || 0,
        hintUsed: outcome.hintUsed || false, rating: user.rating, result: response as Prisma.InputJsonValue,
      } });
      return response;
    }, { timeout: 15_000 });
  }

  async openingAttempt(userId: string, id: string, moves: string[], side: 'w' | 'b', hintUsed: boolean, mistakes: number, requestId: string) {
    const opening = await this.db.opening.findUnique({ where: { id } });
    if (!opening) throw new NotFoundException('Abertura não encontrada.');
    const allMoves = opening.moves as string[];
    const expected = allMoves.filter((_, index) => index % 2 === (side === 'w' ? 0 : 1));
    if (!expected.length || moves.length !== expected.length || moves.some((move, index) => move !== expected[index])) {
      throw new BadRequestException('Conclua todos os lances da sua cor nesta variante para registrar a revisão.');
    }
    return this.capture(userId, { kind: 'opening', contentId: id, side, requestId }, async tx => {
      await tx.activity.create({ data: { userId, type: 'opening', title: opening.name } });
      return { response: { completed: true }, completed: true, success: !hintUsed && mistakes === 0,
        hintUsed, mistakes, recall: hintUsed || mistakes ? 'hard' : 'good' };
    });
  }

  async plan(userId: string) {
    const [user, reviews, lessons, progress, attempts, events] = await Promise.all([
      this.db.user.findUniqueOrThrow({ where: { id: userId } }),
      this.db.studyReview.findMany({ where: { userId }, orderBy: { dueAt: 'asc' } }),
      this.db.lesson.findMany({ orderBy: { sortOrder: 'asc' }, select: { id: true, title: true, level: true, category: true } }),
      this.db.lessonProgress.findMany({ where: { userId }, select: { lessonId: true } }),
      this.db.puzzleAttempt.findMany({ where: { userId, solved: true }, select: { puzzleId: true } }),
      this.db.studyEvent.findMany({ where: { userId, kind: 'puzzle', completed: true }, orderBy: { createdAt: 'desc' }, take: 100 }),
    ]);
    const now = new Date();
    const due = reviews.filter(review => review.dueAt <= now);
    const items: Suggestion[] = [];
    for (const review of due.slice(0, 5)) {
      const title = await this.contentTitle(review.kind, review.contentId);
      if (title) items.push({ kind: review.kind as StudyKind, contentId: review.contentId, side: review.side || undefined, title, reason: 'Revisão agendada para consolidar este conteúdo.', dueAt: review.dueAt.toISOString() });
    }
    const completed = new Set(progress.map(row => row.lessonId));
    const level = user.rating < 1200 ? 'beginner' : user.rating < 1800 ? 'intermediate' : 'advanced';
    const remaining = lessons.filter(lesson => !completed.has(lesson.id));
    const lesson = remaining.find(row => row.category === 'fundamentals') || remaining.find(row => row.level === level) || remaining[0];
    if (lesson) items.push({ kind: 'lesson', contentId: lesson.id, title: lesson.title, reason: lesson.category === 'fundamentals' ? 'Consolide os fundamentos antes de avançar.' : `Próxima aula ainda não concluída, considerando seu rating de treino (${user.rating}).` });

    const recentPuzzles = await this.db.puzzle.findMany({ where: { id: { in: [...new Set(events.map(row => row.contentId))] } }, select: { id: true, themes: true } });
    const themeScores = new Map<string, { count: number; missed: number }>();
    for (const event of events) {
      const puzzle = recentPuzzles.find(row => row.id === event.contentId);
      for (const theme of (puzzle?.themes as string[] || [])) {
        const score = themeScores.get(theme) || { count: 0, missed: 0 };
        score.count++; if (!event.success) score.missed++;
        themeScores.set(theme, score);
      }
    }
    const weak = [...themeScores].filter(([, score]) => score.count >= 3 && score.missed > 0).sort((a, b) => b[1].missed / b[1].count - a[1].missed / a[1].count)[0]?.[0];
    const band = trainingBand(user.rating);
    const solvedIds = attempts.map(row => row.puzzleId);
    const select = { id: true, rating: true } as const;
    const baseWhere: Prisma.PuzzleWhereInput = { id: { notIn: solvedIds }, rating: { gte: band.min, lte: band.max } };
    let candidates = weak ? await this.db.puzzle.findMany({ where: { ...baseWhere, themes: { array_contains: weak } }, take: 100, select, orderBy: [{ rating: 'asc' }, { id: 'asc' }] }) : [];
    const targetedWeakness = candidates.length > 0;
    if (!candidates.length) candidates = await this.db.puzzle.findMany({ where: baseWhere, take: 100, select, orderBy: [{ rating: 'asc' }, { id: 'asc' }] });
    if (!candidates.length) candidates = await this.db.puzzle.findMany({ where: { id: { notIn: solvedIds } }, select });
    const puzzle = candidates.sort((a, b) => Math.abs(a.rating - user.rating) - Math.abs(b.rating - user.rating) || a.id.localeCompare(b.id))[0];
    if (puzzle) items.push({ kind: 'puzzle', contentId: puzzle.id, title: `Desafio de rating ${puzzle.rating}`, reason: targetedWeakness ? `Pratique ${weak}: tema com dificuldade em pelo menos três sessões recentes.` : `Desafio ainda não resolvido, próximo do seu rating de treino (${user.rating}).` });
    if (!reviews.some(row => row.kind === 'opening')) {
      const opening = await this.db.opening.findFirst({ where: { name: 'Italian Game' }, orderBy: { id: 'asc' } });
      if (opening) items.push({ kind: 'opening', contentId: opening.id, side: 'w', title: opening.name, reason: 'Comece seu repertório treinando uma linha curta de desenvolvimento.' });
    }
    return { rating: user.rating, recommendedBand: band, dueCount: due.length, nextReviewAt: reviews.find(row => row.dueAt > now)?.dueAt.toISOString() || null, items };
  }

  private async contentTitle(kind: string, id: string) {
    if (kind === 'lesson') return (await this.db.lesson.findUnique({ where: { id }, select: { title: true } }))?.title;
    if (kind === 'opening') return (await this.db.opening.findUnique({ where: { id }, select: { name: true } }))?.name;
    if (kind === 'puzzle') { const puzzle = await this.db.puzzle.findUnique({ where: { id }, select: { rating: true } }); return puzzle ? `Puzzle ${id} · ${puzzle.rating}` : undefined; }
    return undefined;
  }

  async report(userId: string) {
    const since = new Date(Date.now() - 28 * 86_400_000);
    const [events, reviews, puzzleAttempts] = await Promise.all([
      this.db.studyEvent.findMany({ where: { userId, createdAt: { gte: since }, completed: true }, orderBy: { createdAt: 'asc' } }),
      this.db.studyReview.findMany({ where: { userId } }),
      this.db.puzzleAttempt.count({ where: { userId, solved: true } }),
    ]);
    const puzzles = await this.db.puzzle.findMany({ where: { id: { in: [...new Set(events.filter(row => row.kind === 'puzzle').map(row => row.contentId))] } }, select: { id: true, themes: true } });
    const themes = new Map<string, { theme: string; sessions: number; clean: number; mistakes: number; hints: number }>();
    const days = new Map<string, { date: string; sessions: number; rating: number }>();
    for (const event of events) {
      const date = studyDate(event.createdAt);
      days.set(date, { date, sessions: (days.get(date)?.sessions || 0) + 1, rating: event.rating });
      for (const theme of (puzzles.find(row => row.id === event.contentId)?.themes as string[] || [])) {
        const value = themes.get(theme) || { theme, sessions: 0, clean: 0, mistakes: 0, hints: 0 };
        value.sessions++; value.clean += event.success ? 1 : 0; value.mistakes += event.mistakes; value.hints += event.hintUsed ? 1 : 0;
        themes.set(theme, value);
      }
    }
    const topics = [...themes.values()].map(row => ({ ...row, accuracy: Math.round(row.clean / row.sessions * 100) }));
    return { since: since.toISOString(), sessions: events.length, solvedPuzzles: puzzleAttempts,
      cleanSessions: events.filter(event => event.success).length, studiedOpenings: reviews.filter(row => row.kind === 'opening').length,
      dueReviews: reviews.filter(row => row.dueAt <= new Date()).length, daily: [...days.values()],
      strengths: topics.filter(row => row.sessions >= 3 && row.accuracy >= 70).sort((a, b) => b.accuracy - a.accuracy).slice(0, 5),
      practiceNext: topics.filter(row => row.sessions >= 3 && row.accuracy < 70).sort((a, b) => a.accuracy - b.accuracy).slice(0, 5),
      themes: topics.sort((a, b) => b.sessions - a.sessions),
      note: 'Sessões registradas desde a atualização. Uma sessão limpa termina sem erros ou dicas. Ratings são estimativas locais; temas com menos de três sessões ainda não formam um diagnóstico.' };
  }
}
