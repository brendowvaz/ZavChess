import React, { useEffect, useRef } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useResource } from '../../api/hooks';
import { useNavigation } from '../../navigation/Navigation';
import { Badge, Button, Card, Empty, ErrorState, Heading, Loading, levels } from '../../ui/components';
import { Icon } from '../../ui/Icon';
import { s } from '../../ui/theme';
import { ChessBoard } from '../../chess/ChessBoard';
import type { CatalogEndgame } from './contracts';
import { GeneratedEndgamePanel, TrainingBoard } from './TrainingPanel';
import { useEndgameTraining } from './useEndgameTraining';
import { StudyLayout, StudyMessage } from '../../ui/StudyLayout';

export function EndgamesScreen() {
  const endgames = useResource<CatalogEndgame[]>('/endgames'); const { navigate } = useNavigation();
  return <View style={s.page}><Heading eyebrow="Precisão até o último lance" title="Pratique seus finais" description="Jogue contra a melhor resposta da tablebase e descubra quando uma decisão muda o resultado." />
    <GeneratedEndgamePanel />
    <Text style={s.h2}>Posições do acervo</Text>
    {endgames.loading ? <Loading label="Carregando acervo…" /> : endgames.error ? <ErrorState message={endgames.error} retry={endgames.reload} /> : !endgames.data?.length ? <Empty title="Nenhum final no acervo" description="Você pode continuar usando o gerador acima." /> :
      <View style={s.stack}>{endgames.data.map(endgame => <Pressable key={endgame.id} accessibilityRole="button" accessibilityLabel={`Praticar ${endgame.title}`} onPress={() => navigate({ screen: 'endgame', id: endgame.id })}
        style={({ pressed }) => [s.card, { opacity: pressed ? 0.75 : 1 }]}><View style={s.between}><Badge>{levels[endgame.level]}</Badge><Icon name="flag" /></View>
        <Text style={s.h2}>{endgame.title}</Text><Text style={s.muted}>{endgame.description}</Text></Pressable>)}</View>}
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
