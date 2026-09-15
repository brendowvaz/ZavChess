// Feature-owned wire contracts; independent of shared API types/chess helpers.
export type EndgameTheme = 'queen' | 'rook' | 'pawn' | 'promotion';
export type Side = 'w' | 'b';
export type Outcome = 'win' | 'draw' | 'loss';
export type Category = Outcome | 'cursed-win' | 'blessed-loss' | 'maybe-win' | 'maybe-loss' | 'syzygy-win' | 'syzygy-loss' | 'unknown';
export interface TrainingPosition {
  fen: string; turn: Side; category: Category; outcome: Outcome | null; dtz: number | null; dtm: number | null;
  moves: { uci: string; san: string; category: Category; outcome: Outcome | null; dtz: number | null }[];
  bestMove: string | null;
  terminal: 'checkmate' | 'stalemate' | 'insufficient-material' | 'threefold-repetition' | 'fifty-moves' | null;
  halfmoveClock: number; rule50: 'claim-at-100-plies'; source: { kind: 'tablebase' | 'rules'; name: string; url: string };
}
export interface TrainingExercise {
  fen: string; side: Side; theme: EndgameTheme; objective: 'win' | 'draw'; title: string; instructions: string[];
  source: { kind: 'generated' | 'reference'; name: string; url?: string }; tablebase: TrainingPosition;
}
export interface TrainingFeedback { code: 'lost-win' | 'lost-draw' | 'preserved' | 'uncertain'; message: string }
export interface TrainingTurn { history: string[]; reply: string | null; position: TrainingPosition; feedback: TrainingFeedback }
export interface CatalogEndgame {
  id: string; title: string; description: string; fen: string; goal: string; side: Side;
  level: 'beginner' | 'intermediate' | 'advanced'; tips: string[];
}
