/** Feature-owned response types; independent of the shared API types. */
import type { EngineDifficulty } from './engine-difficulty';

export type AnalysisSide = 'w' | 'b';
export interface PositionAnalysis {
  fen: string; bestMove: string | null; score: { type: 'cp' | 'mate'; value: number };
  depth: number; pv: string[]; engine: string;
}
export interface EngineMove {
  fen: string; bestMove: string | null; engine: string; difficulty: EngineDifficulty; elo: number | null;
}
export type DrawReason = 'stalemate' | 'insufficient-material' | 'fifty-move' | 'threefold-repetition' | 'draw';
export type CoachScore = { type: 'cp'; value: number }
  | { type: 'mate'; value: number; winner: AnalysisSide }
  | { type: 'draw'; value: 0; reason: DrawReason };
export type MoveClassification = 'best' | 'good' | 'inaccuracy' | 'mistake' | 'blunder';
export interface PositionAssessment {
  fen: string; turn: AnalysisSide; score: CoachScore; depth: number; engine: string;
}
export interface AnalysisFact {
  kind: 'move' | 'capture' | 'check' | 'checkmate' | 'draw' | 'castle' | 'promotion';
  text: string; source: 'played-move' | 'alternative-pv' | 'continuation-pv';
  ply: number; fen: string; uci: string;
}
export interface AnalysisLine {
  initialFen: string; moves: string[]; sans: string[]; positions: string[]; facts: AnalysisFact[]; truncated: boolean;
}
export interface MoveAnalysis {
  version: 1; fen: string; afterFen: string; move: string; san: string; perspective: AnalysisSide;
  before: PositionAssessment; after: PositionAssessment;
  loss: {
    centipawns: number | null; signedCentipawns: number | null;
    mate: 'none' | 'delivered' | 'allowed' | 'missed' | 'kept' | 'still-losing' | 'escaped' | 'found';
  };
  classification: MoveClassification; classificationReason: string;
  bestMove: string; matchesBestMove: boolean;
  alternative: AnalysisLine; continuation: AnalysisLine;
  explanation: string[]; facts: AnalysisFact[];
  lesson: { concept: string; plan: string; evidence: AnalysisFact[] };
  method: {
    name: 'stockfish-facts-v1'; requestedDepth: number;
    thresholds: { goodMaxCp: 50; inaccuracyMaxCp: 100; mistakeMaxCp: 250 };
    limitations: string[];
  };
}
