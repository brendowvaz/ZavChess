import React, { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import type { Side } from '../../api/types';
import { ChessBoard } from '../../chess/ChessBoard';
import { DEFAULT_POSITION, linePositions } from '../../chess/logic';
import { Badge, Button, ErrorState, Notice, ProgressBar } from '../../ui/components';
import { s } from '../../ui/theme';
import { Replay } from '../../chess/Replay';
import { MasteryStrip } from './MasteryStrip';
import type { ArrowAnnotation } from '../../chess/annotations';
import { StudyLayout, StudyMessage } from '../../ui/StudyLayout';

type Status = 'todo' | 'wrong' | 'correct';
export type GuidedPracticeResult = { mistakes: number; hintUsed: boolean };

export function GuidedLinePractice({ moves, initialFen = DEFAULT_POSITION, onMastered, study }: {
  moves: string[]; initialFen?: string; onMastered?: (result: GuidedPracticeResult) => void;
  study?: { title: string; subtitle?: string; eyebrow?: string; onBack: () => void; completeAction?: React.ReactNode };
}) {
  const line = useMemo(() => { try { return linePositions(moves, initialFen); } catch { return null; } }, [initialFen, moves]);
  const orientation: Side = initialFen.split(' ')[1] === 'b' ? 'b' : 'w';
  const studentPlies = useMemo(() => moves.flatMap((_, index) => index % 2 === 0 ? [index] : []), [moves]);
  const freshStatus = () => moves.map(() => 'todo' as Status);
  const [phase, setPhase] = useState<'learn' | 'practice' | 'review' | 'complete'>('learn');
  const [status, setStatus] = useState<Status[]>(freshStatus);
  const [queue, setQueue] = useState<number[]>(studentPlies);
  const [cursor, setCursor] = useState(0);
  const [revealed, setRevealed] = useState<'wrong' | 'dont-know' | null>(null);
  const [attemptedMove, setAttemptedMove] = useState<string>();
  const [mistakes, setMistakes] = useState(0);
  const [hintUsed, setHintUsed] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(Math.min(1, moves.length));
  if (!line) return <ErrorState message="Não foi possível preparar a prática desta sequência." />;
  if (!moves.length) return null;
  const index = queue[cursor] ?? moves.length;
  const counts = studentPlies.reduce((value, ply) => ({ ...value, [status[ply]!]: value[status[ply]!] + 1 }), { todo: 0, wrong: 0, correct: 0 });
  const restart = () => { setPhase('learn'); setStatus(freshStatus()); setQueue(studentPlies); setCursor(0); setRevealed(null); setAttemptedMove(undefined); setMistakes(0); setHintUsed(false); setPreviewIndex(Math.min(1, moves.length)); };
  const advance = (nextStatus = status, nextMistakes = mistakes, nextHintUsed = hintUsed) => {
    if (cursor + 1 < queue.length) { setCursor(cursor + 1); setRevealed(null); setAttemptedMove(undefined); return; }
    const errors = studentPlies.filter(itemIndex => nextStatus[itemIndex] === 'wrong');
    if (errors.length) { setPhase('review'); setQueue(errors); setCursor(0); setRevealed(null); setAttemptedMove(undefined); return; }
    setPhase('complete'); onMastered?.({ mistakes: nextMistakes, hintUsed: nextHintUsed });
  };
  const answer = (uci: string) => {
    const correct = uci === moves[index];
    const nextStatus = status.map((item, itemIndex) => itemIndex === index ? (correct ? 'correct' : 'wrong') : item);
    setStatus(nextStatus);
    if (correct) { advance(nextStatus); return; }
    setMistakes(value => value + 1); setAttemptedMove(uci); setRevealed('wrong');
  };
  const dontKnow = () => { setStatus(items => items.map((item, itemIndex) => itemIndex === index ? 'wrong' : item)); setMistakes(value => value + 1); setHintUsed(true); setAttemptedMove(undefined); setRevealed('dont-know'); };
  const arrow = (move: string | undefined, tone: ArrowAnnotation['tone']): ArrowAnnotation[] => move ? [{ from: move.slice(0, 2) as ArrowAnnotation['from'], to: move.slice(2, 4) as ArrowAnnotation['to'], tone }] : [];
  const feedbackArrows = revealed === 'wrong' ? [...arrow(attemptedMove, 'red'), ...arrow(moves[index], 'green')]
    : revealed === 'dont-know' ? arrow(moves[index], 'green') : [];
  if (study) {
    const learnProgress = moves.length ? previewIndex / moves.length * 30 : 0;
    const practiceProgress = counts.correct / Math.max(1, studentPlies.length) * 70 + 30;
    const progress = phase === 'complete' ? 100 : phase === 'learn' ? learnProgress : practiceProgress;
    const previewMove = moves[previewIndex - 1];
    const boardFen = phase === 'learn' ? line.positions[previewIndex]!
      : phase === 'complete' ? line.positions.at(-1)! : line.positions[index]!;
    const boardArrows = phase === 'learn' ? arrow(previewMove, 'green') : feedbackArrows;
    const message = phase === 'complete' ? <StudyMessage tone="success">Sequência dominada. Todos os erros foram corrigidos.</StudyMessage>
      : phase === 'learn' ? <StudyMessage>Observe {line.sans[previewIndex - 1]}. Veja de onde a peça sai e onde chega.</StudyMessage>
      : revealed === 'wrong' ? <StudyMessage tone="error">Seu lance está em vermelho; o correto é {line.sans[index]}.</StudyMessage>
      : revealed === 'dont-know' ? <StudyMessage tone="error">O lance é {line.sans[index]}. Ele voltará para revisão.</StudyMessage>
      : <StudyMessage>{phase === 'review' ? 'Corrija este lance para limpar a pilha.' : 'Jogue o lance que você acabou de aprender.'}</StudyMessage>;
    const actions = phase === 'complete' ? study.completeAction ?? <Button label="Praticar novamente" icon="refresh" variant="secondary" onPress={restart} />
      : phase === 'learn' ? <View style={[s.row, { justifyContent: 'center' }]}>
        <Button label="Anterior" icon="back" compact variant="ghost" disabled={previewIndex <= 1} onPress={() => setPreviewIndex(value => value - 1)} />
        <Button label={previewIndex < moves.length ? 'Próximo lance' : 'Agora faça você'} icon="arrow" onPress={() => previewIndex < moves.length ? setPreviewIndex(value => value + 1) : setPhase('practice')} />
      </View>
      : revealed ? <Button label="Continuar" icon="arrow" onPress={() => advance()} />
      : <Button label="Não sei" variant="secondary" onPress={dontKnow} />;
    return <StudyLayout title={study.title} subtitle={study.subtitle} eyebrow={study.eyebrow} onBack={study.onBack} progress={progress}
      renderBoard={maxSize => <ChessBoard fen={boardFen} orientation={orientation} maxSize={maxSize}
        onMove={phase === 'practice' || phase === 'review' ? (revealed ? undefined : answer) : undefined}
        disabled={phase === 'learn' || phase === 'complete' || !!revealed} feedbackArrows={boardArrows}
        lastMove={phase === 'learn' ? previewMove : phase === 'complete' ? moves.at(-1) : moves[index - 1]} hideStatus />}
      status={message}
      stats={phase === 'practice' || phase === 'review' ? <MasteryStrip compact todo={counts.todo} wrong={counts.wrong} correct={counts.correct} /> : undefined}
      actions={actions} />;
  }
  return <View style={s.stack}>
    {phase === 'learn' ? <><View style={s.between}><Badge>1 · VEJA OS MOVIMENTOS</Badge><Text style={s.small}>{moves.length} {moves.length === 1 ? 'lance' : 'lances'}</Text></View>
      <Replay moves={moves} initialFen={initialFen} orientation={orientation} />
      <Notice>Avance pela sequência e observe de onde cada peça sai e onde chega. Em seguida, você fará todos os lances sem setas.</Notice>
      <Button label="Agora faça você" icon="arrow" onPress={() => setPhase('practice')} /></>
    : phase === 'complete' ? <><MasteryStrip todo={0} wrong={0} correct={studentPlies.length} />
      <ChessBoard fen={line.positions.at(-1)!} orientation={orientation} lastMove={moves.at(-1)} />
      <Notice tone="success">Movimentos dominados. Todos os erros foram corrigidos.</Notice>
      <Button label="Praticar movimentos novamente" icon="refresh" variant="secondary" onPress={restart} /></>
    : <><View style={s.between}><Badge tone={phase === 'review' ? 'gold' : 'green'}>{phase === 'review' ? '3 · CORRIJA OS ERROS' : '2 · FAÇA VOCÊ'}</Badge><Text style={s.small}>Lance {cursor + 1} de {queue.length}</Text></View>
      <ProgressBar value={counts.correct / studentPlies.length * 100} label="Movimentos dominados nesta etapa" />
      <MasteryStrip todo={counts.todo} wrong={counts.wrong} correct={counts.correct} />
      <ChessBoard fen={line.positions[index]!} orientation={orientation} onMove={revealed ? undefined : answer} disabled={!!revealed}
        feedbackArrows={feedbackArrows} lastMove={moves[index - 1]} />
      {revealed === 'wrong' ? <Notice tone="error">A seta vermelha mostra seu lance; a verde mostra o correto: {line.sans[index]}. Este lance voltará na revisão.</Notice>
        : revealed === 'dont-know' ? <Notice tone="error">O lance é {line.sans[index]}. Observe-o agora e acerte na revisão.</Notice>
        : <Text style={s.muted}>{phase === 'review' ? 'Este lance voltou para você corrigir.' : 'Jogue seu lance. A resposta adversária será aplicada automaticamente.'}</Text>}
      {revealed ? <Button label="Entendi" icon="arrow" onPress={() => advance()} /> : <Button label="Não sei" variant="secondary" onPress={dontKnow} />}</>}
  </View>;
}
