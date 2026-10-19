import { Chess } from 'chess.js';
import type { Lesson, LessonDetail } from '../../api/types';
import { DEFAULT_POSITION, linePositions, moveUci, pieceNames } from '../../chess/logic.ts';
import { lessonBoardExercises } from './board-exercises.ts';
import { foundationDrills } from './foundation-drills.ts';

export type LessonTrack = 'start' | 'improve';
export type SessionMode = 'guided' | 'challenge';
export function lessonTrack(lesson: Pick<Lesson, 'category'>): LessonTrack {
  return lesson.category === 'fundamentals' ? 'start' : 'improve';
}
export function lessonChapter(lesson: Pick<Lesson, 'category' | 'sortOrder' | 'level' | 'slug'>) {
  if (lesson.category === 'fundamentals') return lesson.sortOrder <= 8 ? 'Conheça as peças' : 'Jogue uma partida';
  if (lesson.category === 'tactics') return lesson.level === 'beginner' ? 'Enxergue as ameaças' : 'Calcule as combinações';
  if (lesson.category === 'openings') return 'Construa seu jogo';
  return ['rei-ativo', 'oposicao-direta', 'tempos-no-final', 'peao-de-torre', 'converter-promocao', 'promocao-das-pretas', 'peoes-final-tatico', 'zugzwang', 'corrida-de-peoes'].includes(lesson.slug) ? 'Reis e peões em ação' : 'Técnica com as peças';
}
export type LessonCard = {
  id: string; kind: 'move' | 'choice' | 'square'; title: string; prompt: string; explanation: string;
  fen: string; moves: string[]; assisted: boolean;
  options?: string[]; answer?: number;
  square?: string;
};

/** Reflect ranks and exchange colors: pawn direction, castling and en passant remain legal. */
export function oppositeExercise(fen: string, moves: string[]) {
  const parts = fen.split(' ');
  const swap = (value: string) => value.replace(/[a-zA-Z]/g, c => c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase());
  parts[0] = parts[0]!.split('/').reverse().map(swap).join('/');
  parts[1] = parts[1] === 'w' ? 'b' : 'w';
  parts[2] = swap(parts[2]!);
  parts[3] = parts[3] === '-' ? '-' : `${parts[3]![0]}${9 - Number(parts[3]![1])}`;
  const flip = (uci: string) => `${uci[0]}${9 - Number(uci[1])}${uci[2]}${9 - Number(uci[3])}${uci.slice(4)}`;
  const next = { fen: new Chess(parts.join(' ')).fen(), moves: moves.map(flip) };
  linePositions(next.moves, next.fen);
  return next;
}

