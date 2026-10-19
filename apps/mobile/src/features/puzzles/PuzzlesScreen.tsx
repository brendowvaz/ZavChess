import React, { useRef, useState } from 'react';
import { View } from 'react-native';
import { Chess } from 'chess.js';
import type { Page, Puzzle, PuzzleResult, Side } from '../../api/types';
import { api } from '../../api/client';
import { useOperation, useResource } from '../../api/hooks';
import { useAuth } from '../../auth/AuthProvider';
import { useNavigation } from '../../navigation/Navigation';
import { Button, ErrorState, Loading } from '../../ui/components';
import { s } from '../../ui/theme';
import { ChessBoard } from '../../chess/ChessBoard';
import { sideName } from '../../chess/logic';
import { studyRequestId } from '../learning/request-id';
import { StudyLayout, StudyMessage } from '../../ui/StudyLayout';

const themeLabels: Record<string, string> = { mate: 'Mate', mateIn1: 'Mate em 1', mateIn2: 'Mate em 2', fork: 'Garfo', pin: 'Cravada', skewer: 'Espeto', endgame: 'Final', middlegame: 'Meio-jogo', opening: 'Abertura', short: 'Curto', long: 'Longo', crushing: 'Vantagem decisiva', advantage: 'Vantagem', sacrifice: 'Sacrifício', hangingPiece: 'Peça indefesa', discoveredAttack: 'Ataque descoberto', backRankMate: 'Mate na última fileira', defensiveMove: 'Defesa', promotion: 'Promoção', quietMove: 'Lance silencioso' };
export function PuzzlesScreen() {
  const [page, setPage] = useState(1); const [index, setIndex] = useState(0);
  const { navigate } = useNavigation();
  const results = useResource<Page<Puzzle>>(`/puzzles?minRating=600&maxRating=2000&theme=&page=${page}&pageSize=12`);
  const puzzle = results.data?.items[index];
  const next = () => {
    if (!results.data) return;
    if (index < results.data.items.length - 1) setIndex(value => value + 1);
    else if (page * results.data.pageSize < results.data.total) { setPage(value => value + 1); setIndex(0); }
    else { setPage(1); setIndex(0); }
  };
  return <View style={{ flex: 1, minHeight: 0 }}>{results.loading ? <Loading label="Buscando desafio…" />
    : results.error ? <ErrorState message={results.error} retry={results.reload} />
    : puzzle ? <PuzzleTrainer key={puzzle.id} puzzle={puzzle} onNext={next} onBack={() => navigate({ screen: 'home' })}
      position={(page - 1) * (results.data?.pageSize ?? 12) + index + 1} />
    : <ErrorState message="Nenhum puzzle disponível nesta faixa." retry={results.reload} />}</View>;
}
export function PuzzleScreen({ id }: { id: string }) {
  const puzzle = useResource<Puzzle>(`/puzzles/${encodeURIComponent(id)}`);
  const { back } = useNavigation();
  return <View style={{ flex: 1, minHeight: 0 }}>
    {puzzle.loading ? <Loading /> : puzzle.error ? <ErrorState message={puzzle.error} retry={puzzle.reload} /> : puzzle.data ? <PuzzleTrainer key={id} puzzle={puzzle.data} onBack={back} /> : null}
  </View>;
}
function PuzzleTrainer({ puzzle, onNext, onBack, position }: { puzzle: Puzzle; onNext?: () => void; onBack: () => void; position?: number }) {
  const practiceId = useRef(studyRequestId());
  const pending = useRef<{ key: string; requestId: string } | null>(null);
  const [fen, setFen] = useState(puzzle.fen); const [moves, setMoves] = useState<string[]>([]);
  const [hintUsed, setHintUsed] = useState(false); const [hint, setHint] = useState<string | undefined>();
  const [result, setResult] = useState<PuzzleResult | null>(null); const [lastMove, setLastMove] = useState<string | undefined>();
  const operation = useOperation(); const auth = useAuth(); const { navigate } = useNavigation();
  let side: Side; try { side = new Chess(puzzle.fen).turn(); } catch { return <ErrorState message="Este puzzle possui uma posição inválida." />; }
  const solved = result?.status === 'solved';
  const attempt = (uci?: string) => void operation.run(async signal => {
    const askingHint = !uci;
    // Hint use stays sticky, even if a request fails or the same puzzle is restarted.
    const withHint = hintUsed || askingHint;
    if (askingHint) setHintUsed(true);
    const proposed = uci ? [...moves, uci] : moves;
    const key = JSON.stringify({ proposed, withHint });
    if (pending.current?.key !== key) pending.current = { key, requestId: studyRequestId() };
    const response = await api.post<PuzzleResult>(`/puzzles/${encodeURIComponent(puzzle.id)}/attempt`, { moves: proposed, hintUsed: withHint, practiceId: practiceId.current, requestId: pending.current.requestId }, signal);
    // fen is authoritative and already includes reply. Never apply the reply twice.
    new Chess(response.fen);
    pending.current = null;
    setFen(response.fen); setResult(response);
    if (response.status !== 'incorrect') {
      setMoves(proposed); setLastMove(response.reply ?? uci); setHint(askingHint ? response.expectedMove : undefined);
    }
    if (response.status === 'solved') auth.refreshProgress();
  });
  const reset = () => { if (solved) { practiceId.current = studyRequestId(); setHintUsed(false); } pending.current = null; setFen(puzzle.fen); setMoves([]); setResult(null); setHint(undefined); setLastMove(undefined); operation.clearError(); };
  const message = !auth.user ? <StudyMessage>Entre para validar seus lances e salvar seu progresso.</StudyMessage>
    : operation.busy ? <StudyMessage>Validando o lance…</StudyMessage>
    : operation.error ? <StudyMessage tone="error">{operation.error}</StudyMessage>
    : solved ? <StudyMessage tone="success">Puzzle resolvido{result.xpEarned ? ` · +${result.xpEarned} XP` : ''}.</StudyMessage>
    : result?.status === 'incorrect' ? <StudyMessage tone="error">Ainda não. Tente outro lance.</StudyMessage>
    : hint ? <StudyMessage>Dica: {hint.slice(0, 2)} → {hint.slice(2, 4)}.</StudyMessage>
    : result?.status === 'correct' ? <StudyMessage tone="success">Bom lance. Continue a sequência.</StudyMessage>
    : <StudyMessage>Encontre a melhor continuação.</StudyMessage>;
  const actions = !auth.user ? <Button label="Entrar para resolver" onPress={() => navigate({ screen: 'auth' })} />
    : solved ? <View style={[s.row, { justifyContent: 'center' }]}><Button label="Refazer" icon="refresh" compact variant="ghost" onPress={reset} />
      <Button label={onNext ? 'Próximo puzzle' : 'Voltar ao treino'} icon="arrow" onPress={() => onNext ? onNext() : navigate({ screen: 'puzzles' })} /></View>
    : <View style={[s.row, { justifyContent: 'center' }]}><Button label="Dica" variant="secondary" compact disabled={operation.busy} onPress={() => attempt()} />
      <Button label="Recomeçar" icon="refresh" variant="ghost" compact disabled={operation.busy} onPress={reset} /></View>;
  const theme = puzzle.themes.map(item => themeLabels[item] ?? item).slice(0, 2).join(' · ');
  return <StudyLayout title={theme || 'Puzzle'} subtitle={`Rating ${puzzle.rating} · ${sideName(side)}`} eyebrow={position ? `Desafio ${position}` : 'Treino tático'}
    onBack={onBack} progress={solved ? 100 : result?.status === 'correct' ? 65 : moves.length ? 35 : 8}
    renderBoard={maxSize => <ChessBoard fen={fen} orientation={side} maxSize={maxSize} onMove={uci => attempt(uci)}
      disabled={operation.busy || solved || !auth.user} hint={hint} lastMove={lastMove} hideStatus />}
    status={message} actions={actions} />;
}
