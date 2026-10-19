import React, { useEffect, useMemo, useState } from 'react';
import { Modal, ScrollView, Text, View } from 'react-native';
import { Chess, type Square } from 'chess.js';
import type { Analysis } from '../../api/types';
import { api, errorMessage, isAbort } from '../../api/client';
import { ChessBoard } from '../../chess/ChessBoard';
import { moveUci, pvToSan } from '../../chess/logic';
import { Button } from '../../ui/components';
import { colors, s } from '../../ui/theme';

export function PositionInspector({ fen, onClose }: { fen: string; onClose: () => void }) {
  const [history, setHistory] = useState<string[]>([]); const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [error, setError] = useState<string | null>(null); const [revision, setRevision] = useState(0);
  const game = useMemo(() => { const board = new Chess(fen); for (const move of history) moveUci(board, move); return board; }, [fen, history]);
  const position = game.fen();
  useEffect(() => {
    const controller = new AbortController(); setAnalysis(null); setError(null);
    const timer = setTimeout(() => { void api.post<Analysis>('/analysis', { fen: position, depth: 14, multipv: 3 }, controller.signal).then(result => { if (!controller.signal.aborted) setAnalysis(result); })
      .catch(e => { if (!controller.signal.aborted && !isAbort(e)) setError(errorMessage(e)); }); }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [position, revision]);
  const score = analysis?.score;
  const whiteValue = score ? score.value * (position.split(' ')[1] === 'w' ? 1 : -1) : 0;
  return <Modal visible transparent animationType="fade" onRequestClose={onClose}><View style={{ flex: 1, backgroundColor: colors.background }}>
    <ScrollView contentContainerStyle={{ padding: 16, gap: 16, alignItems: 'center' }}><View accessibilityViewIsModal style={{ width: '100%', maxWidth: 650, gap: 16 }}>
      <View style={s.between}><Text style={s.h2}>Explore a posição</Text><Button label="Fechar análise" compact variant="ghost" onPress={onClose} /></View>
      <ChessBoard fen={position} maxSize={540} edgeToEdge={false} onMove={move => setHistory(items => [...items, move])} lastMove={history.at(-1)}
        feedbackArrows={analysis?.bestMove ? [{ from: analysis.bestMove.slice(0, 2) as Square, to: analysis.bestMove.slice(2, 4) as Square, tone: 'green' }] : []} />
      <View style={s.wrap}><Button label="Voltar lance" variant="secondary" disabled={!history.length} onPress={() => setHistory(items => items.slice(0, -1))} />
        <Button label="Posição inicial" variant="ghost" disabled={!history.length} onPress={() => setHistory([])} /></View>
      <Text accessibilityLiveRegion="polite" style={s.h3}>{error ?? (score ? score.type === 'cp' ? `${whiteValue >= 0 ? '+' : ''}${(whiteValue / 100).toFixed(2)} · perspectiva das brancas` : score.value === 0 ? 'Posição terminada' : `Mate em ${Math.abs(score.value)} · ${whiteValue > 0 ? 'brancas' : 'pretas'} em vantagem` : 'Avaliando a posição…')}</Text>
      {analysis ? <><Text style={s.body}>{pvToSan(position, analysis.pv) || 'Sem continuação: posição terminada.'}</Text><Text style={s.small}>{analysis.engine} · profundidade {analysis.depth}</Text>
        {analysis.variations?.map(candidate => <View key={candidate.rank} style={s.card}><Text style={s.label}>Candidata {candidate.rank} · profundidade {candidate.depth}</Text>
          <Text style={s.body}>{pvToSan(position, candidate.pv.slice(0, 8))}</Text><Button label="Explorar esta ideia" compact variant="secondary" onPress={() => { if (candidate.pv[0]) setHistory(value => [...value, candidate.pv[0]!]); }} /></View>)}
        <Text style={s.muted}>Número positivo favorece as brancas; negativo, as pretas. É uma estimativa do motor. Jogue uma alternativa para comparar.</Text></> : null}
      {error ? <Button label="Tentar novamente" onPress={() => setRevision(value => value + 1)} /> : null}
    </View></ScrollView></View></Modal>;
}
