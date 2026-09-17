import React, { useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { Lesson, LessonBoardResult, LessonDetail, Progress } from '../../api/types';
import { api } from '../../api/client';
import { useOperation, useResource } from '../../api/hooks';
import { useAuth } from '../../auth/AuthProvider';
import { useNavigation } from '../../navigation/Navigation';
import { Badge, Button, Card, Chip, Empty, ErrorState, Heading, Loading, Notice, ProgressBar, categories, levels } from '../../ui/components';
import { Icon } from '../../ui/Icon';
import { colors, s } from '../../ui/theme';
import { ChessBoard } from '../../chess/ChessBoard';
import { studyRequestId } from '../learning/request-id';
import { GuidedLinePractice, type GuidedPracticeResult } from '../learning/GuidedLinePractice';
import { lessonBoardExercises } from './board-exercises';
import { DEFAULT_POSITION, linePositions } from '../../chess/logic';
import type { ArrowAnnotation } from '../../chess/annotations';

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
  const [mastered, setMastered] = useState<Record<string, GuidedPracticeResult>>({});
  const [result, setResult] = useState<LessonBoardResult | null>(null);
  const auth = useAuth(); const { navigate } = useNavigation(); const operation = useOperation();
  const step = lesson.steps[stepIndex];
  const fallback = lessonBoardExercises[lesson.id];
  const opponentStep = !!step && /lance adversário|último lance adversário/i.test(`${step.title} ${step.text}`);
  const editorialPracticeKeys = lesson.steps.flatMap((item, index) => item.moves?.length && !/lance adversário|último lance adversário/i.test(`${item.title} ${item.text}`) ? [`step-${index}`] : []);
  const fallbackKey = !editorialPracticeKeys.length && fallback ? 'fallback' : null;
  const requiredKeys = fallbackKey ? [fallbackKey] : editorialPracticeKeys;
  const practiceKey = step?.moves?.length && !opponentStep ? `step-${stepIndex}` : fallbackKey && stepIndex === lesson.steps.length - 1 ? fallbackKey : null;
  const practice = practiceKey === fallbackKey ? fallback : step?.moves?.length ? { fen: step.fen ?? DEFAULT_POSITION, moves: step.moves, prompt: 'Faça seus lances; as respostas adversárias são automáticas.' } : null;
  const nearestFen = step?.fen ?? lesson.steps.find(item => item.fen)?.fen ?? fallback?.fen ?? DEFAULT_POSITION;
  const allMastered = requiredKeys.length > 0 && requiredKeys.every(key => !!mastered[key]);
  const totalMistakes = Object.values(mastered).reduce((sum, item) => sum + item.mistakes, 0);
  const hintUsed = Object.values(mastered).some(item => item.hintUsed);
  const recordMastery = (key: string, practiceResult: GuidedPracticeResult) => setMastered(items => ({ ...items, [key]: practiceResult }));
  return <View style={s.page}>
    <Heading eyebrow={`${categories[lesson.category]} · ${levels[lesson.level]}`} title={lesson.title} description="Aprenda a ideia, faça os movimentos e corrija seus erros até dominar a aula." />
    <View style={s.stack}><View style={s.between}><Text style={s.small}>{`Etapa ${stepIndex + 1} de ${lesson.steps.length}`}</Text><Text style={s.small}>{lesson.minutes} min</Text></View>
      <ProgressBar value={stepIndex / Math.max(1, lesson.steps.length) * 100} label="Progresso desta aula" /></View>
    {step ? <Card><Badge>APRENDA NO TABULEIRO</Badge><Text accessibilityRole="header" style={s.h2}>{step.title}</Text><Text style={s.body}>{opponentStep ? step.text.replace('Reproduza esse lance para chegar ao problema.', 'Esse lance é aplicado automaticamente para chegar ao problema.') : step.text}</Text>
      {opponentStep && step.moves?.length ? <AutomaticOpponentMove fen={step.fen ?? DEFAULT_POSITION} moves={step.moves} />
        : practice && practiceKey ? <><Text style={s.h3}>{practice.prompt}</Text><GuidedLinePractice key={`${lesson.id}-${practiceKey}`} initialFen={practice.fen} moves={practice.moves}
          onMastered={practiceResult => recordMastery(practiceKey, practiceResult)} /></>
        : <ChessBoard fen={nearestFen} />}
      {practiceKey && !mastered[practiceKey] ? <Text style={s.small}>A próxima etapa será liberada quando todos os lances estiverem na pilha de certos.</Text> : null}
      {stepIndex < lesson.steps.length - 1 ? <View style={[s.between, { flexWrap: 'wrap' }]}><Button label="Etapa anterior" variant="ghost" icon="back" disabled={stepIndex === 0} onPress={() => setStepIndex(n => n - 1)} />
        <Button label="Próxima etapa" icon="arrow" disabled={!!practiceKey && !mastered[practiceKey]} onPress={() => setStepIndex(n => n + 1)} /></View> : <>
        {!allMastered ? <Notice>Conclua os movimentos no tabuleiro e corrija todos os erros para finalizar a aula.</Notice>
          : !auth.user ? <Notice action={<Button label="Entrar para salvar a aula" onPress={() => navigate({ screen: 'auth' })} />}>Prática concluída. Entre para registrar o progresso.</Notice>
          : result ? <Notice tone="success">Aula concluída no tabuleiro. {result.xpEarned ? `+${result.xpEarned} XP.` : 'Esta revisão não gerou XP adicional.'}</Notice>
          : <Button label="Concluir aula" icon="check" busy={operation.busy} onPress={() => void operation.run(async signal => {
            const response = await api.post<LessonBoardResult>(`/lessons/${encodeURIComponent(lesson.id)}/board-complete`, { mistakes: totalMistakes, hintUsed, requestId: requestId.current }, signal);
            setResult(response); auth.refreshProgress();
          })} />}
        {operation.error ? <ErrorState message={operation.error} /> : null}
        <View style={s.wrap}><Button label="Etapa anterior" variant="ghost" icon="back" disabled={stepIndex === 0} onPress={() => setStepIndex(n => n - 1)} />
          {result ? <Button label="Ver outras aulas" variant="secondary" onPress={() => navigate({ screen: 'lessons' })} /> : null}</View></>}
    </Card> : null}
  </View>;
}

function AutomaticOpponentMove({ fen, moves }: { fen: string; moves: string[] }) {
  let line;
  try { line = linePositions(moves, fen); } catch { return <ErrorState message="Não foi possível aplicar a resposta adversária desta etapa." />; }
  const last = moves.at(-1)!;
  const orientation = line.positions.at(-1)!.split(' ')[1] === 'b' ? 'b' : 'w';
  const arrow: ArrowAnnotation = { from: last.slice(0, 2) as ArrowAnnotation['from'], to: last.slice(2, 4) as ArrowAnnotation['to'], tone: 'green' };
  return <View style={s.stack}><ChessBoard fen={line.positions.at(-1)!} orientation={orientation} lastMove={last} feedbackArrows={[arrow]} />
    <Notice>O lance adversário foi aplicado automaticamente. Você só fará os seus próprios lances.</Notice></View>;
}
