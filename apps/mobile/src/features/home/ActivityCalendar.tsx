import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { Button, Card } from '../../ui/components';
import { colors, s } from '../../ui/theme';

export function ActivityCalendar({ dates }: { dates: string[] }) {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const [year, month] = today.split('-').map(Number);
  const [offset, setOffset] = useState(0);
  const first = new Date(Date.UTC(year!, month! - 1 + offset, 1));
  const total = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  const active = new Set(dates);
  const cells = Array.from({ length: first.getUTCDay() + total }, (_, i) => i < first.getUTCDay() ? null : i - first.getUTCDay() + 1);
  const prefix = `${first.getUTCFullYear()}-${String(first.getUTCMonth() + 1).padStart(2, '0')}`;
  return <Card><View style={[s.between, { flexWrap: 'wrap' }]}><Text style={s.h3}>Seu calendário de prática</Text><Text style={s.small}>{first.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' })}</Text></View>
    <View style={s.between}><Button label="Mês anterior" compact variant="ghost" onPress={() => setOffset(value => value - 1)} /><Button label="Mês seguinte" compact variant="ghost" disabled={offset >= 0} onPress={() => setOffset(value => value + 1)} /></View>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((label, i) => <Text key={`week-${i}`} style={[s.small, { width: '14.285%', textAlign: 'center', padding: 8 }]}>{label}</Text>)}
      {cells.map((day, i) => { const key = day ? `${prefix}-${String(day).padStart(2, '0')}` : ''; const trained = active.has(key);
        return <View key={i} style={{ width: '14.285%', padding: 3 }}><View accessibilityLabel={day ? `${day}: ${trained ? 'praticou' : key > today ? 'dia futuro' : 'sem prática registrada'}` : undefined}
          style={{ minHeight: 36, borderRadius: 10, borderWidth: key === today ? 2 : 0, borderColor: colors.gold, backgroundColor: trained ? colors.forestDark : 'transparent', justifyContent: 'center', alignItems: 'center' }}>
          <Text style={[s.label, { color: trained ? colors.white : key > today ? colors.muted : colors.ink }]}>{day ?? ''}</Text></View></View>;
      })}</View><Text style={s.small}>Verde: houve treino. Contorno dourado: hoje. Datas no horário de São Paulo.</Text></Card>;
}
