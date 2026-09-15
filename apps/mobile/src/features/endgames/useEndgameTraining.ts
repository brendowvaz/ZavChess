import { useEffect, useReducer, useRef } from 'react';
import { errorMessage, isAbort, request } from '../../api/client';
import type { EndgameTheme, TrainingExercise, TrainingPosition, TrainingTurn } from './contracts';
import { initialTrainingState, trainingReducer } from './training-state';

export function useEndgameTraining() {
  const [state, dispatch] = useReducer(trainingReducer, initialTrainingState);
  const sequence = useRef(0);
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => { sequence.current++; pending.current?.abort(); }, []);
  async function run(operation: 'generate' | 'move' | 'hint', work: (signal: AbortSignal, id: number) => Promise<void>) {
    if (pending.current) return;
    const controller = new AbortController(); pending.current = controller;
    const id = ++sequence.current;
    dispatch({ type: 'start', operation, requestId: id });
    try { await work(controller.signal, id); }
    catch (error) { if (!isAbort(error) && id === sequence.current) dispatch({ type: 'failure', requestId: id, error: errorMessage(error) }); }
    finally { if (id === sequence.current) pending.current = null; }
  }
  function generate(theme: EndgameTheme, lesson?: 'lucena' | 'philidor') {
    return run('generate', async (signal, requestId) => {
      const exclude = state.exercise ? `&excludeFen=${encodeURIComponent(state.exercise.fen)}` : '';
      const exercise = await request<TrainingExercise>(`/endgame-training/generate?theme=${theme}${lesson ? `&lesson=${lesson}` : exclude}`, { signal, timeout: 30000 });
      dispatch({ type: 'exercise', requestId, exercise });
    });
  }
  function open(exercise: Omit<TrainingExercise, 'tablebase' | 'objective'>) {
    return run('generate', async (signal, requestId) => {
      const tablebase = await request<TrainingPosition>('/endgame-training/position', { method: 'POST', signal, body: { initialFen: exercise.fen, history: [] } });
      if (tablebase.terminal || !tablebase.bestMove || (tablebase.outcome !== 'win' && tablebase.outcome !== 'draw')) throw new Error('Esta posição não possui objetivo de vitória ou empate certificado para quem tem a vez.');
      dispatch({ type: 'exercise', requestId, exercise: { ...exercise, side: tablebase.turn, objective: tablebase.outcome, tablebase } });
    });
  }
  function move(move: string) {
    if (!state.exercise || state.position?.terminal) return;
    const body = { initialFen: state.exercise.fen, history: state.history, move };
    return run('move', async (signal, requestId) => {
      const result = await request<TrainingTurn>('/endgame-training/move', { method: 'POST', signal, body, timeout: 35000 });
      dispatch({ type: 'move', requestId, result });
    });
  }
  function hint() {
    if (!state.exercise || state.position?.terminal) return;
    const body = { initialFen: state.exercise.fen, history: state.history };
    return run('hint', async (signal, requestId) => {
      const position = await request<TrainingPosition>('/endgame-training/position', { method: 'POST', signal, body });
      dispatch({ type: 'hint', requestId, position });
    });
  }
  function reset() {
    pending.current?.abort(); pending.current = null;
    dispatch({ type: 'reset', requestId: ++sequence.current });
  }
  return { state, generate, open, move, hint, reset };
}
