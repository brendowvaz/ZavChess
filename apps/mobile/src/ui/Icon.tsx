import React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { colors } from './theme';

export type IconName = 'home' | 'book' | 'opening' | 'puzzle' | 'flag' | 'play' | 'arrow' | 'back' | 'check' | 'user' | 'search' | 'spark' | 'clock' | 'refresh' | 'chevron' | 'close' | 'settings';
const paths: Record<IconName, string> = {
  settings: 'M4 7h3m6 0h7M4 17h9m6 0h1M10 4a3 3 0 1 0 0 6 3 3 0 0 0 0-6M16 14a3 3 0 1 0 0 6 3 3 0 0 0 0-6',
  home: 'M3 10 12 3 21 10M5 9v12h5v-7h4v7h5V9',
  book: 'M12 6v15M12 6C9 3 5 3 3 4v15c3-1 6-1 9 2 3-3 6-3 9-2V4c-3-1-6-1-9 2Z',
  opening: 'M5 20h14M7 17h10l-2-5 3-5-4-3-6 3 3 3-4 3Z',
  puzzle: 'M9 3H3v6c4-2 4 4 0 3v9h6c-2-4 4-4 3 0h9v-9c-4 2-4-4 0-3V3h-9c2 4-4 4-3 0Z',
  flag: 'M5 22V3c5-4 9 4 15 0v11c-6 4-10-4-15 0',
  play: 'm9 5 11 7-11 7Z',
  arrow: 'M4 12h16m-6-6 6 6-6 6', back: 'M20 12H4m6-6-6 6 6 6', check: 'm5 12 4 4L19 6',
  user: 'M4 21v-2a8 8 0 0 1 16 0v2M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8',
  search: 'm16 16 5 5M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14',
  spark: 'm12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5Z',
  clock: 'M12 7v5l3 2M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20',
  refresh: 'M20 7v5h-5M4 17v-5h5M5 7a8 8 0 0 1 14-1l1 6M4 12l1 6a8 8 0 0 0 14-1',
  chevron: 'm9 5 7 7-7 7', close: 'm6 6 12 12M18 6 6 18',
};
export function Icon({ name, size = 22, color = colors.forest }: { name: IconName; size?: number; color?: string }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" accessible={false}>
    <Path d={paths[name]} fill="none" stroke={color} strokeWidth={1.65} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>;
}
export function BrandMark({ size = 38, light = false }: { size?: number; light?: boolean }) {
  return <Svg width={size} height={size} viewBox="0 0 40 40" accessible={false}>
    <Rect x={0} y={0} width={40} height={40} rx={12} fill={light ? '#E8ECD9' : colors.forest} />
    <Path d="M12 29h17l-1-4H14l3-8-4-1 4-8 9 4-2 5 2 7M17 8l-1-3" fill="none" stroke={light ? colors.forest : '#EEEBD5'} strokeWidth={2.4} strokeLinejoin="round" />
    <Circle cx={21} cy={13} r={1} fill={light ? colors.forest : '#EEEBD5'} />
  </Svg>;
}
