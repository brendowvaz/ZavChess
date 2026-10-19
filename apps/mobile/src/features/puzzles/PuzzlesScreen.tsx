import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { Chess } from 'chess.js';
import type { Page, Puzzle, PuzzleResult, Side } from '../../api/types';
import { api } from '../../api/client';
import { useOperation, useResource } from '../../api/hooks';
import { useAuth } from '../../auth/AuthProvider';
import { useNavigation } from '../../navigation/Navigation';
import { Badge, Button, Card, Chip, Empty, ErrorState, Heading, Loading, ProgressBar } from '../../ui/components';
import { colors, s } from '../../ui/theme';
import { ChessBoard } from '../../chess/ChessBoard';
import { sideName } from '../../chess/logic';
import { studyRequestId } from '../learning/request-id';
import { StudyLayout, StudyMessage } from '../../ui/StudyLayout';
import { Replay } from '../../chess/Replay';
import { PositionInspector } from '../analysis/PositionInspector';
import { useAppearance } from '../../appearance/AppearanceProvider';

let sequence: string[] = [];
const recent = new Set<string>();
function startSequence(items: Puzzle[], id: string) { sequence = items.map(item => item.id); recent.clear(); recent.add(id); }

const themeLabels: Record<string, string> = { mate: 'Mate', mateIn1: 'Mate em 1', mateIn2: 'Mate em 2', fork: 'Garfo', pin: 'Cravada', skewer: 'Espeto', endgame: 'Final', middlegame: 'Meio-jogo', opening: 'Abertura', short: 'Curto', long: 'Longo', crushing: 'Vantagem decisiva', advantage: 'Vantagem', sacrifice: 'Sacrifício', hangingPiece: 'Peça indefesa', discoveredAttack: 'Ataque descoberto', backRankMate: 'Mate na última fileira', defensiveMove: 'Defesa', promotion: 'Promoção', quietMove: 'Lance silencioso' };
const featuredThemes = ['mate', 'fork', 'pin', 'skewer', 'sacrifice', 'discoveredAttack', 'quietMove', 'endgame'];
Object.assign(themeLabels, { advancedPawn: 'Peão avançado', bishopEndgame: 'Final de bispos', capturingDefender: 'Capturar defensor', clearance: 'Desobstrução', deflection: 'Desvio',
  doubleCheck: 'Xeque duplo', exposedKing: 'Rei exposto', intermezzo: 'Lance intermediário', kingsideAttack: 'Ataque ao roque', queensideAttack: 'Ataque na ala da dama', knightEndgame: 'Final de cavalos',
  pawnEndgame: 'Final de peões', queenEndgame: 'Final de damas', queenRookEndgame: 'Final de dama e torre', rookEndgame: 'Final de torres', trappedPiece: 'Peça presa', xRayAttack: 'Raio X', zugzwang: 'Zugzwang', underPromotion: 'Subpromoção', mateIn3: 'Mate em 3', mateIn4: 'Mate em 4', attraction: 'Atração', interference: 'Interferência' });
