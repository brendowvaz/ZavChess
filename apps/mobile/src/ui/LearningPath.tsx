import React from 'react';
import { Pressable, Text, useWindowDimensions, View } from 'react-native';
import { Icon } from './Icon';
import { colors, s } from './theme';

export type PathState = 'completed' | 'current' | 'ready';
export type PathItem = { id: string; title: string; subtitle: string; state: PathState; accessibilityLabel?: string };

export function LearningPath({ items, onPress }: { items: PathItem[]; onPress: (item: PathItem) => void }) {
  const { width } = useWindowDimensions();
  const compact = width < 600;
  return <View style={{ gap: 0, width: '100%', maxWidth: '100%', minWidth: 0, overflow: 'hidden' }}>{items.map((item, index) => {
    const current = item.state === 'current'; const completed = item.state === 'completed'; const right = index % 2 === 1;
    const color = completed ? colors.forest : current ? colors.warning : colors.muted;
    const background = completed ? colors.pale : current ? colors.warningBg : colors.surface;
    const axis = compact ? 24 : '50%';
    return <View key={item.id} style={{ width: '100%', maxWidth: '100%', minHeight: compact ? 106 : 118, position: 'relative', justifyContent: 'center', minWidth: 0 }}>
      {index > 0 ? <View style={{ position: 'absolute', top: 0, bottom: '50%', left: axis, width: 2, marginLeft: -1, backgroundColor: completed || current ? colors.sage : colors.line }} /> : null}
      {index < items.length - 1 ? <View style={{ position: 'absolute', top: '50%', bottom: 0, left: axis, width: 2, marginLeft: -1, backgroundColor: completed ? colors.sage : colors.line }} /> : null}
      <View style={{ width: '100%', maxWidth: '100%', flexDirection: compact ? 'row' : right ? 'row-reverse' : 'row', alignItems: 'center', gap: compact ? 12 : 14, minWidth: 0 }}>
        {!compact ? <View style={{ flex: 1, minWidth: 0, alignItems: right ? 'flex-start' : 'flex-end' }}>
          <Pressable accessibilityRole="button" accessibilityLabel={item.accessibilityLabel ?? `${item.title}. ${item.subtitle}`}
            onPress={() => onPress(item)} style={({ pressed }) => ({ width: '100%', maxWidth: 460, minHeight: 82, borderRadius: 18, padding: 16,
              justifyContent: 'center', gap: 4, borderWidth: current ? 2 : 1, borderColor: current ? colors.gold : colors.line,
              backgroundColor: background, opacity: pressed ? 0.72 : 1 })}>
            <Text style={[s.small, { color, fontWeight: '700', textTransform: 'uppercase' }]}>{completed ? 'Concluído' : current ? 'Próximo passo' : 'Disponível'}</Text>
            <Text numberOfLines={2} style={s.h3}>{item.title}</Text><Text numberOfLines={2} style={s.small}>{item.subtitle}</Text>
          </Pressable>
        </View> : null}
        <View accessibilityElementsHidden importantForAccessibility="no" style={{ width: compact ? 48 : 58, height: compact ? 48 : 58, borderRadius: compact ? 24 : 29, zIndex: 2, alignItems: 'center', justifyContent: 'center',
          borderWidth: current ? 4 : 2, borderColor: current ? colors.gold : completed ? colors.forest : colors.line, backgroundColor: background }}>
          {completed ? <Icon name="check" size={25} color={colors.forest} /> : <Text style={{ fontSize: 17, fontWeight: '700', color }}>{index + 1}</Text>}
        </View>
        {compact ? <Pressable accessibilityRole="button" accessibilityLabel={item.accessibilityLabel ?? `${item.title}. ${item.subtitle}`}
          onPress={() => onPress(item)} style={({ pressed }) => ({ flex: 1, minWidth: 0, minHeight: 82, borderRadius: 18, padding: 14,
            justifyContent: 'center', gap: 4, borderWidth: current ? 2 : 1, borderColor: current ? colors.gold : colors.line,
            backgroundColor: background, opacity: pressed ? 0.72 : 1 })}>
          <Text style={[s.small, { color, fontWeight: '700', textTransform: 'uppercase' }]}>{completed ? 'Concluído' : current ? 'Próximo passo' : 'Disponível'}</Text>
          <Text numberOfLines={2} style={s.h3}>{item.title}</Text><Text numberOfLines={2} style={s.small}>{item.subtitle}</Text>
        </Pressable> : <View style={{ flex: 1, minWidth: 0 }} />}
      </View>
    </View>;
  })}</View>;
}
