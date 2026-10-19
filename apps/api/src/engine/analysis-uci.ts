import type { EngineScore } from './analysis-contract';

/** Bounds and other MultiPV lines are not exact estimates of the primary line. */
export function parseExactUciInfo(line: string): { score: EngineScore; depth: number; pv: string[] } | null {
  if (!line.startsWith('info ') || line.startsWith('info string ') || /\b(?:lowerbound|upperbound)\b/.test(line)) return null;
  const multipv = line.match(/\bmultipv (\d+)\b/);
  if (multipv && multipv[1] !== '1') return null;
  const score = line.match(/\bscore (cp|mate) (-?\d+)\b/);
  const depth = line.match(/\bdepth (\d+)\b/);
  const pv = line.match(/\bpv (.+)$/)?.[1].trim().split(/\s+/);
  if (!score || !depth || !pv?.length || !Number.isSafeInteger(Number(score[2]))) return null;
  return { score: { type: score[1] as EngineScore['type'], value: Number(score[2]) }, depth: Number(depth[1]), pv };
}

export function parseExactMultiPv(line: string) {
  const rank = Number(line.match(/\bmultipv (\d+)\b/)?.[1] ?? '1');
  if (!Number.isInteger(rank) || rank < 1 || rank > 3) return null;
  const exact = parseExactUciInfo(line.replace(/\bmultipv \d+\b/, 'multipv 1'));
  return exact ? { ...exact, rank } : null;
}