const blackOpenings = new Set(['siciliana', 'francesa', 'caro-kann', 'escandinava', 'gambito-recusado', 'eslava']);
export function lessonDeck(lesson: LessonDetail, mode: SessionMode): LessonCard[] {
  const explanation = lesson.steps.filter(step => !/lance adversário/i.test(step.title)).map(step => step.text).join('\n\n');
  let drills = lesson.steps.flatMap((step, index) => step.moves?.length && !/lance adversário|último lance adversário/i.test(`${step.title} ${step.text}`)
    ? [{ id: `step-${index}`, fen: step.fen ?? DEFAULT_POSITION, moves: [...step.moves], prompt: step.text }] : []);
  const fallback = lessonBoardExercises[lesson.id];
  if (!drills.length && fallback) drills = [{ ...fallback, id: 'board', moves: [...fallback.moves] }];
  drills.push(...(foundationDrills[lesson.slug] ?? []).map((drill, index) => ({ ...drill, id: `explore-${index}` })));
  const first: LessonCard[] = drills.map(drill => {
    if (lesson.category === 'openings' && blackOpenings.has(lesson.slug) && drill.moves.length > 1) {
      const line = linePositions(drill.moves, drill.fen);
      drill = { ...drill, fen: line.positions[1]!, moves: drill.moves.slice(1) };
    }
    linePositions(drill.moves, drill.fen);
    return { ...drill, id: `${drill.id}-first`, kind: 'move', title: lesson.title,
      prompt: mode === 'guided' ? drill.prompt : 'Encontre a continuação. Calcule também a resposta adversária.',
      explanation, assisted: mode === 'guided' };
  });
  const transfer = first.map(card => {
    const differentColor = lesson.category !== 'openings';
    const exercise = differentColor ? oppositeExercise(card.fen, card.moves) : { fen: card.fen, moves: card.moves };
    return { ...card, ...exercise, id: `${card.id}-recall`, assisted: false,
      prompt: differentColor ? 'Agora com as cores trocadas: aplique a mesma ideia sem seta.' : 'Recupere a linha de memória. Faça apenas os seus lances.' };
  });
  const seen = new Set(first.map(card => card.fen.split(' ').slice(0, 4).join(' ')));
  const extra: LessonCard[] = (lesson.challenges ?? []).flatMap(challenge => {
    const position = challenge.fen.split(' ').slice(0, 4).join(' ');
    if (seen.has(position) || !challenge.moves.length) return [];
    seen.add(position); linePositions(challenge.moves, challenge.fen);
    return [{ id: `apply-${challenge.id}`, kind: 'move' as const, title: 'Aplique em uma posição diferente',
      prompt: `Reconheça a mesma ideia em outra partida. Desafio ${challenge.rating}.`, explanation,
      fen: challenge.fen, moves: challenge.moves, assisted: false }];
  });
  const coordinates: LessonCard[] = lesson.slug === 'mapa-do-tabuleiro' ? ['a1', 'e4', 'h8'].map(square => ({ id: `square-${square}`,
    kind: 'square', title: 'Localize a casa', prompt: `Toque na casa ${square}. Primeiro a coluna, depois a fileira.`, explanation,
    square, fen: DEFAULT_POSITION, moves: [], assisted: false })) : [];
  const cards = [...coordinates, ...first, ...extra, ...transfer];
  if (lesson.quiz && first[0]) cards.push({ id: 'understand', kind: 'choice', title: 'Entendeu a ideia?',
    prompt: lesson.quiz.question, explanation: lesson.quiz.explanation, options: lesson.quiz.options, answer: lesson.quiz.answer,
    fen: first[0].fen, moves: [], assisted: false });
  return cards;
}

