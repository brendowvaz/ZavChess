import { Chess } from 'chess.js';
import type { OpeningAttempt, OpeningAttemptResult, StudySide } from './education-contracts';

export interface OpeningTraining {
  line: readonly string[]; positions: readonly string[]; sans: readonly string[];
  index: number; side: StudySide; moves: readonly string[]; mistakes: number; hintUsed: boolean; requestId: string;
}
export function newOpeningRequestId(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  // Native runtimes without randomUUID: uniqueness token, never an auth secret.
  return `opening-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}
export function beginOpeningTraining(line: readonly string[], side: StudySide, requestId: string): OpeningTraining {
  const game = new Chess(); const positions = [game.fen()]; const sans: string[] = [];
  for (const uci of line) {
    if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci)) throw new Error('Lance UCI inválido.');
    const move = game.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
    sans.push(move.san); positions.push(game.fen());
  }
  return { line: [...line], positions, sans, index: side === 'b' && line.length ? 1 : 0,
    side, moves: [], mistakes: 0, hintUsed: false, requestId };
}
export function trainingFinished(state: OpeningTraining): boolean {
  return state.index >= state.line.length && state.moves.length > 0;
}
export function hintOpeningTraining(state: OpeningTraining): OpeningTraining {
  return state.index < state.line.length ? { ...state, hintUsed: true } : state;
}
export function moveOpeningTraining(state: OpeningTraining, move: string): OpeningTraining {
  if (state.index >= state.line.length) return state;
  if (move !== state.line[state.index]) return { ...state, mistakes: state.mistakes + 1 };
  // Standard starting position, alternating sides. Advance one student move and
  // at most one automatic opponent reply, including the final opponent reply.
  return { ...state, index: Math.min(state.index + 2, state.line.length), moves: [...state.moves, move] };
}
export function completedOpeningAttempt(state: OpeningTraining): OpeningAttempt | null {
  if (!trainingFinished(state)) return null;
  return { moves: [...state.moves], side: state.side, hintUsed: state.hintUsed,
    mistakes: state.mistakes, requestId: state.requestId };
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
          const result = await post(record.openingId, { ...record.attempt, moves: [...record.attempt.moves] });
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
