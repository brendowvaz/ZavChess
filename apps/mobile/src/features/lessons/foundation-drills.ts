import type { LessonBoardExercise } from './board-exercises';
const start = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
export const foundationDrills: Record<string, LessonBoardExercise[]> = {
  'movimento-da-torre': [
    { fen: '4k3/8/8/8/3R4/8/8/4K3 w - - 0 1', moves: ['d4h4'], prompt: 'Agora use uma fileira: leve a torre de d4 até h4.' },
    { fen: '4k3/8/8/3P4/3R4/8/8/4K3 w - - 0 1', moves: ['d4a4'], prompt: 'Seu peão bloqueia a coluna. Encontre o caminho até a4.' },
  ],
  'movimento-do-bispo': [
    { fen: '4k3/8/8/8/8/8/8/2B1K3 w - - 0 1', moves: ['c1a3'], prompt: 'Explore a outra diagonal: leve o bispo de c1 até a3.' },
    { fen: '4k3/8/8/6r1/8/8/8/2B1K3 w - - 0 1', moves: ['c1g5'], prompt: 'Capture a torre na diagonal. O bispo mantém a cor das casas.' },
  ],
  'movimento-da-dama': [
    { fen: '4k3/8/8/8/3Q4/8/8/4K3 w - - 0 1', moves: ['d4h8'], prompt: 'Desta vez, use a diagonal até h8.' },
    { fen: '4k3/8/8/8/3Q4/8/8/4K3 w - - 0 1', moves: ['d4a4'], prompt: 'Combine os movimentos: alcance a4 pela fileira.' },
  ],
  'movimento-do-cavalo': [
    { fen: start, moves: ['b1c3'], prompt: 'O outro cavalo também salta. Leve o cavalo de b1 para c3.' },
    { fen: '4k3/8/8/8/3N4/8/8/4K3 w - - 0 1', moves: ['d4e6'], prompt: 'Partindo do centro, encontre o salto de d4 para e6.' },
  ],
  'movimento-do-rei': [
    { fen: '8/8/4k3/8/4K3/8/8/8 w - - 0 1', moves: ['e4f4'], prompt: 'Vá até f4 sem entrar nas casas atacadas pelo outro rei.' },
    { fen: '8/8/4k3/8/4K3/8/8/8 w - - 0 1', moves: ['e4e3'], prompt: 'O rei também recua: mova uma casa até e3.' },
  ],
  'movimento-do-peao': [
    { fen: start, moves: ['e2e3'], prompt: 'No primeiro movimento, o peão pode avançar uma casa. Jogue e3.' },
    { fen: start, moves: ['e2e4'], prompt: 'Ou duas casas, com caminho livre: jogue e4.' },
  ],
};
