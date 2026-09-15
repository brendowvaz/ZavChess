import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Text, useWindowDimensions, View } from 'react-native';
import { Chess } from 'chess.js';
import type { EngineMove, PositionAnalysis as Analysis, AnalysisSide as Side, MoveAnalysis } from './analysis-contract';
import { api, errorMessage, isAbort } from '../../api/client';
import { ChessBoard } from '../../chess/ChessBoard';
import { DEFAULT_POSITION, gameFromHistory, linePositions, moveUci, positionStatus, pvToSan, sideName } from '../../chess/logic';
import { Badge, Button, Card, Chip, ErrorState, Heading, Loading, Notice } from '../../ui/components';
import { colors, s } from '../../ui/theme';
import { CoachResult } from './CoachResult';
import { LatestAnalysisRequest, lastReviewTarget, validateReviewResponse, type ReviewTarget } from './analysis-session';
import { defaultEngineDifficulty, engineDifficulties, type EngineDifficulty } from './engine-difficulty';
import { loadEngineDifficulty, saveEngineDifficulty } from './engine-difficulty-storage';

type Mode = 'computer' | 'analysis';

function scoreText(analysis: Analysis) {
  if (analysis.score.type === 'mate') {
    if (analysis.score.value === 0) return 'Mate na posição';
    return `Mate ${analysis.score.value > 0 ? 'a favor' : 'contra'} em ${Math.abs(analysis.score.value)}`;
  }
  const pawns = analysis.score.value / 100;
  return `${pawns >= 0 ? '+' : ''}${pawns.toFixed(2)}`;
}

function EngineResult({ analysis }: { analysis: Analysis }) {
  let turn: Side;
  let bestMove = analysis.bestMove ?? '—';
  try {
    const game = new Chess(analysis.fen);
    turn = game.turn();
    if (analysis.bestMove) bestMove = `${moveUci(game, analysis.bestMove).san} · ${analysis.bestMove}`;
  } catch {
    return <ErrorState message="O motor retornou uma análise que não corresponde a uma posição válida." />;
  }
  const variation = pvToSan(analysis.fen, analysis.pv);
  return <Card><View style={[s.between, { flexWrap: 'wrap' }]}><Text accessibilityRole="header" style={s.h2}>Leitura do Stockfish</Text><Badge tone="neutral">Profundidade {analysis.depth}</Badge></View>
    <View style={{ gap: 5 }}><Text style={{ fontSize: 31, fontWeight: '600', color: colors.forest }}>{scoreText(analysis)}</Text>
      <Text style={s.small}>Perspectiva das {sideName(turn)}, que tinham a vez na posição analisada.</Text></View>
    <View style={s.separator} />
    <View style={{ gap: 5 }}><Text style={s.label}>Melhor lance</Text><Text selectable style={s.h3}>{bestMove}</Text></View>
    <View style={{ gap: 5 }}><Text style={s.label}>Linha principal</Text><Text selectable style={variation ? s.body : s.muted}>{variation || 'Nenhuma continuação informada.'}</Text></View>
    <Text style={s.small}>Motor: {analysis.engine}. A avaliação é uma fotografia da posição e pode mudar com maior profundidade.</Text>
  </Card>;
}

