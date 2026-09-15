import type { Color } from 'chess.js';
import type { EngineDifficulty } from './engine-strength';

/** Stockfish's unchanged position contract: score belongs to the side to move. */
export type EngineScore = { type: 'cp' | 'mate'; value: number };
export interface EngineAnalysis {
  fen: string; bestMove: string | null; score: EngineScore; depth: number; pv: string[]; engine: string;
}
export interface EngineMove {
  fen: string; bestMove: string | null; engine: string; difficulty: EngineDifficulty; elo: number | null;
}
export type DrawReason = 'stalemate' | 'insufficient-material' | 'fifty-move' | 'threefold-repetition' | 'draw';
/** Both scores belong to MoveAnalysis.perspective; winner disambiguates mate 0. */
export type CoachScore = { type: 'cp'; value: number }
  | { type: 'mate'; value: number; winner: Color }
  | { type: 'draw'; value: 0; reason: DrawReason };
export type MoveClassification = 'best' | 'good' | 'inaccuracy' | 'mistake' | 'blunder';
export interface PositionAssessment {
  fen: string; turn: Color; score: CoachScore; depth: number; engine: string;
}
export interface AnalysisFact {
  kind: 'move' | 'capture' | 'check' | 'checkmate' | 'draw' | 'castle' | 'promotion';
  text: string;
  source: 'played-move' | 'alternative-pv' | 'continuation-pv';
  /** One-based ply in the corresponding line, with board state AFTER the move. */
  ply: number; fen: string; uci: string;
}
export interface AnalysisLine {
  initialFen: string; moves: string[]; sans: string[]; positions: string[]; facts: AnalysisFact[];
  truncated: boolean;
}
export interface MoveAnalysis {
  version: 1; fen: string; afterFen: string; move: string; san: string; perspective: Color;
  before: PositionAssessment; after: PositionAssessment;
  /** No conversion of mate scores to fictional centipawns. */
  loss: {
    centipawns: number | null; signedCentipawns: number | null;
    mate: 'none' | 'delivered' | 'allowed' | 'missed' | 'kept' | 'still-losing' | 'escaped' | 'found';
  };
  classification: MoveClassification;
  classificationReason: string;
  bestMove: string; matchesBestMove: boolean;
  alternative: AnalysisLine;
  continuation: AnalysisLine;
  explanation: string[]; facts: AnalysisFact[];
  lesson: { concept: string; plan: string; evidence: AnalysisFact[] };
  method: {
    name: 'stockfish-facts-v1'; requestedDepth: number;
    thresholds: { goodMaxCp: 50; inaccuracyMaxCp: 100; mistakeMaxCp: 250 };
    limitations: string[];
  };
}
