import React from 'react';
import { Pressable, Text, useWindowDimensions, View } from 'react-native';
import type { Dashboard, Lesson, Progress } from '../../api/types';
import { useResource } from '../../api/hooks';
import { useAuth } from '../../auth/AuthProvider';
import { useNavigation, type Tab } from '../../navigation/Navigation';
import { Badge, Button, Card, Empty, ErrorState, Heading, Loading, ProgressBar, levels } from '../../ui/components';
import { Icon, type IconName } from '../../ui/Icon';
import { colors, s, serif } from '../../ui/theme';
import { ChessBoard } from '../../chess/ChessBoard';
import { DEFAULT_POSITION } from '../../chess/logic';
import { StudyPlan } from '../learning/StudyPlan';
import { useAppearance } from '../../appearance/AppearanceProvider';
import { lessonTrack } from '../lessons/lesson-session';
import { ActivityCalendar } from './ActivityCalendar';

const practice: { screen: Tab; icon: IconName; title: string; description: string; tag: string }[] = [
  { screen: 'puzzles', icon: 'puzzle', title: 'Encontre o melhor lance', description: 'Treine o olhar para as oportunidades.', tag: 'TÁTICA' },
  { screen: 'openings', icon: 'opening', title: 'Comece com uma ideia', description: 'Explore e pratique linhas de abertura.', tag: 'REPERTÓRIO' },
  { screen: 'endgames', icon: 'flag', title: 'Faça a vantagem valer', description: 'Estude finais com avaliação tablebase.', tag: 'FINAIS' },
];
export function HomeScreen() {
  const { user, restoring, revision } = useAuth();
  const { navigate } = useNavigation();
  const { width } = useWindowDimensions();
  const dashboard = useResource<Dashboard>(user ? '/dashboard' : null, revision);
  const progress = useResource<Progress>(user ? '/progress' : null, revision);
  const lessons = useResource<Lesson[]>('/lessons');
  const { appearance } = useAppearance();
  const next = lessons.data?.filter(lesson => lessonTrack(lesson) === appearance.learningTrack).sort((a, b) => a.sortOrder - b.sortOrder).find(lesson => !progress.data?.completedLessonIds.includes(lesson.id));
  const data = dashboard.data;
  return <View style={s.page}>
    <Heading eyebrow="Um pouco de xadrez. Todos os dias." title={user ? `Seu próximo lance, ${user.name.split(' ')[0]}.` : 'Grandes ideias começam aqui.'}
      description="Um espaço para entender o jogo e evoluir no seu ritmo." />
    <View style={{ backgroundColor: colors.forestDark, borderRadius: 24, padding: width > 700 ? 32 : 25, overflow: 'hidden', flexDirection: 'row', gap: 28 }}>
      <View style={{ flex: 1, gap: 17, justifyContent: 'center' }}><Text style={[s.eyebrow, { color: '#BBCBAC', fontSize: 10 }]}>Do primeiro movimento ao xeque-mate</Text>
        <Text style={{ fontFamily: serif, color: '#FFFBE8', fontSize: width > 700 ? 39 : 32, lineHeight: width > 700 ? 46 : 39 }}>Aprenda a enxergar{width > 700 ? '\n' : ' '}além do lance.</Text>
        <Text style={{ color: '#D4E0CE', fontSize: 14, lineHeight: 23, maxWidth: 390 }}>Aulas que explicam. Tabuleiros que ensinam. Prática que faz a diferença.</Text>
        <View style={[s.wrap, { marginTop: 4 }]}><Button label={user ? 'Começar treino de hoje' : 'Explorar aulas'} variant="light" icon="arrow" onPress={() => navigate({ screen: user ? 'today' : 'lessons' })} />
          <Pressable accessibilityRole="button" onPress={() => navigate({ screen: 'analysis' })} style={{ padding: 13, minHeight: 46 }}><Text style={{ color: '#F3F4DF', fontSize: 14 }}>Ir para o tabuleiro ↗</Text></Pressable></View>
      </View>
      {width >= 1150 ? <View style={{ width: 220, justifyContent: 'center', transform: [{ rotate: '-6deg' }], opacity: 0.93 }}><ChessBoard fen={DEFAULT_POSITION} maxSize={220} hideStatus edgeToEdge={false} /></View> : null}
    </View>
    <StudyPlan />
    {restoring ? <Loading label="Buscando sua sessão…" /> : user ? <>
      <View style={s.between}><Text accessibilityRole="header" style={s.h2}>Sua evolução</Text><Button label="Atualizar" icon="refresh" variant="ghost" compact onPress={() => { dashboard.reload(); progress.reload(); }} /></View>
      {dashboard.loading ? <Loading label="Carregando seu progresso…" /> : dashboard.error ? <ErrorState message={dashboard.error} retry={dashboard.reload} /> : data ? <>
        <View style={[s.wrap, { alignItems: 'stretch' }]}>{[
          { label: 'XP conquistado', value: data.user.xp, suffix: 'XP', icon: 'spark' as IconName },
          { label: 'Aulas concluídas', value: data.completedLessons, suffix: `/ ${data.counts.lessons}`, icon: 'book' as IconName },
          { label: 'Puzzles resolvidos', value: data.solvedPuzzles, suffix: '', icon: 'puzzle' as IconName },
          { label: 'Sequência atual', value: data.streak, suffix: data.streak === 1 ? 'dia' : 'dias', icon: 'clock' as IconName },
        ].map(stat => <Card key={stat.label} style={{ flexGrow: 1, flexBasis: width < 500 ? '44%' : '21%', padding: 20 }}>
          <Icon name={stat.icon} size={20} /><View style={[s.row, { gap: 6, alignItems: 'baseline' }]}><Text style={{ fontSize: 30, fontWeight: '600', color: colors.ink }}>{stat.value.toLocaleString('pt-BR')}</Text><Text style={s.small}>{stat.suffix}</Text></View><Text style={s.small}>{stat.label}</Text></Card>)}</View>
        <Card><View style={s.between}><Text style={s.h3}>Seu caminho de aprendizado</Text><Badge>Rating {data.user.rating}</Badge></View>
          <ProgressBar value={data.counts.lessons ? data.completedLessons / data.counts.lessons * 100 : 0} label="Porcentagem das aulas concluídas" />
          <Text style={s.small}>{data.completedLessons} de {data.counts.lessons} aulas concluídas. Cada conceito é mais uma ferramenta no seu jogo.</Text></Card>
        <Card><View style={s.between}><View><Text style={s.h3}>Sequência diária</Text><Text style={s.small}>{data.weekly.activeDays} dias ativos nos últimos 7 dias</Text></View><View style={[s.row, { gap: 6 }]}><Icon name="flame" color={colors.gold} /><Text style={s.h2}>{data.streak}</Text></View></View>
          <Text style={s.muted}>Qualquer aula, puzzle ou treino concluído conta como prática. Volte a cada dia para manter a sequência.</Text></Card>
        <ActivityCalendar dates={data.activeDates ?? []} />
        <Card><View style={s.between}><Text style={s.h3}>Desafios da semana</Text><Badge tone="gold">PESSOAL</Badge></View>
          {[{ label: 'Resolver 5 puzzles', value: data.weekly.puzzles, goal: 5 }, { label: 'Treinar 2 linhas de abertura', value: data.weekly.openings, goal: 2 }, { label: 'Concluir 2 lições', value: data.weekly.lessons, goal: 2 }].map(challenge => <View key={challenge.label} style={s.stack}>
            <View style={s.between}><Text style={s.body}>{challenge.label}</Text><Text style={s.small}>{Math.min(challenge.value, challenge.goal)}/{challenge.goal}</Text></View><ProgressBar value={challenge.value / challenge.goal * 100} label={challenge.label} /></View>)}
          <Text style={s.small}>Metas motivacionais, sem prêmio pago, limite de uso ou conteúdo bloqueado.</Text></Card>
        <View style={s.wrap}><Button label="Ver relatório completo" icon="spark" variant="secondary" onPress={() => navigate({ screen: 'report' })} /><Button label="Grupos de estudo" variant="secondary" onPress={() => navigate({ screen: 'community' })} /><Button label="Configurações" icon="settings" variant="ghost" onPress={() => navigate({ screen: 'settings' })} /></View>
      </> : null}
    </> : <Card style={{ flexDirection: width > 650 ? 'row' : 'column', alignItems: width > 650 ? 'center' : 'stretch' }}>
      <View style={[s.grow, { gap: 5 }]}><Text style={s.h3}>Seu progresso merece um lugar.</Text><Text style={s.muted}>Crie sua conta para guardar as aulas concluídas e os puzzles resolvidos.</Text></View>
      <Button label="Começar minha jornada" onPress={() => navigate({ screen: 'auth' })} icon="arrow" /></Card>}
    <View style={s.stack}><View style={s.between}><Text accessibilityRole="header" style={s.h2}>{user ? 'Continue aprendendo' : 'Seu primeiro passo'}</Text><Button label="Ver aulas" compact variant="ghost" onPress={() => navigate({ screen: 'lessons' })} /></View>
      {lessons.loading || progress.loading ? <Loading label="Preparando sua trilha…" /> : lessons.error || progress.error ? <ErrorState message={lessons.error ?? progress.error!} retry={() => { lessons.reload(); progress.reload(); }} /> : next ? <Card>
        <View style={s.wrap}><Badge>{levels[next.level]}</Badge><Text style={s.small}>{next.minutes} min · Aula</Text></View>
        <Text style={s.h2}>{next.title}</Text><Text style={s.muted}>{next.description}</Text>
        <Button label={user ? 'Abrir próxima aula' : 'Conhecer esta aula'} icon="arrow" onPress={() => navigate({ screen: 'lesson', id: next.id })} style={{ alignSelf: 'flex-start' }} />
      </Card> : <Empty title={lessons.data?.length ? 'Trilha concluída' : 'Aulas a caminho'} description={lessons.data?.length ? 'Você concluiu todas as aulas disponíveis. Revisite os conceitos ou pratique no tabuleiro.' : 'Nenhuma aula foi publicada no servidor ainda.'} />}
    </View>
    <Text accessibilityRole="header" style={s.h2}>Leve a ideia para o tabuleiro</Text>
    <View style={[s.wrap, { alignItems: 'stretch' }]}>{practice.map(item => <Pressable key={item.screen} accessibilityRole="button" accessibilityLabel={item.title} onPress={() => navigate({ screen: item.screen })}
      style={({ pressed }) => [s.card, { flexGrow: 1, flexBasis: width < 700 ? '100%' : '30%', opacity: pressed ? 0.75 : 1 }]}>
      <View style={s.between}><Icon name={item.icon} size={28} /><Text style={[s.eyebrow, { fontSize: 9, letterSpacing: 1.3 }]}>{item.tag}</Text></View>
      <Text style={s.h3}>{item.title}</Text><Text style={s.muted}>{item.description}</Text><Icon name="arrow" size={19} /></Pressable>)}</View>
    {data ? <View style={s.stack}><Text accessibilityRole="header" style={s.h2}>Seus últimos passos</Text>
      {data.recentActivity.length ? <Card>{data.recentActivity.map((activity, i) => <View key={activity.id} style={{ gap: 14 }}>
        {i > 0 ? <View style={s.separator} /> : null}<View style={s.row}><View style={{ backgroundColor: colors.pale, borderRadius: 10, padding: 10 }}><Icon name="check" size={18} /></View>
          <View style={s.grow}><Text style={s.body}>{activity.title}</Text><Text style={s.small}>{new Date(activity.createdAt).toLocaleString('pt-BR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</Text></View></View></View>)}</Card>
        : <Empty title="O primeiro passo é seu" description="Conclua uma aula ou resolva um puzzle para começar seu histórico." />}</View> : null}
  </View>;
}
