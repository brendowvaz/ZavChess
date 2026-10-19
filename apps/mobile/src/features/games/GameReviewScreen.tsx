import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { api, errorMessage, isAbort } from '../../api/client';
import { useOperation, useResource } from '../../api/hooks';
import { ChessBoard } from '../../chess/ChessBoard';
import { DEFAULT_POSITION, linePositions } from '../../chess/logic';
import { useNavigation } from '../../navigation/Navigation';
import { Badge, Button, Card, Empty, ErrorState, Heading, Loading, ProgressBar } from '../../ui/components';
import { colors, s } from '../../ui/theme';
import type { MoveAnalysis } from '../analysis/analysis-contract';
import { CoachResult } from '../analysis/CoachResult';
import { PositionInspector } from '../analysis/PositionInspector';
import { gamePhase, moveLabels, whiteGraphScore } from './review';

type Game = { id: string; moves: string[] | null; initialFen: string | null; opponent: string | null; opponentRating: number | null;
  color: 'w' | 'b'; result: string | null; speed: string | null; summary: string; review: Record<string, MoveAnalysis> | null };
export function GameReviewScreen({ id }: { id: string }) {
  const game = useResource<Game>(`/learning/games/${encodeURIComponent(id)}`);
  if (game.loading) return <Loading label="Abrindo sua partida…" />;
  if (game.error) return <ErrorState message={game.error} retry={game.reload} />;
  return game.data ? <GameReviewer key={id} game={game.data} /> : null;
}
function GameReviewer({ game }: { game: Game }) {
  const { back } = useNavigation(); const operation = useOperation();
  const [index, setIndex] = useState(0); const [reviews, setReviews] = useState(game.review ?? {});
  const [running, setRunning] = useState(false); const [error, setError] = useState<string | null>(null);
  const [inspect, setInspect] = useState(false); const [detail, setDetail] = useState(false);
  const moves = game.moves ?? [];
  const line = useMemo(() => { try { return linePositions(moves, game.initialFen ?? DEFAULT_POSITION); } catch { return null; } }, [game.moves, game.initialFen]);
  useEffect(() => {
    if (!running) return;
    const ply = moves.findIndex((_, i) => !reviews[String(i)]);
    if (ply < 0) { setRunning(false); return; }
    const controller = new AbortController();
    const timer = setTimeout(() => { void api.post<MoveAnalysis>(`/learning/games/${encodeURIComponent(game.id)}/review`, { ply }, controller.signal)
      .then(result => { if (!controller.signal.aborted) setReviews(value => ({ ...value, [String(ply)]: result })); })
      .catch(e => { if (!controller.signal.aborted && !isAbort(e)) { setError(errorMessage(e)); setRunning(false); } }); }, 600);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [running, reviews, game.id, game.moves]);
  if (!line) return <ErrorState message="Esta partida tem um lance inválido. Importe-a novamente." />;
  if (!moves.length) return <View style={s.page}><Button label="Voltar" onPress={back} /><Empty title="Importe esta partida novamente" description="Este registro antigo guardou apenas o diagnóstico de abertura. Uma nova importação trará todos os lances." /></View>;
  const fen = line.positions[index]!; const current = index ? reviews[String(index - 1)] : undefined;
  const entries = Object.entries(reviews).filter(([ply]) => Number(ply) < moves.length).sort(([a], [b]) => Number(a) - Number(b));
  const points = entries.map(([ply, result]) => ({ x: (Number(ply) + 1) / moves.length * 600, y: 70 - whiteGraphScore(result) / 6 * 60, ply: Number(ply) + 1 }));
  const graph = points.map((point, i) => `${i && point.ply === points[i - 1]!.ply + 1 ? 'L' : 'M'}${point.x},${point.y}`).join(' ');
  const single = () => void operation.run(async signal => {
    const result = await api.post<MoveAnalysis>(`/learning/games/${encodeURIComponent(game.id)}/review`, { ply: index - 1 }, signal);
    setReviews(value => ({ ...value, [String(index - 1)]: result }));
  });
  return <View style={s.page}><Button label="Voltar às partidas" icon="back" variant="ghost" onPress={back} />
    <Heading eyebrow="Revise para evoluir" title={`Você × ${game.opponent ?? 'Adversário'}`} description={game.summary} />
    <View style={s.wrap}><Badge>{game.color === 'w' ? 'Brancas' : 'Pretas'}</Badge><Badge tone="neutral">{game.speed ?? 'Ritmo não informado'}</Badge>
      {game.opponentRating !== null ? <Badge tone="neutral">Adversário {game.opponentRating}</Badge> : null}</View>
    <View style={{ maxWidth: 680, width: '100%', alignSelf: 'center', gap: 14 }}>
      <ChessBoard fen={fen} orientation={game.color} maxSize={640} lastMove={moves[index - 1]} disabled />
      <View style={[s.wrap, { justifyContent: 'center' }]}><Button label="Início" compact variant="ghost" disabled={!index} onPress={() => setIndex(0)} />
        <Button label="Anterior" compact variant="secondary" icon="back" disabled={!index} onPress={() => setIndex(value => value - 1)} />
        <Text style={s.label}>{index}/{moves.length}</Text><Button label="Próximo" compact variant="secondary" icon="arrow" disabled={index >= moves.length} onPress={() => setIndex(value => value + 1)} />
        <Button label="Fim" compact variant="ghost" disabled={index >= moves.length} onPress={() => setIndex(moves.length)} /></View>
      <Button label="Explorar alternativas nesta posição" variant="ghost" onPress={() => setInspect(true)} />
    </View>
    <Card><View style={[s.between, { flexWrap: 'wrap' }]}><Text style={s.h3}>Avaliação ao longo da partida</Text><Badge>{entries.length}/{moves.length} lances analisados</Badge></View>
      <Svg width="100%" height={140} viewBox="-4 0 608 140" accessibilityLabel="Gráfico da avaliação: acima da linha favorece brancas; abaixo, pretas">
        <Line x1={0} y1={70} x2={600} y2={70} stroke={colors.line} strokeWidth={2} />
        <Path d={graph} fill="none" stroke={colors.forest} strokeWidth={3} />
        {points.map(point => <Circle key={point.ply} cx={point.x} cy={point.y} r={index === point.ply ? 6 : 4} fill={index === point.ply ? colors.gold : colors.forest} onPress={() => setIndex(point.ply)} />)}
      </Svg><Text style={s.small}>Acima: brancas. Abaixo: pretas. Escala visual até ±6 peões; mates ficam nas extremidades. Trechos ainda sem análise ficam vazios.</Text>
      <ProgressBar value={entries.length / moves.length * 100} label="Lances analisados" />
      <Button label={running ? 'Pausar análise' : entries.length === moves.length ? 'Análise concluída' : entries.length ? 'Continuar análise da partida' : 'Analisar partida completa'}
        disabled={entries.length === moves.length} onPress={() => { setError(null); setRunning(value => !value); }} />
      {running ? <Text accessibilityLiveRegion="polite" style={s.small}>Analisando com Stockfish. Os resultados são salvos a cada lance; você pode pausar e retomar.</Text> : null}
      {error ? <ErrorState message={error} /> : null}
    </Card>
    <View style={s.wrap}>{(['Abertura', 'Meio-jogo', 'Final'] as const).map(phase => {
      const own = entries.filter(([ply, result]) => result.perspective === game.color && gamePhase(result.fen, Number(ply)) === phase).map(([, result]) => result);
      return <Card key={phase} style={{ flex: 1, minWidth: 190 }}><Text style={s.h3}>{phase}</Text><Text style={s.body}>{own.length} decisões suas analisadas</Text>
        <Text style={s.small}>{own.filter(result => ['mistake', 'blunder'].includes(result.classification)).length} erros · {own.filter(result => result.classification === 'inaccuracy').length} imprecisões</Text></Card>;
    })}</View><Text style={s.small}>Fases aproximadas: abertura até o lance 10; final quando restam até 12 peças; demais posições no meio-jogo.</Text>
    {index ? <Card><View style={s.between}><Text style={s.h3}>{Math.ceil(index / 2)}{index % 2 ? '.' : '…'} {line.sans[index - 1]}</Text>{current ? <Badge tone={['mistake', 'blunder', 'inaccuracy'].includes(current.classification) ? 'gold' : 'green'}>{moveLabels[current.classification]}</Badge> : null}</View>
      {current ? <><Text style={s.body}>{current.lesson.plan}</Text><Button label={detail ? 'Ocultar explicação' : 'Entender este lance'} variant="secondary" onPress={() => setDetail(value => !value)} /></> : <Button label="Analisar este lance" busy={operation.busy} disabled={running} onPress={single} />}
      {operation.error ? <ErrorState message={operation.error} /> : null}</Card> : null}
    {current && detail ? <CoachResult key={`${current.fen}:${current.move}`} result={current} /> : null}
    <Card><Text style={s.h3}>Lances da partida</Text><View style={s.wrap}>{line.sans.map((san, i) => <Pressable key={i} accessibilityRole="button" accessibilityLabel={`Ver lance ${Math.ceil((i + 1) / 2)} ${san}`} onPress={() => setIndex(i + 1)}
      style={{ padding: 10, minHeight: 44, borderRadius: 8, backgroundColor: index === i + 1 ? colors.pale : 'transparent' }}><Text style={s.body}>{i % 2 === 0 ? `${Math.floor(i / 2) + 1}. ` : ''}{san}{reviews[String(i)] ? ` · ${moveLabels[reviews[String(i)]!.classification]}` : ''}</Text></Pressable>)}</View></Card>
    {inspect ? <PositionInspector fen={fen} onClose={() => setInspect(false)} /> : null}
  </View>;
}
