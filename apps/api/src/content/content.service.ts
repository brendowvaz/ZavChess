import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Opening, OpeningGuide, Prisma, User } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { publicUser } from '../auth/auth.service';
import { calculateStreak, puzzlePosition, validatePuzzle } from '../chess/chess-rules';

type Quiz = { question: string; options: string[]; answer: number; explanation: string };
type RelatedLesson = { id: string; slug: string; title: string; level: string };
type StudyGuide = {
  kind: 'family' | 'introductory';
  family: string;
  overview: string;
  whitePlan: string[];
  blackPlan: string[];
  commonMistakes: string[];
  lessons: RelatedLesson[];
};
type OpeningVariantSummary = { id: string; eco: string; name: string; pgn: string; moveCount: number };

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

  async openingFamilies(search: string, page: number, pageSize: number) {
    const where: Prisma.OpeningWhereInput = search
      ? { OR: [{ family: { contains: search } }, { name: { contains: search } }, { eco: { contains: search } }] }
      : {};
    const [matchingRows, grouped] = await Promise.all([
      search ? this.db.opening.findMany({ where, distinct: ['family'], select: { family: true } }) : Promise.resolve([]),
      this.db.opening.groupBy({ by: ['family'], _count: { _all: true }, _min: { eco: true } }),
    ]);
    const matchingFamilies = new Set(matchingRows.map((row) => row.family));
    const families = grouped
      .filter((row) => !search || matchingFamilies.has(row.family))
      .sort((a, b) => a.family.localeCompare(b.family));
    const itemsForPage = families.slice((page - 1) * pageSize, page * pageSize);
    const guides = itemsForPage.length
      ? await this.db.openingGuide.findMany({ where: { family: { in: itemsForPage.map((row) => row.family) } }, select: { family: true } })
      : [];
    const guidedFamilies = new Set(guides.map((guide) => guide.family));
    return {
      items: itemsForPage.map((row) => ({
        family: row.family,
        variationCount: row._count._all,
        firstEco: row._min.eco ?? '—',
        guideKind: guidedFamilies.has(row.family) ? 'family' : 'introductory',
      })),
      total: families.length,
      page,
      pageSize,
    };
  }

  async openingFamily(family: string) {
    const variations = await this.db.opening.findMany({
      where: { family },
      orderBy: [{ eco: 'asc' }, { name: 'asc' }, { pgn: 'asc' }],
    });
    if (!variations.length) throw new NotFoundException('Família de abertura não encontrada.');
    return {
      family,
      variationCount: variations.length,
      studyGuide: await this.studyGuideForFamily(family),
      variations: variations.map((variation) => this.variantSummary(variation)),
    };
  }

  async opening(id: string) {
    const opening = await this.db.opening.findUnique({ where: { id } });
    if (!opening) throw new NotFoundException('Abertura não encontrada.');
    const [studyGuide, siblings] = await Promise.all([
      this.studyGuideForFamily(opening.family),
      this.db.opening.findMany({ where: { family: opening.family }, orderBy: [{ eco: 'asc' }, { name: 'asc' }, { pgn: 'asc' }] }),
    ]);
    const index = siblings.findIndex((sibling) => sibling.id === opening.id);
    return {
      ...opening,
      studyGuide,
      familyNavigation: {
        family: opening.family,
        index: index + 1,
        total: siblings.length,
        previous: index > 0 ? this.variantSummary(siblings[index - 1]!) : null,
        next: index < siblings.length - 1 ? this.variantSummary(siblings[index + 1]!) : null,
      },
    };
  }

  private stringList(value: unknown) {
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
  }

  private variantSummary(opening: Pick<Opening, 'id' | 'eco' | 'name' | 'pgn' | 'moves'>): OpeningVariantSummary {
    return { id: opening.id, eco: opening.eco, name: opening.name, pgn: opening.pgn, moveCount: this.stringList(opening.moves).length };
  }

  private async studyGuideForFamily(family: string): Promise<StudyGuide> {
    const guide = await this.db.openingGuide.findUnique({ where: { family } });
    const lessonIds = guide ? this.stringList(guide.lessonIds) : [];
    const lessons = lessonIds.length
      ? await this.db.lesson.findMany({
        where: { id: { in: lessonIds } },
        select: { id: true, slug: true, title: true, level: true },
      })
      : [];
    return this.studyGuide(family, guide, lessons);
  }

  private studyGuide(family: string, guide: OpeningGuide | null, lessons: RelatedLesson[]): StudyGuide {
    if (guide) {
      const lessonsById = new Map(lessons.map((lesson) => [lesson.id, lesson]));
      return {
        kind: 'family',
        family,
        overview: guide.overview,
        whitePlan: this.stringList(guide.whitePlan),
        blackPlan: this.stringList(guide.blackPlan),
        commonMistakes: this.stringList(guide.commonMistakes),
        // Preserve the editorial order from the guide instead of database order.
        lessons: this.stringList(guide.lessonIds).flatMap((id) => {
          const lesson = lessonsById.get(id);
          return lesson ? [lesson] : [];
        }),
      };
    }

    return {
      kind: 'introductory',
      family,
      overview: `${family} é uma família registrada no catálogo. Cada variante serve para estudar uma sequência e reconhecer a estrutura; o nome da família não torna lances obrigatórios nem substitui analisar a resposta concreta do adversário.`,
      whitePlan: [
        'Desenvolva as peças menores, dispute o centro e deixe o rei seguro antes de tentar repetir a linha de memória.',
        'Se a partida sair da sequência publicada, volte a princípios concretos: atividade das peças, segurança do rei e cálculo de ameaças.',
      ],
      blackPlan: [
        'Responda ao centro com desenvolvimento e mantenha opções para o rei antes de abrir linhas.',
        'Use a estrutura criada pelos lances para escolher um plano, em vez de copiar uma continuação sem considerar o oponente.',
      ],
      commonMistakes: [
        'Tratar a sequência publicada como uma linha forçada.',
        'Avançar peões de flanco antes de concluir o desenvolvimento.',
        'Ignorar a segurança do rei ao tentar memorizar uma variante.',
      ],
      lessons: [],
    };
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
