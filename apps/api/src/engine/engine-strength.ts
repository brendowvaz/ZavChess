export const ENGINE_DIFFICULTIES = [
  'apprentice',
  'beginner',
  'casual',
  'intermediate',
  'advanced',
  'candidate_master',
  'master',
  'international_master',
  'grandmaster',
  'world_champion',
  'machine',
] as const;
export type EngineDifficulty = typeof ENGINE_DIFFICULTIES[number];

export type MoveWeakening = {
  multiPv: number;
  bestMoveChance: number;
  minLossCp: number;
  maxLossCp: number;
};

type DifficultyProfile = {
  estimatedRating: { min: number | null; max: number };
  skillLevel: number;
  depth: number | null;
  movetimeMs: number;
  targetElo: number | null;
  weakening: MoveWeakening | null;
};

/**
 * Ratings are product targets. Below Stockfish's native UCI_Elo floor, a
 * MultiPV search is followed by controlled selection of an inferior legal
 * move. Higher profiles use Stockfish's calibrated UCI_Elo control directly.
 */
export const ENGINE_DIFFICULTY_PROFILES: Record<EngineDifficulty, DifficultyProfile> = {
  apprentice: {
    estimatedRating: { min: null, max: 499 }, skillLevel: 0, depth: 5, movetimeMs: 50, targetElo: null,
    weakening: { multiPv: 64, bestMoveChance: 0.01, minLossCp: 500, maxLossCp: 2_000 },
  },
  beginner: {
    estimatedRating: { min: 500, max: 600 }, skillLevel: 0, depth: 5, movetimeMs: 100, targetElo: null,
    weakening: { multiPv: 64, bestMoveChance: 0.04, minLossCp: 300, maxLossCp: 1_200 },
  },
  casual: {
    estimatedRating: { min: 800, max: 800 }, skillLevel: 0, depth: 5, movetimeMs: 150, targetElo: null,
    weakening: { multiPv: 48, bestMoveChance: 0.10, minLossCp: 150, maxLossCp: 700 },
  },
  intermediate: {
    estimatedRating: { min: 1_000, max: 1_200 }, skillLevel: 3, depth: 5, movetimeMs: 200, targetElo: null,
    weakening: { multiPv: 32, bestMoveChance: 0.22, minLossCp: 60, maxLossCp: 300 },
  },
  advanced: {
    estimatedRating: { min: 1_400, max: 1_500 }, skillLevel: 20, depth: null, movetimeMs: 1_200,
    targetElo: 1_450, weakening: null,
  },
  candidate_master: {
    estimatedRating: { min: 1_800, max: 1_800 }, skillLevel: 20, depth: null, movetimeMs: 1_500,
    targetElo: 1_800, weakening: null,
  },
  master: {
    estimatedRating: { min: 2_000, max: 2_100 }, skillLevel: 20, depth: null, movetimeMs: 1_800,
    targetElo: 2_050, weakening: null,
  },
  international_master: {
    estimatedRating: { min: 2_300, max: 2_400 }, skillLevel: 20, depth: null, movetimeMs: 2_200,
    targetElo: 2_350, weakening: null,
  },
  grandmaster: {
    estimatedRating: { min: 2_500, max: 2_600 }, skillLevel: 20, depth: null, movetimeMs: 2_800,
    targetElo: 2_550, weakening: null,
  },
  world_champion: {
    estimatedRating: { min: 2_700, max: 2_800 }, skillLevel: 20, depth: null, movetimeMs: 3_500,
    targetElo: 2_750, weakening: null,
  },
  machine: {
    estimatedRating: { min: 2_900, max: 3_000 }, skillLevel: 20, depth: null, movetimeMs: 5_000,
    targetElo: 2_950, weakening: null,
  },
};

export type UciStrengthCapabilities = {
  limitStrength: boolean;
  skillLevel: boolean;
  eloRange: { min: number; max: number } | null;
};

export function emptyStrengthCapabilities(): UciStrengthCapabilities {
  return { limitStrength: false, skillLevel: false, eloRange: null };
}

export function readStrengthOption(line: string, current: UciStrengthCapabilities): UciStrengthCapabilities {
  if (/^option name UCI_LimitStrength type check\b/.test(line)) return { ...current, limitStrength: true };
  if (/^option name Skill Level type spin\b/.test(line)) return { ...current, skillLevel: true };
  const elo = line.match(/^option name UCI_Elo type spin\b.*\bmin (\d+) max (\d+)$/);
  return elo ? { ...current, eloRange: { min: Number(elo[1]), max: Number(elo[2]) } } : current;
}

export function strengthSettings(difficulty: EngineDifficulty, capabilities: UciStrengthCapabilities) {
  const profile = ENGINE_DIFFICULTY_PROFILES[difficulty];
  if (profile.targetElo !== null) {
    if (!capabilities.limitStrength || !capabilities.eloRange) return null;
    const elo = Math.min(capabilities.eloRange.max, Math.max(capabilities.eloRange.min, profile.targetElo));
    return {
      ...profile,
      elo,
      commands: [
        'setoption name MultiPV value 1',
        'setoption name UCI_LimitStrength value true',
        `setoption name UCI_Elo value ${elo}`,
      ],
    };
  }
  if (!capabilities.skillLevel || !profile.weakening) return null;
  return {
    ...profile,
    elo: null,
    commands: [
      ...(capabilities.limitStrength ? ['setoption name UCI_LimitStrength value false'] : []),
      `setoption name Skill Level value ${profile.skillLevel}`,
      `setoption name MultiPV value ${profile.weakening.multiPv}`,
    ],
  };
}
