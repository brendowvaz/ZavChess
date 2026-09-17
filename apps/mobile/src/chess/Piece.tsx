import React from 'react';
import { Image, View, type ImageSourcePropType } from 'react-native';
import type { Color, PieceSymbol } from 'chess.js';
import { useAppearance } from '../appearance/AppearanceProvider';
import type { PieceStyle } from '../appearance/themes';

const sheets: Record<PieceStyle, ImageSourcePropType> = {
  classic: require('../../assets/pieces/classic-web-sprite.png'),
  geometric: require('../../assets/pieces/geometric-web-sprite.png'),
  rounded: require('../../assets/pieces/rounded-web-sprite.png'),
  sculpted: require('../../assets/pieces/sculpted-web-sprite.png'),
};

const columns: Record<PieceSymbol, number> = { k: 0, q: 1, b: 2, n: 3, r: 4, p: 5 };

export function Piece({ type, color, size, pieceStyle }: { type: PieceSymbol; color: Color; size: number; pieceStyle?: PieceStyle }) {
  const { appearance } = useAppearance();
  const style = pieceStyle ?? appearance.pieceStyle;
  const row = color === 'w' ? 0 : 1;

  return <View aria-hidden style={{ width: size, height: size, overflow: 'hidden', pointerEvents: 'none' }}>
    <Image source={sheets[style]} resizeMode="stretch" fadeDuration={0}
      style={{ position: 'absolute', width: size * 6, height: size * 2,
        left: -columns[type] * size, top: -row * size }} />
  </View>;
}
