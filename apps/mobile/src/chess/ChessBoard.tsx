import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Modal, PanResponder, Platform, Pressable, Text, useWindowDimensions, View, type PointerEvent } from 'react-native';
import Svg, { Path, Polygon } from 'react-native-svg';
import { Chess, type Color, type Square, type PieceSymbol } from 'chess.js';
import { colors, s } from '../ui/theme';
import { Button, ErrorState } from '../ui/components';
import { moveUci, normalizeCastlingTarget, pieceNames, positionStatus, sideName } from './logic';
import { Piece } from './Piece';
import { useAppearance } from '../appearance/AppearanceProvider';
import { boardThemes } from '../appearance/themes';
import {
  annotationColors,
  annotationToneFromModifiers,
  annotationToneLabels,
  arrowGeometry,
  toggleArrowAnnotation,
  toggleSquareAnnotation,
  type AnnotationTone,
  type ArrowAnnotation,
  type SquareAnnotation,
} from './annotations';

type WebPointerInfo = {
  altKey?: boolean; button?: number; clientX: number; clientY: number; ctrlKey?: boolean;
  pointerId: number; shiftKey?: boolean;
};

export function ChessBoard({ fen, orientation = 'w', onMove, disabled = false, lastMove, hint, feedbackArrows = [], maxSize = 720, hideStatus = false, showTurnStatus = false, edgeToEdge = true }: {
  fen: string; orientation?: Color; onMove?: (uci: string) => void; disabled?: boolean;
  lastMove?: string; hint?: string; feedbackArrows?: ArrowAnnotation[]; maxSize?: number; hideStatus?: boolean; showTurnStatus?: boolean; edgeToEdge?: boolean;
}) {
  const { width: viewportWidth } = useWindowDimensions();
  const { appearance } = useAppearance();
  const theme = boardThemes[appearance.boardTheme];
  const fullBleed = edgeToEdge && viewportWidth < 980;
  const [compactWidth, setCompactWidth] = useState(viewportWidth);
  const [width, setWidth] = useState(320);
  const [selected, setSelected] = useState<Square | null>(null);
  const [dragging, setDragging] = useState<Square | null>(null);
  const [promotion, setPromotion] = useState<{ from: Square; to: Square } | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const [squareAnnotations, setSquareAnnotations] = useState<SquareAnnotation[]>([]);
  const [arrowAnnotations, setArrowAnnotations] = useState<ArrowAnnotation[]>([]);
  const [rightPreview, setRightPreview] = useState<ArrowAnnotation | null>(null);
  const boardRef = useRef<View>(null);
  const boardOrigin = useRef({ x: 0, y: 0 });
  const pendingDragSource = useRef<Square | null>(null);
  const dragSource = useRef<Square | null>(null);
  const activePointerId = useRef<number | null>(null);
  const pointerDrag = useRef<{ from: Square; x: number; y: number; pointerId: number; active: boolean } | null>(null);
  const annotationGesture = useRef<{ from: Square; tone: AnnotationTone; pointerId: number } | null>(null);
  const suppressPress = useRef(false);
  const dragPosition = useRef(new Animated.ValueXY()).current;
  useEffect(() => {
    if (!fullBleed || Platform.OS !== 'web') { setCompactWidth(viewportWidth); return; }
    let parent = (boardRef.current as unknown as HTMLElement | null)?.parentElement;
    while (parent) {
      const overflowY = window.getComputedStyle(parent).overflowY;
      if (overflowY === 'auto' || overflowY === 'scroll') {
        setCompactWidth(parent.clientWidth);
        return;
      }
      parent = parent.parentElement;
    }
    setCompactWidth(document.documentElement.clientWidth);
  }, [fullBleed, viewportWidth]);
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const element = boardRef.current as unknown as HTMLElement | null;
    if (!element) return;
    const preventMenu = (event: MouseEvent) => event.preventDefault();
    element.addEventListener('contextmenu', preventMenu);
    return () => element.removeEventListener('contextmenu', preventMenu);
  }, []);
  const game = useMemo(() => { try { return new Chess(fen); } catch { return null; } }, [fen]);
  useEffect(() => {
    setSelected(null); setDragging(null); setPromotion(null); setAnnouncement('');
    pendingDragSource.current = null; dragSource.current = null; activePointerId.current = null; pointerDrag.current = null; annotationGesture.current = null; setRightPreview(null); suppressPress.current = false;
  }, [fen, disabled, orientation]);
  const squareSize = Math.min(width, maxSize) / 8;
  const ranks = useMemo(() => orientation === 'w' ? [8, 7, 6, 5, 4, 3, 2, 1] : [1, 2, 3, 4, 5, 6, 7, 8], [orientation]);
  const files = useMemo(() => (orientation === 'w' ? 'abcdefgh' : 'hgfedcba').split(''), [orientation]);
  const legal = selected && game ? game.moves({ square: selected, verbose: true }) : [];
  const interactive = !!onMove && !disabled && !!game && !game.isGameOver();
  const castlingRookTargets = useMemo(() => {
    if (!selected || game?.get(selected)?.type !== 'k') return new Set<Square>();
    const targets = new Set<Square>();
    for (const file of ['a', 'h']) {
      const rookSquare = `${file}${selected[1]}` as Square;
      if (normalizeCastlingTarget(game, selected, rookSquare) !== rookSquare) targets.add(rookSquare);
    }
    return targets;
  }, [game, legal, selected]);
  const commit = useCallback((from: Square, to: Square, promote?: string) => {
    const uci = `${from}${to}${promote ?? ''}`;
    try { moveUci(new Chess(fen), uci); setSelected(null); setPromotion(null); onMove?.(uci); }
    catch { setAnnouncement('Esse lance não é permitido nesta posição.'); }
  }, [fen, onMove]);
  const attemptMove = useCallback((from: Square, rawTarget: Square) => {
    if (!game) return false;
    const to = normalizeCastlingTarget(game, from, rawTarget);
    const candidates = game.moves({ square: from, verbose: true }).filter(move => move.to === to);
    if (!candidates.length) return false;
    if (candidates.some(move => !!move.promotion)) setPromotion({ from, to });
    else commit(from, to);
    return true;
  }, [commit, game]);
  const press = useCallback((square: Square) => {
    if (suppressPress.current) { suppressPress.current = false; return; }
    if (!interactive || !game) return;
    if (selected === square) { setSelected(null); return; }
    if (selected && attemptMove(selected, square)) return;
    const piece = game.get(square);
    if (piece?.color === game.turn()) { setSelected(square); setAnnouncement(`${pieceNames[piece.type]} em ${square} selecionado. Escolha uma casa marcada.`); }
    else { setSelected(null); setAnnouncement('Selecione uma peça da cor que tem a vez.'); }
  }, [attemptMove, game, interactive, selected]);
  const measureBoard = useCallback(() => {
    boardRef.current?.measureInWindow((x, y) => { boardOrigin.current = { x, y }; });
  }, []);
  const squareAt = useCallback((pageX: number, pageY: number): Square | null => {
    const col = Math.floor((pageX - boardOrigin.current.x) / squareSize);
    const row = Math.floor((pageY - boardOrigin.current.y) / squareSize);
    const file = files[col];
    const rank = ranks[row];
    return file && rank ? `${file}${rank}` as Square : null;
  }, [files, ranks, squareSize]);
  const startPointer = useCallback((event: PointerEvent) => {
    if (Platform.OS !== 'web') return;
    const pointer = event.nativeEvent as unknown as WebPointerInfo;
    const x = pointer.clientX;
    const y = pointer.clientY;
    const pointerId = pointer.pointerId;
    if (pointer.button === 2) {
      event.preventDefault();
      const target = event.currentTarget as unknown as { setPointerCapture?: (id: number) => void };
      target.setPointerCapture?.(pointerId);
      boardRef.current?.measureInWindow((boardX, boardY) => {
        boardOrigin.current = { x: boardX, y: boardY };
        const from = squareAt(x, y);
        annotationGesture.current = from ? { from, tone: annotationToneFromModifiers(pointer), pointerId } : null;
      });
      return;
    }
    if (pointer.button !== undefined && pointer.button !== 0) return;
    setSquareAnnotations([]);
    setArrowAnnotations([]);
    setRightPreview(null);
    activePointerId.current = pointerId;
    boardRef.current?.measureInWindow((boardX, boardY) => {
      if (activePointerId.current !== pointerId) return;
      boardOrigin.current = { x: boardX, y: boardY };
      const from = squareAt(x, y);
      pendingDragSource.current = from && game && game.get(from)?.color === game.turn() ? from : null;
      pointerDrag.current = pendingDragSource.current ? { from: pendingDragSource.current, x, y, pointerId, active: false } : null;
    });
  }, [game, squareAt]);
  const moveDraggedPiece = useCallback((pageX: number, pageY: number) => {
    dragPosition.setValue({
      x: pageX - boardOrigin.current.x - squareSize / 2,
      y: pageY - boardOrigin.current.y - squareSize / 2,
    });
  }, [dragPosition, squareSize]);
  const endDrag = useCallback((pageX?: number, pageY?: number) => {
    const from = dragSource.current;
    const to = pageX === undefined || pageY === undefined ? null : squareAt(pageX, pageY);
    pendingDragSource.current = null;
    dragSource.current = null;
    setDragging(null);
    setSelected(null);
    if (!from || !to || from === to) return;
    if (!attemptMove(from, to)) setAnnouncement('Esse lance não é permitido nesta posição.');
  }, [attemptMove, squareAt]);
  const movePointer = useCallback((event: PointerEvent) => {
    if (Platform.OS !== 'web') return;
    const native = event.nativeEvent as unknown as WebPointerInfo;
    const annotation = annotationGesture.current;
    if (annotation?.pointerId === native.pointerId) {
      event.preventDefault();
      const to = squareAt(native.clientX, native.clientY);
      setRightPreview(to && to !== annotation.from ? { from: annotation.from, to, tone: annotation.tone } : null);
      return;
    }
    if (!pointerDrag.current) return;
    const pointer = pointerDrag.current;
    const x = native.clientX;
    const y = native.clientY;
    if (!pointer.active && Math.hypot(x - pointer.x, y - pointer.y) >= 5) {
      pointer.active = true;
      const target = event.currentTarget as unknown as { setPointerCapture?: (pointerId: number) => void };
      target.setPointerCapture?.(pointer.pointerId);
      pendingDragSource.current = null;
      dragSource.current = pointer.from;
      setSelected(pointer.from);
      setDragging(pointer.from);
    }
    if (pointer.active) moveDraggedPiece(x, y);
  }, [moveDraggedPiece, squareAt]);
  const releasePointer = useCallback((event: PointerEvent) => {
    if (Platform.OS !== 'web') return;
    const native = event.nativeEvent as unknown as WebPointerInfo;
    const annotation = annotationGesture.current;
    if (annotation?.pointerId === native.pointerId) {
      event.preventDefault();
      annotationGesture.current = null;
      setRightPreview(null);
      const to = squareAt(native.clientX, native.clientY);
      if (!to) return;
      const colorName = annotationToneLabels[annotation.tone];
      if (to === annotation.from) {
        const removing = squareAnnotations.some(item => item.square === to && item.tone === annotation.tone);
        setSquareAnnotations(items => toggleSquareAnnotation(items, to, annotation.tone));
        setAnnouncement(removing ? `Marcação removida de ${to}.` : `Casa ${to} marcada em ${colorName}.`);
      } else {
        const removing = arrowAnnotations.some(item => item.from === annotation.from && item.to === to && item.tone === annotation.tone);
        setArrowAnnotations(items => toggleArrowAnnotation(items, annotation.from, to, annotation.tone));
        setAnnouncement(removing ? `Seta de ${annotation.from} para ${to} removida.` : `Seta de ${annotation.from} para ${to} marcada em ${colorName}.`);
      }
      return;
    }
    const pointer = pointerDrag.current;
    activePointerId.current = null;
    pointerDrag.current = null;
    pendingDragSource.current = null;
    if (!pointer?.active) return;
    suppressPress.current = true;
    endDrag(native.clientX, native.clientY);
    setTimeout(() => { suppressPress.current = false; }, 0);
  }, [arrowAnnotations, endDrag, squareAnnotations, squareAt]);
  const cancelPointer = useCallback(() => {
    if (Platform.OS !== 'web') return;
    if (annotationGesture.current) {
      annotationGesture.current = null;
      setRightPreview(null);
      return;
    }
    const wasActive = pointerDrag.current?.active;
    activePointerId.current = null;
    pointerDrag.current = null;
    pendingDragSource.current = null;
    if (wasActive) endDrag();
  }, [endDrag]);
  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponderCapture: event => {
      if (!interactive || !game) return false;
      const from = squareAt(event.nativeEvent.pageX, event.nativeEvent.pageY);
      pendingDragSource.current = from && game.get(from)?.color === game.turn() ? from : null;
      return false;
    },
    onMoveShouldSetPanResponderCapture: (_event, gesture) => {
      if (!interactive || !game || Math.hypot(gesture.dx, gesture.dy) < 5) return false;
      const from = pendingDragSource.current;
      if (!from || game.get(from)?.color !== game.turn()) return false;
      return true;
    },
    onPanResponderGrant: (_event, gesture) => {
      const from = pendingDragSource.current;
      pendingDragSource.current = null;
      if (!from || !game || game.get(from)?.color !== game.turn()) return;
      dragSource.current = from;
      setSelected(from);
      setDragging(from);
      moveDraggedPiece(gesture.moveX, gesture.moveY);
    },
    onPanResponderMove: (_event, gesture) => moveDraggedPiece(gesture.moveX, gesture.moveY),
    onPanResponderRelease: (_event, gesture) => endDrag(gesture.moveX, gesture.moveY),
    onPanResponderTerminate: () => endDrag(),
    onPanResponderTerminationRequest: () => false,
  }), [endDrag, game, interactive, moveDraggedPiece, squareAt]);

  if (!game) return <ErrorState message="O tabuleiro recebeu uma posição inválida. Recarregue este conteúdo." />;
  return <View style={{ width: fullBleed ? compactWidth : '100%', maxWidth: fullBleed ? undefined : maxSize, alignSelf: 'center', gap: 12 }} onLayout={e => setWidth(e.nativeEvent.layout.width)}>
    <View ref={boardRef} onLayout={measureBoard} onPointerDown={startPointer} onPointerMove={movePointer}
      onPointerUp={releasePointer} onPointerCancel={cancelPointer} {...(Platform.OS === 'web' ? {} : panResponder.panHandlers)}
      style={{ borderRadius: fullBleed ? 0 : 8, overflow: 'hidden', width: '100%', aspectRatio: 1, backgroundColor: theme.light }}>
      {ranks.map((rank, row) => <View key={rank} style={{ flexDirection: 'row', flex: 1 }}>{files.map((file, col) => {
        const square = `${file}${rank}` as Square;
        const piece = game.get(square);
        const squareAnnotation = squareAnnotations.find(item => item.square === square);
        const dark = (file.charCodeAt(0) - 97 + rank) % 2 === 0;
        const target = legal.some(move => move.to === square) || castlingRookTargets.has(square);
        const highlighted = square === selected || hint?.slice(0, 2) === square || hint?.slice(2, 4) === square;
        const previous = lastMove?.slice(0, 2) === square || lastMove?.slice(2, 4) === square;
        const check = piece?.type === 'k' && piece.color === game.turn() && game.isCheck();
        return <Pressable key={square} accessibilityRole={onMove ? 'button' : 'text'} accessibilityLabel={`${square}, ${piece ? `${pieceNames[piece.type]} ${piece.color === 'w' ? 'branco' : 'preto'}` : 'casa vazia'}${target ? ', destino legal' : ''}${check ? ', em xeque' : ''}${squareAnnotation ? `, marcada em ${annotationToneLabels[squareAnnotation.tone]}` : ''}`}
          accessibilityHint={interactive ? 'Toque na peça e depois no destino, ou arraste a peça até o destino.' : undefined}
          accessibilityState={{ selected: square === selected, disabled: !interactive }} disabled={!interactive} onPress={() => press(square)}
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: check ? theme.check : highlighted ? theme.selected : previous ? theme.previous : dark ? theme.dark : theme.light }}>
          {squareAnnotation ? <View style={{ position: 'absolute', inset: 0, backgroundColor: annotationColors[squareAnnotation.tone], opacity: 0.64, pointerEvents: 'none' }} /> : null}
          {piece && square !== dragging ? <Piece type={piece.type} color={piece.color} size={squareSize * 0.91} /> : null}
          {target ? <View style={piece ? { position: 'absolute', width: '88%', height: '88%', borderRadius: 99, borderWidth: 3, borderColor: theme.marker + 'AA', pointerEvents: 'none' } : { position: 'absolute', width: '25%', height: '25%', borderRadius: 99, backgroundColor: theme.marker + '88', pointerEvents: 'none' }} /> : null}
          {col === 0 ? <Text aria-hidden style={{ position: 'absolute', top: 2, left: 3, fontSize: Math.max(9, squareSize * 0.19), fontWeight: '600', color: check || highlighted || previous ? theme.labelLight : dark ? theme.labelDark : theme.labelLight }}>{rank}</Text> : null}
          {row === 7 ? <Text aria-hidden style={{ position: 'absolute', bottom: 1, right: 3, fontSize: Math.max(9, squareSize * 0.19), fontWeight: '600', color: check || highlighted || previous ? theme.labelLight : dark ? theme.labelDark : theme.labelLight }}>{file}</Text> : null}
        </Pressable>;
      })}</View>)}
      <AnnotationArrows arrows={[...feedbackArrows, ...arrowAnnotations]} preview={rightPreview} files={files} ranks={ranks} squareSize={squareSize} boardSize={squareSize * 8} />
      {dragging && game.get(dragging) ? <Animated.View style={{ position: 'absolute', zIndex: 2, width: squareSize, height: squareSize, alignItems: 'center', justifyContent: 'center', transform: dragPosition.getTranslateTransform(), pointerEvents: 'none' }}>
        <Piece type={game.get(dragging)!.type} color={game.get(dragging)!.color} size={squareSize * 0.98} />
      </Animated.View> : null}
    </View>
    {!hideStatus && (announcement || showTurnStatus) ? <Text accessibilityLiveRegion="polite" style={[s.small, { textAlign: 'center' }]}>{announcement || positionStatus(game)}</Text> : null}
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

function AnnotationArrows({ arrows, preview, files, ranks, squareSize, boardSize }: {
  arrows: ArrowAnnotation[]; preview: ArrowAnnotation | null; files: string[]; ranks: number[]; squareSize: number; boardSize: number;
}) {
  const visible = preview ? [...arrows, preview] : arrows;
  if (!visible.length) return null;
  return <Svg width={boardSize} height={boardSize} style={{ position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none' }}>
    {visible.map((arrow, index) => {
      const geometry = arrowGeometry(arrow.from, arrow.to, files, ranks, squareSize);
      if (!geometry) return null;
      const color = annotationColors[arrow.tone];
      const opacity = preview === arrow ? 0.58 : 0.78;
      return <React.Fragment key={`${arrow.from}-${arrow.to}-${arrow.tone}-${index}`}>
        <Path d={geometry.path} fill="none" stroke={color} strokeWidth={squareSize * 0.18} strokeLinecap="round" strokeLinejoin="round" opacity={opacity} />
        <Polygon points={geometry.head.map(point => `${point.x},${point.y}`).join(' ')} fill={color} opacity={opacity} />
      </React.Fragment>;
    })}
  </Svg>;
}
