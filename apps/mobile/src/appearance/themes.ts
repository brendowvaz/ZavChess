export const pieceStyles = [
  { id: 'classic', name: 'Clássico', description: 'Curvas elegantes e detalhes tradicionais.' },
  { id: 'geometric', name: 'Geométrico', description: 'Formas marcantes e linhas simples.' },
  { id: 'rounded', name: 'Arredondado', description: 'Contornos suaves e proporções amigáveis.' },
  { id: 'sculpted', name: 'Esculpido', description: 'Facetas amplas e recortes marcantes.' },
] as const;
export type PieceStyle = typeof pieceStyles[number]['id'];
export const boardThemes = {
  sage: { name: 'Sálvia', description: 'Verde e creme.', light: '#E9E9D5', dark: '#819878', labelLight: '#42593D', labelDark: '#FFFFFF', selected: '#E8C16E', previous: '#C3C78B', check: '#DC8E80', marker: '#173B30' },
  wood: { name: 'Madeira', description: 'Tons quentes de areia e nogueira.', light: '#F0D9B5', dark: '#AD805C', labelLight: '#65452C', labelDark: '#FFFFFF', selected: '#EBC769', previous: '#D8C18C', check: '#E28D7C', marker: '#4A3020' },
  blue: { name: 'Azul', description: 'Azul sereno com casas claras.', light: '#E4EDF2', dark: '#7797B0', labelLight: '#36566F', labelDark: '#FFFFFF', selected: '#E8C16E', previous: '#B6CED1', check: '#DD928A', marker: '#203D55' },
  graphite: { name: 'Grafite', description: 'Cinzas neutros e contraste definido.', light: '#E0E2E2', dark: '#737C80', labelLight: '#40494D', labelDark: '#FFFFFF', selected: '#E8C16E', previous: '#C4C59A', check: '#DD928A', marker: '#253136' },
} as const;
export type BoardTheme = keyof typeof boardThemes;
export type Appearance = { pieceStyle: PieceStyle; boardTheme: BoardTheme; autoAdvance: boolean; vibration: boolean; colorBlind: boolean; showLegalMoves: boolean; learningTrack: 'start' | 'improve' };
export const defaultAppearance: Appearance = { pieceStyle: 'geometric', boardTheme: 'sage', autoAdvance: true, vibration: false, colorBlind: false, showLegalMoves: true, learningTrack: 'improve' };

// Validate fields independently so older or damaged settings cannot break a board.
export function parseAppearance(raw: string | null): Appearance {
  try {
    const value: unknown = raw ? JSON.parse(raw) : null;
    if (!value || typeof value !== 'object') return { ...defaultAppearance };
    const saved = value as Record<string, unknown>;
    return {
      pieceStyle: pieceStyles.some(style => style.id === saved.pieceStyle) ? saved.pieceStyle as PieceStyle : defaultAppearance.pieceStyle,
      boardTheme: typeof saved.boardTheme === 'string' && Object.hasOwn(boardThemes, saved.boardTheme) ? saved.boardTheme as BoardTheme : defaultAppearance.boardTheme,
      autoAdvance: typeof saved.autoAdvance === 'boolean' ? saved.autoAdvance : defaultAppearance.autoAdvance,
      vibration: typeof saved.vibration === 'boolean' ? saved.vibration : defaultAppearance.vibration,
      colorBlind: typeof saved.colorBlind === 'boolean' ? saved.colorBlind : defaultAppearance.colorBlind,
      showLegalMoves: typeof saved.showLegalMoves === 'boolean' ? saved.showLegalMoves : defaultAppearance.showLegalMoves,
      learningTrack: saved.learningTrack === 'start' ? 'start' : 'improve',
    };
  } catch { return { ...defaultAppearance }; }
}
