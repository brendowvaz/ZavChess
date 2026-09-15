const DAY = 86_400_000;
const INTERVALS = [1, 3, 7, 14, 30, 60];
export type Recall = 'again' | 'hard' | 'good';

export function nextReview(previous: { stage: number; dueAt: Date } | null, recall: Recall, now: Date) {
  if (recall === 'again') return { stage: 0, dueAt: new Date(now.getTime() + 10 * 60_000) };
  if (recall === 'hard') return { stage: 0, dueAt: new Date(now.getTime() + DAY) };
  // Early repetition is welcome, but cannot postpone an already scheduled review.
  if (previous && previous.dueAt > now) return previous;
  const stage = previous ? Math.min(previous.stage + 1, INTERVALS.length - 1) : 0;
  return { stage, dueAt: new Date(now.getTime() + INTERVALS[stage]! * DAY) };
}

export function trainingBand(rating: number) {
  return { min: Math.max(0, rating - 200), max: Math.min(4000, rating + 200) };
}

export function studyDate(date: Date) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}
