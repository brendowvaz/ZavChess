import React, { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Chess } from 'chess.js';
import type { Endgame, Tablebase } from '../../api/types';
import { useResource } from '../../api/hooks';
import { useNavigation } from '../../navigation/Navigation';
import { Badge, Button, Card, Empty, ErrorState, Heading, Loading, Notice, levels } from '../../ui/components';
import { Icon } from '../../ui/Icon';
import { s } from '../../ui/theme';
import { ChessBoard } from '../../chess/ChessBoard';
import { gameFromHistory, moveUci, positionStatus, sideName } from '../../chess/logic';
import { categoryLabel, invertCategory } from '../../chess/tablebase';

export function EndgamesScreen() {
  const endgames = useResource<Endgame[]>('/endgames'); const { navigate } = useNavigation();
  return <View style={s.page}><Heading eyebrow="Precisão até o último lance" title="Poucas peças. Grandes decisões." description="Pratique posições de final e consulte o resultado com jogo perfeito, diretamente na tablebase." />
    {endgames.loading ? <Loading label="Carregando finais…" /> : endgames.error ? <ErrorState message={endgames.error} retry={endgames.reload} /> : !endgames.data?.length ? <Empty title="Nenhum final publicado" description="Os exercícios aparecerão aqui quando forem disponibilizados pelo servidor." /> :
      <View style={s.stack}>{endgames.data.map(endgame => <Pressable key={endgame.id} accessibilityRole="button" accessibilityLabel={`Praticar ${endgame.title}`} onPress={() => navigate({ screen: 'endgame', id: endgame.id })}
        style={({ pressed }) => [s.card, { opacity: pressed ? 0.75 : 1 }]}><View style={s.between}><Badge>{levels[endgame.level]}</Badge><Icon name="flag" /></View>
        <Text style={s.h2}>{endgame.title}</Text><Text style={s.muted}>{endgame.description}</Text><Text style={s.small}>Objetivo: {endgame.goal}</Text></Pressable>)}</View>}
  </View>;
}
export function EndgameScreen({ id }: { id: string }) {
  const endgame = useResource<Endgame>(`/endgames/${encodeURIComponent(id)}`); const { back } = useNavigation();
  return <View style={s.page}><Button label="Voltar aos finais" icon="back" variant="ghost" onPress={back} style={{ alignSelf: 'flex-start' }} />
    {endgame.loading ? <Loading label="Abrindo o final…" /> : endgame.error ? <ErrorState message={endgame.error} retry={endgame.reload} /> : endgame.data ? <EndgameTrainer endgame={endgame.data} /> : null}</View>;
}
function EndgameTrainer({ endgame }: { endgame: Endgame }) {
  const [history, setHistory] = useState<string[]>([]); const [showMoves, setShowMoves] = useState(false); const [moveError, setMoveError] = useState<string | null>(null);
  const game = useMemo(() => { try { return gameFromHistory(endgame.fen, history); } catch { return null; } }, [endgame.fen, history]);
  const fen = game?.fen();
  const pieces = game?.board().flat().filter(Boolean).length ?? 0;
  const tablebase = useResource<Tablebase>(fen && pieces <= 7 && !game?.isGameOver() ? `/endgames/evaluate?fen=${encodeURIComponent(fen)}` : null);
  if (!game || !fen) return <ErrorState message="Este final possui uma posição inválida." />;
  const studentTurn = game.turn() === endgame.side;
  const play = (uci: string) => {
    try { moveUci(new Chess(fen), uci); setHistory(moves => [...moves, uci]); setMoveError(null); }
    catch { setMoveError('O serviço retornou um lance que não é legal nesta posição. Recarregue a avaliação.'); }
  };
  return <View style={s.page}><Heading eyebrow={`${levels[endgame.level]} · Treino de finais`} title={endgame.title} description={endgame.description} />
    <Notice>Objetivo: {endgame.goal} Você joga de {sideName(endgame.side)}. Após seu lance, use “Resposta da tablebase” para continuar contra a melhor defesa disponível.</Notice>
    <Card><ChessBoard fen={fen} orientation={endgame.side} lastMove={history[history.length - 1]} onMove={play} disabled={!studentTurn || game.isGameOver()} />
      {game.isGameOver() ? <Notice>{positionStatus(game)}</Notice> : !studentTurn ? <Button label="Resposta da tablebase" icon="play" busy={tablebase.loading} disabled={!tablebase.data?.moves.length || !!tablebase.error} onPress={() => { const best = tablebase.data?.moves[0]; if (best) play(best.uci); }} /> : null}
      {moveError ? <ErrorState message={moveError} retry={tablebase.reload} /> : null}
      <View style={s.wrap}><Button label="Desfazer" variant="secondary" icon="back" disabled={!history.length} onPress={() => { setHistory(moves => moves.slice(0, Math.max(0, moves.length - (studentTurn ? 2 : 1)))); setMoveError(null); }} />
        <Button label="Recomeçar final" variant="ghost" icon="refresh" onPress={() => { setHistory([]); setMoveError(null); setShowMoves(false); }} /></View>
    </Card>
    <Card><View style={s.between}><Text style={s.h2}>Avaliação tablebase</Text><Badge tone="neutral">Até 7 peças</Badge></View>
      {pieces > 7 ? <Notice>Esta posição tem mais de 7 peças. A tablebase não pode avaliá-la.</Notice> : game.isGameOver() ? <Notice>{positionStatus(game)}</Notice>
        : tablebase.loading ? <Loading label="Consultando a tablebase ao vivo…" /> : tablebase.error ? <ErrorState message={tablebase.error} retry={tablebase.reload} /> : tablebase.data ? <>
          <Text style={s.h3}>{categoryLabel(tablebase.data.category)}</Text><Text style={s.muted}>Perspectiva das {sideName(game.turn())}, que têm a vez.</Text>
          <View style={s.wrap}><Badge>DTZ: {tablebase.data.dtz ?? 'indisponível'}</Badge><Badge>DTM: {tablebase.data.dtm ?? 'indisponível'}</Badge></View>
          <Text style={s.small}>DTZ é a distância em meios-lances até captura ou movimento de peão, segundo a tablebase; DTM é a distância até o mate. A regra dos 50 lances e as repetições continuam valendo.</Text>
          <Button label={showMoves ? 'Ocultar continuações' : 'Consultar continuações'} variant="secondary" onPress={() => setShowMoves(v => !v)} />
          {showMoves ? <View style={s.stack}>{tablebase.data.moves.slice(0, 8).map(move => <View key={move.uci} style={s.row}><Text style={[s.h3, { minWidth: 54 }]}>{move.san}</Text>
            <View style={s.grow}><Text style={s.small}>{categoryLabel(invertCategory(move.category))}</Text><Text style={s.small}>Para as {sideName(game.turn())} após este lance · DTZ adversário: {move.dtz ?? '—'}</Text></View></View>)}</View> : null}
        </> : null}
    </Card>
    <Card><Text style={s.h3}>Ideias para levar ao tabuleiro</Text>{endgame.tips.map((tip, i) => <Text key={i} style={s.body}>{i + 1}. {tip}</Text>)}
      <Text style={s.small}>Treino local, sem atribuição de XP. A API não oferece registro de conclusão de finais.</Text></Card>
  </View>;
}
