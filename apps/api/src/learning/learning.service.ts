import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../database/prisma.service';
import { nextReview, studyDate, trainingBand, type Recall } from './schedule';
import { buildRepertoireCourses, lineDecisions, repertoireSpec, repertoireSpecs } from './repertoires';
import { Chess } from 'chess.js';

type StudyKind = 'lesson' | 'puzzle' | 'opening' | 'position';
type StudyInput = { kind: StudyKind; contentId: string; side?: string; requestId?: string };
type Outcome = { response: object; completed: boolean; success: boolean; mistakes?: number; hintUsed?: boolean; recall: Recall | null };
type Suggestion = { kind: Exclude<StudyKind, 'position'>; contentId: string; title: string; reason: string; dueAt?: string; side?: string; focusPly?: number };
type ImportedGame = { externalId: string; playedAt: Date | null; color: 'w' | 'b'; moves: string[] };

function uciHistory(game: Chess) {
  return game.history({ verbose: true }).map(move => `${move.from}${move.to}${move.promotion ?? ''}`);
}

function prefixLength(left: string[], right: string[]) {
  let index = 0;
  while (index < left.length && index < right.length && left[index] === right[index]) index++;
  return index;
}

async function fetchWithTimeout(url: string, init: RequestInit = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    if (!response.ok) throw new BadRequestException(response.status === 404 ? 'Jogador não encontrado nessa plataforma.' : `A plataforma respondeu com erro ${response.status}.`);
    return response;
  } catch (error) {
    if (error instanceof BadRequestException) throw error;
    throw new BadRequestException('Não foi possível buscar as partidas agora. Confira o nome do jogador e tente novamente.');
  } finally { clearTimeout(timer); }
}

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

  async openingAttempt(userId: string, id: string, moves: string[], plies: number[] | undefined, side: 'w' | 'b', hintUsed: boolean, mistakes: number, positionMistakes: number[] | undefined, requestId: string) {
    const opening = await this.db.opening.findUnique({ where: { id } });
    if (!opening) throw new NotFoundException('Abertura não encontrada.');
    const allMoves = opening.moves as string[];
    const allStudentPlies = allMoves.flatMap((_, index) => index % 2 === (side === 'w' ? 0 : 1) ? [index] : []);
    const studiedPlies = plies ?? allStudentPlies;
    if (!studiedPlies.length || new Set(studiedPlies).size !== studiedPlies.length || studiedPlies.some(ply => !allStudentPlies.includes(ply))) {
      throw new BadRequestException('As posições estudadas não pertencem à cor escolhida nesta variante.');
    }
    const expected = studiedPlies.map(ply => allMoves[ply]!);
    if (!expected.length || moves.length !== expected.length || moves.some((move, index) => move !== expected[index])) {
      throw new BadRequestException('Conclua todos os lances da sua cor nesta variante para registrar a revisão.');
    }
    const positionResults = positionMistakes ?? expected.map(() => mistakes ? 1 : 0);
    if (positionResults.length !== expected.length || positionResults.some(value => !Number.isInteger(value) || value < 0 || value > 1000)) {
      throw new BadRequestException('O resultado por posição não corresponde à variante treinada.');
    }
    const decisionsByPly = new Map(lineDecisions(opening, side).map(decision => [decision.ply, decision]));
    const decisions = studiedPlies.map(ply => decisionsByPly.get(ply)!);
    return this.capture(userId, { kind: 'opening', contentId: id, side, requestId }, async tx => {
      const now = new Date();
      for (const [index, decision] of decisions.entries()) {
        await tx.openingPosition.upsert({
          where: { key: decision.key },
          create: { key: decision.key, fen: decision.fen, openingId: id, ply: decision.ply, title: `${opening.name}: ${decision.san}`, explanation: decision.explanation },
          update: { explanation: decision.explanation },
        });
        const key = { userId, kind: 'position', contentId: decision.key, side };
        const previous = await tx.studyReview.findUnique({ where: { userId_kind_contentId_side: key } });
        const schedule = nextReview(previous, positionResults[index]! > 0 ? 'hard' : 'good', now);
        await tx.studyReview.upsert({
          where: { userId_kind_contentId_side: key },
          create: { ...key, ...schedule, repetitions: 1, lastStudiedAt: now },
          update: { ...schedule, repetitions: { increment: 1 }, lastStudiedAt: now },
        });
      }
      await tx.activity.create({ data: { userId, type: 'opening', title: opening.name } });
      return { response: { completed: true, positionMastery: { tracked: decisions.length, clean: positionResults.filter(value => value === 0).length } }, completed: true, success: !hintUsed && mistakes === 0,
        hintUsed, mistakes, recall: hintUsed || mistakes ? 'hard' : 'good' };
    });
  }

  private async courseRows() {
    const families = [...new Set(repertoireSpecs.flatMap(spec => spec.families))];
    return this.db.opening.findMany({ where: { family: { in: families } }, select: { id: true, name: true, family: true, eco: true, moves: true } });
  }

  async repertoires(userId: string) {
    const [rows, selected, reviews] = await Promise.all([
      this.courseRows(),
      this.db.userRepertoire.findMany({ where: { userId }, select: { courseId: true } }),
      this.db.studyReview.findMany({ where: { userId, kind: 'position' }, select: { contentId: true, dueAt: true, repetitions: true } }),
    ]);
    const selectedIds = new Set(selected.map(item => item.courseId));
    const byKey = new Map(reviews.map(review => [review.contentId, review]));
    const now = new Date();
    return buildRepertoireCourses(rows).map(course => {
      const keys = new Set(course.lines.flatMap(line => line.decisions.map(decision => decision.key)));
      const learned = [...keys].filter(key => byKey.has(key)).length;
      const due = [...keys].filter(key => (byKey.get(key)?.dueAt ?? new Date(8640000000000000)) <= now).length;
      return { ...course, selected: selectedIds.has(course.id), learnedPositions: learned, duePositions: due,
        mastery: keys.size ? Math.round(learned / keys.size * 100) : 0 };
    });
  }

  async repertoire(userId: string, id: string) {
    const course = (await this.repertoires(userId)).find(item => item.id === id);
    if (!course) throw new NotFoundException('Repertório não encontrado.');
    return course;
  }

  async selectRepertoire(userId: string, id: string) {
    if (!repertoireSpec(id)) throw new NotFoundException('Repertório não encontrado.');
    await this.db.userRepertoire.upsert({
      where: { userId_courseId: { userId, courseId: id } },
      create: { userId, courseId: id }, update: { selectedAt: new Date() },
    });
    return { selected: true, courseId: id };
  }

  private async chessComGames(username: string): Promise<ImportedGame[]> {
    const profile = await fetchWithTimeout(`https://api.chess.com/pub/player/${encodeURIComponent(username.toLocaleLowerCase())}/games/archives`, { headers: { 'User-Agent': 'ZavChess/0.1 learning-import' } });
    const archivePayload = await profile.json() as { archives?: string[] };
    const archives = (archivePayload.archives ?? []).slice(-2);
    const batches = await Promise.all(archives.map(async url => {
      const response = await fetchWithTimeout(url, { headers: { 'User-Agent': 'ZavChess/0.1 learning-import' } });
      return (await response.json() as { games?: Array<{ url?: string; pgn?: string; end_time?: number; white?: { username?: string }; black?: { username?: string } }> }).games ?? [];
    }));
    return batches.flat().slice(-50).flatMap(raw => {
      try {
        const color = raw.white?.username?.toLocaleLowerCase() === username.toLocaleLowerCase() ? 'w'
          : raw.black?.username?.toLocaleLowerCase() === username.toLocaleLowerCase() ? 'b' : null;
        if (!color || !raw.pgn) return [];
        const game = new Chess(); game.loadPgn(raw.pgn);
        return [{ externalId: raw.url ?? `${raw.end_time}-${uciHistory(game).join('')}`, playedAt: raw.end_time ? new Date(raw.end_time * 1000) : null, color, moves: uciHistory(game) }];
      } catch { return []; }
    });
  }

  private async lichessGames(username: string): Promise<ImportedGame[]> {
    const response = await fetchWithTimeout(`https://lichess.org/api/games/user/${encodeURIComponent(username)}?max=50&clocks=false&evals=false&opening=false`, { headers: { Accept: 'application/x-ndjson', 'User-Agent': 'ZavChess/0.1 learning-import' } });
    const body = await response.text();
    return body.split(/\r?\n/).filter(Boolean).flatMap(line => {
      try {
        const raw = JSON.parse(line) as { id?: string; createdAt?: number; moves?: string; players?: { white?: { user?: { name?: string } }; black?: { user?: { name?: string } } } };
        const color = raw.players?.white?.user?.name?.toLocaleLowerCase() === username.toLocaleLowerCase() ? 'w'
          : raw.players?.black?.user?.name?.toLocaleLowerCase() === username.toLocaleLowerCase() ? 'b' : null;
        if (!color || !raw.id || !raw.moves) return [];
        const game = new Chess();
        for (const san of raw.moves.split(/\s+/)) game.move(san);
        return [{ externalId: raw.id, playedAt: raw.createdAt ? new Date(raw.createdAt) : null, color, moves: uciHistory(game) }];
      } catch { return []; }
    });
  }

  async importGames(userId: string, platform: 'chesscom' | 'lichess', username: string) {
    const games = platform === 'chesscom' ? await this.chessComGames(username) : await this.lichessGames(username);
    if (!games.length) throw new BadRequestException('Nenhuma partida pública válida foi encontrada para esse jogador.');
    const [rows, selected] = await Promise.all([this.courseRows(), this.db.userRepertoire.findMany({ where: { userId }, select: { courseId: true } })]);
    const courseIds = selected.length ? new Set(selected.map(item => item.courseId)) : new Set(['italiana-essencial']);
    const courses = buildRepertoireCourses(rows).filter(course => courseIds.has(course.id));
    const lineMeta = new Map(courses.flatMap(course => course.lines.map(line => [line.openingId, { side: course.side, course: course.title }] as const)));
    const candidateRows = rows.filter(row => lineMeta.has(row.id)).map(row => ({ ...row, line: Array.isArray(row.moves) ? row.moves as string[] : [] }));
    const analyzed = games.map(game => {
      const candidates = candidateRows.filter(row => lineMeta.get(row.id)?.side === game.color);
      const best = candidates.map(row => ({ row, prefix: prefixLength(game.moves, row.line) })).sort((a, b) => b.prefix - a.prefix || b.row.line.length - a.row.line.length)[0];
      if (!best || best.prefix < 2) return { game, openingId: null, firstMissPly: null, weakness: false, summary: 'A partida ainda não entrou em um dos repertórios selecionados.' };
      const diverged = best.prefix < best.row.line.length;
      const weakness = diverged && best.prefix % 2 === (game.color === 'w' ? 0 : 1);
      const summary = !diverged ? `A partida permaneceu no ramo treinado de ${best.row.name}.`
        : weakness ? `Você saiu do ramo de ${best.row.name} no lance ${Math.floor(best.prefix / 2) + 1}.`
        : `O adversário escolheu uma resposta ainda não coberta depois de ${best.row.name}.`;
      return { game, openingId: best.row.id, firstMissPly: diverged ? best.prefix : null, weakness, summary };
    });
    await this.db.openingGameImport.createMany({ data: analyzed.map(item => ({
      userId, platform, username, gameExternalId: item.game.externalId, playedAt: item.game.playedAt, color: item.game.color,
      openingId: item.openingId, firstMissPly: item.weakness ? item.firstMissPly : null, summary: item.summary,
    })), skipDuplicates: true });
    const weaknesses = analyzed.filter(item => item.weakness);
    const grouped = new Map<string, { openingId: string; count: number; summary: string }>();
    for (const item of weaknesses) {
      const key = `${item.openingId}:${item.firstMissPly}`;
      const current = grouped.get(key) ?? { openingId: item.openingId!, count: 0, summary: item.summary };
      current.count++; grouped.set(key, current);
    }
    return { imported: analyzed.length, matched: analyzed.filter(item => item.openingId).length, weaknesses: weaknesses.length,
      recommendations: [...grouped.values()].sort((a, b) => b.count - a.count).slice(0, 5) };
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
    for (const review of due) {
      if (items.length >= 5) break;
      if (review.kind === 'position') {
        const position = await this.db.openingPosition.findUnique({ where: { key: review.contentId }, include: { opening: { select: { id: true, name: true } } } });
        if (position && !items.some(item => item.kind === 'opening' && item.contentId === position.opening.id)) {
          items.push({ kind: 'opening', contentId: position.opening.id, side: review.side || undefined, focusPly: position.ply,
            title: position.title, reason: `${position.explanation} Esta decisão está pronta para revisão.`, dueAt: review.dueAt.toISOString() });
        }
        continue;
      }
      const title = await this.contentTitle(review.kind, review.contentId);
      if (review.kind === 'opening' && items.some(item => item.kind === 'opening' && item.contentId === review.contentId)) continue;
      if (title) items.push({ kind: review.kind as Suggestion['kind'], contentId: review.contentId, side: review.side || undefined, title, reason: 'Revisão agendada para consolidar este conteúdo.', dueAt: review.dueAt.toISOString() });
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
    const selectedCourse = await this.db.userRepertoire.findFirst({ where: { userId }, orderBy: { selectedAt: 'desc' } });
    const importedWeakness = await this.db.openingGameImport.findFirst({ where: { userId, firstMissPly: { not: null }, openingId: { not: null } }, orderBy: { importedAt: 'desc' } });
    if (importedWeakness?.openingId && !items.some(item => item.kind === 'opening' && item.contentId === importedWeakness.openingId)) {
      const opening = await this.db.opening.findUnique({ where: { id: importedWeakness.openingId }, select: { name: true } });
      if (opening) items.push({ kind: 'opening', contentId: importedWeakness.openingId, side: importedWeakness.color,
        title: opening.name, reason: `${importedWeakness.summary} Vamos corrigir essa decisão usando uma partida sua.` });
    }
    if (selectedCourse) {
      const course = (await this.repertoires(userId)).find(item => item.id === selectedCourse.courseId);
      const nextLine = course?.lines.find(line => !reviews.some(review => review.kind === 'opening' && review.contentId === line.openingId)) ?? course?.lines[0];
      if (course && nextLine && !items.some(item => item.kind === 'opening' && item.contentId === nextLine.openingId)) {
        items.push({ kind: 'opening', contentId: nextLine.openingId, side: course.side, title: nextLine.name,
          reason: `Próxima linha de ${course.title}: aprenda as decisões que mais conectam a abertura ao meio-jogo.` });
      }
    } else if (!reviews.some(row => row.kind === 'opening')) {
      const opening = await this.db.opening.findFirst({ where: { name: 'Italian Game' }, orderBy: { id: 'asc' } });
      if (opening) items.push({ kind: 'opening', contentId: opening.id, side: 'w', title: opening.name, reason: 'Comece seu repertório treinando uma linha curta de desenvolvimento.' });
    }
    return { rating: user.rating, recommendedBand: band, dueCount: due.length, nextReviewAt: reviews.find(row => row.dueAt > now)?.dueAt.toISOString() || null, items };
  }

  private async contentTitle(kind: string, id: string) {
    if (kind === 'lesson') return (await this.db.lesson.findUnique({ where: { id }, select: { title: true } }))?.title;
    if (kind === 'opening') return (await this.db.opening.findUnique({ where: { id }, select: { name: true } }))?.name;
    if (kind === 'puzzle') { const puzzle = await this.db.puzzle.findUnique({ where: { id }, select: { rating: true } }); return puzzle ? `Puzzle ${id} · ${puzzle.rating}` : undefined; }
    if (kind === 'position') return (await this.db.openingPosition.findUnique({ where: { key: id }, select: { title: true } }))?.title;
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
