export interface StudySuggestion {
  kind: 'lesson' | 'puzzle' | 'opening'; contentId: string; title: string; reason: string; dueAt?: string; side?: string;
}
export interface StudyPlan {
  rating: number; recommendedBand: { min: number; max: number }; dueCount: number; nextReviewAt: string | null; items: StudySuggestion[];
}
export interface StudyTopic { theme: string; sessions: number; clean: number; mistakes: number; hints: number; accuracy: number }
export interface StudyReport {
  since: string; sessions: number; cleanSessions: number; solvedPuzzles: number; studiedOpenings: number; dueReviews: number;
  daily: { date: string; sessions: number; rating: number }[]; strengths: StudyTopic[]; practiceNext: StudyTopic[]; themes: StudyTopic[]; note: string;
}
