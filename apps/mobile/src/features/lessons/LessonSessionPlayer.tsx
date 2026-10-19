import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Modal, Platform, ScrollView, Text, View } from 'react-native';
import type { LessonBoardResult, LessonDetail } from '../../api/types';
import { api } from '../../api/client';
import { useOperation } from '../../api/hooks';
import { useAuth } from '../../auth/AuthProvider';
import { ChessBoard } from '../../chess/ChessBoard';
import { linePositions } from '../../chess/logic';
import type { ArrowAnnotation } from '../../chess/annotations';
import { useNavigation } from '../../navigation/Navigation';
import { Badge, Button, Card, Loading } from '../../ui/components';
import { colors, s } from '../../ui/theme';
import { StudyLayout, StudyMessage } from '../../ui/StudyLayout';
import { studyRequestId } from '../learning/request-id';
import { advanceLesson, answerLesson, hintLesson, lessonDeck, lessonMoveFeedback, restoreLesson, sessionCard, sessionDone, sessionFen, startLesson, type LessonSession, type SessionMode } from './lesson-session';
import { clearLessonClaim, lessonStorageKey, offerLessonClaim, readLessonClaim, readLessonSession, writeLessonSession } from './lesson-storage';
import { useAppearance } from '../../appearance/AppearanceProvider';
import { PositionInspector } from '../analysis/PositionInspector';

