import React, { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { api } from '../../api/client';
import { useOperation, useResource } from '../../api/hooks';
import { useAuth } from '../../auth/AuthProvider';
import { useNavigation } from '../../navigation/Navigation';
import { Badge, Button, Card, Chip, Empty, ErrorState, Field, Heading, Loading, ProgressBar } from '../../ui/components';
import { s } from '../../ui/theme';

type Group = { id: string; name: string; inviteCode: string; members: number };
type Weekly = { puzzles: number; openings: number; lessons: number };
type Member = { id: string; name: string; rating: number; streak: number; puzzles: number; weekly: Weekly };
type GroupDetail = Group & { leaderboard: Member[]; weekly: Weekly; goals: Weekly };
export function CommunityScreen() {
  const auth = useAuth(); const { navigate, back } = useNavigation(); const operation = useOperation();
  const groups = useResource<Group[]>(auth.user ? '/community/groups' : null);
  const [name, setName] = useState(''); const [invite, setInvite] = useState(''); const [selected, setSelected] = useState<string | null>(null);
  const [sort, setSort] = useState<'rating' | 'streak' | 'puzzles'>('rating');
  const detail = useResource<GroupDetail>(selected ? `/community/groups/${encodeURIComponent(selected)}` : null, auth.revision);
  const leaderboard = useMemo(() => [...(detail.data?.leaderboard ?? [])].sort((a, b) => b[sort] - a[sort] || a.name.localeCompare(b.name)), [detail.data, sort]);
  return <View style={s.page}><Button label="Voltar ao progresso" icon="back" variant="ghost" onPress={back} />
    <Heading eyebrow="Aprender em companhia" title="Grupos de estudo" description="Convide seus amigos, acompanhe a evolução e completem metas juntos." />
    {!auth.user ? <Card><Text style={s.body}>Entre para criar um grupo ou aceitar um convite.</Text><Button label="Entrar" onPress={() => navigate({ screen: 'auth' })} /></Card> : <>
      <Card><Text style={s.h3}>Crie ou encontre seu grupo</Text><Text style={s.small}>Ao participar, seu nome, rating de treino e estatísticas ficam visíveis aos membros. Seu e-mail permanece privado.</Text>
        <Field label="Nome do novo grupo" value={name} onChangeText={setName} maxLength={80} />
        <Button label="Criar grupo" busy={operation.busy} disabled={name.trim().length < 2} onPress={() => void operation.run(async signal => {
          const group = await api.post<Group>('/community/groups', { name: name.trim() }, signal); setName(''); groups.reload(); setSelected(group.id);
        })} />
        <Field label="Código do convite" value={invite} onChangeText={setInvite} autoCapitalize="none" autoCorrect={false} maxLength={24} />
        <Button label="Entrar com convite" variant="secondary" busy={operation.busy} disabled={!/^[a-f0-9]{24}$/i.test(invite.trim())} onPress={() => void operation.run(async signal => {
          const group = await api.post<Group>('/community/join', { inviteCode: invite.trim() }, signal); setInvite(''); groups.reload(); setSelected(group.id);
        })} />
        {operation.error ? <ErrorState message={operation.error} /> : null}</Card>
      {groups.loading ? <Loading /> : groups.error ? <ErrorState message={groups.error} retry={groups.reload} /> : !groups.data?.length ? <Empty title="Seu primeiro grupo começa aqui" description="Crie um grupo ou peça um código de convite a um amigo." /> : <View style={s.wrap}>{groups.data.map(group => <Chip key={group.id} label={`${group.name} · ${group.members}`} selected={selected === group.id} onPress={() => setSelected(group.id)} />)}</View>}
      {detail.loading ? <Loading label="Montando o placar…" /> : detail.error ? <ErrorState message={detail.error} retry={detail.reload} /> : detail.data ? <>
        <Card><Text style={s.h2}>{detail.data.name}</Text><Text style={s.small}>Código para convidar amigos — selecione e compartilhe:</Text><Text selectable style={s.mono}>{detail.data.inviteCode}</Text>
          <Button label="Atualizar placar" compact variant="ghost" onPress={detail.reload} /></Card>
        <Card><Text style={s.h3}>Desafios coletivos · últimos 7 dias</Text>{([['puzzles', 'Puzzles'], ['openings', 'Linhas de abertura'], ['lessons', 'Lições']] as const).map(([key, label]) => <View key={key} style={s.stack}>
          <View style={s.between}><Text style={s.body}>{label}</Text><Text style={s.small}>{detail.data!.weekly[key]}/{detail.data!.goals[key]}</Text></View><ProgressBar value={detail.data!.weekly[key] / detail.data!.goals[key] * 100} label={`Meta coletiva de ${label}`} />
        </View>)}<Text style={s.small}>Metas de colaboração. Todos os recursos estão disponíveis a cada participante.</Text></Card>
        <View style={s.wrap}><Chip label="Rating" selected={sort === 'rating'} onPress={() => setSort('rating')} /><Chip label="Sequência" selected={sort === 'streak'} onPress={() => setSort('streak')} /><Chip label="Puzzles" selected={sort === 'puzzles'} onPress={() => setSort('puzzles')} /></View>
        <Card>{leaderboard.map((member, index) => <View key={member.id} style={s.between}><View style={{ flex: 1 }}><Text style={s.h3}>{index + 1}. {member.name}{member.id === auth.user?.id ? ' · você' : ''}</Text>
          <Text style={s.small}>Rating {member.rating} · {member.streak} dias · {member.puzzles} puzzles</Text></View><Badge>{member[sort]}</Badge></View>)}</Card>
        <Button label="Sair deste grupo" variant="ghost" busy={operation.busy} onPress={() => void operation.run(async signal => {
          await api.post(`/community/groups/${encodeURIComponent(selected!)}/leave`, {}, signal); setSelected(null); groups.reload();
        })} />
      </> : null}
    </>}
  </View>;
}
