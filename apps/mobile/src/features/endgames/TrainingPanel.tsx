import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { ChessBoard } from '../../chess/ChessBoard';
import { Badge, Button, Card, Chip, ErrorState, Notice, SourceLink } from '../../ui/components';
import { s } from '../../ui/theme';
import type { EndgameTheme } from './contracts';
import { categoryLabels, endgameStatus } from './training-state';
import { useEndgameTraining } from './useEndgameTraining';

export function TrainingBoard({ trainer }: { trainer: ReturnType<typeof useEndgameTraining> }) {
  const { state, move, hint, reset } = trainer;
  const { exercise, position } = state;
  const [showMoves, setShowMoves] = useState(false);
  if (!exercise || !position) return null;
  const lost = state.feedback?.code === 'lost-win' || state.feedback?.code === 'lost-draw';
  return <View style={s.stack}>
    <Card><View style={s.between}><Text style={s.h2}>{exercise.title}</Text><Badge>{exercise.objective === 'win' ? 'Vencer' : 'Empatar'}</Badge></View>
      <Text style={s.body}>Você joga de {exercise.side === 'w' ? 'brancas' : 'pretas'}. A resposta adversária é automática.</Text>
      {exercise.instructions.map(text => <Text key={text} style={s.muted}>{text}</Text>)}
      <ChessBoard fen={position.fen} orientation={exercise.side} lastMove={state.history.at(-1)} hint={state.hint || undefined}
        onMove={uci => { void move(uci); }} disabled={!!state.operation || !!position.terminal || position.turn !== exercise.side} />
      {state.operation === 'move' ? <Notice>Avaliando seu lance e preparando a resposta…</Notice> : null}
      {state.feedback ? <Notice tone={lost ? 'error' : state.feedback.code === 'preserved' ? 'success' : 'info'}>{state.feedback.message}</Notice> : null}
      {position.terminal ? <Notice>{endgameStatus(position)}</Notice> : null}
      {state.hint ? <Notice>Dica: {position.moves.find(item => item.uci === state.hint)?.san || state.hint}. Este lance preserva o melhor resultado certificado.</Notice> : null}
      <View style={s.wrap}><Button label="Pedir dica" variant="secondary" onPress={() => { void hint(); }} busy={state.operation === 'hint'} disabled={!!state.operation || !!position.terminal} />
        <Button label="Recomeçar posição" variant="ghost" icon="refresh" onPress={reset} disabled={!state.history.length && !state.operation} /></View>
    </Card>
    <Card><Text style={s.h3}>Resultado com jogo perfeito</Text><Text style={s.body}>{endgameStatus(position)}</Text>
      {!position.terminal ? <Text style={s.small}>Perspectiva das {position.turn === 'w' ? 'brancas' : 'pretas'}, que têm a vez. O histórico também é considerado para repetição.</Text> : null}
      <Text style={s.small}>DTZ: {position.dtz ?? 'indisponível'} · DTM: {position.dtm ?? 'indisponível'} · Sem captura ou avanço de peão: {position.halfmoveClock}/100 meios-lances.</Text>
      <Text style={s.small}>Neste treino, o empate é reclamado ao completar 100 meios-lances sem captura ou avanço de peão, ou na terceira repetição. Xeque-mate tem precedência. DTZ mede a distância até zerar esse contador e pode conter arredondamento; não é uma contagem até o mate.</Text>
      <SourceLink url={position.source.url} label={position.source.name} /><Text style={s.small}>{exercise.source.name}</Text>
      {exercise.source.url ? <SourceLink url={exercise.source.url} label="Abrir referência da posição" /> : null}
      <Button label={showMoves ? 'Ocultar lances avaliados' : 'Ver lances avaliados'} variant="ghost" onPress={() => setShowMoves(value => !value)} />
      {showMoves ? position.moves.map(item => <Text key={item.uci} style={s.small}>{item.san} · {categoryLabels[item.category]}</Text>) : null}
    </Card>
  </View>;
}
export function GeneratedEndgamePanel() {
  const trainer = useEndgameTraining();
  const [theme, setTheme] = useState<EndgameTheme>('queen');
  const themes: [EndgameTheme, string][] = [['queen', 'Dama'], ['rook', 'Torre'], ['pawn', 'Peões'], ['promotion', 'Promoção']];
  return <View style={s.stack}><Card><Text style={s.h2}>Treino variado</Text><Text style={s.muted}>Escolha um tema. Cada novo final recebe um objetivo confirmado pela tablebase.</Text>
    <View style={s.wrap}>{themes.map(([value, label]) => <Chip key={value} label={label} selected={theme === value} onPress={trainer.state.operation ? undefined : () => setTheme(value)} />)}</View>
    <Button label={trainer.state.exercise ? 'Gerar outro final' : 'Gerar final'} icon="refresh" onPress={() => { void trainer.generate(theme); }} busy={trainer.state.operation === 'generate'} disabled={!!trainer.state.operation} />
    {theme === 'rook' ? <><Text style={s.h3}>Técnicas clássicas verificadas</Text><View style={s.wrap}>
      <Button label="Lucena: vencer" variant="secondary" disabled={!!trainer.state.operation} onPress={() => { void trainer.generate('rook', 'lucena'); }} />
      <Button label="Philidor: empatar" variant="secondary" disabled={!!trainer.state.operation} onPress={() => { void trainer.generate('rook', 'philidor'); }} />
    </View></> : null}
    {trainer.state.error ? <ErrorState message={trainer.state.error} /> : null}
  </Card><TrainingBoard trainer={trainer} /></View>;
}