export type LessonSession = {
  version: 1; mode: SessionMode; queue: string[]; cursor: number; ply: number; mistakes: number; hints: number;
  review: string[]; mastered: string[]; feedback: null | { kind: 'correct' | 'wrong' | 'hint'; move?: string; choice?: number };
};
export function startLesson(cards: LessonCard[], mode: SessionMode): LessonSession {
  return { version: 1, mode, queue: cards.map(card => card.id), cursor: 0, ply: 0, mistakes: 0, hints: 0,
    review: [], mastered: [], feedback: null };
}
export function sessionCard(session: LessonSession, cards: LessonCard[]) { return cards.find(card => card.id === session.queue[session.cursor]); }
export function sessionDone(session: LessonSession) { return session.cursor >= session.queue.length; }
export function sessionFen(session: LessonSession, card: LessonCard) {
  const line = linePositions(card.moves, card.fen);
  const shownPly = session.ply + (session.feedback?.kind === 'correct' && card.kind === 'move' ? 1 : 0);
  return line.positions[Math.min(shownPly, card.moves.length)]!;
}
export function lessonMoveFeedback(card: LessonCard, ply: number) {
  if (card.kind !== 'move') return '';
  const before = linePositions(card.moves, card.fen).positions[ply];
  if (!before || !card.moves[ply]) return '';
  const board = new Chess(before); const move = moveUci(board, card.moves[ply]!);
  if (board.isCheckmate()) return 'Xeque e nenhuma resposta legal: o rei não pode fugir, capturar nem bloquear.';
  if (move.promotion) return `O peão chegou à última fileira e virou ${pieceNames[move.promotion]}. Reavalie a posição com a nova peça.`;
  if (move.isKingsideCastle() || move.isQueensideCastle()) return 'No roque, o rei anda duas casas e a torre passa para o lado dele em um único lance.';
  if (move.isEnPassant()) return 'O peão captura na diagonal e retira o peão que acabou de avançar duas casas.';
  if (move.captured && board.isCheck()) return `Captura com xeque: você retirou ${pieceNames[move.captured]} e o adversário precisa responder ao ataque ao rei.`;
  if (board.isCheck()) return 'É xeque. A resposta adversária precisa tirar o rei do ataque antes de continuar qualquer outro plano.';
  if (move.captured) return `Você capturou ${pieceNames[move.captured]}. Observe a resposta antes de concluir se ganhou material.`;
  return `A peça saiu de ${move.from} para ${move.to}. Confira as novas casas que ela controla e as ameaças adversárias.`;
}
function needsReview(session: LessonSession, id: string) {
  return session.review.includes(id) ? session.review : [...session.review, id];
}
export function answerLesson(session: LessonSession, card: LessonCard, answer: string | number): LessonSession {
  if ((session.feedback && session.feedback.kind !== 'hint') || sessionDone(session)) return session;
  if (card.kind === 'move') {
    if (typeof answer !== 'string') return session;
    try { const game = new Chess(sessionFen(session, card)); game.move({ from: answer.slice(0, 2), to: answer.slice(2, 4), promotion: answer.slice(4) || undefined }); }
    catch { return session; }
  } else if (card.kind === 'choice') {
    if (typeof answer !== 'number' || !Number.isInteger(answer) || !card.options?.[answer]) return session;
  } else if (typeof answer !== 'string' || !/^[a-h][1-8]$/.test(answer)) return session;
  const correct = card.kind === 'move' ? answer === card.moves[session.ply] : card.kind === 'square' ? answer === card.square : answer === card.answer;
  return { ...session, mistakes: session.mistakes + (correct ? 0 : 1),
    review: correct ? session.review : needsReview(session, card.id),
    feedback: { kind: correct ? 'correct' : 'wrong', ...(typeof answer === 'string' ? { move: answer } : { choice: answer }) } };
}
export function hintLesson(session: LessonSession, card: LessonCard): LessonSession {
  if (session.feedback || sessionDone(session)) return session;
  return { ...session, hints: session.hints + 1, review: needsReview(session, card.id), feedback: { kind: 'hint' } };
}
/** Called after a short visual confirmation. Wrong answers never skip a decision. */
export function advanceLesson(session: LessonSession, card: LessonCard): LessonSession {
  if (!session.feedback) return session;
  if (session.feedback.kind !== 'correct') return { ...session, feedback: null };
  const nextPly = session.ply + 2;
  if (card.kind === 'move' && nextPly < card.moves.length) return { ...session, ply: nextPly, feedback: null };
  const revisit = session.review.includes(card.id);
  return { ...session, cursor: session.cursor + 1, ply: 0, feedback: null,
    queue: revisit ? [...session.queue, card.id] : session.queue,
    review: session.review.filter(id => id !== card.id),
    mastered: revisit ? session.mastered : [...new Set([...session.mastered, card.id])] };
}
export function restoreLesson(raw: string | null, cards: LessonCard[], mode: SessionMode): LessonSession {
  const fallback = startLesson(cards, mode);
  try {
    const value = JSON.parse(raw ?? 'null') as LessonSession | null;
    if (!value || value.version !== 1 || value.mode !== mode || !Array.isArray(value.queue) || !Array.isArray(value.review) || !Array.isArray(value.mastered)) return fallback;
    const ids = new Set(cards.map(card => card.id));
    if (value.queue.length < cards.length || value.queue.length > 1000 || !cards.every((card, index) => value.queue[index] === card.id)
      || ![...value.queue, ...value.review, ...value.mastered].every(id => ids.has(id))
      || ![value.cursor, value.ply, value.mistakes, value.hints].every(n => Number.isInteger(n) && n >= 0)
      || value.cursor > value.queue.length || value.ply % 2 !== 0) return fallback;
    const card = sessionCard(value, cards);
    if (card && (card.kind === 'move' ? value.ply >= card.moves.length : value.ply !== 0)) return fallback;
    // Resume before the transient feedback, never auto-skip an unconfirmed move.
    return { ...value, feedback: null };
  } catch { return fallback; }
}
