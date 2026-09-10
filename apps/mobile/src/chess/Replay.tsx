import React, { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { ChessBoard } from './ChessBoard';
import { DEFAULT_POSITION, linePositions } from './logic';
import { Button, ErrorState } from '../ui/components';
import { colors, s } from '../ui/theme';
import type { Side } from '../api/types';

export function Replay({ moves, initialFen = DEFAULT_POSITION, orientation = 'w' }: { moves: string[]; initialFen?: string; orientation?: Side }) {
  const [index, setIndex] = useState(0);
  const line = useMemo(() => { try { return linePositions(moves, initialFen); } catch { return null; } }, [moves, initialFen]);
  if (!line) return <ErrorState message="Não foi possível reproduzir esta linha: o conteúdo contém uma posição ou lance inválido." />;
  const step = Math.min(index, moves.length);
  return <View style={s.stack}><ChessBoard fen={line.positions[step]!} orientation={orientation} lastMove={moves[step - 1]} />
    <View style={[s.wrap, { justifyContent: 'center' }]}>
      <Button compact label="Início" variant="ghost" disabled={step === 0} onPress={() => setIndex(0)} />
      <Button compact label="Anterior" icon="back" variant="secondary" disabled={step === 0} onPress={() => setIndex(step - 1)} />
      <Text style={s.small}>{step}/{moves.length}</Text>
      <Button compact label="Próximo" icon="arrow" variant="secondary" disabled={step === moves.length} onPress={() => setIndex(step + 1)} />
      <Button compact label="Fim" variant="ghost" disabled={step === moves.length} onPress={() => setIndex(moves.length)} /></View>
    {line.sans.length ? <View style={s.wrap}>{line.sans.map((san, i) => <Pressable key={i} accessibilityRole="button" accessibilityLabel={`Ver lance ${i + 1}: ${san}`} accessibilityState={{ selected: step === i + 1 }} onPress={() => setIndex(i + 1)}
      style={{ minHeight: 40, padding: 10, borderRadius: 8, backgroundColor: step === i + 1 ? colors.pale : 'transparent' }}>
      <Text style={[s.body, { fontSize: 13 }]}>{i % 2 === 0 ? `${Math.floor(i / 2) + 1}. ` : ''}{san}</Text></Pressable>)}</View> : null}
  </View>;
}
