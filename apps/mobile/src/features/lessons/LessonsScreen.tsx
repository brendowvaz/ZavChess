import React, { useState } from 'react';
import { Text, View } from 'react-native';
import type { Lesson, LessonDetail, Progress } from '../../api/types';
import { useResource } from '../../api/hooks';
import { useAuth } from '../../auth/AuthProvider';
import { useNavigation } from '../../navigation/Navigation';
import { Badge, Button, Card, Chip, Empty, ErrorState, Heading, Loading, ProgressBar, levels } from '../../ui/components';
import { s } from '../../ui/theme';
import { LearningPath } from '../../ui/LearningPath';
import { lessonChapter, lessonTrack, type LessonTrack, type SessionMode } from './lesson-session';
import { LessonSessionPlayer } from './LessonSessionPlayer';
import { useAppearance } from '../../appearance/AppearanceProvider';

export function LessonsScreen() {
  const auth = useAuth(); const { navigate } = useNavigation();
  const lessons = useResource<Lesson[]>('/lessons');
  const progress = useResource<Progress>(auth.user ? '/progress' : null, auth.revision);
  const { appearance, updateAppearance } = useAppearance();
  const track = appearance.learningTrack;
  const setTrack = (learningTrack: LessonTrack) => updateAppearance({ learningTrack });
  const [level, setLevel] = useState('all');
  const filtered = lessons.data?.filter(lesson => lessonTrack(lesson) === track && (level === 'all' || lesson.level === level)).sort((a, b) => a.sortOrder - b.sortOrder) ?? [];
  const completed = new Set(progress.data?.completedLessonIds ?? []);
  const next = filtered.find(lesson => !completed.has(lesson.id));
  const count = filtered.filter(lesson => completed.has(lesson.id)).length;
  const chapters = [...new Set(filtered.map(lessonChapter))];
  return <View style={s.page}>
    <Heading eyebrow="Aprenda jogando" title="Fundamentos" description="Uma ideia, uma posição, uma decisão sua. O próximo desafio chega assim que você acerta." />
    <View style={s.wrap}><Chip label="Já jogo · Quero evoluir" selected={track === 'improve'} onPress={() => { setTrack('improve'); setLevel('all'); }} />
      <Chip label="Estou começando" selected={track === 'start'} onPress={() => { setTrack('start'); setLevel('all'); }} /></View>
    <Card><View style={[s.between, { flexWrap: 'wrap' }]}><Text style={s.h2}>{track === 'start' ? 'Seus primeiros lances' : 'Pense como um jogador'}</Text><Badge>{count}/{filtered.length}</Badge></View>
      <Text style={s.muted}>{track === 'start' ? 'Movimente as peças com ajuda visual. Depois aplique a ideia sozinho, com as cores trocadas.' : 'Comece resolvendo: combinações, decisões de abertura e técnica de finais. Abra a explicação quando precisar.'}</Text>
      <ProgressBar value={count / Math.max(1, filtered.length) * 100} label="Desafios concluídos nesta trilha" />
      {next ? <Button label={`Continuar: ${next.title}`} icon="play" onPress={() => navigate({ screen: 'lesson', id: next.id })} /> : null}</Card>
    {track === 'improve' ? <View style={s.wrap}><Chip label="Todos os níveis" selected={level === 'all'} onPress={() => setLevel('all')} />{Object.entries(levels).map(([id, label]) => <Chip key={id} label={label} selected={level === id} onPress={() => setLevel(id)} />)}</View> : null}
    {progress.error ? <ErrorState message={progress.error} retry={progress.reload} /> : null}
    {lessons.loading ? <Loading label="Preparando desafios…" /> : lessons.error ? <ErrorState message={lessons.error} retry={lessons.reload} /> : !filtered.length ? <Empty title="Nenhum desafio neste nível" description="Escolha outro nível para continuar." /> : chapters.map(chapter => <View key={chapter} style={s.stack}>
      <Text accessibilityRole="header" style={s.h2}>{chapter}</Text>
      <LearningPath items={filtered.filter(lesson => lessonChapter(lesson) === chapter).map(lesson => ({ id: lesson.id, title: lesson.title,
        subtitle: `${levels[lesson.level]} · prática + recuperação`,
        state: completed.has(lesson.id) ? 'completed' as const : lesson.id === next?.id ? 'current' as const : 'ready' as const,
      }))} onPress={item => navigate({ screen: 'lesson', id: item.id })} />
    </View>)}
  </View>;
}

export function LessonScreen({ id }: { id: string }) {
  const lesson = useResource<LessonDetail>(`/lessons/${encodeURIComponent(id)}`);
  const lessons = useResource<Lesson[]>('/lessons'); const auth = useAuth();
  if (lesson.loading) return <Loading label="Abrindo seu desafio…" />;
  if (lesson.error) return <ErrorState message={lesson.error} retry={lesson.reload} />;
  if (!lesson.data) return null;
  return <LessonMode key={id} lesson={lesson.data} lessons={lessons.data ?? []} userId={auth.user?.id} />;
}
function LessonMode({ lesson, lessons, userId }: { lesson: LessonDetail; lessons: Lesson[]; userId?: string }) {
  const mode: SessionMode = lessonTrack(lesson) === 'start' ? 'guided' : 'challenge';
  const ordered = lessons.filter(item => lessonTrack(item) === lessonTrack(lesson)).sort((a, b) => a.sortOrder - b.sortOrder);
  const index = ordered.findIndex(item => item.id === lesson.id);
  return <LessonSessionPlayer key={`${lesson.id}-${mode}-${userId ?? 'guest'}`} lesson={lesson} mode={mode} nextLessonId={index >= 0 ? ordered[index + 1]?.id : undefined} />;
}
