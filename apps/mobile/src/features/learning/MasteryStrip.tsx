import React from 'react';
import { Text, View } from 'react-native';
import { colors, s } from '../../ui/theme';

export function MasteryStrip({ todo, wrong, correct, compact = false }: { todo: number; wrong: number; correct: number; compact?: boolean }) {
  const item = (label: string, value: number, color: string, backgroundColor: string) => <View key={label}
    accessibilityLabel={`${label}: ${value}`} style={{ flex: 1, minWidth: compact ? 68 : 88, gap: compact ? 1 : 5, padding: compact ? 7 : 12, borderRadius: 13, backgroundColor }}>
    <Text style={[s.small, { color, fontWeight: '700', textTransform: 'uppercase', fontSize: compact ? 9 : 12, lineHeight: compact ? 13 : 18 }]}>{label}</Text>
    <Text style={[s.h2, { color, fontSize: compact ? 17 : 21, lineHeight: compact ? 21 : 28 }]}>{value}</Text>
  </View>;
  return <View style={[s.row, { alignItems: 'stretch', flexWrap: 'wrap' }]}>
    {item('A fazer', todo, colors.muted, '#EFF1EC')}
    {item('Erros', wrong, colors.error, colors.errorBg)}
    {item('Certos', correct, colors.forest, colors.pale)}
  </View>;
}
