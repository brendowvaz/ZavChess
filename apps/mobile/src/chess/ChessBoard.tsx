import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { Chess, type Color, type Square, type PieceSymbol } from 'chess.js';
import { colors, s } from '../ui/theme';
import { Button, ErrorState } from '../ui/components';
import { moveUci, pieceNames, positionStatus, sideName } from './logic';
import { Piece } from './Piece';
import { useAppearance } from '../appearance/AppearanceProvider';
import { boardThemes } from '../appearance/themes';

export function ChessBoard({ fen, orientation = 'w', onMove, disabled = false, lastMove, hint, maxSize = 520, hideStatus = false }: {
  fen: string; orientation?: Color; onMove?: (uci: string) => void; disabled?: boolean;
  lastMove?: string; hint?: string; maxSize?: number; hideStatus?: boolean;
}) {
  const { appearance } = useAppearance();
  const theme = boardThemes[appearance.boardTheme];
  const [width, setWidth] = useState(320);
  const [selected, setSelected] = useState<Square | null>(null);
  const [promotion, setPromotion] = useState<{ from: Square; to: Square } | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const game = useMemo(() => { try { return new Chess(fen); } catch { return null; } }, [fen]);
  useEffect(() => { setSelected(null); setPromotion(null); setAnnouncement(''); }, [fen, disabled, orientation]);
  if (!game) return <ErrorState message="O tabuleiro recebeu uma posição inválida. Recarregue este conteúdo." />;
  const squareSize = Math.min(width, maxSize) / 8;
  const ranks = orientation === 'w' ? [8, 7, 6, 5, 4, 3, 2, 1] : [1, 2, 3, 4, 5, 6, 7, 8];
  const files = (orientation === 'w' ? 'abcdefgh' : 'hgfedcba').split('');
  const legal = selected ? game.moves({ square: selected, verbose: true }) : [];
  const interactive = !!onMove && !disabled && !game.isGameOver();
  const commit = (from: Square, to: Square, promote?: string) => {
    const uci = `${from}${to}${promote ?? ''}`;
    try { moveUci(new Chess(fen), uci); setSelected(null); setPromotion(null); onMove?.(uci); }
    catch { setAnnouncement('Esse lance não é permitido nesta posição.'); }
  };
  const press = (square: Square) => {
    if (!interactive) return;
    if (selected === square) { setSelected(null); return; }
    if (selected) {
      const candidates = legal.filter(move => move.to === square);
      if (candidates.length) {
        if (candidates.some(move => !!move.promotion)) setPromotion({ from: selected, to: square });
        else commit(selected, square);
        return;
      }
    }
    const piece = game.get(square);
    if (piece?.color === game.turn()) { setSelected(square); setAnnouncement(`${pieceNames[piece.type]} em ${square} selecionado. Escolha uma casa marcada.`); }
    else { setSelected(null); setAnnouncement('Selecione uma peça da cor que tem a vez.'); }
  };
  return <View style={{ width: '100%', maxWidth: maxSize, alignSelf: 'center', gap: 12 }} onLayout={e => setWidth(e.nativeEvent.layout.width)}>
    <View style={{ borderRadius: 8, overflow: 'hidden', width: '100%', aspectRatio: 1, backgroundColor: theme.light }}>
      {ranks.map((rank, row) => <View key={rank} style={{ flexDirection: 'row', flex: 1 }}>{files.map((file, col) => {
        const square = `${file}${rank}` as Square;
        const piece = game.get(square);
        const dark = (file.charCodeAt(0) - 97 + rank) % 2 === 0;
        const target = legal.some(move => move.to === square);
        const highlighted = square === selected || hint?.slice(0, 2) === square || hint?.slice(2, 4) === square;
        const previous = lastMove?.slice(0, 2) === square || lastMove?.slice(2, 4) === square;
        const check = piece?.type === 'k' && piece.color === game.turn() && game.isCheck();
        return <Pressable key={square} accessibilityRole={onMove ? 'button' : 'text'} accessibilityLabel={`${square}, ${piece ? `${pieceNames[piece.type]} ${piece.color === 'w' ? 'branco' : 'preto'}` : 'casa vazia'}${target ? ', destino legal' : ''}${check ? ', em xeque' : ''}`}
          accessibilityHint={interactive ? 'Toque na peça e depois no destino para mover.' : undefined}
          accessibilityState={{ selected: square === selected, disabled: !interactive }} disabled={!interactive} onPress={() => press(square)}
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: check ? theme.check : highlighted ? theme.selected : previous ? theme.previous : dark ? theme.dark : theme.light }}>
          {piece ? <Piece type={piece.type} color={piece.color} size={squareSize * 0.91} /> : null}
          {target ? <View pointerEvents="none" style={piece ? { position: 'absolute', width: '88%', height: '88%', borderRadius: 99, borderWidth: 3, borderColor: theme.marker + 'AA' } : { position: 'absolute', width: '25%', height: '25%', borderRadius: 99, backgroundColor: theme.marker + '88' }} /> : null}
          {col === 0 ? <Text accessible={false} style={{ position: 'absolute', top: 2, left: 3, fontSize: Math.max(9, squareSize * 0.19), fontWeight: '600', color: check || highlighted || previous ? theme.labelLight : dark ? theme.labelDark : theme.labelLight }}>{rank}</Text> : null}
          {row === 7 ? <Text accessible={false} style={{ position: 'absolute', bottom: 1, right: 3, fontSize: Math.max(9, squareSize * 0.19), fontWeight: '600', color: check || highlighted || previous ? theme.labelLight : dark ? theme.labelDark : theme.labelLight }}>{file}</Text> : null}
        </Pressable>;
      })}</View>)}
    </View>
    {!hideStatus ? <View style={{ gap: 4 }}><Text accessibilityLiveRegion="polite" style={[s.small, { textAlign: 'center' }]}>{announcement || positionStatus(game)}</Text>
      {interactive && !announcement ? <Text style={[s.small, { textAlign: 'center' }]}>Toque em uma peça para ver os lances legais.</Text> : null}</View> : null}
    <Modal transparent animationType="fade" visible={!!promotion} onRequestClose={() => setPromotion(null)}>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 22, backgroundColor: '#11271FCC' }}>
        <View accessibilityViewIsModal style={[s.card, { maxWidth: 370, width: '100%' }]}><Text accessibilityRole="header" style={s.h2}>Promover peão</Text>
          <Text style={s.muted}>Escolha a nova peça das {sideName(game.turn())}.</Text>
          <View style={[s.row, { justifyContent: 'space-between' }]}>{(['q', 'r', 'b', 'n'] as PieceSymbol[]).map(type => <Pressable key={type} accessibilityRole="button" accessibilityLabel={`Promover a ${pieceNames[type]}`}
            style={{ padding: 8, backgroundColor: colors.pale, borderRadius: 10 }} onPress={() => { if (promotion) commit(promotion.from, promotion.to, type); }}>
            <Piece type={type} color={game.turn()} size={44} /></Pressable>)}</View>
          <Button label="Cancelar" variant="ghost" onPress={() => setPromotion(null)} /></View>
      </View>
    </Modal>
  </View>;
}