export function AnalysisScreen() {
  const { width } = useWindowDimensions();
  const [mode, setMode] = useState<Mode>('computer');
  const [side, setSide] = useState<Side>('w');
  const [depth, setDepth] = useState(12);
  const [difficulty, setDifficulty] = useState<EngineDifficulty>(defaultEngineDifficulty);
  const [difficultyStorageError, setDifficultyStorageError] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [thinking, setThinking] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [coach, setCoach] = useState<MoveAnalysis | null>(null);
  const [coaching, setCoaching] = useState(false);
  const [coachError, setCoachError] = useState<string | null>(null);
  const historyRef = useRef<string[]>([]);
  const difficultyTouched = useRef(false);
  const engineRequests = useRef(new LatestAnalysisRequest());
  const coachRequests = useRef(new LatestAnalysisRequest());
  const game = useMemo(() => gameFromHistory(DEFAULT_POSITION, history), [history]);
  const sans = useMemo(() => linePositions(history).sans, [history]);
  const lastTarget = useMemo(() => lastReviewTarget(history), [history]);
  const ownTarget = useMemo(() => lastReviewTarget(history, side), [history, side]);

  const cancelCoach = useCallback(() => {
    coachRequests.current.cancel();
    setCoaching(false); setCoach(null); setCoachError(null);
  }, []);

  const cancelEngine = useCallback(() => {
    engineRequests.current.cancel();
    setThinking(false);
  }, []);

  useEffect(() => () => { engineRequests.current.cancel(); coachRequests.current.cancel(); }, []);
  useEffect(() => {
    let mounted = true;
    void loadEngineDifficulty().then(value => { if (mounted && !difficultyTouched.current) setDifficulty(value); })
      .catch(() => { if (mounted) setDifficultyStorageError(true); });
    return () => { mounted = false; };
  }, []);

  const reviewMove = async (target: ReviewTarget | null) => {
    if (!target || thinking) return;
    const ticket = coachRequests.current.begin();
    setCoaching(true); setCoach(null); setCoachError(null);
    try {
      const response = await api.post<MoveAnalysis>('/analysis/move', { fen: target.fen, move: target.move, depth: mode === 'analysis' ? depth : 12 }, ticket.controller.signal);
      if (!coachRequests.current.isCurrent(ticket)) return;
      validateReviewResponse(response, target);
      setCoach(response);
    } catch (error) {
      if (coachRequests.current.isCurrent(ticket) && !isAbort(error)) setCoachError(errorMessage(error));
    } finally {
      if (coachRequests.current.finish(ticket)) setCoaching(false);
    }
  };

  const analyzePosition = useCallback(async (expectedFen: string) => {
    cancelEngine();
    cancelCoach();
    const ticket = engineRequests.current.begin();
    const { controller } = ticket;
    setThinking(true); setRequestError(null);
    try {
      const response = await api.post<Analysis>('/analysis', { fen: expectedFen, depth }, controller.signal);
      if (!engineRequests.current.isCurrent(ticket)) return;
      const normalizedFen = new Chess(expectedFen).fen();
      if (new Chess(response.fen).fen() !== normalizedFen) throw new Error('O motor respondeu para outra posição. Tente analisar novamente.');
      setAnalysis(response);
    } catch (error) {
      if (!isAbort(error) && engineRequests.current.isCurrent(ticket)) setRequestError(errorMessage(error));
    } finally {
      if (engineRequests.current.finish(ticket)) setThinking(false);
    }
  }, [cancelEngine, cancelCoach, depth]);

  const requestEngineMove = useCallback(async (expectedFen: string) => {
    cancelEngine();
    cancelCoach();
    const ticket = engineRequests.current.begin();
    setThinking(true); setRequestError(null); setAnalysis(null);
    try {
      const response = await api.post<EngineMove>('/engine/move', { fen: expectedFen, difficulty }, ticket.controller.signal);
      if (!engineRequests.current.isCurrent(ticket)) return;
      const normalizedFen = new Chess(expectedFen).fen();
      if (new Chess(response.fen).fen() !== normalizedFen || response.difficulty !== difficulty) throw new Error('O motor respondeu com configurações diferentes desta partida. Tente novamente.');
      if (!response.bestMove) throw new Error('O motor não informou um lance para continuar a partida.');
      const currentHistory = historyRef.current;
      const currentGame = gameFromHistory(DEFAULT_POSITION, currentHistory);
      if (currentGame.fen() !== normalizedFen) return;
      moveUci(currentGame, response.bestMove);
      const nextHistory = [...currentHistory, response.bestMove];
      historyRef.current = nextHistory;
      setHistory(nextHistory);
    } catch (error) {
      if (!isAbort(error) && engineRequests.current.isCurrent(ticket)) setRequestError(errorMessage(error));
    } finally {
      if (engineRequests.current.finish(ticket)) setThinking(false);
    }
  }, [cancelEngine, cancelCoach, difficulty]);

  const restart = (nextMode: Mode, nextSide: Side) => {
    cancelEngine();
    cancelCoach();
    historyRef.current = [];
    setHistory([]); setAnalysis(null); setRequestError(null);
    if (nextMode === 'computer' && nextSide === 'b') void requestEngineMove(DEFAULT_POSITION);
  };

  const selectMode = (nextMode: Mode) => {
    if (nextMode === mode) return;
    setMode(nextMode);
    restart(nextMode, side);
  };

  const selectSide = (nextSide: Side) => {
    if (nextSide === side) return;
    setSide(nextSide);
    if (mode === 'computer') restart(mode, nextSide);
  };

  const selectDifficulty = (nextDifficulty: EngineDifficulty) => {
    if (nextDifficulty === difficulty) return;
    difficultyTouched.current = true;
    cancelCoach();
    setDifficulty(nextDifficulty); setDifficultyStorageError(false);
    void saveEngineDifficulty(nextDifficulty).catch(() => setDifficultyStorageError(true));
  };

  const play = (uci: string) => {
    try {
      const currentGame = gameFromHistory(DEFAULT_POSITION, historyRef.current);
      if (currentGame.isGameOver() || thinking || (mode === 'computer' && currentGame.turn() !== side)) return;
      moveUci(currentGame, uci);
      cancelEngine(); cancelCoach();
      const nextHistory = [...historyRef.current, uci];
      historyRef.current = nextHistory;
      setHistory(nextHistory); setAnalysis(null); setRequestError(null);
      if (mode === 'computer' && !currentGame.isGameOver()) void requestEngineMove(currentGame.fen());
    } catch {
      setRequestError('Não foi possível aplicar esse lance. Recomece a posição e tente novamente.');
    }
  };

  const undo = () => {
    cancelEngine();
    cancelCoach();
    const amount = mode === 'computer' && game.turn() === side ? 2 : 1;
    const nextHistory = historyRef.current.slice(0, Math.max(0, historyRef.current.length - amount));
    historyRef.current = nextHistory;
    setHistory(nextHistory); setAnalysis(null); setRequestError(null);
  };

  const computerTurn = mode === 'computer' && game.turn() !== side && !game.isGameOver();
  const canUndo = history.length > (mode === 'computer' && side === 'b' ? 1 : 0);
  return <View style={s.page}>
    <Heading eyebrow="Jogue, teste, compreenda" title="O tabuleiro é seu laboratório." description="Jogue contra o Stockfish ou explore uma posição livremente e peça uma avaliação real ao servidor." />
    <Card><View style={[s.between, { flexWrap: 'wrap', alignItems: 'flex-end' }]}>
      <View style={{ gap: 8 }}><Text style={s.label}>Modo</Text><View style={s.wrap}><Chip label="Partida contra o motor" selected={mode === 'computer'} onPress={() => selectMode('computer')} /><Chip label="Análise livre" selected={mode === 'analysis'} onPress={() => selectMode('analysis')} /></View></View>
      <View style={{ gap: 8 }}><Text style={s.label}>{mode === 'computer' ? 'Sua cor' : 'Orientação'}</Text><View style={s.wrap}><Chip label="Brancas" selected={side === 'w'} onPress={() => selectSide('w')} /><Chip label="Pretas" selected={side === 'b'} onPress={() => selectSide('b')} /></View></View>
      {mode === 'computer' ? <View style={{ gap: 8 }}><Text style={s.label}>Dificuldade do adversário</Text><View style={s.wrap}>{engineDifficulties.map(level => <Chip key={level.id}
        label={level.label} selected={difficulty === level.id} onPress={thinking ? undefined : () => selectDifficulty(level.id)} />)}</View></View>
        : <View style={{ gap: 8 }}><Text style={s.label}>Profundidade da análise</Text><View style={s.wrap}>{[8, 12, 16, 18].map(value => <Chip key={value} label={String(value)} selected={depth === value} onPress={thinking ? undefined : () => { cancelCoach(); setDepth(value); }} />)}</View></View>}
    </View></Card>
    {difficultyStorageError && mode === 'computer' ? <Notice tone="error">A dificuldade funciona nesta partida, mas não pôde ser salva neste dispositivo.</Notice> : null}
    <View style={{ flexDirection: width >= 900 ? 'row' : 'column', alignItems: 'flex-start', gap: 24 }}>
      <Card style={{ flex: width >= 900 ? 1.35 : undefined, width: '100%' }}>
        <ChessBoard fen={game.fen()} orientation={side} onMove={play} lastMove={history[history.length - 1]}
          disabled={thinking || game.isGameOver() || (mode === 'computer' && game.turn() !== side)} edgeToEdge={width < 900} />
      </Card>
      <View style={{ flex: 1, width: '100%', gap: 16 }}>
        <Card><View style={s.between}><Text accessibilityRole="header" style={s.h2}>{mode === 'computer' ? 'Sua partida' : 'Posição livre'}</Text><Badge>{history.length} meios-lances</Badge></View>
          <Text style={s.muted}>{game.isGameOver() ? positionStatus(game) : thinking ? 'Stockfish está calculando a resposta…' : computerTurn ? 'A resposta do motor está pendente.' : mode === 'computer' ? `Sua vez: jogue com as ${sideName(side)}.` : 'Mova qualquer lado e analise quando quiser.'}</Text>
          {thinking ? <Loading label={mode === 'computer' ? 'Stockfish está escolhendo um lance…' : 'Stockfish está avaliando a posição…'} /> : null}
          {requestError ? <ErrorState message={requestError} retry={computerTurn ? () => void requestEngineMove(game.fen()) : undefined} /> : null}
          {mode === 'analysis' ? <Button label="Analisar esta posição" icon="spark" busy={thinking} disabled={game.isGameOver()} onPress={() => void analyzePosition(game.fen())} /> : null}
          <View style={s.wrap}><Button label="Desfazer" icon="back" variant="secondary" disabled={!canUndo} onPress={undo} />
            <Button label="Nova partida" icon="refresh" variant="ghost" onPress={() => restart(mode, side)} /></View>
        </Card>
        <Card>
          <Text accessibilityRole="header" style={s.h3}>Entenda seu lance</Text>
          <Text style={s.muted}>{lastTarget ? `Último lance: ${lastTarget.san}, das ${lastTarget.color === 'w' ? 'brancas' : 'pretas'}. Compare antes e depois, veja uma alternativa e explore a continuação.` : 'Faça um lance para pedir uma avaliação com explicações.'}</Text>
          <Button label="Avaliar último lance" icon="spark" disabled={!lastTarget || thinking} busy={coaching} onPress={() => void reviewMove(lastTarget)} />
          {mode === 'computer' && ownTarget && ownTarget.ply !== lastTarget?.ply ? <Button label={`Avaliar meu último lance (${ownTarget.san})`} variant="secondary" disabled={thinking || coaching} onPress={() => void reviewMove(ownTarget)} /> : null}
          {coaching ? <Text accessibilityLiveRegion="polite" style={s.small}>Comparando as duas posições… Você pode continuar jogando ou desfazer para cancelar.</Text> : null}
          {coachError ? <ErrorState message={coachError} /> : null}
          {game.isThreefoldRepetition() ? <Text style={s.small}>A partida empatou por repetição. A análise enviada por FEN não inclui esse histórico; a avaliação isolada pode indicar outro resultado.</Text> : null}
        </Card>
        <Card><Text accessibilityRole="header" style={s.h3}>Lances da partida</Text>
          <Text selectable style={sans.length ? s.body : s.muted}>{sans.length ? sans.map((san, index) => `${index % 2 === 0 ? `${Math.floor(index / 2) + 1}. ` : ''}${san}`).join('  ') : 'Faça o primeiro lance no tabuleiro.'}</Text>
        </Card>
        <Notice>{mode === 'computer' ? 'O adversário joga com a força selecionada no Stockfish. Na dificuldade Máquina, o motor joga sem redução de habilidade.' : 'A análise usa a posição atual, sem alterar a partida. A pontuação vem do Stockfish no servidor.'}</Notice>
      </View>
    </View>
    {coach ? <CoachResult key={`${coach.fen}:${coach.move}:${coach.method.requestedDepth}`} result={coach} /> : null}
    {analysis ? <EngineResult analysis={analysis} /> : null}
  </View>;
}
