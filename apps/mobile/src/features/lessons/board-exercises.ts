export type LessonBoardExercise = { fen: string; moves: string[]; prompt: string };
const DEFAULT_POSITION = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

/** Board-first replacements for lessons whose editorial source predates move drills. */
export const lessonBoardExercises: Record<string, LessonBoardExercise> = {
  'lesson-mapa-do-tabuleiro': { fen: DEFAULT_POSITION, moves: ['e2e4'], prompt: 'Leve o peão de e2 até e4 e acompanhe as coordenadas.' },
  'lesson-objetivo-do-jogo': { fen: '7k/8/5KQ1/8/8/8/8/8 w - - 0 1', moves: ['g6g7'], prompt: 'Encontre o lance que dá xeque-mate.' },
  'lesson-movimento-da-torre': { fen: '4k3/8/8/8/3R4/8/8/4K3 w - - 0 1', moves: ['d4d8'], prompt: 'Mova a torre de d4 até d8 pela coluna aberta.' },
  'lesson-movimento-do-bispo': { fen: '4k3/8/8/8/8/8/8/2B1K3 w - - 0 1', moves: ['c1g5'], prompt: 'Leve o bispo pela diagonal de c1 até g5.' },
  'lesson-movimento-da-dama': { fen: '4k3/8/8/8/3Q4/8/8/4K3 w - - 0 1', moves: ['d4d8'], prompt: 'Use uma linha reta da dama para dar xeque em d8.' },
  'lesson-movimento-do-cavalo': { fen: DEFAULT_POSITION, moves: ['g1f3'], prompt: 'Desenvolva o cavalo de g1 para f3 com seu salto em L.' },
  'lesson-movimento-do-rei': { fen: '8/8/4k3/8/4K3/8/8/8 w - - 0 1', moves: ['e4d3'], prompt: 'Mova o rei para d3, mantendo distância segura do rei adversário.' },
  'lesson-movimento-do-peao': { fen: '4k3/8/8/3p4/4P3/8/8/4K3 w - - 0 1', moves: ['e4d5'], prompt: 'Capture diagonalmente o peão preto em d5.' },
  'lesson-capturas-e-defensores': { fen: '4k3/8/8/3r4/3Q4/8/8/4K3 w - - 0 1', moves: ['d4d5'], prompt: 'Confira a posição resultante e capture a torre sem defesa.' },
  'lesson-responder-ao-xeque': { fen: '4r1k1/8/8/8/8/8/8/4K3 w - - 0 1', moves: ['e1d2'], prompt: 'Seu rei está em xeque. Leve-o para uma casa segura.' },
  'lesson-mate-e-afogamento': { fen: '7k/8/5KQ1/8/8/8/8/8 w - - 0 1', moves: ['g6g7'], prompt: 'Dê mate sem deixar a posição terminar em afogamento.' },
  'lesson-roque-com-seguranca': { fen: 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1', moves: ['e1g1'], prompt: 'Faça o roque pequeno das brancas.' },
  'lesson-captura-en-passant': { fen: '4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1', moves: ['e5d6'], prompt: 'Aproveite imediatamente a captura en passant.' },
  'lesson-escolha-da-promocao': { fen: '4k3/P7/8/8/8/8/8/4K3 w - - 0 1', moves: ['a7a8q'], prompt: 'Promova o peão a dama.' },
  'lesson-valor-e-atividade': { fen: DEFAULT_POSITION, moves: ['g1f3'], prompt: 'Aumente a atividade desenvolvendo o cavalo para f3.' },
  'lesson-rotina-antes-de-jogar': { fen: '4r1k1/8/8/8/8/8/8/4K3 w - - 0 1', moves: ['e1d2'], prompt: 'Reconheça a ameaça imediata e retire o rei do xeque.' },
  'lesson-rei-ativo': { fen: '4k3/8/4K3/4P3/8/8/8/8 w - - 0 1', moves: ['e6d6'], prompt: 'Ative o rei para abrir caminho ao peão.' },
  'lesson-oposicao-direta': { fen: '8/8/4k3/8/4K3/4P3/8/8 w - - 0 1', moves: ['e4d4'], prompt: 'Faça o lance de espera com o rei sem avançar o peão.' },
  'lesson-tempos-no-final': { fen: '8/8/4k3/8/4K3/4P3/8/8 b - - 0 1', moves: ['e6d6'], prompt: 'Mantenha o rei preto diante do peão.' },
  'lesson-peao-de-torre': { fen: 'k7/P7/K7/8/8/8/8/8 w - - 0 1', moves: ['a6b6'], prompt: 'Teste a única tentativa do rei sem afogar imediatamente.' },
  'lesson-converter-promocao': { fen: '8/2P3k1/4K3/8/8/8/8/8 w - - 0 1', moves: ['c7c8q'], prompt: 'Promova a dama e continue atento ao afogamento.' },
  'lesson-promocao-das-pretas': { fen: '8/8/8/8/8/4k3/4p3/K7 b - - 0 1', moves: ['e2e1q'], prompt: 'Promova o peão preto na primeira fileira.' },
  'lesson-mate-com-dama': { fen: '7k/8/5K2/8/8/3Q4/8/8 w - - 0 1', moves: ['d3h3'], prompt: 'Restrinja o rei com a dama sem provocar afogamento.' },
  'lesson-mate-com-torre': { fen: '7k/8/5K2/8/8/8/8/R7 w - - 0 1', moves: ['a1a8'], prompt: 'Use a torre para cortar a oitava fileira com xeque.' },
  'lesson-bispo-cor-promocao': { fen: 'k7/P7/KB6/8/8/8/8/8 w - - 0 1', moves: ['b6c5'], prompt: 'Mova o bispo e observe que ele continua sem controlar a8.' },
  'lesson-torre-peao-passado': { fen: '8/8/8/8/4k3/4p3/K7/7R w - - 0 1', moves: ['h1h4'], prompt: 'Dê o xeque lateral antes que o peão avance.' },
  'lesson-corrida-de-peoes': { fen: '7k/P7/8/8/8/8/7p/K7 w - - 0 1', moves: ['a7a8q'], prompt: 'Promova com xeque para ganhar um tempo na corrida.' },
  'lesson-ler-syzygy': { fen: '8/8/8/8/8/2p5/K1k5/7Q w - - 0 1', moves: ['h1h2'], prompt: 'Dê xeque e pare a promoção antes de comparar a posição.' },
};