export function LessonSessionPlayer({ lesson, mode, nextLessonId }: { lesson: LessonDetail; mode: SessionMode; nextLessonId?: string }) {
  const auth = useAuth(); const { back, navigate, replace } = useNavigation(); const operation = useOperation();
  const cards = useMemo(() => lessonDeck(lesson, mode), [lesson, mode]);
  const [session, setSession] = useState<LessonSession>(() => startLesson(cards, mode));
  const { appearance } = useAppearance();
  const [ready, setReady] = useState(false); const [automatic, setAutomatic] = useState(appearance.autoAdvance);
  const [active, setActive] = useState(AppState.currentState === 'active');
  const [details, setDetails] = useState(false); const [storageError, setStorageError] = useState(false);
  const [inspect, setInspect] = useState(false);
  const [lastInsight, setLastInsight] = useState('');
  const [result, setResult] = useState<LessonBoardResult | null>(null);
  const requestId = useRef(studyRequestId()); const saving = useRef(false); const writes = useRef(Promise.resolve());
  const key = lessonStorageKey(auth.user?.id, lesson.id, mode);
  useEffect(() => {
    let mounted = true;
    const claim = auth.user ? readLessonClaim(lesson.id, mode) : null;
    void (claim ? Promise.resolve(claim) : readLessonSession(key)).then(raw => {
      if (!mounted) return;
      if (raw) {
        try {
          const saved = JSON.parse(raw);
          const restored = restoreLesson(JSON.stringify(saved.session), cards, mode);
          setSession(restored);
          if (typeof saved.requestId === 'string' && saved.requestId.length <= 100) requestId.current = saved.requestId;
        } catch { setStorageError(true); }
      }
    }).catch(() => { if (mounted) setStorageError(true); }).finally(() => { if (mounted) setReady(true); });
    return () => { mounted = false; };
  }, [key, cards, mode]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => setActive(state === 'active'));
    if (Platform.OS !== 'web') return () => subscription.remove();
    const visibility = () => setActive(!document.hidden);
    document.addEventListener('visibilitychange', visibility);
    return () => { subscription.remove(); document.removeEventListener('visibilitychange', visibility); };
  }, []);
  useEffect(() => {
    if (!ready) return;
    const payload = JSON.stringify({ session, requestId: requestId.current });
    writes.current = writes.current.then(() => writeLessonSession(key, payload)).catch(() => setStorageError(true));
  }, [session, key, ready]);
  const card = sessionCard(session, cards); const done = sessionDone(session);
  useEffect(() => {
    if (card?.kind === 'move' && session.feedback?.kind === 'correct') setLastInsight(lessonMoveFeedback(card, session.ply));
  }, [card, session.ply, session.feedback]);
  useEffect(() => {
    if (!card || !session.feedback || session.feedback.kind === 'hint' || !automatic || !active || details || inspect) return;
    const delay = session.feedback.kind === 'wrong' ? 1200 : card.kind === 'choice' ? 1800 : mode === 'guided' ? 600 : 380;
    const timer = setTimeout(() => setSession(value => advanceLesson(value, card)), delay);
    return () => clearTimeout(timer);
  }, [session, card, automatic, active, details, inspect, mode]);
  const finish = () => {
    if (saving.current || !auth.user) return;
    saving.current = true;
    void operation.run(async signal => {
      try {
        const response = await api.post<LessonBoardResult>(`/lessons/${encodeURIComponent(lesson.id)}/board-complete`,
          { mistakes: session.mistakes, hintUsed: session.hints > 0, requestId: requestId.current }, signal);
        clearLessonClaim(lesson.id, mode); setResult(response); auth.refreshProgress();
      } finally { saving.current = false; }
    });
  };
  useEffect(() => { if (ready && done && !result && !operation.error) finish(); }, [ready, done, auth.user?.id]);
  if (!ready) return <Loading label="Retomando sua prática…" />;
  if (!cards.length) return <Card><Text style={s.h3}>Esta aula ainda precisa de exercícios.</Text><Button label="Voltar" onPress={back} /></Card>;
  const restart = () => { requestId.current = studyRequestId(); setResult(null); operation.clearError(); setSession(startLesson(cards, mode)); };
  if (done) return <StudyLayout title={lesson.title} eyebrow="Sessão concluída" onBack={back} progress={100}
    renderBoard={maxSize => <ChessBoard fen={cards.filter(item => item.kind === 'move').at(-1)?.fen ?? cards[0]!.fen} maxSize={maxSize} disabled hideStatus />}
    status={<StudyMessage tone="success">Você praticou, recuperou a ideia e corrigiu os erros.</StudyMessage>}
    stats={<View style={s.stack}><View style={s.wrap}><Badge>{session.mastered.length} desafios dominados</Badge><Badge tone="neutral">{session.mistakes} ajustes · {session.hints} dicas</Badge></View>
      <Text style={s.small}>{operation.busy ? 'Salvando progresso…' : operation.error ? operation.error : result ? `Progresso salvo${result.xpEarned ? ` · +${result.xpEarned} XP` : ''}.` : 'Prática guardada neste aparelho.'}</Text>
      {operation.error ? <Button label="Tentar salvar novamente" variant="secondary" onPress={finish} /> : null}
      {!auth.user ? <Button label="Entrar para sincronizar" variant="ghost" onPress={() => { offerLessonClaim(lesson.id, mode, JSON.stringify({ session, requestId: requestId.current })); navigate({ screen: 'auth' }); }} /> : null}</View>}
    actions={<View style={s.stack}><Button label={nextLessonId ? 'Próxima sessão' : 'Escolher outro treino'} icon="arrow" onPress={() => nextLessonId ? replace({ screen: 'lesson', id: nextLessonId }) : navigate({ screen: 'lessons' })} />
      <Button label="Treinar novamente" icon="refresh" variant="ghost" onPress={restart} /></View>} />;
  if (!card) return null;
  const expected = card.moves[session.ply]; const line = linePositions(card.moves, card.fen);
  const assisted = card.assisted || session.feedback?.kind === 'hint';
  const feedback = session.feedback;
  const arrows: ArrowAnnotation[] = assisted && expected ? [{ from: expected.slice(0, 2) as ArrowAnnotation['from'], to: expected.slice(2, 4) as ArrowAnnotation['to'], tone: 'green' }] : [];
  if (card.kind === 'move' && feedback?.kind === 'wrong' && feedback.move) arrows.push({ from: feedback.move.slice(0, 2) as ArrowAnnotation['from'], to: feedback.move.slice(2, 4) as ArrowAnnotation['to'], tone: 'red' });
  const message = feedback?.kind === 'correct' ? card.kind === 'choice' ? card.explanation : card.kind === 'square' ? 'Casa encontrada!' : `Boa! ${line.sans[session.ply]}.`
    : feedback?.kind === 'wrong' ? card.kind === 'choice' ? 'Reveja a ideia e escolha outra resposta.' : card.kind === 'square' ? 'Confira a letra da coluna e o número da fileira.' : 'Essa não é a continuação deste desafio. Observe a posição e tente outra ideia.'
    : feedback?.kind === 'hint' ? card.kind === 'choice' ? card.explanation : card.kind === 'square' ? `Procure a coluna ${card.square?.[0]} e a fileira ${card.square?.[1]}.` : `Experimente ${line.sans[session.ply]}. Depois você vai recuperar a ideia sem ajuda.`
    : card.kind === 'move' && session.ply > 0 ? 'O adversário respondeu. Continue sua ideia.' : card.prompt;
  return <><StudyLayout title={lesson.title} subtitle={session.cursor >= cards.length ? 'Revisão dos pontos difíceis' : card.assisted ? 'Experimente com ajuda' : 'Resolva no tabuleiro'}
    eyebrow={`Desafio ${session.cursor + 1} de ${session.queue.length}`} onBack={back} progress={session.cursor / session.queue.length * 100} boardMaxSize={card.kind === 'choice' ? 220 : 720}
    topAction={<Button label={automatic ? 'Pausar' : 'Retomar'} compact variant="ghost" onPress={() => setAutomatic(value => !value)} />}
    renderBoard={maxSize => <ChessBoard fen={sessionFen(session, card)} maxSize={maxSize} orientation={card.fen.split(' ')[1] === 'b' ? 'b' : 'w'} hideStatus
      practiceMode disabled={card.kind === 'choice' || !!feedback && feedback.kind !== 'hint'} feedbackArrows={arrows}
      onSquarePress={card.kind === 'square' ? square => setSession(value => answerLesson(value, card, square)) : undefined}
      onMove={card.kind === 'move' ? move => setSession(value => answerLesson(value, card, move)) : undefined} lastMove={feedback?.kind === 'correct' && card.kind === 'move' ? feedback.move : card.moves[session.ply - 1]} />}
    status={<StudyMessage tone={feedback?.kind === 'correct' ? 'success' : feedback?.kind === 'wrong' ? 'error' : 'info'}>{message}</StudyMessage>}
    stats={<View style={s.stack}>{lastInsight && card.kind === 'move' ? <Text accessibilityLiveRegion="polite" style={s.small}>{lastInsight}</Text> : null}{card.kind === 'choice' ? card.options?.map((option, index) => <Button key={index} label={option} variant={feedback?.choice === index ? 'primary' : 'secondary'}
      disabled={!!feedback && feedback.kind !== 'hint'} onPress={() => setSession(value => answerLesson(value, card, index))} />) : null}
      {storageError ? <Text accessibilityRole="alert" style={s.small}>Não foi possível guardar a retomada neste aparelho.</Text> : null}</View>}
    actions={<View style={[s.wrap, { justifyContent: 'center' }]}><Button label="Entender a ideia" compact variant="ghost" onPress={() => setDetails(true)} />
      <Button label="Analisar" compact variant="ghost" onPress={() => setInspect(true)} />
      {!feedback ? <Button label="Dica" compact variant="secondary" onPress={() => setSession(value => hintLesson(value, card))} /> : null}
      {!automatic && feedback && feedback.kind !== 'hint' ? <Button label="Avançar" compact onPress={() => setSession(value => advanceLesson(value, card))} /> : null}</View>} />
    {inspect ? <PositionInspector fen={sessionFen(session, card)} onClose={() => setInspect(false)} /> : null}
    <Modal visible={details} transparent animationType="fade" onRequestClose={() => setDetails(false)}><View style={{ flex: 1, padding: 24, backgroundColor: '#000B', justifyContent: 'center' }}>
      <View accessibilityViewIsModal style={[s.card, { maxHeight: '80%', maxWidth: 620, width: '100%', alignSelf: 'center' }]}><Text style={s.h2}>{lesson.title}</Text>
        <ScrollView><Text style={s.body}>{card.explanation}</Text></ScrollView><Button label="Voltar ao desafio" onPress={() => setDetails(false)} /></View></View></Modal></>;
}
