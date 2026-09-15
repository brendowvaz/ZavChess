import type { EngineScore } from './analysis-contract';
import type { MoveWeakening } from './engine-strength';

export type RankedEngineMove = {
  move: string;
  multipv: number;
  depth: number;
  score: EngineScore;
};

export function parseRankedEngineMove(line: string): RankedEngineMove | null {
  if (!line.startsWith('info ') || line.startsWith('info string ') || /\b(?:lowerbound|upperbound)\b/.test(line)) return null;
  const multipv = Number(line.match(/\bmultipv (\d+)\b/)?.[1]);
  const depth = Number(line.match(/\bdepth (\d+)\b/)?.[1]);
  const score = line.match(/\bscore (cp|mate) (-?\d+)\b/);
  const move = line.match(/\bpv ([a-h][1-8][a-h][1-8][qrbn]?)(?:\s|$)/)?.[1];
  if (!Number.isSafeInteger(multipv) || multipv < 1 || !Number.isSafeInteger(depth) || depth < 1 || !score || !move) return null;
  return { move, multipv, depth, score: { type: score[1] as EngineScore['type'], value: Number(score[2]) } };
}

function scoreValue(score: EngineScore) {
  if (score.type === 'cp') return score.value;
  return score.value > 0 ? 100_000 - Math.min(score.value, 999) * 100 : -100_000 - Math.max(score.value, -999) * 100;
}

/** Selects a legal engine candidate around a sampled centipawn-loss target. */
export function chooseWeakenedMove(
  candidates: Iterable<RankedEngineMove>,
  weakening: MoveWeakening,
  random: () => number = Math.random,
): string | null {
  const ranked = [...candidates]
    .filter((candidate, index, all) => all.findIndex(other => other.move === candidate.move) === index)
    .sort((a, b) => a.multipv - b.multipv);
  if (!ranked.length) return null;
  const best = ranked.find(candidate => candidate.multipv === 1) ?? ranked.reduce((a, b) => scoreValue(a.score) >= scoreValue(b.score) ? a : b);
  if (random() < weakening.bestMoveChance || ranked.length === 1) return best.move;
  const bestScore = scoreValue(best.score);
  const sampledLoss = weakening.minLossCp + random() * (weakening.maxLossCp - weakening.minLossCp);
  const alternatives = ranked.filter(candidate => candidate.move !== best.move);
  return alternatives.reduce((chosen, candidate) => {
    const distance = Math.abs(Math.max(0, bestScore - scoreValue(candidate.score)) - sampledLoss);
    const chosenDistance = Math.abs(Math.max(0, bestScore - scoreValue(chosen.score)) - sampledLoss);
    return distance < chosenDistance ? candidate : chosen;
  }).move;
}
