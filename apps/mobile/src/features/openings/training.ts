import { Chess } from 'chess.js';
import type { OpeningAttempt, OpeningAttemptResult, StudySide } from './education-contracts';

export interface OpeningTraining {
  line: readonly string[]; positions: readonly string[]; sans: readonly string[];
  studentPlies: readonly number[]; queue: readonly number[]; cursor: number;
  phase: 'learn' | 'practice' | 'review' | 'complete';
  status: Readonly<Record<number, 'todo' | 'wrong' | 'correct'>>;
  errors: Readonly<Record<number, number>>;
  index: number; side: StudySide; moves: readonly string[]; mistakes: number; hintUsed: boolean; requestId: string;
  revealed: boolean; outcome: 'correct' | 'wrong' | 'dont-know' | null; attemptedMove?: string;
}
export function newOpeningRequestId(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  // Native runtimes without randomUUID: uniqueness token, never an auth secret.
  return `opening-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}
export function beginOpeningTraining(line: readonly string[], side: StudySide, requestId: string, focusPly?: number): OpeningTraining {
  const game = new Chess(); const positions = [game.fen()]; const sans: string[] = [];
  for (const uci of line) {
    if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci)) throw new Error('Lance UCI inválido.');
    const move = game.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
    sans.push(move.san); positions.push(game.fen());
  }
  const allStudentPlies = line.flatMap((_, index) => index % 2 === (side === 'w' ? 0 : 1) ? [index] : []);
  const studentPlies = focusPly !== undefined && allStudentPlies.includes(focusPly) ? [focusPly] : allStudentPlies;
  const status = Object.fromEntries(studentPlies.map(index => [index, 'todo' as const]));
  return { line: [...line], positions, sans, studentPlies, queue: studentPlies, cursor: 0,
    phase: 'learn', status, errors: {}, index: studentPlies[0] ?? line.length,
    side, moves: [], mistakes: 0, hintUsed: false, requestId, revealed: false, outcome: null, attemptedMove: undefined };
}
export function trainingFinished(state: OpeningTraining): boolean {
  return state.phase === 'complete';
}
export function hintOpeningTraining(state: OpeningTraining): OpeningTraining {
  if ((state.phase !== 'practice' && state.phase !== 'review') || state.revealed) return state;
  return { ...state, hintUsed: true, mistakes: state.mistakes + 1, revealed: true, outcome: 'dont-know',
    status: { ...state.status, [state.index]: 'wrong' }, errors: { ...state.errors, [state.index]: (state.errors[state.index] ?? 0) + 1 }, attemptedMove: undefined };
}
export function moveOpeningTraining(state: OpeningTraining, move: string): OpeningTraining {
  if ((state.phase !== 'practice' && state.phase !== 'review') || state.revealed || state.index >= state.line.length) return state;
  if (move !== state.line[state.index]) return { ...state, mistakes: state.mistakes + 1, revealed: true, outcome: 'wrong',
    status: { ...state.status, [state.index]: 'wrong' }, errors: { ...state.errors, [state.index]: (state.errors[state.index] ?? 0) + 1 }, attemptedMove: move };
  return { ...state, revealed: true, outcome: 'correct', status: { ...state.status, [state.index]: 'correct' }, attemptedMove: undefined };
}
export function advanceOpeningTraining(state: OpeningTraining): OpeningTraining {
  if (state.phase === 'complete') return state;
  if (state.phase === 'learn') {
    if (state.cursor + 1 < state.studentPlies.length) {
      const cursor = state.cursor + 1;
      return { ...state, cursor, index: state.studentPlies[cursor]!, revealed: false, outcome: null, attemptedMove: undefined };
    }
    return { ...state, phase: 'practice', queue: state.studentPlies, cursor: 0,
      index: state.studentPlies[0] ?? state.line.length, revealed: false, outcome: null, attemptedMove: undefined };
  }
  if (!state.revealed) return state;
  if (state.cursor + 1 < state.queue.length) {
    const cursor = state.cursor + 1;
    return { ...state, cursor, index: state.queue[cursor]!, revealed: false, outcome: null, attemptedMove: undefined };
  }
  const errors = state.studentPlies.filter(index => state.status[index] === 'wrong');
  if (errors.length) return { ...state, phase: 'review', queue: errors, cursor: 0, index: errors[0]!, revealed: false, outcome: null, attemptedMove: undefined };
  const moves = state.studentPlies.map(index => state.line[index]!);
  return { ...state, phase: 'complete', queue: [], cursor: 0, index: state.line.length, moves, revealed: false, outcome: null, attemptedMove: undefined };
}
export function openingTrainingCounts(state: OpeningTraining) {
  return state.studentPlies.reduce((counts, index) => {
    const status = state.status[index] ?? 'todo';
    counts[status]++;
    return counts;
  }, { todo: 0, wrong: 0, correct: 0 });
}
export function completedOpeningAttempt(state: OpeningTraining): OpeningAttempt | null {
  if (!trainingFinished(state)) return null;
  return { moves: [...state.moves], plies: [...state.studentPlies], side: state.side, hintUsed: state.hintUsed,
    mistakes: state.mistakes, positionMistakes: state.studentPlies.map(ply => state.errors[ply] ?? 0), requestId: state.requestId };
}

export interface CompletedOpening {
  openingId: string; openingName: string; attempt: OpeningAttempt;
  ownerId: string | null; status: 'pending' | 'saving' | 'saved' | 'error';
  error?: string; result?: OpeningAttemptResult;
}
type PostAttempt = (openingId: string, attempt: OpeningAttempt) => Promise<OpeningAttemptResult>;
/** Feature-owned in-memory outbox survives route changes and the login screen.
 * A failed request retains its immutable payload/id; an explicit retry can never
 * create a second logical attempt. Guest records are claimed by the next login.
 */
export function createOpeningCompletionStore() {
  let records: CompletedOpening[] = [];
  const listeners = new Set<() => void>();
  const inflight = new Map<string, Promise<void>>();
  const emit = () => { for (const listener of listeners) listener(); };
  const update = (id: string, patch: Partial<CompletedOpening>) => {
    records = records.map(record => record.attempt.requestId === id ? { ...record, ...patch } : record); emit();
  };
  return {
    getSnapshot: () => records,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    enqueue(openingId: string, openingName: string, state: OpeningTraining, ownerId: string | null) {
      const attempt = completedOpeningAttempt(state);
      if (!attempt || records.some(record => record.attempt.requestId === attempt.requestId)) return;
      records = [...records, { openingId, openingName, attempt, ownerId, status: 'pending' }]; emit();
    },
    async save(requestId: string, userId: string, post: PostAttempt): Promise<void> {
      if (inflight.has(requestId)) return inflight.get(requestId);
      const record = records.find(item => item.attempt.requestId === requestId);
      if (!record || record.status === 'saved' || (record.ownerId && record.ownerId !== userId)) return;
      update(requestId, { ownerId: userId, status: 'saving', error: undefined });
      const work = Promise.resolve().then(async () => {
        try {
          // Copy the payload so a transport cannot mutate a retry's source.
          const result = await post(record.openingId, { ...record.attempt, moves: [...record.attempt.moves], plies: [...record.attempt.plies], positionMistakes: [...record.attempt.positionMistakes] });
          if (result?.completed !== true || typeof result.reviewId !== 'string' || !result.reviewId ||
              typeof result.nextReviewAt !== 'string' || !Number.isFinite(Date.parse(result.nextReviewAt))) {
            throw new Error('O servidor não confirmou a conclusão. Tente salvar novamente.');
          }
          update(requestId, { status: 'saved', result });
        } catch (error) {
          update(requestId, { status: 'error', error: error instanceof Error ? error.message : 'Não foi possível salvar a conclusão.' });
        } finally { inflight.delete(requestId); }
      });
      inflight.set(requestId, work);
      return work;
    },
  };
}
export const openingCompletions = createOpeningCompletionStore();
