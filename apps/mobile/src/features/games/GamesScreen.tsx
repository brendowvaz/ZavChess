import React, { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { api } from '../../api/client';
import { useOperation, useResource } from '../../api/hooks';
import { useAuth } from '../../auth/AuthProvider';
import { useNavigation } from '../../navigation/Navigation';
import { Badge, Button, Card, Chip, Empty, ErrorState, Field, Heading, Loading, Notice } from '../../ui/components';
import { Icon } from '../../ui/Icon';
import { colors, s } from '../../ui/theme';

type Platform = 'chesscom' | 'lichess';
type ImportedGame = {
  id: string; platform: Platform; username: string; playedAt: string | null; color: 'w' | 'b';
  openingId: string | null; opening: { id: string; name: string; eco: string } | null;
  firstMissPly: number | null; summary: string; needsPractice: boolean;
  opponent: string | null; opponentRating: number | null; result: string | null; speed: string | null; moveCount: number; analyzedMoves: number;
};
type ImportResult = { imported: number; matched: number; weaknesses: number; recommendations: { openingId: string; count: number; summary: string }[] };

export function GamesScreen() {
  const auth = useAuth(); const { navigate } = useNavigation(); const importer = useOperation();
  const games = useResource<ImportedGame[]>(auth.user ? '/learning/games' : null, auth.revision);
  const [platform, setPlatform] = useState<Platform>('chesscom'); const [username, setUsername] = useState('');
  const [source, setSource] = useState<'all' | Platform>('all'); const [focus, setFocus] = useState<'all' | 'practice' | 'covered'>('all');
  const [result, setResult] = useState<ImportResult | null>(null);
  const [speed, setSpeed] = useState('all'); const [outcome, setOutcome] = useState('all'); const [sort, setSort] = useState('recent');
  const filtered = useMemo(() => (games.data ?? []).filter(game => (source === 'all' || game.platform === source)
    && (focus === 'all' || (focus === 'practice' ? game.needsPractice : !game.needsPractice))
    && (speed === 'all' || game.speed === speed) && (outcome === 'all' || game.result === outcome))
    .sort((a, b) => sort === 'rating' ? (b.opponentRating ?? 0) - (a.opponentRating ?? 0) : sort === 'review' ? Number(b.needsPractice) - Number(a.needsPractice) : (b.playedAt ?? '').localeCompare(a.playedAt ?? '')), [games.data, source, focus, speed, outcome, sort]);
  return <View style={s.page}>
    <Heading eyebrow="Jogue, revise, corrija" title="Partidas" description="Jogue contra o motor, analise posições e transforme suas partidas públicas em um plano de treino." />
    <View style={s.wrap}><Button label="Jogar contra o motor" icon="play" onPress={() => navigate({ screen: 'analysis' })} />
      <Button label="Abrir análise livre" icon="spark" variant="secondary" onPress={() => navigate({ screen: 'analysis' })} /></View>
    {!auth.user ? <Card><Text style={s.h2}>Conecte seu progresso</Text><Text style={s.muted}>Você pode jogar e analisar sem conta. Entre apenas para importar partidas públicas e guardar seus diagnósticos.</Text>
      <Button label="Entrar ou criar conta" onPress={() => navigate({ screen: 'auth' })} style={{ alignSelf: 'flex-start' }} /></Card> : <>
      <Card><View style={s.between}><View style={s.wrap}><Badge tone="gold">DIAGNÓSTICO DE ABERTURA</Badge><Badge tone="neutral">SEM LIMITE</Badge></View><Icon name="search" /></View>
        <Text style={s.h2}>Revise o que aconteceu nas suas partidas.</Text><Text style={s.muted}>Importe até 50 partidas públicas recentes por vez. O Zav distingue seu desvio de uma resposta adversária fora do repertório e cria um atalho para a posição certa.</Text>
        <View style={s.wrap}><Chip label="Chess.com" selected={platform === 'chesscom'} onPress={() => setPlatform('chesscom')} /><Chip label="Lichess" selected={platform === 'lichess'} onPress={() => setPlatform('lichess')} /></View>
        <Field label="Nome público do jogador" value={username} onChangeText={setUsername} autoCorrect={false} autoCapitalize="none"
          placeholder={platform === 'chesscom' ? 'Seu usuário no Chess.com' : 'Seu usuário no Lichess'} />
        <Button label="Importar e diagnosticar" icon="refresh" busy={importer.busy} disabled={username.trim().length < 2} style={{ alignSelf: 'flex-start' }} onPress={() => void importer.run(async signal => {
          const imported = await api.post<ImportResult>('/learning/games/import', { platform, username: username.trim() }, signal);
          setResult(imported); games.reload(); auth.refreshProgress();
        })} />
        {importer.error ? <ErrorState message={importer.error} /> : null}
        {result ? <Notice tone="success">{result.imported} partidas lidas · {result.matched} reconhecidas no repertório · {result.weaknesses} decisões para revisar.</Notice> : null}
      </Card>
      <View style={s.between}><Text accessibilityRole="header" style={s.h2}>Partidas importadas</Text><Button label="Atualizar" icon="refresh" compact variant="ghost" onPress={games.reload} /></View>
      <View style={s.wrap}><Chip label="Todas as fontes" selected={source === 'all'} onPress={() => setSource('all')} /><Chip label="Chess.com" selected={source === 'chesscom'} onPress={() => setSource('chesscom')} /><Chip label="Lichess" selected={source === 'lichess'} onPress={() => setSource('lichess')} /></View>
      <View style={s.wrap}><Chip label="Todas" selected={focus === 'all'} onPress={() => setFocus('all')} /><Chip label="Para revisar" selected={focus === 'practice'} onPress={() => setFocus('practice')} /><Chip label="No repertório" selected={focus === 'covered'} onPress={() => setFocus('covered')} /></View>
      <View style={s.wrap}>{[['all', 'Todos os ritmos'], ['bullet', 'Bullet'], ['blitz', 'Blitz'], ['rapid', 'Rápido'], ['classical', 'Clássico']].map(([id, label]) => <Chip key={id} label={label!} selected={speed === id} onPress={() => setSpeed(id!)} />)}</View>
      <View style={s.wrap}>{[['all', 'Todos os resultados'], ['win', 'Vitórias'], ['draw', 'Empates'], ['loss', 'Derrotas']].map(([id, label]) => <Chip key={id} label={label!} selected={outcome === id} onPress={() => setOutcome(id!)} />)}</View>
      <View style={s.wrap}>{[['recent', 'Recentes'], ['rating', 'Maior rating'], ['review', 'Prioridade de treino']].map(([id, label]) => <Chip key={id} label={label!} selected={sort === id} onPress={() => setSort(id!)} />)}</View>
      {games.loading ? <Loading label="Carregando diagnósticos…" /> : games.error ? <ErrorState message={games.error} retry={games.reload} /> : !filtered.length ? <Empty title="Nenhuma partida neste filtro" description="Importe suas partidas ou escolha outro filtro." /> : <View style={s.stack}>{filtered.map(game =>
        <Pressable key={game.id} accessibilityRole="button" accessibilityLabel={`${game.opening?.name ?? 'Partida sem abertura identificada'}. ${game.summary}`}
          onPress={() => navigate({ screen: 'game', id: game.id })}
          style={({ pressed }) => [s.card, { opacity: pressed ? 0.72 : 1 }]}>
          <View style={s.between}><View style={s.wrap}><Badge>{game.platform === 'chesscom' ? 'Chess.com' : 'Lichess'}</Badge><Badge tone={game.needsPractice ? 'gold' : 'green'}>{game.needsPractice ? 'REVISAR' : 'COBERTA'}</Badge></View>
            <Text style={s.small}>{game.playedAt ? new Date(game.playedAt).toLocaleDateString('pt-BR') : 'Data indisponível'}</Text></View>
          <Text style={s.h3}>{game.opponent ?? 'Adversário'}{game.opponentRating !== null ? ` · ${game.opponentRating}` : ''}</Text>
          <View style={s.wrap}><Badge tone="neutral">{({ win: 'Vitória', draw: 'Empate', loss: 'Derrota' } as Record<string, string>)[game.result ?? ''] ?? 'Resultado não informado'}</Badge><Text style={s.small}>{game.speed ?? 'Ritmo não informado'} · {game.analyzedMoves ?? 0}/{game.moveCount ?? 0} lances analisados</Text></View>
          <Text style={s.body}>{game.summary}</Text>
          <View style={s.between}><Text style={s.small}>Você jogou de {game.color === 'w' ? 'brancas' : 'pretas'}</Text><View style={[s.row, { gap: 6 }]}><Text style={[s.label, { color: colors.forest }]}>Revisar partida</Text><Icon name="chevron" size={16} /></View></View>
        </Pressable>)}</View>}
    </>}
  </View>;
}
