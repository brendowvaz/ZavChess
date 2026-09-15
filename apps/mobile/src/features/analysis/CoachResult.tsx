import React, { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { ChessBoard } from '../../chess/ChessBoard';
import { Badge, Button, Card, Chip, ErrorState } from '../../ui/components';
import { colors, s } from '../../ui/theme';
import type { AnalysisLine, AnalysisSide, MoveAnalysis, MoveClassification } from './analysis-contract';
import { coachScoreText, replayPositions } from './analysis-session';

const labels: Record<MoveClassification, string> = { best: 'Melhor lance', good: 'Bom lance', inaccuracy: 'Imprecisão', mistake: 'Erro', blunder: 'Erro grave' };
const sourceNames = { 'played-move': 'Lance jogado', 'alternative-pv': 'Alternativa', 'continuation-pv': 'Continuação após o lance' };

function ContinuationReplay({ line, orientation }: { line: AnalysisLine; orientation: AnalysisSide }) {
  const [index, setIndex] = useState(0);
  const replay = useMemo(() => { try { return replayPositions(line); } catch { return null; } }, [line]);
  if (!replay) return <ErrorState message="Não foi possível reproduzir a continuação recebida." />;
  const step = Math.min(index, line.moves.length);
  return <View style={s.stack}>
    <ChessBoard fen={replay.positions[step]!} orientation={orientation} lastMove={line.moves[step - 1]} disabled />
    <View style={[s.wrap, { justifyContent: 'center' }]}>
      <Button compact label="Início da linha" variant="ghost" disabled={step === 0} onPress={() => setIndex(0)} />
      <Button compact label="Lance anterior" icon="back" variant="secondary" disabled={step === 0} onPress={() => setIndex(step - 1)} />
      <Text accessibilityLiveRegion="polite" style={s.small}>{step}/{line.moves.length}</Text>
      <Button compact label="Próximo lance" icon="arrow" variant="secondary" disabled={step === line.moves.length} onPress={() => setIndex(step + 1)} />
      <Button compact label="Fim da linha" variant="ghost" disabled={step === line.moves.length} onPress={() => setIndex(line.moves.length)} />
    </View>
    <View style={s.wrap}>{replay.labels.map((label, i) => <Pressable key={i} accessibilityRole="button" accessibilityLabel={`Ver ${label}`}
      accessibilityState={{ selected: step === i + 1 }} onPress={() => setIndex(i + 1)}
      style={{ minHeight: 44, padding: 12, borderRadius: 8, backgroundColor: step === i + 1 ? colors.pale : 'transparent' }}>
      <Text style={s.body}>{label}</Text>
    </Pressable>)}</View>
    {step === 0 ? <Text style={s.small}>Posição inicial desta linha.</Text> : line.facts.filter(fact => fact.ply === step).map((fact, i) => <Text key={i} style={s.small}>{fact.text}</Text>)}
    {!line.moves.length ? <Text style={s.muted}>A posição terminou; não há continuação.</Text> : null}
    {line.truncated ? <Text style={s.small}>Mostrando somente o trecho legal disponível, até 24 meios-lances.</Text> : null}
  </View>;
}

export function CoachResult({ result }: { result: MoveAnalysis }) {
  const [branch, setBranch] = useState<'continuation' | 'alternative'>('continuation');
  const [showMethod, setShowMethod] = useState(false);
  const line = result[branch];
  return <Card>
    <View style={[s.between, { flexWrap: 'wrap', gap: 8 }]}>
      <Text accessibilityRole="header" style={s.h2}>Avaliação do lance {result.san}</Text>
      <Badge tone={['mistake', 'blunder', 'inaccuracy'].includes(result.classification) ? 'gold' : 'green'}>{labels[result.classification]}</Badge>
    </View>
    <Text style={s.muted}>Perspectiva de quem jogou: {result.perspective === 'w' ? 'brancas' : 'pretas'}. Lance {result.move}.</Text>
    <View style={[s.wrap, { gap: 24 }]}>
      <View><Text style={s.label}>Antes</Text><Text style={s.h3}>{coachScoreText(result.before.score, result.perspective)}</Text><Text style={s.small}>Profundidade {result.before.depth}</Text></View>
      <View><Text style={s.label}>Depois</Text><Text style={s.h3}>{coachScoreText(result.after.score, result.perspective)}</Text><Text style={s.small}>{result.after.depth === 0 ? 'Resultado pelas regras' : `Profundidade ${result.after.depth}`}</Text></View>
      <View><Text style={s.label}>Perda estimada</Text><Text style={s.h3}>{result.loss.centipawns === null ? 'Mate: sem conversão em cp' : `${result.loss.centipawns} cp`}</Text></View>
    </View>
    {result.explanation.map((text, i) => <Text selectable key={i} style={s.body}>{text}</Text>)}
    <View style={s.separator} />
    <Text accessibilityRole="header" style={s.h3}>Conceito: {result.lesson.concept}</Text>
    <Text style={s.body}>{result.lesson.plan}</Text>
    {result.lesson.evidence.map((fact, i) => <Text key={i} style={s.small}>{sourceNames[fact.source]}, passo {fact.ply}: {fact.text}</Text>)}
    <Text accessibilityRole="header" style={s.h3}>{result.matchesBestMove ? 'Você escolheu a recomendação do motor' : `Alternativa: ${result.alternative.sans[0]} · ${result.bestMove}`}</Text>
    <Text style={s.small}>A alternativa parte da posição antes do lance. A continuação mostra a resposta ao lance jogado. Explore as linhas sem alterar sua partida.</Text>
    <View style={s.wrap}>
      <Chip label="Após o lance jogado" selected={branch === 'continuation'} onPress={() => setBranch('continuation')} />
      <Chip label={result.matchesBestMove ? 'Linha recomendada' : 'Ver alternativa'} selected={branch === 'alternative'} onPress={() => setBranch('alternative')} />
    </View>
    <ContinuationReplay key={`${result.fen}:${result.move}:${branch}`} line={line} orientation={result.perspective} />
    <Text style={s.small}>Stockfish e regras do tabuleiro. A classificação é uma estimativa local e pode mudar com outra busca.</Text>
    <Button label={showMethod ? 'Ocultar critérios' : 'Como esta avaliação foi feita'} variant="ghost" onPress={() => setShowMethod(!showMethod)} />
    {showMethod ? <View style={{ gap: 8 }}>
      <Text style={s.small}>Melhor: coincide com a recomendação antes do lance ou dá mate. Bom: perda até {result.method.thresholds.goodMaxCp} cp. Imprecisão: até {result.method.thresholds.inaccuracyMaxCp} cp. Erro: até {result.method.thresholds.mistakeMaxCp} cp. Erro grave: acima disso.</Text>
      <Text style={s.small}>Permitir um mate antes não previsto: erro grave. Deixar de encontrar o mate a favor: erro. Manter o mesmo desfecho de mate: bom ou melhor; sem penalidade numérica pela distância.</Text>
      {result.method.limitations.map((text, i) => <Text key={i} style={s.small}>{text}</Text>)}
      <Text style={s.small}>Motor antes: {result.before.engine}. Motor depois: {result.after.engine}. Profundidade solicitada: {result.method.requestedDepth}.</Text>
    </View> : null}
  </Card>;
}
