import React, { useState } from 'react';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { Text, View } from 'react-native';
import { useResource } from '../../api/hooks';
import { useAuth } from '../../auth/AuthProvider';
import { useNavigation } from '../../navigation/Navigation';
import { Badge, Button, Card, Chip, Empty, ErrorState, Heading, Loading, ProgressBar } from '../../ui/components';
import { colors, s } from '../../ui/theme';
import type { StudyReport, StudyTopic } from './types';

const labels: Record<string, string> = { fork: 'Garfo', pin: 'Cravada', mate: 'Mate', mateIn1: 'Mate em 1', mateIn2: 'Mate em 2', endgame: 'Finais', middlegame: 'Meio-jogo', sacrifice: 'Sacrifício', hangingPiece: 'Peça indefesa', short: 'Sequências curtas', long: 'Sequências longas', advantage: 'Vantagem', crushing: 'Vantagem decisiva' };
function Topics({ title, topics }: { title: string; topics: StudyTopic[] }) {
  return <Card><Text style={s.h3}>{title}</Text>{topics.length ? topics.map(topic => <View key={topic.theme} style={s.stack}>
    <Text style={s.body}>{labels[topic.theme] || topic.theme}: {topic.accuracy}% sem erros ou dicas</Text>
    <ProgressBar value={topic.accuracy} label={`Acertos limpos em ${labels[topic.theme] || topic.theme}`} />
    <Text style={s.small}>{topic.sessions} sessões · {topic.mistakes} erros · {topic.hints} sessões com dica</Text>
  </View>) : <Text style={s.muted}>Ainda não há três sessões por tema para uma avaliação.</Text>}</Card>;
}
export function ReportScreen() {
  const auth = useAuth(); const { navigate, back } = useNavigation();
  const [period, setPeriod] = useState(28);
  const report = useResource<StudyReport>(auth.user ? `/learning/report?days=${period}` : null, auth.revision);
  return <View style={s.page}><Button label="Voltar" variant="ghost" icon="back" onPress={back} />
    <Heading eyebrow="Sua evolução" title="O que seu treino está mostrando." description="Acompanhe a prática e descubra onde concentrar suas próximas sessões." />
    <View style={s.wrap}>{[[7, '1 semana'], [28, '4 semanas'], [90, '3 meses'], [365, '1 ano']].map(([days, label]) => <Chip key={days} label={String(label)} selected={period === days} onPress={() => setPeriod(Number(days))} />)}</View>
    {!auth.user ? <Card><Text style={s.body}>Entre para acompanhar seu aprendizado.</Text><Button label="Entrar" onPress={() => navigate({ screen: 'auth' })} /></Card> : report.loading ? <Loading /> : report.error ? <ErrorState message={report.error} retry={report.reload} /> : report.data ? <>
      <View style={s.wrap}><Badge>{report.data.sessions} sessões em {period} dias</Badge><Badge>{report.data.cleanSessions} sem erros ou dicas</Badge><Badge>{report.data.studiedOpenings} linhas/cores estudadas</Badge><Badge>{report.data.dueReviews} revisões prontas</Badge></View>
      <RatingChart daily={report.data.daily} />
      {!report.data.sessions ? <Empty title="Seu relatório começa com a próxima sessão" description="Conclua uma aula, resolva um puzzle ou treine uma variante. O histórico anterior continua salvo no painel inicial." /> : null}
      <Topics title="Pontos fortes" topics={report.data.strengths} /><Topics title="Vale praticar de novo" topics={report.data.practiceNext} />
      <Card><Text style={s.h3}>Atividade e rating por dia</Text>{report.data.daily.map(day => <View key={day.date} style={[s.between, { flexWrap: 'wrap' }]}>
        <Text style={s.body}>{day.date.split('-').reverse().join('/')}</Text><Text style={s.small}>{day.sessions} sessões · rating {day.rating}</Text>
      </View>)}{!report.data.daily.length ? <Text style={s.muted}>Os dias aparecem à medida que você pratica.</Text> : null}</Card>
      <Text style={s.small}>{report.data.note}</Text><Button label="Continuar meu treino" onPress={() => navigate({ screen: 'home' })} />
    </> : null}
  </View>;
}

function RatingChart({ daily }: { daily: StudyReport['daily'] }) {
  const min = Math.min(...daily.map(day => day.rating), 1000) - 30;
  const max = Math.max(...daily.map(day => day.rating), 1000) + 30;
  const points = daily.map((day, index) => ({ x: daily.length === 1 ? 300 : index / Math.max(1, daily.length - 1) * 600, y: 110 - (day.rating - min) / (max - min) * 100 }));
  return <Card><Text style={s.h3}>Seu rating de treino</Text>{daily.length ? <><Svg width="100%" height={130} viewBox="-8 0 616 130" accessibilityLabel={`Rating de treino: de ${daily[0]!.rating} até ${daily.at(-1)!.rating}`}>
    <Line x1={0} y1={115} x2={600} y2={115} stroke={colors.line} />
    <Path d={points.map((point, i) => `${i ? 'L' : 'M'}${point.x},${point.y}`).join(' ')} fill="none" stroke={colors.forest} strokeWidth={3} />
    {points.map((point, i) => <Circle key={i} cx={point.x} cy={point.y} r={4} fill={colors.forest} />)}</Svg>
    <View style={s.between}><Text style={s.small}>{daily[0]!.date} · {daily[0]!.rating}</Text><Text style={s.label}>{daily.at(-1)!.rating}</Text></View></> : <Text style={s.muted}>Seu gráfico aparece após as primeiras sessões.</Text>}
    <Text style={s.small}>Estimativa do treino do Zav Chess. Não representa o rating de uma plataforma externa.</Text></Card>;
}
