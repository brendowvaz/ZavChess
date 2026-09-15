import type { Square } from 'chess.js';

export type AnnotationTone = 'green' | 'red' | 'yellow' | 'blue';
export type SquareAnnotation = { square: Square; tone: AnnotationTone };
export type ArrowAnnotation = { from: Square; to: Square; tone: AnnotationTone };
export type BoardPoint = { x: number; y: number };

export const annotationColors: Record<AnnotationTone, string> = {
  green: '#7FB33D',
  red: '#E76552',
  yellow: '#F2B321',
  blue: '#3FA7C9',
};

export const annotationToneLabels: Record<AnnotationTone, string> = {
  green: 'verde', red: 'vermelho', yellow: 'amarelo', blue: 'azul',
};

export function annotationToneFromModifiers(keys: { ctrlKey?: boolean; altKey?: boolean; shiftKey?: boolean }): AnnotationTone {
  if (keys.shiftKey) return 'red';
  if (keys.ctrlKey) return 'yellow';
  if (keys.altKey) return 'blue';
  return 'green';
}

export function toggleSquareAnnotation(items: SquareAnnotation[], square: Square, tone: AnnotationTone) {
  const existing = items.find(item => item.square === square);
  const withoutSquare = items.filter(item => item.square !== square);
  return existing?.tone === tone ? withoutSquare : [...withoutSquare, { square, tone }];
}

export function toggleArrowAnnotation(items: ArrowAnnotation[], from: Square, to: Square, tone: AnnotationTone) {
  const existing = items.find(item => item.from === from && item.to === to);
  const withoutArrow = items.filter(item => item.from !== from || item.to !== to);
  return existing?.tone === tone ? withoutArrow : [...withoutArrow, { from, to, tone }];
}

export function arrowGeometry(from: Square, to: Square, files: string[], ranks: number[], squareSize: number) {
  const fromColumn = files.indexOf(from[0]!);
  const toColumn = files.indexOf(to[0]!);
  const fromRow = ranks.indexOf(Number(from[1]));
  const toRow = ranks.indexOf(Number(to[1]));
  if ([fromColumn, toColumn, fromRow, toRow].some(value => value < 0) || squareSize <= 0) return null;

  const start = { x: (fromColumn + 0.5) * squareSize, y: (fromRow + 0.5) * squareSize };
  const end = { x: (toColumn + 0.5) * squareSize, y: (toRow + 0.5) * squareSize };
  const columns = Math.abs(toColumn - fromColumn);
  const rows = Math.abs(toRow - fromRow);
  const knight = (columns === 2 && rows === 1) || (columns === 1 && rows === 2);
  const turn: BoardPoint | undefined = knight
    ? columns === 2 ? { x: end.x, y: start.y } : { x: start.x, y: end.y }
    : undefined;
  const finalSegmentStart = turn ?? start;
  const dx = end.x - finalSegmentStart.x;
  const dy = end.y - finalSegmentStart.y;
  const length = Math.hypot(dx, dy);
  if (!length) return null;
  const unit = { x: dx / length, y: dy / length };
  const headLength = squareSize * 0.4;
  const headHalfWidth = squareSize * 0.29;
  const base = { x: end.x - unit.x * headLength, y: end.y - unit.y * headLength };
  const perpendicular = { x: -unit.y, y: unit.x };
  const head = [
    end,
    { x: base.x + perpendicular.x * headHalfWidth, y: base.y + perpendicular.y * headHalfWidth },
    { x: base.x - perpendicular.x * headHalfWidth, y: base.y - perpendicular.y * headHalfWidth },
  ];
  const path = `M ${start.x} ${start.y}${turn ? ` L ${turn.x} ${turn.y}` : ''} L ${base.x} ${base.y}`;
  return { start, end, turn, path, head, knight };
}
