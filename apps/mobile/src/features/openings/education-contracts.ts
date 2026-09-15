// Additive response overlay; shared api/types.ts remains owned by the parent.
import type { Opening, OpeningFamilyDetail } from '../../api/types';

export type StudySide = 'w' | 'b';
export interface OpeningAttempt {
  moves: string[]; side: StudySide; hintUsed: boolean; mistakes: number; requestId: string;
}
export interface OpeningAttemptResult { completed: true; nextReviewAt: string; reviewId: string }
export interface GuideLine {
  openingId: string; name: string; pgn: string; moves: string[]; fen: string;
  annotations: { ply: number; uci: string; san: string; text: string }[];
}
export interface GuideContent {
  whitePlan: string[]; blackPlan: string[]; commonMistakes: string[];
  reviewStatus: 'human-review-pending';
  sources: { title: string; url: string; scope: 'identity-and-moves'; openingId: string }[];
}
export interface FamilyGuideContent extends GuideContent {
  family: string; displayName: string; overview: string; aliases: string[]; lessonIds: string[];
  referenceLine: GuideLine;
}
export interface VariationGuideContent extends GuideContent {
  id: string; name: string; title: string; aliases: string[]; distinction: string; line: GuideLine;
}
export interface OpeningEducation {
  version: 1; familyGuide: FamilyGuideContent | null; variationGuide: VariationGuideContent | null;
  coverage: 'variation' | 'family-only' | 'catalog-only'; notice: string;
}
export type EducationalOpening = Opening & { education?: OpeningEducation };
export type EducationalFamily = OpeningFamilyDetail & { education?: OpeningEducation };
