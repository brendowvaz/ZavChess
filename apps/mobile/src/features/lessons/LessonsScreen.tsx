import React, { useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { Lesson, LessonDetail, LessonResult, Progress } from '../../api/types';
import { api } from '../../api/client';
import { useOperation, useResource } from '../../api/hooks';
import { useAuth } from '../../auth/AuthProvider';
import { useNavigation } from '../../navigation/Navigation';
import { Badge, Button, Card, Chip, Empty, ErrorState, Heading, Loading, Notice, ProgressBar, categories, levels } from '../../ui/components';
import { Icon } from '../../ui/Icon';
import { colors, s } from '../../ui/theme';
import { Replay } from '../../chess/Replay';
import { ChessBoard } from '../../chess/ChessBoard';
import { studyRequestId } from '../learning/request-id';

export function LessonsScreen() {
  const auth = useAuth(); const { navigate } = useNavigation();
  const lessons = useResource<Lesson[]>('/lessons');
  const progress = useResource<Progress>(auth.user ? '/progress' : null, auth.revision);
  const [category, setCategory] = useState('all');
  const filtered = lessons.data?.filter(lesson => category === 'all' || lesson.category === category).sort((a, b) => a.sortOrder - b.sortOrder);
  return <View style={s.page}><Heading eyebrow="Aprenda com propósito" title="Uma ideia de cada vez." description="Entenda o conceito, explore o tabuleiro e coloque seu conhecimento à prova." />
    <View style={s.wrap}><Chip label="Todas as aulas" selected={category === 'all'} onPress={() => setCategory('all')} />{Object.entries(categories).map(([id, label]) => <Chip key={id} label={label} selected={category === id} onPress={() => setCategory(id)} />)}</View>
    {progress.error ? <ErrorState message={`Não foi possível carregar suas conclusões. ${progress.error}`} retry={progress.reload} /> : null}
    {lessons.loading ? <Loading label="Carregando aulas…" /> : lessons.error ? <ErrorState message={lessons.error} retry={lessons.reload} /> : !filtered?.length ? <Empty title="Nenhuma aula nesta trilha" description="Escolha outra categoria ou volte quando novos conteúdos forem publicados." /> :
      <View style={s.stack}>{filtered.map((lesson, index) => {
        const completed = progress.data?.completedLessonIds.includes(lesson.id);
        return <Pressable key={lesson.id} accessibilityRole="button" accessibilityLabel={`${lesson.title}, ${levels[lesson.level]}, ${lesson.minutes} minutos${completed ? ', concluída' : ''}`} onPress={() => navigate({ screen: 'lesson', id: lesson.id })}
          style={({ pressed }) => [s.card, { opacity: pressed ? 0.75 : 1, padding: 22 }]}>
          <View style={[s.row, { alignItems: 'flex-start' }]}><View style={{ width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: colors.pale }}>
            {completed ? <Icon name="check" /> : <Text style={{ fontSize: 17, fontFamily: 'monospace', color: colors.forest }}>{String(index + 1).padStart(2, '0')}</Text>}</View>
            <View style={[s.grow, { gap: 10 }]}><View style={s.wrap}><Badge>{categories[lesson.category]}</Badge><Text style={s.small}>{levels[lesson.level]} · {lesson.minutes} min</Text>{completed ? <Badge tone="gold">Concluída</Badge> : null}</View>
              <Text style={s.h2}>{lesson.title}</Text><Text style={s.muted}>{lesson.description}</Text></View><Icon name="chevron" size={18} /></View>
        </Pressable>;
      })}</View>}
  </View>;
}

export function LessonScreen({ id }: { id: string }) {
  const lesson = useResource<LessonDetail>(`/lessons/${encodeURIComponent(id)}`);
  const { back } = useNavigation();
  return <View style={s.page}><Button label="Voltar às aulas" icon="back" variant="ghost" onPress={back} style={{ alignSelf: 'flex-start' }} />
    {lesson.loading ? <Loading label="Abrindo a aula…" /> : lesson.error ? <ErrorState message={lesson.error} retry={lesson.reload} /> : lesson.data ? <LessonReader lesson={lesson.data} /> : null}</View>;
}
function LessonReader({ lesson }: { lesson: LessonDetail }) {
  const requestId = useRef(studyRequestId());
  const [stepIndex, setStepIndex] = useState(0);
  const [answer, setAnswer] = useState<number | null>(null);
  const [result, setResult] = useState<LessonResult | null>(null);
  const auth = useAuth(); const { navigate } = useNavigation(); const operation = useOperation();
  const step = lesson.steps[stepIndex];
  const quizVisible = stepIndex >= lesson.steps.length;
  return <View style={s.page}>
    <Heading eyebrow={`${categories[lesson.category]} · ${levels[lesson.level]}`} title={lesson.title} description={lesson.description} />
    <View style={s.stack}><View style={s.between}><Text style={s.small}>{quizVisible ? 'Hora de praticar o conceito' : `Etapa ${stepIndex + 1} de ${lesson.steps.length}`}</Text><Text style={s.small}>{lesson.minutes} min</Text></View>
      <ProgressBar value={stepIndex / Math.max(1, lesson.steps.length) * 100} label="Etapas de leitura desta aula" /></View>
    {!quizVisible && step ? <Card><Text accessibilityRole="header" style={s.h2}>{step.title}</Text><Text style={s.body}>{step.text}</Text>
      {step.moves?.length ? <Replay key={`${lesson.id}-${stepIndex}`} initialFen={step.fen} moves={step.moves} /> : step.fen ? <ChessBoard fen={step.fen} /> : null}
      <View style={[s.between, { flexWrap: 'wrap' }]}><Button label="Etapa anterior" variant="ghost" icon="back" disabled={stepIndex === 0} onPress={() => setStepIndex(n => n - 1)} />
        <Button label={stepIndex === lesson.steps.length - 1 ? 'Ir para o quiz' : 'Próxima etapa'} icon="arrow" onPress={() => setStepIndex(n => n + 1)} /></View>
    </Card> : <Card><Badge>QUIZ DA AULA</Badge><Text accessibilityRole="header" style={s.h2}>{lesson.quiz.question}</Text>
      <View style={{ gap: 10 }}>{lesson.quiz.options.map((option, i) => <Pressable key={i} accessibilityRole="radio" accessibilityLabel={option} accessibilityState={{ checked: answer === i, disabled: operation.busy || !!result?.correct }}
        disabled={operation.busy || result?.correct} onPress={() => { setAnswer(i); setResult(null); requestId.current = studyRequestId(); }}
        style={({ pressed }) => ({ flexDirection: 'row', gap: 12, alignItems: 'center', minHeight: 56, borderWidth: 1, borderColor: answer === i ? colors.forest : colors.line, borderRadius: 12, padding: 15, backgroundColor: answer === i ? colors.pale : colors.surface, opacity: pressed ? 0.75 : 1 })}>
        <View style={{ width: 25, height: 25, borderRadius: 13, borderWidth: 1, borderColor: answer === i ? colors.forest : '#CBD3C5', backgroundColor: answer === i ? colors.forest : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 11, color: answer === i ? 'white' : colors.muted }}>{String.fromCharCode(65 + i)}</Text></View><Text style={[s.body, s.grow]}>{option}</Text></Pressable>)}</View>
      {!auth.user ? <Notice action={<Button label="Entrar para responder" onPress={() => navigate({ screen: 'auth' })} />}>Entre para enviar sua resposta e registrar a conclusão.</Notice> :
        <Button label={result?.correct ? 'Aula concluída' : 'Verificar resposta'} icon={result?.correct ? 'check' : 'arrow'} disabled={answer === null || !!result?.correct} busy={operation.busy} onPress={() => void operation.run(async signal => {
          const response = await api.post<LessonResult>(`/lessons/${encodeURIComponent(lesson.id)}/complete`, { answer, requestId: requestId.current }, signal);
          setResult(response); requestId.current = studyRequestId(); auth.refreshProgress();
        })} />}
      {operation.error ? <ErrorState message={operation.error} /> : null}
      {result ? <Notice tone={result.correct ? 'success' : 'error'}>{result.correct ? 'Muito bem! ' : 'Ainda não. '}{result.explanation}{result.correct ? ` ${result.xpEarned > 0 ? `+${result.xpEarned} XP.` : 'Esta conclusão não gerou XP adicional.'}` : ''}</Notice> : null}
      {result?.nextReviewAt ? <Text style={s.small}>Revisão agendada: {new Date(result.nextReviewAt).toLocaleString('pt-BR')}.</Text> : null}
      <View style={s.wrap}><Button label="Revisar o conteúdo" icon="back" variant="ghost" disabled={operation.busy || !lesson.steps.length} onPress={() => setStepIndex(0)} />
        {result?.correct ? <Button label="Ver outras aulas" variant="secondary" onPress={() => navigate({ screen: 'lessons' })} /> : null}</View>
    </Card>}
  </View>;
}
