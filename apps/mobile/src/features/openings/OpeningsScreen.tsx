import React, { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Chess } from 'chess.js';
import type { Opening, Page, Side } from '../../api/types';
import { useDebounced, useResource } from '../../api/hooks';
import { useNavigation } from '../../navigation/Navigation';
import { Badge, Button, Card, Chip, Empty, ErrorState, Field, Heading, Loading, Notice, Pagination, SourceLink } from '../../ui/components';
import { colors, s } from '../../ui/theme';
import { Icon } from '../../ui/Icon';
import { ChessBoard } from '../../chess/ChessBoard';
import { Replay } from '../../chess/Replay';
import { linePositions, sideName } from '../../chess/logic';

export function OpeningsScreen() {
  const [search, setSearch] = useState(''); const [page, setPage] = useState(1);
  const query = useDebounced(search.trim()); const { navigate } = useNavigation();
  const data = useResource<Page<Opening>>(`/openings?search=${encodeURIComponent(query)}&page=${page}&pageSize=24`);
  return <View style={s.page}><Heading eyebrow="Construa seu repertório" title="Um bom começo tem uma ideia." description="Pesquise por nome, família ou código ECO. Veja cada lance e treine a linha." />
    <Field label="Pesquisar aberturas" placeholder="Ex.: Italiana, Siciliana ou B20" value={search} onChangeText={text => { setSearch(text); setPage(1); }} autoCorrect={false} returnKeyType="search" />
    {data.loading ? <Loading label="Buscando aberturas…" /> : data.error ? <ErrorState message={data.error} retry={data.reload} /> : data.data ? <>
      <Text style={s.small}>{data.data.total.toLocaleString('pt-BR')} {data.data.total === 1 ? 'abertura encontrada' : 'aberturas encontradas'}</Text>
      {!data.data.items.length ? <Empty title="Nenhuma abertura encontrada" description="Tente outro nome ou código ECO. A busca consulta o catálogo do servidor." /> : <View style={s.stack}>{data.data.items.map(opening =>
        <Pressable key={opening.id} accessibilityRole="button" accessibilityLabel={`Estudar ${opening.name}, ${opening.eco}`} onPress={() => navigate({ screen: 'opening', id: opening.id })}
          style={({ pressed }) => [s.card, { opacity: pressed ? 0.75 : 1 }]}><View style={s.between}><Badge>{opening.eco}</Badge><Icon name="chevron" size={18} /></View>
          <Text style={s.h2}>{opening.name}</Text><Text style={s.muted}>{opening.family}</Text><Text numberOfLines={2} style={s.mono}>{opening.pgn}</Text>
          <Text style={s.small}>{opening.moves.length} meios-lances · Replay e treino</Text></Pressable>)}</View>}
      <Pagination page={data.data.page} pageSize={data.data.pageSize} total={data.data.total} onChange={setPage} />
    </> : null}</View>;
}
export function OpeningScreen({ id }: { id: string }) {
  const opening = useResource<Opening>(`/openings/${encodeURIComponent(id)}`); const { back } = useNavigation();
  return <View style={s.page}><Button label="Voltar às aberturas" icon="back" variant="ghost" onPress={back} style={{ alignSelf: 'flex-start' }} />
    {opening.loading ? <Loading label="Abrindo a linha…" /> : opening.error ? <ErrorState message={opening.error} retry={opening.reload} /> : opening.data ? <OpeningReader opening={opening.data} /> : null}</View>;
}
function OpeningReader({ opening }: { opening: Opening }) {
  const [mode, setMode] = useState<'replay' | 'train'>('replay'); const [side, setSide] = useState<Side>('w');
  return <View style={s.page}><Heading eyebrow={`${opening.eco} · ${opening.family}`} title={opening.name} description="Entenda a sequência. Depois, encontre os lances sem olhar." />
    <View style={[s.between, { flexWrap: 'wrap' }]}><View style={s.wrap}><Chip label="Explorar linha" selected={mode === 'replay'} onPress={() => setMode('replay')} /><Chip label="Treinar de memória" selected={mode === 'train'} onPress={() => setMode('train')} /></View>
      <View style={s.wrap}><Chip label="Brancas" selected={side === 'w'} onPress={() => setSide('w')} /><Chip label="Pretas" selected={side === 'b'} onPress={() => setSide('b')} /></View></View>
    <Card>{mode === 'replay' ? <Replay moves={opening.moves} orientation={side} /> : <OpeningTrainer key={side} opening={opening} side={side} />}</Card>
    {mode === 'replay' ? <Card><Text style={s.h3}>Notação da linha</Text><Text selectable style={s.mono}>{opening.pgn}</Text></Card> : null}
    <SourceLink url={opening.sourceUrl} />
  </View>;
}
function OpeningTrainer({ opening, side }: { opening: Opening; side: Side }) {
  const line = useMemo(() => { try { return linePositions(opening.moves); } catch { return null; } }, [opening.moves]);
  const start = side === 'b' && opening.moves.length ? 1 : 0;
  const [index, setIndex] = useState(start); const [message, setMessage] = useState<string | null>(null);
  const [wrong, setWrong] = useState(false); const [hint, setHint] = useState<string | undefined>();
  if (!line) return <ErrorState message="Esta linha contém lances inválidos e não pode ser treinada." />;
  if (!opening.moves.length) return <Empty title="Linha sem lances" description="Esta abertura ainda não possui uma sequência para treinar." />;
  const finished = index >= opening.moves.length;
  const fen = line.positions[index]!;
  const move = (uci: string) => {
    if (uci !== opening.moves[index]) { setWrong(true); setMessage('O lance é legal, mas esta linha segue por outro caminho. Tente novamente.'); return; }
    let next = index + 1;
    // The opponent follows the published line; no engine or invented continuation.
    if (next < opening.moves.length && new Chess(line.positions[next]!).turn() !== side) next++;
    setIndex(next); setHint(undefined); setWrong(false);
    setMessage(next >= opening.moves.length ? 'Linha concluída! Repetir ajuda a reconhecer as ideias no tabuleiro.' : 'Isso! A resposta da linha foi aplicada. Encontre seu próximo lance.');
  };
  return <View style={s.stack}><View style={s.between}><Badge>Treinando de {sideName(side)}</Badge><Text style={s.small}>{index}/{opening.moves.length} meios-lances</Text></View>
    <ChessBoard fen={fen} orientation={side} onMove={move} disabled={finished} hint={hint} lastMove={opening.moves[index - 1]} />
    {message ? <Notice tone={wrong ? 'error' : 'success'}>{message}</Notice> : <Text style={s.muted}>{side === 'b' ? 'A linha começa com o lance das brancas já aplicado. ' : ''}Faça o próximo lance da abertura.</Text>}
    <View style={s.wrap}><Button label="Recomeçar linha" icon="refresh" variant="secondary" onPress={() => { setIndex(start); setMessage(null); setHint(undefined); setWrong(false); }} />
      <Button label="Mostrar dica" variant="ghost" disabled={finished} onPress={() => { setHint(opening.moves[index]); setWrong(false); setMessage(`Procure o lance ${line.sans[index]}. As casas estão marcadas.`); }} /></View>
    <Text style={s.small}>Este é um treino local da linha publicada. Não gera XP nem altera seu progresso.</Text>
  </View>;
}
