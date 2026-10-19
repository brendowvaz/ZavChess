export interface StudySuggestion {
  kind: 'lesson' | 'puzzle' | 'opening'; contentId: string; title: string; reason: string; dueAt?: string; side?: string; focusPly?: number;
}
export interface RepertoireDecision {
  key: string; fen: string; ply: number; uci: string; san: string; explanation: string;
  masteryPoints?: number; dueAt?: string | null;
}
export interface RepertoireLine {
  openingId: string; name: string; eco: string; moveCount: number; decisions: RepertoireDecision[];
}
export interface RepertoireCourse {
  id: string; title: string; subtitle: string; side: 'w' | 'b'; level: 'beginner' | 'intermediate'; goals: string[];
  lineCount: number; positionCount: number; lines: RepertoireLine[]; selected: boolean;
  learnedPositions: number; duePositions: number; mastery: number;
  rank?: string; points?: number; maxPoints?: number;
}
export interface StudyPlan {
  rating: number; recommendedBand: { min: number; max: number }; dueCount: number; nextReviewAt: string | null; items: StudySuggestion[];
}
export interface StudyTopic { theme: string; sessions: number; clean: number; mistakes: number; hints: number; accuracy: number }
export interface StudyReport {
  since: string; sessions: number; cleanSessions: number; solvedPuzzles: number; studiedOpenings: number; dueReviews: number;
  daily: { date: string; sessions: number; rating: number }[]; strengths: StudyTopic[]; practiceNext: StudyTopic[]; themes: StudyTopic[]; note: string;
}
