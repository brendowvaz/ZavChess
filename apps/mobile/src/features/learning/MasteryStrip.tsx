import React from 'react';
import { Text, View } from 'react-native';
import { colors, s } from '../../ui/theme';

export function MasteryStrip({ todo, wrong, correct }: { todo: number; wrong: number; correct: number }) {
  const item = (label: string, value: number, color: string, backgroundColor: string) => <View key={label}
    accessibilityLabel={`${label}: ${value}`} style={{ flex: 1, minWidth: 88, gap: 5, padding: 12, borderRadius: 13, backgroundColor }}>
    <Text style={[s.small, { color, fontWeight: '700', textTransform: 'uppercase' }]}>{label}</Text>
    <Text style={[s.h2, { color }]}>{value}</Text>
  </View>;
  return <View style={[s.row, { alignItems: 'stretch', flexWrap: 'wrap' }]}>
    {item('A fazer', todo, colors.muted, '#EFF1EC')}
    {item('Erros', wrong, colors.error, colors.errorBg)}
    {item('Certos', correct, colors.forest, colors.pale)}
  </View>;
}
