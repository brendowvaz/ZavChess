import type { TablebaseCategory } from '../api/types';

export function categoryLabel(category: TablebaseCategory | string): string {
  const labels: Record<string, string> = {
    win: 'Vitória com jogo perfeito', loss: 'Derrota com jogo perfeito', draw: 'Empate com jogo perfeito',
    'cursed-win': 'Vitória teórica, mas empate pela regra dos 50 lances',
    'blessed-loss': 'Derrota teórica, mas empate pela regra dos 50 lances',
    'maybe-win': 'Vitória incerta pela regra dos 50 lances', 'maybe-loss': 'Derrota incerta pela regra dos 50 lances',
    unknown: 'Avaliação desconhecida',
  };
  return labels[category] ?? `Avaliação: ${category}`;
}
export function invertCategory(category: TablebaseCategory): TablebaseCategory {
  const inverse: Record<TablebaseCategory, TablebaseCategory> = {
    win: 'loss', loss: 'win', draw: 'draw', 'cursed-win': 'blessed-loss', 'blessed-loss': 'cursed-win',
    'maybe-win': 'maybe-loss', 'maybe-loss': 'maybe-win', unknown: 'unknown',
  };
  return inverse[category] ?? 'unknown';
}
