export type Side = 'w' | 'b';
export type Level = 'beginner' | 'intermediate' | 'advanced';
export interface User { id: string; name: string; email: string; rating: number; xp: number }
export interface Session { token: string; user: User }
export interface Page<T> { items: T[]; total: number; page: number; pageSize: number }
export interface Progress { completedLessonIds: string[]; solvedPuzzleIds: string[] }
export interface Dashboard {
  user: User; completedLessons: number; solvedPuzzles: number; streak: number;
  recentActivity: { id: string; type: string; title: string; createdAt: string }[];
  counts: { lessons: number; openings: number; puzzles: number; endgames: number };
}
export interface Lesson {
  id: string; slug: string; title: string; category: 'fundamentals' | 'tactics' | 'openings' | 'endgames';
  level: Level; description: string; sortOrder: number; minutes: number;
}
export interface LessonDetail extends Lesson {
  steps: { title: string; text: string; fen?: string; moves?: string[] }[];
  quiz: { question: string; options: string[] };
}
export interface LessonResult { correct: boolean; explanation: string; xpEarned: number }
export interface Opening { id: string; eco: string; name: string; family: string; pgn: string; fen: string; moves: string[]; sourceUrl: string }
export interface Puzzle { id: string; rating: number; themes: string[]; fen: string; sourceUrl: string }
export interface PuzzleResult { status: 'correct' | 'incorrect' | 'solved'; fen: string; reply?: string; expectedMove?: string; xpEarned?: number }
export interface Endgame { id: string; slug: string; title: string; description: string; fen: string; goal: string; level: Level; side: Side; tips: string[] }
export type TablebaseCategory = 'win' | 'loss' | 'draw' | 'cursed-win' | 'blessed-loss' | 'unknown' | 'maybe-win' | 'maybe-loss';
export interface Tablebase {
  category: TablebaseCategory; dtz: number | null; dtm: number | null;
  moves: { uci: string; san: string; category: TablebaseCategory; dtz: number | null }[];
}
export interface Analysis { fen: string; bestMove: string | null; score: { type: 'cp' | 'mate'; value: number }; depth: number; pv: string[]; engine: string }