const ranks = [
  { min: 0, next: 1000, label: 'Novato', nextLabel: 'Aprendiz' }, { min: 1000, next: 1200, label: 'Aprendiz', nextLabel: 'Competidor' },
  { min: 1200, next: 1500, label: 'Competidor', nextLabel: 'Estrategista' }, { min: 1500, next: 1800, label: 'Estrategista', nextLabel: 'Especialista' },
  { min: 1800, next: 2200, label: 'Especialista', nextLabel: 'Mestre' }, { min: 2200, next: 3000, label: 'Mestre', nextLabel: 'Elite' },
  { min: 3000, next: 3501, label: 'Elite', nextLabel: 'Elite' },
];
export function PuzzlesScreen() {
  const auth = useAuth(); const initialRating = auth.user?.rating ?? 1000;
  const [page, setPage] = useState(1); const [center, setCenter] = useState(Math.round(initialRating / 200) * 200); const [theme, setTheme] = useState('');
  const [allThemes, setAllThemes] = useState(false);
  const { navigate } = useNavigation();
  const minRating = Math.max(0, center - 200); const maxRating = Math.min(4000, center + 200);
  const results = useResource<Page<Puzzle>>(`/puzzles?minRating=${minRating}&maxRating=${maxRating}&theme=${encodeURIComponent(theme)}&page=${page}&pageSize=12`);
  const rank = useMemo(() => ranks.find(item => initialRating >= item.min && initialRating < item.next) ?? ranks.at(-1)!, [initialRating]);
  const rankProgress = (initialRating - rank.min) / Math.max(1, rank.next - rank.min) * 100;
  const chooseTheme = (value: string) => { setTheme(value); setPage(1); };
  const shiftBand = (amount: number) => { setCenter(value => Math.min(3800, Math.max(200, value + amount))); setPage(1); };
  return <View style={s.page}>
    <Heading eyebrow="Treino tático adaptativo" title="Puzzles" description="Escolha uma faixa e um tema. Dicas e tentativas são livres: elas orientam a próxima revisão, mas não bloqueiam seu treino." />
    <Card><View style={s.between}><View><Text style={s.small}>Seu rating de treino</Text><Text style={{ fontSize: 34, color: colors.ink, fontWeight: '700' }}>{initialRating}</Text></View><Badge tone="gold">{rank.label}</Badge></View>
      <ProgressBar value={rankProgress} label={`Progresso de ${rank.label} para ${rank.nextLabel}`} /><Text style={s.small}>{rank.label === rank.nextLabel ? 'Você alcançou o rank mais alto do treino.' : `${Math.max(0, rank.next - initialRating)} pontos até ${rank.nextLabel}`}</Text></Card>
    <Card><Text style={s.h3}>Dificuldade</Text><View style={[s.between, { flexWrap: 'wrap' }]}><Button label="Mais fácil" variant="ghost" compact disabled={center <= 200} onPress={() => shiftBand(-200)} />
      <View style={{ alignItems: 'center' }}><Text style={s.h2}>{minRating}–{maxRating}</Text><Text style={s.small}>faixa selecionada</Text></View>
      <Button label="Mais difícil" variant="ghost" compact disabled={center >= 3800} onPress={() => shiftBand(200)} /></View>
      <Text style={s.h3}>Tema</Text><View style={s.wrap}><Chip label="Todos" selected={!theme} onPress={() => chooseTheme('')} />{(allThemes ? Object.keys(themeLabels).sort((a, b) => themeLabels[a]!.localeCompare(themeLabels[b]!)) : featuredThemes).map(id => <Chip key={id} label={themeLabels[id] ?? id} selected={theme === id} onPress={() => chooseTheme(id)} />)}</View>
      <Button label={allThemes ? 'Mostrar temas principais' : 'Ver todos os temas'} compact variant="ghost" onPress={() => setAllThemes(value => !value)} /></Card>
    {results.loading ? <Loading label="Montando sua seleção…" /> : results.error ? <ErrorState message={results.error} retry={results.reload} /> : results.data ? <>
      <View style={s.between}><Text accessibilityRole="header" style={s.h2}>{results.data.total.toLocaleString('pt-BR')} desafios disponíveis</Text>
        {results.data.items[0] ? <Button label="Começar agora" icon="arrow" onPress={() => { const id = results.data!.items[0]!.id; startSequence(results.data!.items, id); navigate({ screen: 'puzzle', id }); }} /> : null}</View>
      {!results.data.items.length ? <Empty title="Nenhum puzzle nesta combinação" description="Mude o tema ou a faixa de rating; todo o acervo continua disponível." /> : <View style={s.stack}>{results.data.items.map((puzzle, index) => <Pressable key={puzzle.id}
        accessibilityRole="button" accessibilityLabel={`Puzzle ${index + 1}, rating ${puzzle.rating}, ${puzzle.themes.map(item => themeLabels[item] ?? item).join(', ')}`}
        onPress={() => { startSequence(results.data!.items, puzzle.id); navigate({ screen: 'puzzle', id: puzzle.id }); }} style={({ pressed }) => [s.card, { opacity: pressed ? 0.72 : 1 }]}>
        <View style={s.between}><View style={s.wrap}>{puzzle.themes.slice(0, 3).map(item => <Badge key={item}>{themeLabels[item] ?? item}</Badge>)}</View><Text style={s.h3}>{puzzle.rating}</Text></View>
        <Text style={s.muted}>Desafio {(page - 1) * results.data!.pageSize + index + 1} · jogue a melhor continuação</Text>
      </Pressable>)}</View>}
      <View style={s.between}><Button label="Página anterior" icon="back" variant="secondary" disabled={page <= 1} onPress={() => setPage(value => value - 1)} />
        <Text style={s.small}>Página {page} de {Math.max(1, Math.ceil(results.data.total / results.data.pageSize))}</Text>
        <Button label="Mais desafios" icon="arrow" variant="secondary" disabled={page * results.data.pageSize >= results.data.total} onPress={() => setPage(value => value + 1)} /></View>
    </> : null}
  </View>;
}
export function PuzzleScreen({ id }: { id: string }) {
  const puzzle = useResource<Puzzle>(`/puzzles/${encodeURIComponent(id)}`);
  const [batch, setBatch] = useState(1);
  const candidates = useResource<Page<Puzzle>>(puzzle.data ? `/puzzles?minRating=${Math.max(0, puzzle.data.rating - 300)}&maxRating=${Math.min(4000, puzzle.data.rating + 300)}&page=${batch}&pageSize=50` : null);
  const { back, replace } = useNavigation();
  const next = sequence.find(item => item !== id && !recent.has(item)) ?? candidates.data?.items.find(item => item.id !== id && !recent.has(item.id))?.id;
  useEffect(() => {
    if (!next && candidates.data?.items.length && batch * candidates.data.pageSize < candidates.data.total) setBatch(value => value + 1);
  }, [next, candidates.data, batch]);
  return <View style={{ flex: 1, minHeight: 0 }}>
    {puzzle.loading ? <Loading /> : puzzle.error ? <ErrorState message={puzzle.error} retry={puzzle.reload} /> : puzzle.data ? <PuzzleTrainer key={id} puzzle={puzzle.data} onBack={back}
      onNext={next ? () => { recent.add(id); recent.add(next); if (recent.size > 500) { recent.clear(); recent.add(next); } replace({ screen: 'puzzle', id: next }); } : undefined} /> : null}
  </View>;
}
function PuzzleTrainer({ puzzle, onNext, onBack, position }: { puzzle: Puzzle; onNext?: () => void; onBack: () => void; position?: number }) {
  const practiceId = useRef(studyRequestId());
  const pending = useRef<{ key: string; requestId: string } | null>(null);
  const [fen, setFen] = useState(puzzle.fen); const [moves, setMoves] = useState<string[]>([]);
  const [hintUsed, setHintUsed] = useState(false); const [hint, setHint] = useState<string | undefined>();
  const [result, setResult] = useState<PuzzleResult | null>(null); const [lastMove, setLastMove] = useState<string | undefined>();
  const [solution, setSolution] = useState<{ fen: string; moves: string[] } | null>(null);
  const { appearance } = useAppearance();
  const [showSolution, setShowSolution] = useState(false); const [inspect, setInspect] = useState(false); const [continuous, setContinuous] = useState(appearance.autoAdvance);
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
    const response = await api.post<PuzzleResult>(`/puzzles/${encodeURIComponent(puzzle.id)}/${auth.user ? 'attempt' : 'check'}`, { moves: proposed, hintUsed: withHint, practiceId: practiceId.current, requestId: pending.current.requestId }, signal);
    // fen is authoritative and already includes reply. Never apply the reply twice.
    new Chess(response.fen);
    pending.current = null;
    setFen(response.fen); setResult(response);
    if (response.status !== 'incorrect') {
      setMoves(proposed); setLastMove(response.reply ?? uci); setHint(askingHint ? response.expectedMove : undefined);
    }
    if (response.status === 'solved') auth.refreshProgress();
  });
  useEffect(() => {
    if (!solved || !continuous || !onNext || inspect || showSolution) return;
    const timer = setTimeout(onNext, 1800);
    return () => clearTimeout(timer);
  }, [solved, continuous, onNext, inspect, showSolution]);
  const reset = () => { if (solved) { practiceId.current = studyRequestId(); setHintUsed(false); } pending.current = null; setSolution(null); setFen(puzzle.fen); setMoves([]); setResult(null); setHint(undefined); setLastMove(undefined); operation.clearError(); };
  const revealSolution = () => void operation.run(async signal => {
    const answer = await api.get<{ fen: string; moves: string[] }>(`/puzzles/${encodeURIComponent(puzzle.id)}/solution`, signal);
    setHintUsed(true); setContinuous(false); setSolution(answer); setShowSolution(true);
  });
  const message = operation.busy ? <StudyMessage>Conferindo a posição…</StudyMessage>
    : operation.error ? <StudyMessage tone="error">{operation.error}</StudyMessage>
    : solved ? <StudyMessage tone="success">Puzzle resolvido{result.xpEarned ? ` · +${result.xpEarned} XP` : ''}.</StudyMessage>
    : result?.status === 'incorrect' ? <StudyMessage tone="error">Ainda não. Tente outro lance.</StudyMessage>
    : hint ? <StudyMessage>Dica: {hint.slice(0, 2)} → {hint.slice(2, 4)}.</StudyMessage>
    : result?.status === 'correct' ? <StudyMessage tone="success">Bom lance. Continue a sequência.</StudyMessage>
    : <StudyMessage>Encontre a melhor continuação.</StudyMessage>;
  const actions = solved ? <View style={[s.wrap, { justifyContent: 'center' }]}><Button label="Refazer" icon="refresh" compact variant="ghost" onPress={reset} />
      <Button label="Analisar" compact variant="secondary" onPress={() => { setContinuous(false); setInspect(true); }} />
      <Button label={onNext ? 'Próximo puzzle' : 'Voltar ao treino'} icon="arrow" onPress={() => onNext ? onNext() : navigate({ screen: 'puzzles' })} /></View>
    : <View style={[s.wrap, { justifyContent: 'center' }]}><Button label="Pedir dica" variant="secondary" compact disabled={operation.busy} onPress={() => attempt()} />
      <Button label="Mostrar solução" variant="ghost" compact disabled={operation.busy} onPress={revealSolution} />
      <Button label="Recomeçar" icon="refresh" variant="ghost" compact disabled={operation.busy} onPress={reset} /></View>;
  const theme = puzzle.themes.map(item => themeLabels[item] ?? item).slice(0, 2).join(' · ');
  return <><StudyLayout title={theme || 'Puzzle'} subtitle={`Rating ${puzzle.rating} · ${sideName(side)}`} eyebrow={position ? `Desafio ${position}` : 'Treino tático'}
    topAction={<Button label={continuous ? 'Pausar fila' : 'Auto'} variant="ghost" compact onPress={() => setContinuous(value => !value)} />}
    onBack={onBack} progress={solved ? 100 : result?.status === 'correct' ? 65 : moves.length ? 35 : 8}
    renderBoard={maxSize => <ChessBoard fen={fen} orientation={side} maxSize={maxSize} onMove={uci => attempt(uci)}
      disabled={operation.busy || solved} hint={hint} lastMove={lastMove} hideStatus />}
    status={message} actions={actions} />
    {inspect ? <PositionInspector fen={fen} onClose={() => setInspect(false)} /> : null}
    <Modal visible={showSolution} animationType="slide" onRequestClose={() => setShowSolution(false)}><ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={{ padding: 16, gap: 16 }}>
      <Text style={s.h2}>Veja a ideia completa</Text><Text style={s.muted}>Reproduza os dois lados e observe a resposta à ameaça. Revelar a solução não conclui o desafio.</Text>
      {solution ? <Replay moves={solution.moves} initialFen={solution.fen} orientation={side} /> : null}
      <View style={s.wrap}><Button label="Tentar sozinho" onPress={() => setShowSolution(false)} /><Button label="Analisar posição" variant="secondary" onPress={() => { setShowSolution(false); setInspect(true); }} />
        {onNext ? <Button label="Próximo desafio" variant="ghost" onPress={onNext} /> : null}</View>
    </ScrollView></Modal></>;
}
