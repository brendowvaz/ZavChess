import React, { useState } from 'react';
import { Pressable, Text, useWindowDimensions, View } from 'react-native';
import { Chess, type PieceSymbol } from 'chess.js';
import { useAppearance } from '../../appearance/AppearanceProvider';
import { boardThemes, defaultAppearance, pieceStyles, type BoardTheme, type PieceStyle } from '../../appearance/themes';
import { ChessBoard } from '../../chess/ChessBoard';
import { Piece } from '../../chess/Piece';
import { moveUci } from '../../chess/logic';
import { Button, Card, Heading, Notice } from '../../ui/components';
import { Icon } from '../../ui/Icon';
import { colors, s } from '../../ui/theme';

const samplePieces: PieceSymbol[] = ['k', 'q', 'b', 'n', 'r', 'p'];
const initialFen = new Chess().fen();
export function SettingsScreen() {
  const { appearance, updateAppearance, saveState, retrySave } = useAppearance();
  const { width } = useWindowDimensions();
  const [fen, setFen] = useState(initialFen);
  const [lastMove, setLastMove] = useState<string>();
  const theme = boardThemes[appearance.boardTheme];
  return <View style={s.page}>
    <Heading eyebrow="Do seu jeito" title="Configurações" description="Escolha suas peças e as cores do tabuleiro." />
    {saveState === 'error' ? <Notice tone="error" action={<Button label="Tentar salvar novamente" onPress={retrySave} variant="secondary" compact />}>
      Não foi possível acessar suas preferências salvas. As escolhas funcionam agora, mas podem não ser mantidas ao reabrir o app.
    </Notice> : null}
    <View style={{ width: '100%', gap: 28 }}>
      <View style={{ width: '100%', minWidth: 0, gap: 28 }}>
        <View style={s.stack}>
          <Text accessibilityRole="header" style={s.h2}>Estilo das peças</Text>
          <View style={[s.wrap, { gap: 12 }]}>{pieceStyles.map(style => {
            const selected = appearance.pieceStyle === style.id;
            return <Pressable key={style.id} accessibilityRole="radio" accessibilityLabel={`Peças ${style.name}`} accessibilityState={{ checked: selected }} aria-checked={selected}
              onPress={() => updateAppearance({ pieceStyle: style.id })}
              style={({ pressed }) => ({ flexBasis: width < 600 ? '100%' : '47%', flexGrow: 1, minWidth: 0, padding: 14, gap: 10, borderRadius: 16, borderWidth: 2,
                borderColor: selected ? colors.forest : colors.line, backgroundColor: colors.surface, opacity: pressed ? 0.75 : 1 })}>
              <View style={s.between}><Text style={s.h3}>{style.name}</Text><Selection selected={selected} /></View>
              <PieceSwatch pieceStyle={style.id} light={theme.light} dark={theme.dark} />
              <Text style={s.small}>{style.description}</Text>
            </Pressable>;
          })}</View>
        </View>
        <View style={s.stack}>
          <Text accessibilityRole="header" style={s.h2}>Cores do tabuleiro</Text>
          <View style={[s.wrap, { gap: 12 }]}>{(Object.keys(boardThemes) as BoardTheme[]).map(id => {
            const board = boardThemes[id];
            const selected = appearance.boardTheme === id;
            return <Pressable key={id} accessibilityRole="radio" accessibilityLabel={`Tabuleiro ${board.name}`} accessibilityState={{ checked: selected }} aria-checked={selected}
              onPress={() => updateAppearance({ boardTheme: id })}
              style={({ pressed }) => ({ flexBasis: '47%', flexGrow: 1, padding: 14, gap: 10, borderRadius: 16, borderWidth: 2, borderColor: selected ? colors.forest : colors.line,
                backgroundColor: colors.surface, opacity: pressed ? 0.75 : 1 })}>
              <View style={{ borderRadius: 7, overflow: 'hidden' }} pointerEvents="none">{[0, 1].map(row => <View key={row} style={{ flexDirection: 'row' }}>
                {[0, 1, 2, 3].map(col => <View key={col} style={{ flex: 1, height: 22, backgroundColor: (row + col) % 2 ? board.dark : board.light }} />)}
              </View>)}</View>
              <View style={s.between}><Text style={s.h3}>{board.name}</Text><Selection selected={selected} /></View>
              <Text style={s.small}>{board.description}</Text>
            </Pressable>;
          })}</View>
        </View>
        <View style={s.stack}>
          {saveState !== 'saved' ? <Text accessibilityLiveRegion="polite" style={s.small}>{saveState === 'saving' ? 'Salvando preferências…' : 'Preferências ainda não salvas neste dispositivo.'}</Text> : null}
          <Button label="Restaurar aparência padrão" variant="secondary" icon="refresh" onPress={() => updateAppearance(defaultAppearance)}
            disabled={appearance.pieceStyle === defaultAppearance.pieceStyle && appearance.boardTheme === defaultAppearance.boardTheme} style={{ alignSelf: 'flex-start' }} />
        </View>
      </View>
      <Card style={{ width: '100%', maxWidth: 760, alignSelf: 'center', gap: 16 }}>
        <View style={s.between}><Text accessibilityRole="header" style={s.h2}>Seu tabuleiro</Text><Icon name="opening" /></View>
        <Text style={s.small}>{pieceStyles.find(style => style.id === appearance.pieceStyle)?.name} · {theme.name}</Text>
        <ChessBoard fen={fen} lastMove={lastMove} onMove={uci => {
          const game = new Chess(fen); moveUci(game, uci); setFen(game.fen()); setLastMove(uci);
        }} />
        <Button label="Reiniciar prévia" variant="ghost" compact icon="refresh" onPress={() => { setFen(initialFen); setLastMove(undefined); }} />
      </Card>
    </View>
  </View>;
}
function PieceSwatch({ pieceStyle, light, dark }: { pieceStyle: PieceStyle; light: string; dark: string }) {
  const [width, setWidth] = useState(180);
  return <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden style={{ borderRadius: 8, overflow: 'hidden' }}
    onLayout={event => setWidth(event.nativeEvent.layout.width)}>
    {(['w', 'b'] as const).map((color, row) => <View key={color} style={{ flexDirection: 'row' }}>{samplePieces.map((type, col) => <View key={type}
      style={{ flex: 1, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: (row + col) % 2 ? dark : light }}>
      <Piece type={type} color={color} size={width / 6 * 0.91} pieceStyle={pieceStyle} />
    </View>)}</View>)}
  </View>;
}
function Selection({ selected }: { selected: boolean }) {
  return <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: selected ? 0 : 1, borderColor: colors.line, backgroundColor: selected ? colors.forest : colors.surface,
    alignItems: 'center', justifyContent: 'center' }}>{selected ? <Icon name="check" size={15} color={colors.white} /> : null}</View>;
}
