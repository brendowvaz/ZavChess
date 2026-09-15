import React from 'react';
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
  const endgame = useResource<CatalogEndgame>(`/endgames/${encodeURIComponent(id)}`); const { back } = useNavigation();
  return <View style={s.page}><Button label="Voltar aos finais" icon="back" variant="ghost" onPress={back} style={{ alignSelf: 'flex-start' }} />
    {endgame.loading ? <Loading label="Abrindo o final…" /> : endgame.error ? <ErrorState message={endgame.error} retry={endgame.reload} /> : endgame.data ? <CatalogTrainer key={endgame.data.id} endgame={endgame.data} /> : null}</View>;
}
function CatalogTrainer({ endgame }: { endgame: CatalogEndgame }) {
  const trainer = useEndgameTraining();
  return <View style={s.stack}>{!trainer.state.exercise ? <Card><Heading title={endgame.title} description={endgame.description} />
    <ChessBoard fen={endgame.fen} orientation={endgame.side} disabled />
    <Button label="Validar objetivo e iniciar treino" busy={!!trainer.state.operation} onPress={() => { void trainer.open({
      fen: endgame.fen, side: endgame.side, theme: /[qQ]/.test(endgame.fen.split(' ')[0] || '') ? 'queen' : /[rR]/.test(endgame.fen.split(' ')[0] || '') ? 'rook' : 'pawn',
      title: endgame.title, instructions: endgame.tips, source: { kind: 'reference', name: 'Acervo Zav Chess · descrição editorial; resultado consultado ao iniciar' },
    }); }} />
  </Card> : null}{trainer.state.error ? <ErrorState message={trainer.state.error} /> : null}<TrainingBoard trainer={trainer} /></View>;
}
