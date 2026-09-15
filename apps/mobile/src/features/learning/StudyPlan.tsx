import React from 'react';
import { Text, View } from 'react-native';
import { useResource } from '../../api/hooks';
import { useAuth } from '../../auth/AuthProvider';
import { useNavigation } from '../../navigation/Navigation';
import { Badge, Button, Card, ErrorState, Loading } from '../../ui/components';
import { s } from '../../ui/theme';
import type { StudyPlan as Plan } from './types';

export function StudyPlan() {
  const auth = useAuth();
  const plan = useResource<Plan>(auth.user ? '/learning/plan' : null, auth.revision);
  const { navigate } = useNavigation();
  if (!auth.user) return null;
  return <View style={s.stack}>
    <View style={[s.between, { flexWrap: 'wrap' }]}><Text accessibilityRole="header" style={s.h2}>Seu treino de hoje</Text><Button label="Meu relatório" variant="ghost" compact onPress={() => navigate({ screen: 'report' })} /></View>
    {plan.loading ? <Loading label="Preparando seu treino…" /> : plan.error ? <ErrorState message={plan.error} retry={plan.reload} /> : plan.data ? <>
      <Text style={s.muted}>{plan.data.dueCount ? `${plan.data.dueCount} revisões prontas. Comece por elas e depois explore um novo conceito.` : plan.data.nextReviewAt ? `Próxima revisão em ${new Date(plan.data.nextReviewAt).toLocaleString('pt-BR')}. Enquanto isso, avance no seu ritmo.` : 'Seu primeiro treino prepara as próximas recomendações.'}</Text>
      {plan.data.items.map((item, index) => <Card key={`${item.kind}-${item.contentId}-${item.side || ''}`}>
        <View style={s.wrap}><Badge>{item.dueAt ? 'Revisão' : item.kind === 'lesson' ? 'Aula' : item.kind === 'opening' ? 'Abertura' : 'Puzzle'}</Badge><Text style={s.small}>Passo {index + 1}</Text></View>
        <Text style={s.h3}>{item.title}</Text><Text style={s.muted}>{item.reason}</Text>
        <Button label={item.dueAt ? 'Revisar agora' : 'Começar treino'} icon="arrow" onPress={() => {
          if (item.kind === 'opening') navigate({ screen: 'opening', id: item.contentId, studySide: item.side === 'b' ? 'b' : 'w' });
          else navigate({ screen: item.kind, id: item.contentId });
        }} />
      </Card>)}
      {!plan.data.items.length ? <Text style={s.body}>Você está em dia. Explore o catálogo ou volte quando uma revisão estiver pronta.</Text> : null}
    </> : null}
  </View>;
}
