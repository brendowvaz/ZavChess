import React from 'react';
import { Text, View } from 'react-native';
import { useAuth } from '../../auth/AuthProvider';
import { useResource } from '../../api/hooks';
import { useNavigation } from '../../navigation/Navigation';
import { Badge, Button, Card, Empty, ErrorState, Heading, Loading, ProgressBar } from '../../ui/components';
import { s } from '../../ui/theme';
import type { StudyPlan, StudySuggestion } from './types';

function open(item: StudySuggestion, navigate: ReturnType<typeof useNavigation>['navigate']) {
  if (item.kind === 'opening') navigate({ screen: 'opening', id: item.contentId, studySide: item.side === 'b' ? 'b' : 'w', focusPly: item.focusPly });
  else navigate({ screen: item.kind, id: item.contentId });
}

export function DailyTrainingScreen() {
  const auth = useAuth(); const { navigate } = useNavigation();
  const plan = useResource<StudyPlan>(auth.user ? '/learning/plan' : null, auth.revision);
  if (!auth.user) return <View style={s.page}><Heading eyebrow="Treino pessoal" title="Entre para receber seu treino de hoje." description="O plano usa seu progresso, seus erros e as revisões que estão prontas." />
    <Button label="Entrar ou criar conta" icon="arrow" onPress={() => navigate({ screen: 'auth' })} style={{ alignSelf: 'flex-start' }} /></View>;
  return <View style={s.page}>
    <Heading eyebrow="5–10 minutos · adaptado a você" title="Seu treino de hoje" description="Primeiro recuperamos o que pode ser esquecido. Depois praticamos uma fraqueza e acrescentamos no máximo uma ideia nova." />
    {plan.loading ? <Loading label="Montando sua sessão…" /> : plan.error ? <ErrorState message={plan.error} retry={plan.reload} /> : plan.data ? <>
      <Card><View style={s.between}><Text style={s.h3}>Sessão preparada</Text><Badge tone={plan.data.dueCount ? 'gold' : 'green'}>{plan.data.dueCount} revisões prontas</Badge></View>
        <ProgressBar value={0} label={`${plan.data.items.length} etapas selecionadas`} />
        <Text style={s.muted}>A ordem é intencional: recordar antes de aprender melhora a retenção e mostra onde a explicação precisa reaparecer.</Text>
      </Card>
      {plan.data.items.map((item, index) => <Card key={`${item.kind}-${item.contentId}-${item.side ?? ''}`}>
        <View style={s.wrap}><Badge tone={index === 0 ? 'gold' : 'neutral'}>{item.dueAt ? 'RECORDE' : index === plan.data!.items.length - 1 ? 'APRENDA' : 'PRATIQUE'}</Badge><Text style={s.small}>Etapa {index + 1} de {plan.data!.items.length}</Text></View>
        <Text style={s.h2}>{item.title}</Text><Text style={s.body}>{item.reason}</Text>
        {index === 0 ? <Button label="Começar por aqui" icon="arrow" onPress={() => open(item, navigate)} style={{ alignSelf: 'flex-start' }} />
          : <Button label="Abrir etapa" variant="secondary" onPress={() => open(item, navigate)} style={{ alignSelf: 'flex-start' }} />}
      </Card>)}
      {!plan.data.items.length ? <Empty title="Treino concluído por hoje" description="Você está em dia. Pode explorar um repertório ou voltar quando uma revisão estiver pronta." /> : null}
      <View style={s.wrap}><Button label="Escolher meu repertório" variant="secondary" onPress={() => navigate({ screen: 'repertoires' })} /><Button label="Ver relatório" variant="ghost" onPress={() => navigate({ screen: 'report' })} /></View>
    </> : null}
  </View>;
}
