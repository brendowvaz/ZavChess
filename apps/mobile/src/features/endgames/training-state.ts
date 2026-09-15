import type { TrainingExercise, TrainingFeedback, TrainingPosition, TrainingTurn } from './contracts';

export interface TrainingState {
  exercise: TrainingExercise | null; position: TrainingPosition | null; history: string[];
  feedback: TrainingFeedback | null; hint: string | null; error: string | null;
  operation: 'generate' | 'move' | 'hint' | null; requestId: number;
}
export const initialTrainingState: TrainingState = {
  exercise: null, position: null, history: [], feedback: null, hint: null, error: null, operation: null, requestId: 0,
};
type Action =
  | { type: 'start'; requestId: number; operation: NonNullable<TrainingState['operation']> }
  | { type: 'failure'; requestId: number; error: string }
  | { type: 'exercise'; requestId: number; exercise: TrainingExercise }
  | { type: 'move'; requestId: number; result: TrainingTurn }
  | { type: 'hint'; requestId: number; position: TrainingPosition }
  | { type: 'reset'; requestId: number };
export function trainingReducer(state: TrainingState, action: Action): TrainingState {
  if (action.type === 'start') return { ...state, operation: action.operation, requestId: action.requestId, error: null };
  if (action.type === 'reset') return { ...state, position: state.exercise?.tablebase || null, history: [], feedback: null, hint: null, error: null, operation: null, requestId: action.requestId };
  if (action.requestId !== state.requestId) return state;
  if (action.type === 'failure') return { ...state, error: action.error, operation: null };
  if (action.type === 'exercise') return { ...initialTrainingState, requestId: action.requestId, exercise: action.exercise, position: action.exercise.tablebase };
  if (action.type === 'hint') return { ...state, position: action.position, hint: action.position.bestMove, operation: null,
    error: action.position.bestMove ? null : 'Não há dica certificada para esta posição.' };
  return { ...state, position: action.result.position, history: action.result.history, feedback: action.result.feedback, hint: null, operation: null, error: null };
}
export const categoryLabels: Record<TrainingPosition['category'], string> = {
  win: 'Vitória com jogo perfeito', loss: 'Derrota com jogo perfeito', draw: 'Empate com jogo perfeito',
  'cursed-win': 'Vitória teórica; empate com a regra dos 50 lances', 'blessed-loss': 'Derrota teórica; empate com a regra dos 50 lances',
  'maybe-win': 'Vitória incerta: tablebase parcial ou regra dos 50 lances', 'maybe-loss': 'Derrota incerta: tablebase parcial ou regra dos 50 lances',
  'syzygy-win': 'Vitória incerta por arredondamento do DTZ', 'syzygy-loss': 'Derrota incerta por arredondamento do DTZ', unknown: 'Resultado desconhecido',
};
export function endgameStatus(position: TrainingPosition): string {
  const labels = {
    checkmate: `Xeque-mate. Vitória das ${position.turn === 'w' ? 'pretas' : 'brancas'}.`,
    stalemate: 'Empate por afogamento.', 'insufficient-material': 'Empate por material insuficiente.',
    'threefold-repetition': 'Empate por repetição tripla.', 'fifty-moves': 'Empate pela regra dos 50 lances.',
  };
  return position.terminal ? labels[position.terminal] : categoryLabels[position.category];
}
