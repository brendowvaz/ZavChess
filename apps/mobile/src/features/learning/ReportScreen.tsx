import React from 'react';
import { Text, View } from 'react-native';
import { useResource } from '../../api/hooks';
import { useAuth } from '../../auth/AuthProvider';
import { useNavigation } from '../../navigation/Navigation';
import { Badge, Button, Card, Empty, ErrorState, Heading, Loading, ProgressBar } from '../../ui/components';
import { s } from '../../ui/theme';
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
  const report = useResource<StudyReport>(auth.user ? '/learning/report' : null, auth.revision);
  return <View style={s.page}><Button label="Voltar" variant="ghost" icon="back" onPress={back} />
    <Heading eyebrow="Sua evolução" title="O que seu treino está mostrando." description="Acompanhe as últimas quatro semanas e descubra onde concentrar a prática." />
    {!auth.user ? <Card><Text style={s.body}>Entre para acompanhar seu aprendizado.</Text><Button label="Entrar" onPress={() => navigate({ screen: 'auth' })} /></Card> : report.loading ? <Loading /> : report.error ? <ErrorState message={report.error} retry={report.reload} /> : report.data ? <>
      <View style={s.wrap}><Badge>{report.data.sessions} sessões em 28 dias</Badge><Badge>{report.data.cleanSessions} sem erros ou dicas</Badge><Badge>{report.data.studiedOpenings} linhas/cores estudadas</Badge><Badge>{report.data.dueReviews} revisões prontas</Badge></View>
      {!report.data.sessions ? <Empty title="Seu relatório começa com a próxima sessão" description="Conclua uma aula, resolva um puzzle ou treine uma variante. O histórico anterior continua salvo no painel inicial." /> : null}
      <Topics title="Pontos fortes" topics={report.data.strengths} /><Topics title="Vale praticar de novo" topics={report.data.practiceNext} />
      <Card><Text style={s.h3}>Atividade e rating por dia</Text>{report.data.daily.map(day => <View key={day.date} style={[s.between, { flexWrap: 'wrap' }]}>
        <Text style={s.body}>{day.date.split('-').reverse().join('/')}</Text><Text style={s.small}>{day.sessions} sessões · rating {day.rating}</Text>
      </View>)}{!report.data.daily.length ? <Text style={s.muted}>Os dias aparecem à medida que você pratica.</Text> : null}</Card>
      <Text style={s.small}>{report.data.note}</Text><Button label="Continuar meu treino" onPress={() => navigate({ screen: 'home' })} />
    </> : null}
  </View>;
}
