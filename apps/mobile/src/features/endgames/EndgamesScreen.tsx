import React, { useEffect, useRef } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useResource } from '../../api/hooks';
import { useNavigation } from '../../navigation/Navigation';
import { Badge, Button, Card, Empty, ErrorState, Heading, Loading, Notice, levels } from '../../ui/components';
import { Icon } from '../../ui/Icon';
import { s } from '../../ui/theme';
import { ChessBoard } from '../../chess/ChessBoard';
import type { CatalogEndgame } from './contracts';
import { GeneratedEndgamePanel, TrainingBoard } from './TrainingPanel';
import { useEndgameTraining } from './useEndgameTraining';
import { StudyLayout, StudyMessage } from '../../ui/StudyLayout';
import { LearningPath } from '../../ui/LearningPath';
import type { Lesson } from '../../api/types';

export function EndgamesScreen() {
  const endgames = useResource<CatalogEndgame[]>('/endgames'); const { navigate } = useNavigation();
  const lessons = useResource<Lesson[]>('/lessons');
  return <View style={s.page}><Heading eyebrow="Precisão até o último lance" title="Finais" description="Aprenda o padrão, reconheça a posição-chave e converta contra a melhor defesa da tablebase." />
    <Card><View style={s.between}><View><Text style={s.h3}>Curso de finais</Text><Text style={s.small}>Lições e posições práticas</Text></View><Badge tone="green">TUDO LIBERADO</Badge></View>
      <Text style={s.muted}>Siga a trilha sugerida ou abra qualquer posição. Nenhum final, dica ou tentativa exige assinatura.</Text></Card>
    <Text accessibilityRole="header" style={s.h2}>Reconheça a ideia</Text>
    {lessons.data ? <LearningPath items={lessons.data.filter(item => item.category === 'endgames').map((lesson, index) => ({ id: lesson.id, title: lesson.title,
      subtitle: `${levels[lesson.level]} · desafios no tabuleiro`, state: index === 0 ? 'current' as const : 'ready' as const }))} onPress={item => navigate({ screen: 'lesson', id: item.id })} /> : null}
    <Text accessibilityRole="header" style={s.h2}>Leve até o fim contra a melhor defesa</Text>
    {endgames.loading ? <Loading label="Carregando acervo…" /> : endgames.error ? <ErrorState message={endgames.error} retry={endgames.reload} /> : !endgames.data?.length ? <Empty title="Nenhum final no acervo" description="Você pode continuar usando o gerador acima." /> :
      <LearningPath items={endgames.data.map((endgame, index) => ({ id: endgame.id, title: endgame.title,
        subtitle: `${levels[endgame.level]} · ${endgame.goal}`, state: index === 0 ? 'current' as const : 'ready' as const,
        accessibilityLabel: `Praticar ${endgame.title}. ${levels[endgame.level]}. Disponível`,
      }))} onPress={item => navigate({ screen: 'endgame', id: item.id })} />}
    <Notice>Quer variar a posição? O laboratório abaixo gera exercícios novos e verifica o objetivo pela tablebase.</Notice>
    <GeneratedEndgamePanel />
  </View>;
}
export function EndgameScreen({ id }: { id: string }) {
  const endgame = useResource<CatalogEndgame>(`/endgames/${encodeURIComponent(id)}`); const endgames = useResource<CatalogEndgame[]>('/endgames');
  const { back, replace } = useNavigation(); const index = endgames.data?.findIndex(item => item.id === id) ?? -1;
  const nextId = index >= 0 ? endgames.data?.[index + 1]?.id : undefined;
  return <View style={{ flex: 1, minHeight: 0 }}>
    {endgame.loading ? <Loading label="Abrindo o final…" /> : endgame.error ? <ErrorState message={endgame.error} retry={endgame.reload} /> : endgame.data ? <CatalogTrainer key={endgame.data.id} endgame={endgame.data}
      onBack={back} onNext={nextId ? () => replace({ screen: 'endgame', id: nextId }) : undefined} /> : null}</View>;
}
function CatalogTrainer({ endgame, onBack, onNext }: { endgame: CatalogEndgame; onBack: () => void; onNext?: () => void }) {
  const trainer = useEndgameTraining();
  const opened = useRef(false);
  const exercise = {
    fen: endgame.fen, side: endgame.side, theme: /[qQ]/.test(endgame.fen.split(' ')[0] || '') ? 'queen' as const : /[rR]/.test(endgame.fen.split(' ')[0] || '') ? 'rook' as const : 'pawn' as const,
    title: endgame.title, instructions: endgame.tips, source: { kind: 'reference' as const, name: 'Acervo Zav Chess · descrição editorial; resultado consultado ao iniciar' },
  };
  useEffect(() => {
    if (opened.current) return; opened.current = true;
    void trainer.open(exercise);
  }, []);
  return <View style={{ flex: 1, minHeight: 0 }}>{!trainer.state.exercise && !trainer.state.error ? <Loading label="Preparando o final…" /> : null}
    {trainer.state.error && !trainer.state.exercise ? <StudyLayout title={endgame.title} subtitle={endgame.description} eyebrow="Final"
      onBack={onBack} renderBoard={maxSize => <ChessBoard fen={endgame.fen} orientation={endgame.side} maxSize={maxSize} disabled hideStatus />}
      status={<StudyMessage tone="error">{trainer.state.error}</StudyMessage>}
      actions={<Button label="Tentar novamente" icon="refresh" onPress={() => { void trainer.open(exercise); }} />} /> : null}
    <TrainingBoard trainer={trainer} study={{ title: endgame.title, subtitle: endgame.description, onBack, onNext }} /></View>;
}
