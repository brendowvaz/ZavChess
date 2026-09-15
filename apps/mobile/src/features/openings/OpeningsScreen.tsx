import React, { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { Opening, OpeningFamily, OpeningFamilyDetail, OpeningStudyGuide, OpeningVariant, Page, Side } from '../../api/types';
import { useDebounced, useResource } from '../../api/hooks';
import { useNavigation } from '../../navigation/Navigation';
import { Badge, Button, Card, Chip, Empty, ErrorState, Field, Heading, Loading, Notice, Pagination, SourceLink } from '../../ui/components';
import { colors, s } from '../../ui/theme';
import { Icon } from '../../ui/Icon';
import { ChessBoard } from '../../chess/ChessBoard';
import { Replay } from '../../chess/Replay';
import { sideName } from '../../chess/logic';
import { useAuth } from '../../auth/AuthProvider';
import type { EducationalFamily, EducationalOpening, FamilyGuideContent, OpeningEducation, VariationGuideContent } from './education-contracts';
import { OpeningCompletions } from './OpeningCompletions';
import {
  beginOpeningTraining,
  hintOpeningTraining,
  moveOpeningTraining,
  newOpeningRequestId,
  openingCompletions,
  trainingFinished,
  type OpeningTraining,
} from './training';

export function OpeningsScreen() {
  const [search, setSearch] = useState(''); const [page, setPage] = useState(1);
  const query = useDebounced(search.trim()); const { navigate } = useNavigation();
  const data = useResource<Page<OpeningFamily>>(`/opening-families?search=${encodeURIComponent(query)}&page=${page}&pageSize=24`);
  return <View style={s.page}><Heading eyebrow="Construa seu repertório" title="Escolha uma abertura. Depois, uma variante." description="A lista mostra as famílias. Dentro de cada uma você encontra todas as linhas-filhas para estudar e comparar." />
    <Field label="Pesquisar aberturas" placeholder="Ex.: Italiana, Siciliana ou B20" value={search} onChangeText={text => { setSearch(text); setPage(1); }} autoCorrect={false} returnKeyType="search" />
    {data.loading ? <Loading label="Buscando aberturas…" /> : data.error ? <ErrorState message={data.error} retry={data.reload} /> : data.data ? <>
      <Text style={s.small}>{data.data.total.toLocaleString('pt-BR')} {data.data.total === 1 ? 'família encontrada' : 'famílias encontradas'}</Text>
      {!data.data.items.length ? <Empty title="Nenhuma família encontrada" description="Tente outro nome, variante ou código ECO. A busca considera o nome de cada linha filha." /> : <View style={s.stack}>{data.data.items.map(family =>
        <Pressable key={family.family} accessibilityRole="button" accessibilityLabel={`Abrir ${family.family}, com ${family.variationCount} variantes`} onPress={() => navigate({ screen: 'opening-family', id: family.family })}
          style={({ pressed }) => [s.card, { opacity: pressed ? 0.75 : 1 }]}><View style={s.between}><Badge>{family.firstEco}</Badge><Icon name="chevron" size={18} /></View>
          <Text style={s.h2}>{family.family}</Text><Text style={s.muted}>{family.variationCount} {family.variationCount === 1 ? 'variante' : 'variantes'} · a partir de {family.firstEco}</Text>
          <Text style={s.small}>{family.guideKind === 'family' ? 'Guia de plano, erros comuns e aulas relacionadas' : 'Orientação de estudo e lista completa de variantes'}</Text></Pressable>)}</View>}
      <Pagination page={data.data.page} pageSize={data.data.pageSize} total={data.data.total} onChange={setPage} />
    </> : null}</View>;
}
export function OpeningFamilyScreen({ family }: { family: string }) {
  const content = useResource<EducationalFamily>(`/opening-families/${encodeURIComponent(family)}`); const { back, navigate } = useNavigation();
  const [search, setSearch] = useState('');
  const variants = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('pt-BR');
    if (!content.data || !term) return content.data?.variations ?? [];
    return content.data.variations.filter(variant => `${variant.eco} ${variant.name} ${variant.pgn}`.toLocaleLowerCase('pt-BR').includes(term));
  }, [content.data, search]);
  return <View style={s.page}><Button label="Voltar às aberturas" icon="back" variant="ghost" onPress={back} style={{ alignSelf: 'flex-start' }} />
    {content.loading ? <Loading label="Carregando variantes…" /> : content.error ? <ErrorState message={content.error} retry={content.reload} /> : content.data ? <>
      <Heading eyebrow="ABERTURA-PÃE" title={content.data.family} description={`${content.data.variationCount} variantes-filhas. Abra uma e use anterior/próxima para compará-las sem perder sua posição na família.`} />
      {content.data.education ? <EducationPanel education={content.data.education} familyOnly /> : <StudyGuide guide={content.data.studyGuide} />}
      <Card><Text style={s.h2}>Variantes desta abertura</Text><Text style={s.muted}>Filtre pelo nome, ECO ou sequência. A lista mantém todas as variantes da família visíveis durante o estudo.</Text>
        <Field label="Filtrar variantes" placeholder="Ex.: Najdorf, B90 ou 6. Bg5" value={search} onChangeText={setSearch} autoCorrect={false} returnKeyType="search" />
        <Text style={s.small}>{variants.length} {variants.length === 1 ? 'variante exibida' : 'variantes exibidas'}</Text>
        {!variants.length ? <Empty title="Nenhuma variante neste filtro" description="Limpe ou altere o filtro para ver outra linha da família." /> : <View style={s.stack}>{variants.map(variant => <VariantCard key={variant.id} family={content.data!.family} variant={variant} onPress={() => navigate({ screen: 'opening', id: variant.id })} />)}</View>}
      </Card>
    </> : null}</View>;
}
export function OpeningScreen({ id, initialSide }: { id: string; initialSide?: Side }) {
  const opening = useResource<EducationalOpening>(`/openings/${encodeURIComponent(id)}`); const { back, navigate } = useNavigation();
  return <View style={s.page}><Button label="Voltar" icon="back" variant="ghost" onPress={back} style={{ alignSelf: 'flex-start' }} />
    {opening.data ? <Button label={`Todas as variantes de ${opening.data.family}`} icon="book" variant="secondary" onPress={() => navigate({ screen: 'opening-family', id: opening.data!.family })} style={{ alignSelf: 'flex-start' }} /> : null}
    {opening.loading ? <Loading label="Abrindo a linha…" /> : opening.error ? <ErrorState message={opening.error} retry={opening.reload} /> : opening.data ? <OpeningReader opening={opening.data} initialSide={initialSide} /> : null}</View>;
}
function OpeningReader({ opening, initialSide }: { opening: EducationalOpening; initialSide?: Side }) {
  const [mode, setMode] = useState<'replay' | 'train'>(initialSide ? 'train' : 'replay'); const [side, setSide] = useState<Side>(initialSide ?? 'w');
  return <View style={s.page}><Heading eyebrow={`${opening.eco} · ${opening.family}`} title={opening.name} description={opening.studyGuide?.kind === 'family' ? 'Comece pelo plano da família e use a linha para enxergar as ideias em ação.' : 'Entenda a sequência. Depois, encontre os lances sem olhar.'} />
    <View style={[s.between, { flexWrap: 'wrap' }]}><View style={s.wrap}><Chip label="Explorar linha" selected={mode === 'replay'} onPress={() => setMode('replay')} /><Chip label="Treinar de memória" selected={mode === 'train'} onPress={() => setMode('train')} /></View>
      <View style={s.wrap}><Chip label="Brancas" selected={side === 'w'} onPress={() => setSide('w')} /><Chip label="Pretas" selected={side === 'b'} onPress={() => setSide('b')} /></View></View>
    <Card>{mode === 'replay' ? <Replay moves={opening.moves} orientation={side} /> : <OpeningTrainer key={side} opening={opening} side={side} />}</Card>
    {opening.familyNavigation ? <FamilyNavigator navigation={opening.familyNavigation} side={side} currentId={opening.id} /> : null}
    {opening.education ? <EducationPanel education={opening.education} /> : opening.studyGuide ? <StudyGuide guide={opening.studyGuide} /> : null}
    {mode === 'replay' ? <Card><Text style={s.h3}>Notação da linha</Text><Text selectable style={s.mono}>{opening.pgn}</Text></Card> : null}
    <SourceLink url={opening.sourceUrl} />
  </View>;
}
function VariantCard({ family, variant, onPress }: { family: string; variant: OpeningVariant; onPress: () => void }) {
  const title = variationTitle(family, variant.name);
  return <Pressable accessibilityRole="button" accessibilityLabel={`Estudar variante ${title}, ${variant.eco}`} onPress={onPress}
    style={({ pressed }) => [{ borderWidth: 1, borderColor: colors.line, borderRadius: 13, padding: 15, gap: 6, opacity: pressed ? 0.72 : 1 }]}><View style={s.between}><Badge>{variant.eco}</Badge><Icon name="chevron" size={17} /></View>
    <Text style={s.body}>{title}</Text><Text numberOfLines={2} style={s.mono}>{variant.pgn}</Text><Text style={s.small}>{variant.moveCount} meios-lances · abrir para replay e treino</Text></Pressable>;
}
function FamilyNavigator({ navigation, side, currentId }: { navigation: NonNullable<Opening['familyNavigation']>; side: Side; currentId: string }) {
  const { navigate, replace } = useNavigation();
  return <Card><View style={[s.between, { flexWrap: 'wrap' }]}><Badge tone="gold">VARIANTE {navigation.index}/{navigation.total}</Badge><Button label={`Ver ${navigation.total} variantes`} compact variant="ghost" onPress={() => navigate({ screen: 'opening-family', id: navigation.family })} /></View>
    <Text style={s.h3}>{navigation.family}</Text><Text style={s.muted}>Passe para a linha anterior ou próxima sem sair desta família.</Text>
    <View style={[s.row, { alignItems: 'stretch', flexWrap: 'wrap', gap: 12 }]}><View style={[s.grow, { minWidth: 150, gap: 7 }]}><Text numberOfLines={2} style={s.small}>{navigation.previous ? variationTitle(navigation.family, navigation.previous.name) : 'Você está na primeira variante.'}</Text>
      <Button label="Variante anterior" icon="back" compact variant="secondary" disabled={!navigation.previous} onPress={() => { if (navigation.previous) replace({ screen: 'opening', id: navigation.previous.id, studySide: side }); }} /></View>
      <View style={[s.grow, { minWidth: 150, gap: 7 }]}><Text numberOfLines={2} style={s.small}>{navigation.next ? variationTitle(navigation.family, navigation.next.name) : 'Você está na última variante.'}</Text>
        <Button label="Próxima variante" icon="arrow" compact disabled={!navigation.next} onPress={() => { if (navigation.next) replace({ screen: 'opening', id: navigation.next.id, studySide: side }); }} /></View></View>
    {navigation.nearby?.length ? <View style={s.stack}><Text style={s.label}>Pular para uma variante próxima</Text><View style={s.wrap}>{navigation.nearby.map(variant => <Chip key={variant.id}
      label={`${variant.eco} · ${variationTitle(navigation.family, variant.name)}`} selected={variant.id === currentId}
      onPress={() => replace({ screen: 'opening', id: variant.id, studySide: side })} />)}</View></View> : null}
  </Card>;
}
function variationTitle(family: string, name: string) {
  const prefix = `${family}: `;
  return name.startsWith(prefix) ? name.slice(prefix.length) : name === family ? 'Linha principal' : name;
}
function EducationPanel({ education, familyOnly = false }: { education: OpeningEducation; familyOnly?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const guide: FamilyGuideContent | VariationGuideContent | null = familyOnly
    ? education.familyGuide
    : education.variationGuide ?? education.familyGuide;
  if (!guide) return <Notice>{education.notice}</Notice>;
  const variation = 'distinction' in guide;
  const line = variation ? guide.line : guide.referenceLine;
  const title = variation ? guide.title : guide.displayName;
  const introduction = variation ? guide.distinction : guide.overview;
  const section = (heading: string, items: string[]) => <View style={s.stack}><Text style={s.h3}>{heading}</Text>{items.map(item => <View key={item} style={[s.row, { alignItems: 'flex-start', gap: 9 }]}>
    <Text style={{ color: colors.gold, lineHeight: 23 }}>•</Text><Text style={[s.body, s.grow]}>{item}</Text></View>)}</View>;
  return <Card><View style={[s.between, { flexWrap: 'wrap' }]}><Badge tone="gold">{variation ? 'GUIA DA VARIANTE' : 'GUIA DA FAMÍLIA'}</Badge></View>
    <Text style={s.h2}>{title}</Text><Text style={s.body}>{introduction}</Text>
    <Button label={expanded ? 'Fechar guia' : 'Abrir planos, erros e linha comentada'} variant="secondary" compact onPress={() => setExpanded(value => !value)} />
    {expanded ? <View style={s.stack}>{section('Plano das brancas', guide.whitePlan)}{section('Plano das pretas', guide.blackPlan)}{section('Erros comuns', guide.commonMistakes)}
      <View style={s.stack}><Text style={s.h3}>Linha de referência</Text><Replay moves={line.moves} orientation="w" />
        {line.annotations.map(note => <Notice key={`${note.ply}-${note.uci}`}>{note.ply}. {note.san} ({note.uci}) — {note.text}</Notice>)}</View>
      {education.variationGuide && education.familyGuide && !familyOnly ? <Text style={s.small}>Contexto da família: {education.familyGuide.overview}</Text> : null}
      {guide.sources.map(source => <SourceLink key={`${source.openingId}-${source.url}`} url={source.url} label={`Fonte dos lances: ${source.title}`} />)}
    </View> : null}
    <Notice>{education.notice}</Notice>
  </Card>;
}
function StudyGuide({ guide }: { guide: OpeningStudyGuide }) {
  const { navigate } = useNavigation();
  const section = (title: string, items: string[]) => <View style={s.stack} key={title}><Text style={s.h3}>{title}</Text>{items.map(item => <View key={item} style={[s.row, { alignItems: 'flex-start', gap: 9 }]}><Text style={{ color: colors.gold, lineHeight: 23 }}>•</Text><Text style={[s.body, s.grow]}>{item}</Text></View>)}</View>;
  return <Card><View style={[s.between, { flexWrap: 'wrap' }]}><Badge tone={guide.kind === 'family' ? 'gold' : 'neutral'}>{guide.kind === 'family' ? 'GUIA DA FAMÍLIA' : 'ORIENTAÇÃO INICIAL'}</Badge><Text style={s.small}>{guide.family}</Text></View>
    <Text style={s.h2}>Antes de decorar, entenda o plano.</Text><Text style={s.body}>{guide.overview}</Text>
    {section('Plano das brancas', guide.whitePlan)}
    {section('Plano das pretas', guide.blackPlan)}
    {section('Erros comuns', guide.commonMistakes)}
    {guide.lessons.length ? <View style={s.stack}><Text style={s.h3}>Aulas para continuar</Text>{guide.lessons.map(lesson => <Pressable key={lesson.id} accessibilityRole="button" accessibilityLabel={`Abrir aula: ${lesson.title}`} onPress={() => navigate({ screen: 'lesson', id: lesson.id })}
      style={({ pressed }) => [{ borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: 14, opacity: pressed ? 0.72 : 1, gap: 4 }]}><Text style={s.small}>{lesson.level === 'beginner' ? 'Iniciante' : lesson.level === 'intermediate' ? 'Intermediário' : 'Avançado'}</Text><Text style={s.body}>{lesson.title}</Text></Pressable>)}</View> : null}
    {guide.kind === 'introductory' ? <Notice>Esta variante ainda não tem um guia editorial próprio. A orientação mostra princípios de estudo e não apresenta a linha como forçada.</Notice> : <Text style={s.small}>Guia editorial da família. Variantes podem mudar o plano: confira sempre a posição antes de repetir um lance.</Text>}
  </Card>;
}
function OpeningTrainer({ opening, side }: { opening: Opening; side: Side }) {
  const { user } = useAuth(); const { replace } = useNavigation();
  const createTraining = () => beginOpeningTraining(opening.moves, side, newOpeningRequestId());
  const [training, setTraining] = useState<OpeningTraining>(createTraining);
  const [message, setMessage] = useState<string | null>(null);
  const [wrong, setWrong] = useState(false); const [hint, setHint] = useState<string | undefined>();
  const studentMoves = opening.moves.filter((_, index) => index % 2 === (side === 'w' ? 0 : 1));
  if (!opening.moves.length) return <Empty title="Linha sem lances" description="Esta abertura ainda não possui uma sequência para treinar." />;
  if (!studentMoves.length) return <Empty title={`Sem lances das ${sideName(side)}`} description="Escolha a outra cor para treinar esta linha curta." />;
  const finished = trainingFinished(training);
  const fen = training.positions[training.index]!;
  const move = (uci: string) => {
    const next = moveOpeningTraining(training, uci);
    if (next.index === training.index) {
      setTraining(next); setWrong(true); setHint(undefined);
      setMessage('O lance é legal, mas esta linha segue por outro caminho. Tente novamente.');
      return;
    }
    setTraining(next); setHint(undefined); setWrong(false);
    if (trainingFinished(next)) {
      openingCompletions.enqueue(opening.id, opening.name, next, user?.id ?? null);
      setMessage('Linha concluída. A revisão foi preparada e será salva quando você estiver conectado.');
    } else setMessage('Isso! A resposta publicada foi aplicada. Encontre seu próximo lance.');
  };
  const restart = () => { setTraining(createTraining()); setMessage(null); setHint(undefined); setWrong(false); };
  return <View style={s.stack}><View style={s.between}><Badge>Treinando de {sideName(side)}</Badge><Text style={s.small}>{training.moves.length}/{studentMoves.length} lances seus</Text></View>
    <ChessBoard fen={fen} orientation={side} onMove={move} disabled={finished} hint={hint} lastMove={training.line[training.index - 1]} />
    {message ? <Notice tone={wrong ? 'error' : 'success'}>{message}</Notice> : <Text style={s.muted}>{side === 'b' ? 'A linha começa com o lance das brancas já aplicado. ' : ''}Faça o próximo lance da abertura.</Text>}
    <View style={s.wrap}><Button label={finished ? 'Treinar novamente' : 'Recomeçar linha'} icon="refresh" variant="secondary" onPress={restart} />
      <Button label="Mostrar dica" variant="ghost" disabled={finished} onPress={() => {
        const next = hintOpeningTraining(training); setTraining(next); setHint(training.line[training.index]); setWrong(false);
        setMessage(`Procure o lance ${training.sans[training.index]}. As casas estão marcadas.`);
      }} /></View>
    <OpeningCompletions onlyRequestId={training.requestId} onReview={(id, reviewSide) => replace({ screen: 'opening', id, studySide: reviewSide })} />
    <Text style={s.small}>A resposta adversária segue a linha publicada. Erros e dicas influenciam o intervalo da próxima revisão.</Text>
  </View>;
}
