import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { api } from '../../api/client';
import { useOperation, useResource } from '../../api/hooks';
import { useAuth } from '../../auth/AuthProvider';
import { useNavigation } from '../../navigation/Navigation';
import { Badge, Button, Card, Chip, Empty, ErrorState, Field, Heading, Loading, Notice, ProgressBar } from '../../ui/components';
import { s } from '../../ui/theme';
import type { RepertoireCourse } from '../learning/types';

type ImportResult = { imported: number; matched: number; weaknesses: number; recommendations: { openingId: string; count: number; summary: string }[] };

export function RepertoiresScreen() {
  const auth = useAuth(); const { navigate } = useNavigation();
  const courses = useResource<RepertoireCourse[]>(auth.user ? '/learning/repertoires' : null, auth.revision);
  const importer = useOperation(); const [platform, setPlatform] = useState<'chesscom' | 'lichess'>('chesscom'); const [username, setUsername] = useState('');
  const [imported, setImported] = useState<ImportResult | null>(null);
  if (!auth.user) return <View style={s.page}><Heading eyebrow="Repertórios guiados" title="Escolha menos. Aprenda melhor." description="Entre para montar um repertório e acompanhar o domínio de cada posição." />
    <Button label="Entrar para escolher" onPress={() => navigate({ screen: 'auth' })} style={{ alignSelf: 'flex-start' }} /></View>;
  return <View style={s.page}><Heading eyebrow="Cursos curados" title="Seu repertório, decisão por decisão." description="Linhas curtas, respostas comuns e um plano claro para o meio-jogo. O catálogo completo continua disponível quando você quiser pesquisar." />
    <Card><Badge tone="gold">DIAGNÓSTICO PELAS SUAS PARTIDAS</Badge><Text style={s.h2}>Treine o que realmente acontece no seu jogo.</Text><Text style={s.muted}>Buscamos até 50 partidas públicas recentes e distinguimos um erro seu de uma resposta adversária ainda não coberta.</Text>
      <View style={s.wrap}><Chip label="Chess.com" selected={platform === 'chesscom'} onPress={() => setPlatform('chesscom')} /><Chip label="Lichess" selected={platform === 'lichess'} onPress={() => setPlatform('lichess')} /></View>
      <Field label="Nome público do jogador" value={username} onChangeText={setUsername} placeholder={platform === 'chesscom' ? 'Seu usuário no Chess.com' : 'Seu usuário no Lichess'} autoCorrect={false} />
      <Button label="Analisar minhas partidas" busy={importer.busy} disabled={username.trim().length < 2} onPress={() => void importer.run(async signal => {
        const result = await api.post<ImportResult>('/learning/games/import', { platform, username: username.trim() }, signal);
        setImported(result); auth.refreshProgress();
      })} style={{ alignSelf: 'flex-start' }} />
      {importer.error ? <ErrorState message={importer.error} /> : null}
      {imported ? <Notice tone="success">{imported.imported} partidas analisadas · {imported.matched} entraram no repertório · {imported.weaknesses} desvios seus encontrados.{imported.recommendations[0] ? ` Prioridade: ${imported.recommendations[0].summary}` : ''}</Notice> : null}
    </Card>
    {courses.loading ? <Loading label="Montando repertórios…" /> : courses.error ? <ErrorState message={courses.error} retry={courses.reload} /> : courses.data?.length ? <View style={s.stack}>{courses.data.map(course =>
      <Card key={course.id}><View style={s.between}><View style={s.wrap}><Badge tone={course.selected ? 'green' : 'neutral'}>{course.selected ? 'NO MEU REPERTÓRIO' : course.side === 'w' ? 'BRANCAS' : 'PRETAS'}</Badge><Text style={s.small}>{course.level === 'beginner' ? 'Iniciante' : 'Intermediário'}</Text></View><Text style={s.small}>{course.lineCount} linhas</Text></View>
        <Text style={s.h2}>{course.title}</Text><Text style={s.muted}>{course.subtitle}</Text>
        <View style={s.between}><Badge tone="gold">{course.rank ?? 'Começando'}</Badge><Text style={s.small}>{course.points ?? 0}/{course.maxPoints ?? course.positionCount * 10} pontos de domínio</Text></View>
        <ProgressBar value={course.mastery} label={`${course.mastery}% de domínio consolidado`} />
        {course.duePositions ? <Notice>{course.duePositions} posições estão prontas para revisão.</Notice> : null}
        <Button label={course.selected ? 'Continuar repertório' : 'Conhecer repertório'} icon="arrow" onPress={() => navigate({ screen: 'repertoire', id: course.id })} style={{ alignSelf: 'flex-start' }} />
      </Card>)}</View> : <Empty title="Repertórios em preparação" description="O catálogo ainda não contém linhas suficientes para montar os cursos." />}
  </View>;
}

