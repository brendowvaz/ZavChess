import React from 'react';
import { Pressable, Text, useWindowDimensions, View } from 'react-native';
import { Icon } from './Icon';
import { colors, s } from './theme';

export function StudyLayout({ title, subtitle, eyebrow, progress, onBack, topAction, renderBoard, status, stats, actions, boardMaxSize = 720 }: {
  title: string; subtitle?: string; eyebrow?: string; progress?: number; onBack: () => void;
  topAction?: React.ReactNode; renderBoard: (maxSize: number) => React.ReactNode;
  status?: React.ReactNode; stats?: React.ReactNode; actions?: React.ReactNode;
  boardMaxSize?: number;
}) {
  const { width, height } = useWindowDimensions();
  const horizontal = width >= 780 || width > height;
  const boardSize = Math.min(boardMaxSize, Math.max(180, Math.floor(horizontal
    ? Math.min(720, height - 96, width - 360)
    : Math.min(width, height - 320))));
  const clamped = Math.max(0, Math.min(100, progress ?? 0));
  return <View style={{ flex: 1, minHeight: 0, backgroundColor: colors.background, overflow: 'hidden' }}>
    <View style={{ minHeight: 64, paddingHorizontal: 14, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 10,
      borderBottomWidth: 1, borderBottomColor: colors.line, backgroundColor: colors.surface }}>
      <Pressable accessibilityRole="button" accessibilityLabel="Voltar" onPress={onBack}
        style={({ pressed }) => ({ width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.58 : 1 })}>
        <Icon name="back" size={22} />
      </Pressable>
      <View style={{ flex: 1, minWidth: 0, alignItems: horizontal ? 'flex-start' : 'center', gap: 1 }}>
        {eyebrow ? <Text numberOfLines={1} style={[s.eyebrow, { fontSize: 9, letterSpacing: 1.3 }]}>{eyebrow}</Text> : null}
        <Text accessibilityRole="header" numberOfLines={1} style={[s.h3, { lineHeight: 22 }]}>{title}</Text>
        {subtitle ? <Text numberOfLines={1} style={[s.small, { lineHeight: 16 }]}>{subtitle}</Text> : null}
      </View>
      <View style={{ minWidth: 44, alignItems: 'flex-end' }}>{topAction}</View>
    </View>
    {progress !== undefined ? <View accessibilityRole="progressbar" accessibilityLabel="Progresso da atividade"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped) }} style={{ height: 4, backgroundColor: colors.line }}>
      <View style={{ width: `${clamped}%`, height: 4, backgroundColor: colors.forest }} />
    </View> : null}
    <View style={{ flex: 1, minHeight: 0, flexDirection: horizontal ? 'row' : 'column', alignItems: horizontal ? 'center' : 'stretch',
      justifyContent: 'center', gap: horizontal ? 22 : 0, padding: horizontal ? 16 : 0 }}>
      <View style={{ width: horizontal ? boardSize : '100%', alignItems: 'center', justifyContent: 'center' }}>
        {renderBoard(boardSize)}
      </View>
      <View style={{ flex: horizontal ? undefined : 1, width: horizontal ? Math.min(330, Math.max(280, width - boardSize - 54)) : '100%',
        minHeight: 0, paddingHorizontal: horizontal ? 0 : 14, paddingVertical: horizontal ? 0 : 12,
        justifyContent: 'center', gap: horizontal ? 16 : 10 }}>
        {status}
        {stats}
        {actions}
      </View>
    </View>
  </View>;
}

export function StudyMessage({ children, tone = 'info' }: React.PropsWithChildren<{ tone?: 'info' | 'success' | 'error' }>) {
  const color = tone === 'error' ? colors.error : colors.forest;
  const backgroundColor = tone === 'error' ? colors.errorBg : colors.pale;
  return <View accessibilityRole={tone === 'error' ? 'alert' : undefined} accessibilityLiveRegion="polite"
    style={{ minHeight: 48, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, alignItems: 'center', justifyContent: 'center', backgroundColor }}>
    <Text style={[s.body, { color, fontWeight: '600', textAlign: 'center', fontSize: 14, lineHeight: 19 }]}>{children}</Text>
  </View>;
}
