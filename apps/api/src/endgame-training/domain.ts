import { Chess, type Color, type PieceSymbol, type Square } from 'chess.js';

export const THEMES = ['queen', 'rook', 'pawn', 'promotion'] as const;
export type Theme = typeof THEMES[number];
export type Outcome = 'win' | 'draw' | 'loss';
export type Objective = Exclude<Outcome, 'loss'>;
export const CATEGORIES = ['win', 'syzygy-win', 'maybe-win', 'cursed-win', 'draw', 'blessed-loss', 'maybe-loss', 'syzygy-loss', 'loss', 'unknown'] as const;
export type Category = typeof CATEGORIES[number];
export interface RawEvaluation {
  category: string; dtz: number | null; dtm: number | null;
  moves: { uci: string; san: string; category: string; dtz: number | null }[];
}
export interface Evaluator { evaluateEndgame(fen: string): Promise<RawEvaluation> }
export interface TrainingMove { uci: string; san: string; category: Category; outcome: Outcome | null; dtz: number | null }
export interface Position {
  fen: string; turn: Color; category: Category; outcome: Outcome | null;
  dtz: number | null; dtm: number | null; moves: TrainingMove[]; bestMove: string | null;
  terminal: 'checkmate' | 'stalemate' | 'insufficient-material' | 'threefold-repetition' | 'fifty-moves' | null;
  halfmoveClock: number; rule50: 'claim-at-100-plies'; source: ReturnType<typeof tablebaseSource> | { name: string; url: string; kind: 'rules' };
}
export interface Exercise {
  fen: string; side: Color; theme: Theme; objective: Objective; instructions: string[];
  title: string; source: { kind: 'generated' | 'reference'; name: string; url?: string };
  tablebase: Position;
}
export interface TrainingInput { initialFen: string; history: string[] }
export class TrainingError extends Error {
  readonly status: number;
  constructor(message: string, status = 400) { super(message); this.status = status; }
}
export const LIMITS = { placements: 768, candidates: 96, probes: 6, requestMs: 8500, generationMs: 20000, turnMs: 26000, history: 400 } as const;
const FIDE = 'https://handbook.fide.com/chapter/e012023';
export const LESSONS = [
  {
    id: 'lucena', title: 'Lucena: construir a ponte',
    fen: '6K1/4k1P1/8/8/8/7r/8/5R2 w - - 0 1', objective: 'win' as const,
    url: 'https://lichess.org/study/pqUSUw8Y/tAcIEIbG',
    instructions: ['Afaste o rei defensor com a torre.', 'Prepare a torre na quarta fileira para cobrir o rei dos xeques e liberar o caminho do peão.'],
  },
  {
    id: 'philidor', title: 'Philidor: defender o empate',
    fen: '1r2k3/R7/8/4PK2/8/8/8/8 b - - 0 1', objective: 'draw' as const,
    url: 'https://lichess.org/study/pqUSUw8Y/CvqYotss',
    instructions: ['Mantenha o rei defensor diante do peão e impeça a entrada do rei adversário com a torre na sexta fileira (terceira das pretas).', 'Quando o peão avançar à sexta, procure os xeques por trás. Confira o momento com a dica.'],
  },
] as const;
const INSTRUCTIONS: Record<Theme, string[]> = {
  queen: ['Use o rei para apoiar a dama e reduzir as casas do rei adversário.', 'Antes de cada lance, confira se o adversário ainda tem uma jogada: evite o afogamento.'],
  rook: ['Coordene rei e torre; corte o acesso do rei adversário.', 'Proteja a torre e avalie as trocas. Posições geradas não representam necessariamente uma técnica clássica.'],
  pawn: ['Compare a atividade dos reis, a oposição e as casas de promoção.', 'Calcule a corrida antes de avançar; um tempo pode mudar o resultado.'],
  promotion: ['Compare dama, torre, bispo e cavalo antes de promover.', 'Observe xeques, capturas e afogamento depois da promoção.'],
};
const TITLES: Record<Theme, string> = { queen: 'Final de dama', rook: 'Final de torre', pawn: 'Final de peões', promotion: 'Escolha a promoção' };
export function invertCategory(category: Category): Category {
  const pairs: Record<Category, Category> = {
    win: 'loss', loss: 'win', draw: 'draw', 'cursed-win': 'blessed-loss', 'blessed-loss': 'cursed-win',
    'maybe-win': 'maybe-loss', 'maybe-loss': 'maybe-win', 'syzygy-win': 'syzygy-loss', 'syzygy-loss': 'syzygy-win', unknown: 'unknown',
  };
  return pairs[category];
}
// Ambiguous DTZ/partial-table categories never certify a win or a draw.
export function outcome(category: Category): Outcome | null {
  if (category === 'win' || category === 'loss') return category;
  return ['draw', 'cursed-win', 'blessed-loss'].includes(category) ? 'draw' : null;
}
export function tablebaseSource(fen: string) {
  return { kind: 'tablebase' as const, name: 'Lichess · Syzygy', url: `https://tablebase.lichess.ovh/standard?fen=${encodeURIComponent(fen)}` };
}
export function legalPosition(fen: string, allowTerminal = false): Chess {
  try {
    if (typeof fen !== 'string' || fen.length > 200 || fen.trim().split(/\s+/).length !== 6) throw new Error();
    const game = new Chess(fen);
    const pieces = game.board().flat().filter(piece => piece !== null);
    if (pieces.length > 7 || fen.trim().split(/\s+/)[2] !== '-') throw new Error();
    const white = pieces.find(piece => piece.type === 'k' && piece.color === 'w')!;
    const black = pieces.find(piece => piece.type === 'k' && piece.color === 'b')!;
    if (Math.abs(white.square.charCodeAt(0) - black.square.charCodeAt(0)) <= 1 && Math.abs(Number(white.square[1]) - Number(black.square[1])) <= 1) throw new Error();
    const idleKing = game.turn() === 'w' ? black : white;
    if (game.isAttacked(idleKing.square, game.turn())) throw new Error();
    if (pieces.some(piece => piece.type === 'p' && /[18]$/.test(piece.square))) throw new Error();
    // Training roots have no en-passant history. Subsequent en passant is reconstructed by replay.
    if (fen.trim().split(/\s+/)[3] !== '-') throw new Error();
    if (!allowTerminal && game.isGameOver()) throw new Error();
    return game;
  } catch { throw new TrainingError('FEN inválida para treino: use até 7 peças, reis separados, sem roque, en passant inicial ou posição encerrada.'); }
}
export function play(game: Chess, uci: string) {
  if (typeof uci !== 'string' || !/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci)) throw new TrainingError('Lance UCI inválido.');
  try { return game.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] }); }
  catch { throw new TrainingError('Lance ilegal nesta posição.'); }
}
export function replay(input: TrainingInput) {
  if (!input || !Array.isArray(input.history) || input.history.length > LIMITS.history) throw new TrainingError('Histórico inválido ou acima de 400 meios-lances.');
  const game = legalPosition(input.initialFen, true);
  for (const move of input.history) {
    if (game.isGameOver()) throw new TrainingError('O histórico continua após o fim do treino.');
    play(game, move);
  }
  return game;
}
export function terminalPosition(game: Chess): Position | null {
  const terminal = game.isCheckmate() ? 'checkmate' : game.isStalemate() ? 'stalemate' : game.isInsufficientMaterial() ? 'insufficient-material'
    : game.isThreefoldRepetition() ? 'threefold-repetition' : game.isDrawByFiftyMoves() ? 'fifty-moves' : null;
  if (!terminal) return null;
  const category = terminal === 'checkmate' ? 'loss' : 'draw';
  return { fen: game.fen(), turn: game.turn(), category, outcome: category, dtz: null, dtm: null, moves: [], bestMove: null,
    terminal, halfmoveClock: Number(game.fen().split(' ')[4]), rule50: 'claim-at-100-plies', source: { kind: 'rules', name: 'Regras do xadrez · FIDE', url: FIDE } };
}
function category(value: string): Category {
  if (!(CATEGORIES as readonly string[]).includes(value)) throw new TrainingError('Categoria não reconhecida na tablebase.', 503);
  return value as Category;
}
function distance(value: number | null) { return Number.isInteger(value) ? value : null; }
export function evaluatedPosition(game: Chess, raw: RawEvaluation): Position {
  const terminal = terminalPosition(game);
  if (terminal) return terminal;
  if (!raw || !Array.isArray(raw.moves)) throw new TrainingError('Resposta incompleta da tablebase.', 503);
  const legal = game.moves({ verbose: true });
  const seen = new Set<string>();
  const moves = raw.moves.map(move => {
    const legalMove = legal.find(item => `${item.from}${item.to}${item.promotion || ''}` === move.uci);
    if (!legalMove || seen.has(move.uci)) throw new TrainingError('A tablebase retornou lances inválidos ou duplicados.', 503);
    seen.add(move.uci);
    const actorCategory = invertCategory(category(move.category));
    // Replay on the same game preserves repetition history; terminal rules override remote WDL.
    play(game, move.uci);
    const after = terminalPosition(game);
    game.undo();
    const actualCategory = after ? invertCategory(after.category) : actorCategory;
    return { uci: move.uci, san: legalMove.san, category: actualCategory, outcome: outcome(actualCategory), dtz: distance(move.dtz) };
  });
  if (seen.size !== legal.length) throw new TrainingError('A tablebase não cobriu todos os lances legais.', 503);
  const rootCategory = category(raw.category);
  const rootOutcome = outcome(rootCategory);
  // Preserve the provider's ordering within equal results (DTZ, zeroing and mate tie breaks).
  const score = (value: Outcome | null) => value === 'win' ? 2 : value === 'draw' ? 1 : value === 'loss' ? 0 : -1;
  const certain = moves.filter(move => move.outcome !== null);
  const best = certain.reduce<TrainingMove | null>((best, move) => !best || score(move.outcome) > score(best.outcome) ? move : best, null);
  // A draw cannot be called best while an unevaluated move might win; a proven win is sufficient.
  const uncertain = moves.some(move => move.outcome === null);
  const bestMove = best && (best.outcome === 'win' || !uncertain) ? best.uci : null;
  // Repetition may lower a remote win to a draw. Never upgrade an uncertain root to certified.
  const effectiveOutcome = rootOutcome !== null && bestMove ? best!.outcome : rootOutcome;
  return { fen: game.fen(), turn: game.turn(), category: rootCategory, outcome: effectiveOutcome,
    dtz: distance(raw.dtz), dtm: distance(raw.dtm), moves, bestMove, terminal: null,
    halfmoveClock: Number(game.fen().split(' ')[4]), rule50: 'claim-at-100-plies', source: tablebaseSource(game.fen()) };
}
export function moveFeedback(before: Outcome | null, after: Outcome | null) {
  if (before === null || after === null) return { code: 'uncertain' as const, message: 'A tablebase não certifica o resultado com a regra dos 50 lances; este lance não foi julgado.' };
  if (before === 'win' && after !== 'win') return { code: 'lost-win' as const, message: after === 'draw' ? 'Este lance deixou escapar a vitória; agora a posição é de empate.' : 'Este lance perdeu a vitória e permite derrota com jogo perfeito.' };
  if (before === 'draw' && after === 'loss') return { code: 'lost-draw' as const, message: 'Este lance perdeu o empate. A melhor defesa adversária agora vence.' };
  return { code: 'preserved' as const, message: 'Lance avaliado: você preservou o melhor resultado disponível.' };
}
function fromPerspective(position: Position, side: Color): Outcome | null {
  if (position.outcome === null || position.outcome === 'draw' || side === position.turn) return position.outcome;
  return position.outcome === 'win' ? 'loss' : 'win';
}
function randomFen(theme: Theme, random: () => number): string {
  const pick = (n: number) => Math.min(n - 1, Math.max(0, Math.floor(random() * n)));
  const squares = Array.from({ length: 64 }, (_, i) => `${'abcdefgh'[i % 8]}${1 + Math.floor(i / 8)}` as Square);
  for (let i = squares.length - 1; i > 0; i--) { const j = pick(i + 1); [squares[i], squares[j]] = [squares[j], squares[i]]; }
  const game = new Chess(); game.clear();
  const strong: Color = pick(2) ? 'w' : 'b';
  const weak: Color = strong === 'w' ? 'b' : 'w';
  const put = (type: PieceSymbol, color: Color, promotion = false) => {
    const index = squares.findIndex(sq => type !== 'p' || (promotion ? sq[1] === (color === 'w' ? '7' : '2') : !/[18]$/.test(sq)));
    game.put({ type, color }, squares.splice(index, 1)[0]);
  };
  put('k', strong); put('k', weak);
  if (theme === 'queen') put('q', strong);
  if (theme === 'rook') { put('r', strong); if (pick(2)) { put('p', strong); put('r', weak); } }
  if (theme === 'pawn') { put('p', strong); if (pick(2)) put('p', weak); }
  if (theme === 'promotion') put('p', strong, true);
  const turn = theme === 'promotion' || pick(4) ? strong : weak;
  return `${game.fen().split(' ')[0]} ${turn} - - 0 1`;
}
export function candidatePool(theme: Theme, random = Math.random): string[] {
  const fens = new Set<string>();
  for (let attempt = 0; attempt < LIMITS.placements && fens.size < LIMITS.candidates; attempt++) {
    try {
      const game = legalPosition(randomFen(theme, random));
      if (theme === 'promotion' && !game.moves({ verbose: true }).some(move => move.promotion)) continue;
      fens.add(game.fen());
    } catch { /* A bounded rejection sampler; even a constant RNG terminates. */ }
  }
  return [...fens];
}
export class TrainingCore {
  private readonly evaluator: Evaluator;
  private readonly pool: (theme: Theme) => Iterable<string>;
  private readonly recent = new Map<Theme, string[]>();
  private active = 0;
  private pending = 0;
  private readonly probeMs: number;
  constructor(evaluator: Evaluator, pool = candidatePool, probeMs: number = LIMITS.requestMs) { this.evaluator = evaluator; this.pool = pool; this.probeMs = probeMs; }
  private async bounded<T>(work: (deadline: number) => Promise<T>, duration: number): Promise<T> {
    if (this.active >= 2) throw new TrainingError('Há dois treinos em avaliação. Tente novamente em instantes.', 503);
    this.active++;
    try { return await work(Date.now() + duration); } finally { this.active--; }
  }
  private async probe(game: Chess, deadline: number): Promise<Position> {
    const terminal = terminalPosition(game);
    if (terminal) return terminal;
    const remaining = deadline - Date.now();
    if (remaining <= 0 || this.pending >= 2) throw new TrainingError('O limite de avaliação foi atingido. Tente novamente.', 503);
    this.pending++;
    // Hold the slot until EngineService actually settles, even if our caller times out.
    const request = Promise.resolve().then(() => this.evaluator.evaluateEndgame(game.fen())).finally(() => { this.pending--; });
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const raw = await Promise.race([request, new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new TrainingError('A tablebase demorou para responder. Sua posição foi preservada.', 503)), Math.min(this.probeMs, remaining));
      })]);
      return evaluatedPosition(game, raw);
    } catch (error) {
      if (error instanceof TrainingError) throw error;
      throw new TrainingError('A tablebase está indisponível. Sua posição foi preservada; tente novamente.', 503);
    } finally { clearTimeout(timer); }
  }
  async generate(theme: Theme, excludeFen?: string, lessonId?: string): Promise<Exercise> {
    if (!(THEMES as readonly string[]).includes(theme)) throw new TrainingError('Tema inválido. Use queen, rook, pawn ou promotion.');
    if (excludeFen !== undefined) excludeFen = legalPosition(excludeFen, true).fen();
    const lesson = lessonId === undefined ? undefined : LESSONS.find(item => item.id === lessonId);
    if (lessonId !== undefined && (!lesson || theme !== 'rook')) throw new TrainingError('Referência inválida; Lucena e Philidor pertencem ao tema rook.');
    return this.bounded(async deadline => {
      const seen = new Set<string>(lesson ? [] : [...(this.recent.get(theme) || []), ...(excludeFen ? [excludeFen] : [])]);
      let probes = 0; let visited = 0;
      for (const candidate of lesson ? [lesson.fen] : this.pool(theme)) {
        if (++visited > LIMITS.candidates || probes >= LIMITS.probes || Date.now() >= deadline) break;
        let game: Chess;
        try { game = legalPosition(candidate); } catch { continue; }
        if (seen.has(game.fen())) continue;
        seen.add(game.fen()); probes++;
        const position = await this.probe(game, deadline);
        const objective = position.outcome;
        if ((objective !== 'win' && objective !== 'draw') || !position.bestMove || (lesson && lesson.objective !== objective)) continue;
        const recent = this.recent.get(theme) || [];
        this.recent.set(theme, [...recent, game.fen()].slice(-32));
        return { fen: game.fen(), side: game.turn(), theme, objective, title: lesson?.title || TITLES[theme],
          instructions: [objective === 'win' ? 'Converta a vitória contra a melhor defesa.' : 'Mantenha o empate contra jogo perfeito.', ...(lesson?.instructions || INSTRUCTIONS[theme])],
          source: lesson ? { kind: 'reference', name: 'Lichess Practice · Basic Rook Endgames', url: lesson.url } : { kind: 'generated', name: 'Composição gerada pelo Zav Chess; objetivo verificado pela tablebase' },
          tablebase: position };
      }
      throw new TrainingError('Nenhuma nova posição com objetivo certificado foi encontrada neste lote limitado. Tente gerar outro.', 503);
    }, LIMITS.generationMs);
  }
  async position(input: TrainingInput): Promise<Position> {
    const game = replay(input);
    return this.bounded(deadline => this.probe(game, deadline), LIMITS.requestMs);
  }
  async turn(input: TrainingInput & { move: string }) {
    const game = replay(input);
    if (input.history.length + 2 > LIMITS.history) throw new TrainingError('Limite do treino atingido. Recomece ou gere outro final.');
    const student = new Chess(input.initialFen).turn();
    if (game.turn() !== student || game.isGameOver()) throw new TrainingError('Aguarde sua vez ou recomece o treino encerrado.');
    // Validate the student move before any network call.
    play(game, input.move); game.undo();
    return this.bounded(async deadline => {
      const before = await this.probe(game, deadline);
      play(game, input.move);
      const after = await this.probe(game, deadline);
      const feedback = moveFeedback(fromPerspective(before, student), fromPerspective(after, student));
      const history = [...input.history, input.move];
      let reply: string | null = null;
      if (!after.terminal) {
        if (!after.bestMove) throw new TrainingError('A tablebase não certifica uma melhor resposta. A posição anterior foi preservada.', 503);
        reply = after.bestMove;
        play(game, reply); history.push(reply);
      }
      const position = reply ? await this.probe(game, deadline) : after;
      return { history, reply, feedback, position };
    }, LIMITS.turnMs);
  }
}