export function RepertoireScreen({ id }: { id: string }) {
  const auth = useAuth(); const { back, navigate } = useNavigation(); const operation = useOperation();
  const course = useResource<RepertoireCourse>(auth.user ? `/learning/repertoires/${encodeURIComponent(id)}` : null, auth.revision);
  return <View style={s.page}><Button label="Voltar aos repertórios" icon="back" variant="ghost" onPress={back} style={{ alignSelf: 'flex-start' }} />
    {course.loading ? <Loading label="Abrindo repertório…" /> : course.error ? <ErrorState message={course.error} retry={course.reload} /> : course.data ? <>
      <Heading eyebrow={`${course.data.side === 'w' ? 'Brancas' : 'Pretas'} · ${course.data.lineCount} linhas curtas`} title={course.data.title} description={course.data.subtitle} />
      <Card><Text style={s.h3}>O que você aprenderá</Text>{course.data.goals.map(goal => <Text key={goal} style={s.body}>• {goal}</Text>)}
        <ProgressBar value={course.data.mastery} label={`${course.data.mastery}% do repertório praticado`} />
        <Text style={s.body}>{course.data.rank} · {course.data.points}/{course.data.maxPoints} pontos</Text>
        <Text style={s.small}>Cada decisão chega a 10 pontos com revisões espaçadas. Repetir antes da data ajuda a praticar; os pontos avançam quando a revisão está pronta.</Text>
        {!course.data.selected ? <Button label="Adicionar ao meu repertório" busy={operation.busy} onPress={() => void operation.run(async signal => {
          await api.post(`/learning/repertoires/${encodeURIComponent(id)}/select`, {}, signal); auth.refreshProgress(); course.reload();
        })} style={{ alignSelf: 'flex-start' }} /> : <Notice tone="success">Este curso já faz parte do seu treino pessoal.</Notice>}
        {operation.error ? <ErrorState message={operation.error} /> : null}
      </Card>
      <Text accessibilityRole="header" style={s.h2}>Árvore de decisões</Text>
      {course.data.lines.map((line, index) => <Card key={line.openingId}>
        <View style={s.between}><Badge>{line.eco}</Badge><Text style={s.small}>Ramo {index + 1} · {line.decisions.length} decisões suas</Text></View>
        <Text style={s.h3}>{line.name}</Text>
        {line.decisions.map(decision => <View key={decision.key} style={s.stack}><View style={s.between}><Text style={s.label}>{decision.san}</Text><Badge>{decision.masteryPoints ?? 0}/10</Badge></View>
          <Text style={s.body}>{decision.explanation}</Text><ProgressBar value={(decision.masteryPoints ?? 0) * 10} label={`Domínio da decisão ${decision.san}`} />
          <Button label="Revisar esta decisão" compact variant="ghost" onPress={() => navigate({ screen: 'opening', id: line.openingId, studySide: course.data!.side, focusPly: decision.ply })} />
        </View>)}
        <Button label="Aprender este ramo" icon="arrow" onPress={() => navigate({ screen: 'opening', id: line.openingId, studySide: course.data!.side })} style={{ alignSelf: 'flex-start' }} />
      </Card>)}
    </> : null}
  </View>;
}
