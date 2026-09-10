import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { Chess } from 'chess.js';
import type { Page, Puzzle, PuzzleResult, Side } from '../../api/types';
import { api } from '../../api/client';
import { useOperation, useResource } from '../../api/hooks';
import { useAuth } from '../../auth/AuthProvider';
import { useNavigation } from '../../navigation/Navigation';
import { Badge, Button, Card, Empty, ErrorState, Field, Heading, Loading, Notice, Pagination, SourceLink } from '../../ui/components';
import { s } from '../../ui/theme';
import { ChessBoard } from '../../chess/ChessBoard';
import { sideName } from '../../chess/logic';

const themeLabels: Record<string, string> = { mate: 'Mate', mateIn1: 'Mate em 1', mateIn2: 'Mate em 2', fork: 'Garfo', pin: 'Cravada', skewer: 'Espeto', endgame: 'Final', middlegame: 'Meio-jogo', opening: 'Abertura', short: 'Curto', long: 'Longo', crushing: 'Vantagem decisiva', advantage: 'Vantagem', sacrifice: 'Sacrifício', hangingPiece: 'Peça indefesa', discoveredAttack: 'Ataque descoberto', backRankMate: 'Mate na última fileira', defensiveMove: 'Defesa', promotion: 'Promoção', quietMove: 'Lance silencioso' };
export function PuzzlesScreen() {
  const [min, setMin] = useState('600'); const [max, setMax] = useState('1600'); const [theme, setTheme] = useState('');
  const [filter, setFilter] = useState({ min: 600, max: 1600, theme: '' }); const [filterError, setFilterError] = useState<string | null>(null);
  const [page, setPage] = useState(1); const [index, setIndex] = useState(0);
  const results = useResource<Page<Puzzle>>(`/puzzles?minRating=${filter.min}&maxRating=${filter.max}&theme=${encodeURIComponent(filter.theme)}&page=${page}&pageSize=12`);
  const puzzle = results.data?.items[index];
  const apply = () => {
    const low = Number(min); const high = Number(max);
    if (!/^\d+$/.test(min) || !/^\d+$/.test(max) || low < 0 || high > 4000 || low > high) { setFilterError('Informe ratings entre 0 e 4000, com o mínimo menor ou igual ao máximo.'); return; }
    setFilterError(null); setPage(1); setIndex(0); setFilter({ min: low, max: high, theme: theme.trim() });
  };
  return <View style={s.page}><Heading eyebrow="Treine o seu olhar" title="O próximo lance muda tudo." description="Encontre a sequência. O adversário responde, e você continua até resolver." />
    <Card><View style={[s.wrap, { alignItems: 'flex-end' }]}><View style={{ flexGrow: 1, flexBasis: 100 }}><Field label="Rating mínimo" value={min} onChangeText={setMin} keyboardType="number-pad" maxLength={4} /></View>
      <View style={{ flexGrow: 1, flexBasis: 100 }}><Field label="Rating máximo" value={max} onChangeText={setMax} keyboardType="number-pad" maxLength={4} /></View>
      <View style={{ flexGrow: 2, flexBasis: 180 }}><Field label="Tema (opcional)" placeholder="Ex.: fork, mateIn2, pin" value={theme} onChangeText={setTheme} autoCapitalize="none" autoCorrect={false} onSubmitEditing={apply} /></View>
      <Button label="Filtrar" icon="search" onPress={apply} /></View><Text style={s.small}>Temas da base: fork = garfo · pin = cravada · mateIn2 = mate em 2.</Text>
      {filterError ? <ErrorState message={filterError} /> : null}</Card>
    {results.loading ? <Loading label="Buscando desafios…" /> : results.error ? <ErrorState message={results.error} retry={results.reload} /> : results.data ? <>
      <Text style={s.small}>{results.data.total.toLocaleString('pt-BR')} desafios encontrados{puzzle ? ` · Desafio ${(page - 1) * results.data.pageSize + index + 1}` : ''}</Text>
      {puzzle ? <PuzzleTrainer key={puzzle.id} puzzle={puzzle} /> : <Empty title="Nenhum puzzle nesta seleção" description="Amplie a faixa de rating ou limpe o tema para buscar outros desafios." />}
      <View style={[s.between, { flexWrap: 'wrap' }]}><Button label="Desafio anterior" icon="back" variant="secondary" disabled={index === 0} onPress={() => setIndex(n => n - 1)} />
        <Button label="Próximo desafio" icon="arrow" disabled={!results.data.items.length || index >= results.data.items.length - 1} onPress={() => setIndex(n => n + 1)} /></View>
      <Pagination page={results.data.page} pageSize={results.data.pageSize} total={results.data.total} onChange={next => { setPage(next); setIndex(0); }} />
    </> : null}
  </View>;
}
function PuzzleTrainer({ puzzle }: { puzzle: Puzzle }) {
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
    const response = await api.post<PuzzleResult>(`/puzzles/${encodeURIComponent(puzzle.id)}/attempt`, { moves: proposed, hintUsed: withHint }, signal);
    // fen is authoritative and already includes reply. Never apply the reply twice.
    new Chess(response.fen);
    setFen(response.fen); setResult(response);
    if (response.status !== 'incorrect') {
      setMoves(proposed); setLastMove(response.reply ?? uci); setHint(askingHint ? response.expectedMove : undefined);
    }
    if (response.status === 'solved') auth.refreshProgress();
  });
  return <Card><View style={[s.between, { flexWrap: 'wrap' }]}><Badge>Rating {puzzle.rating}</Badge><Text style={s.small}>Você joga de {sideName(side)}</Text></View>
    <View style={s.wrap}>{puzzle.themes.map(theme => <Badge key={theme} tone="neutral">{themeLabels[theme] ?? theme}</Badge>)}</View>
    <ChessBoard fen={fen} orientation={side} onMove={uci => attempt(uci)} disabled={operation.busy || solved || !auth.user} hint={hint} lastMove={lastMove} />
    {!auth.user ? <Notice action={<Button label="Entrar para resolver" onPress={() => navigate({ screen: 'auth' })} />}>Entre para validar seus lances e salvar o resultado deste puzzle.</Notice> : null}
    {operation.busy ? <Loading label="Validando a sequência…" /> : null}
    {operation.error ? <ErrorState message={operation.error} /> : null}
    {solved ? <Notice tone="success">Puzzle resolvido! {result.xpEarned ? `+${result.xpEarned} XP.` : 'Sem XP adicional nesta tentativa.'}</Notice>
      : result?.status === 'incorrect' ? <Notice tone="error">Ainda não é a sequência certa. A posição foi mantida para você tentar outro lance.</Notice>
      : hint ? <Notice>Dica: mova de {hint.slice(0, 2)} para {hint.slice(2, 4)}{hint[4] ? `, com promoção para ${hint[4]}` : ''}. As casas estão marcadas.</Notice>
      : result?.status === 'correct' ? <Notice tone="success">Bom lance! A resposta do adversário já foi aplicada. Continue a sequência.</Notice> : <Text style={s.muted}>A posição já inclui o primeiro lance do adversário. Encontre a continuação.</Text>}
    <View style={s.wrap}><Button label="Pedir dica" variant="secondary" disabled={!auth.user || operation.busy || solved} onPress={() => attempt()} />
      <Button label="Recomeçar" icon="refresh" variant="ghost" disabled={operation.busy} onPress={() => { setFen(puzzle.fen); setMoves([]); setResult(null); setHint(undefined); setLastMove(undefined); operation.clearError(); }} /></View>
    <Text style={s.small}>{hintUsed ? 'Dica utilizada: esta resolução não concede XP.' : 'Pedir uma dica revela o próximo lance e remove o XP desta resolução.'} Tentativas e pontuação são validadas pelo servidor.</Text>
    <SourceLink url={puzzle.sourceUrl} label="Ver partida de origem" />
  </Card>;
}
