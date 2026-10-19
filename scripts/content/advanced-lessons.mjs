import { Chess } from 'chess.js';

// Original explanations and questions. Board examples come from the project's
// already attributed public puzzle collection; no third-party course text/assets.
const topics = [
  ['peao-avancado', 'Um peão que exige uma resposta', 'advancedPawn', 'tactics', 'intermediate',
    'Um peão perto da promoção pode valer mais pela ameaça que cria do que pelo seu valor material. Conte quantos tempos faltam e compare promover, capturar e jogar com xeque.',
    'O que deve entrar no cálculo de um peão avançado?', 'Tempos até promover e recursos do adversário', ['Apenas o valor de um ponto', 'Somente a distância até a dama inimiga', 'Promover sempre sem olhar a posição']],
  ['capturar-defensor', 'Capture quem sustenta a defesa', 'capturingDefender', 'tactics', 'intermediate',
    'Localize a peça que protege o alvo. Capturá-la pode tornar possível uma segunda captura ou um mate. Calcule a recaptura antes de sacrificar: remover um defensor só funciona quando a continuação compensa.',
    'Quando capturar um defensor é justificável?', 'Quando a continuação concreta compensa a troca', ['Sempre que a captura é com xeque', 'Quando a peça está perto do rei', 'Sempre que podemos sacrificar a dama']],
  ['rei-exposto', 'Aproveite um rei sem abrigo', 'exposedKing', 'tactics', 'intermediate',
    'Um rei exposto pode ser atacado por várias direções. Comece pelos xeques, mas confira também as fugas: um xeque que ajuda o rei a escapar pode ser pior que uma ameaça tranquila.',
    'Qual é a melhor rotina contra um rei exposto?', 'Comparar xeques, fugas e respostas defensivas', ['Dar qualquer xeque disponível', 'Capturar o primeiro peão que aparecer', 'Mover apenas a dama']],
  ['lance-intermediario', 'Antes de recapturar, crie uma obrigação', 'intermezzo', 'tactics', 'intermediate',
    'Uma recaptura pode esperar quando existe um lance mais urgente. Um xeque ou outra ameaça forte pode obrigar uma resposta e melhorar a troca. Confira se ainda poderá recuperar o material depois.',
    'O que caracteriza um lance intermediário?', 'Inserir uma ameaça antes da continuação esperada', ['Recapturar imediatamente em toda troca', 'Jogar somente com peões', 'Oferecer empate entre dois lances']],
  ['ataque-ao-roque', 'Abra caminhos para o rei roqueado', 'kingsideAttack', 'tactics', 'intermediate',
    'Ataques ao roque dependem de linhas abertas e peças cooperando. Antes de quebrar a cobertura de peões, confira quantas peças chegam ao ataque e quais defesas podem fechar o caminho.',
    'O que torna um ataque ao roque mais consistente?', 'Coordenação e cálculo das respostas defensivas', ['Somente ter uma dama perto do rei', 'Avançar todos os peões sem calcular', 'Ignorar as peças longe do ataque']],
  ['ataque-ala-dama', 'Crie ameaças na ala da dama', 'queensideAttack', 'tactics', 'intermediate',
    'A ala da dama também oferece alvos: um rei abrigado ali, peças sem defesa e colunas abertas. Identifique o alvo real antes de avançar peões; abrir uma coluna interessa a quem consegue ocupá-la.',
    'Antes de abrir uma coluna, o que você deve conferir?', 'Qual lado conseguirá ocupar e usar essa coluna', ['Apenas a cor da casa de promoção', 'Se todos os peões já se moveram', 'Se a dama começou na ala correta']],
  ['lance-silencioso', 'Encontre a ameaça sem xeque', 'quietMove', 'tactics', 'advanced',
    'Um lance silencioso não captura nem dá xeque, mas pode preparar uma ameaça decisiva. Depois de procurar as opções forçantes, imagine a posição ideal das suas peças e calcule como o adversário poderia impedir seu plano.',
    'Por que um lance sem captura ou xeque pode ser forte?', 'Ele pode criar uma ameaça difícil de defender', ['Porque o adversário perde a vez', 'Porque lances silenciosos não podem ser capturados', 'Porque elimina a necessidade de calcular']],
  ['ataque-raio-x', 'Enxergue o alvo atrás da peça', 'xRayAttack', 'tactics', 'advanced',
    'Uma peça de longo alcance pode influenciar um alvo através de uma peça intermediária. Imagine o que muda quando essa peça sai da linha ou é capturada. Confira a sequência antes de contar o alvo como ganho.',
    'Qual pergunta ajuda a reconhecer um raio X?', 'O que a peça de trás atacará quando a linha abrir?', ['Quantas casas o cavalo salta?', 'A torre pode atravessar uma peça agora?', 'A dama pode saltar o bloqueador?']],
  ['zugzwang', 'Quando ter a vez vira um problema', 'zugzwang', 'endgames', 'advanced',
    'No zugzwang, ter de jogar piora a posição. Compare os lances disponíveis do defensor e o que cada um abandona. Um lance de espera pode transferir essa obrigação, mas ele também precisa preservar sua própria posição.',
    'O que define o zugzwang?', 'A obrigação de jogar força uma concessão', ['O jogador pode passar a vez', 'Todo xeque é mate', 'A partida acaba por falta de tempo']],
  ['mate-ultima-fileira', 'A última fileira precisa de uma saída', 'backRankMate', 'tactics', 'beginner',
    'O rei pode ficar preso atrás dos próprios peões. Torres e damas exploram essa falta de fugas. Antes de jogar a combinação, confira capturas e bloqueios na última fileira e veja se o rei dispõe de uma casa de escape.',
    'O que torna o mate na última fileira possível?', 'O rei está sem fugas e a linha não pode ser defendida', ['Qualquer torre na oitava fileira', 'Ter um peão a mais', 'O rei ter feito roque em algum momento']],
  ['mate-em-tres', 'Calcule até o fim: mate em três', 'mateIn3', 'tactics', 'intermediate',
    'Não pare o cálculo depois do primeiro xeque. Para cada tentativa, procure a defesa que mais resiste e acompanhe a nova posição. Uma linha de mate exige respostas a todas as defesas relevantes, não apenas à mais natural.',
    'Como testar uma linha de mate?', 'Procurar a melhor defesa em cada posição', ['Supor que o adversário fará o lance mais fraco', 'Contar apenas quantos xeques existem', 'Interromper o cálculo na primeira captura']],
  ['mate-em-quatro', 'Mantenha a rede por vários lances', 'mateIn4', 'tactics', 'advanced',
    'Em uma sequência longa, a rede de mate precisa sobreviver a cada defesa. Controle as fugas, identifique as peças indispensáveis e evite trocar o atacante que mantém o rei preso.',
    'Durante o cálculo, o que precisa ser reavaliado após cada defesa?', 'As fugas do rei e a coordenação dos atacantes', ['Somente o relógio', 'A posição inicial, sem atualizar as peças', 'O número do lance da abertura']],
  ['subpromocao', 'Nem sempre a dama é a promoção certa', 'underPromotion', 'tactics', 'advanced',
    'Promover a cavalo, torre ou bispo pode dar um xeque necessário ou evitar um afogamento. Compare as quatro opções na posição resultante; escolher a peça mais forte em valor não garante o melhor resultado.',
    'Quando considerar uma subpromoção?', 'Quando outra peça cria o recurso exato ou evita empate', ['Somente quando já existe uma dama', 'Porque o peão precisa continuar peão', 'Porque promover a dama é proibido no final']],
  ['bispos-final-tatico', 'Bispos: diagonais que decidem o final', 'bishopEndgame', 'endgames', 'intermediate',
    'Nos finais de bispos, as diagonais conectam ataque e defesa. Observe peões nas casas da cor do bispo, passados distantes e a atividade dos reis. Calcule a tática antes de usar uma regra geral sobre bispos.',
    'O que uma regra sobre finais de bispos não substitui?', 'O cálculo da posição concreta', ['O nome da abertura', 'A contagem dos números das casas', 'A escolha da cor das peças antes da partida']],
  ['cavalos-final-tatico', 'Cavalos: calcule os saltos e os tempos', 'knightEndgame', 'endgames', 'intermediate',
    'Um cavalo pode atacar dois alvos, mas precisa de tempos para chegar até eles. Conte os saltos, confira xeques intermediários e não subestime um peão passado que obriga o cavalo a abandonar outra função.',
    'Como comparar cavalo e peão passado?', 'Contando os saltos e os tempos até a promoção', ['Somente pelo valor material do cavalo', 'Supondo que o cavalo anda em diagonal', 'Ignorando os reis']],
  ['peoes-final-tatico', 'Peões: uma ruptura pode mudar tudo', 'pawnEndgame', 'endgames', 'intermediate',
    'Finais de peões exigem precisão porque um tempo pode decidir a promoção. Compare corridas, capturas e rupturas. Antes de trocar peões, reconstrua onde os reis ficarão e quem terá a vez.',
    'Antes de trocar peões, qual informação é essencial?', 'A posição resultante e quem terá a vez', ['Apenas quantos peões havia na abertura', 'O valor da dama que já saiu', 'A cor da última peça capturada']],
  ['torres-final-tatico', 'Torres ativas e peões sob pressão', 'rookEndgame', 'endgames', 'intermediate',
    'Uma torre ativa pode dar xeques e atacar peões ao mesmo tempo. Compare defesa passiva, atividade e distância dos reis. Uma regra como ficar atrás do peão é um ponto de partida; a posição concreta decide o lance.',
    'Como usar uma regra de finais de torres?', 'Como orientação que ainda precisa de cálculo', ['Como ordem obrigatória em toda posição', 'Para dispensar a defesa dos peões', 'Para ignorar xeques adversários']],
  ['damas-final-tatico', 'Damas: xeques, fugas e promoção', 'queenEndgame', 'endgames', 'advanced',
    'A dama pode mudar de lado do tabuleiro em um lance. Em finais, conte xeques, possíveis repetições e a segurança do rei antes de promover ou buscar material. Um peão a mais não elimina os recursos defensivos.',
    'O que pode impedir a conversão de um final de damas?', 'Xeques perpétuos e outros recursos defensivos', ['A dama não poder dar xeque', 'Peões deixarem de promover', 'Reis poderem se capturar']],
  ['dama-torre-final', 'Dama e torre: coordene as ameaças', 'queenRookEndgame', 'endgames', 'advanced',
    'Com peças pesadas, a segurança do rei costuma ser urgente. Observe ameaças de mate, ataques duplos e peças alinhadas antes de recolher peões. Uma peça pesada distante pode mudar a avaliação com um único xeque.',
    'O que deve vir antes de uma captura de peão?', 'Conferir xeques e ameaças contra o rei', ['Retirar a dama do tabuleiro', 'Jogar qualquer lance de torre', 'Ignorar alinhamentos das peças']],
  ['ameaca-f2-f7', 'Reconheça a pressão sobre f2 e f7', 'attackingF2F7', 'tactics', 'beginner',
    'No início, f2 e f7 são defendidas apenas pelo rei. Bispos, cavalos e damas podem combinar ataques ali. Isso não torna qualquer sacrifício correto: confira o desenvolvimento e as respostas antes de executar a ideia.',
    'Por que f2 e f7 chamam atenção na posição inicial?', 'São defendidas apenas pelo rei', ['Estão fora do tabuleiro', 'Não podem receber um xeque', 'Os peões dessas casas não podem mover']],
  ['xeque-descoberto', 'Saia da linha e dê xeque com outra peça', 'discoveredCheck', 'tactics', 'intermediate',
    'No xeque descoberto, uma peça sai da frente e revela o ataque de outra ao rei. A peça que se move pode criar uma segunda ameaça enquanto o adversário precisa responder ao xeque.',
    'Qual peça dá o xeque descoberto?', 'A peça cuja linha foi aberta', ['Sempre a peça que acabou de mover', 'Sempre um cavalo', 'O próprio rei adversário']],
];

export function buildAdvancedLessons(puzzles) {
  return topics.map(([slug, title, theme, category, level, idea, question, correct, wrong], index) => {
    const target = level === 'advanced' ? 1900 : level === 'intermediate' ? 1400 : 850;
    const candidates = puzzles.filter(puzzle => puzzle.themes.includes(theme)).sort((a, b) => Math.abs(a.rating - target) - Math.abs(b.rating - target));
    if (!candidates.length) throw new Error(`Sem exemplo verificado para ${theme}`);
    const seen = new Set();
    const examples = candidates.filter(puzzle => { const key = puzzle.fen.split(' ').slice(0, 4).join(' '); if (seen.has(key)) return false; seen.add(key); return true; }).slice(0, 3);
    const steps = [{ title: 'Uma ideia para procurar', text: idea }];
    for (const puzzle of examples) {
      const board = new Chess(puzzle.fen); const setup = puzzle.moves[0];
      board.move({ from: setup.slice(0, 2), to: setup.slice(2, 4), promotion: setup[4] });
      const fen = board.fen(); const moves = puzzle.moves.slice(1);
      for (const move of moves) board.move({ from: move.slice(0, 2), to: move.slice(2, 4), promotion: move[4] });
      steps.push({ title: `Aplique em outra posição · ${puzzle.rating}`, text: `Encontre a continuação e calcule a resposta adversária. ${idea}`, fen, moves });
    }
    const options = [correct, ...wrong]; const answer = index % options.length;
    [options[0], options[answer]] = [options[answer], options[0]];
    return { id: `lesson-${slug}`, slug, title, category, level, description: idea.split('. ')[0] + '.', sortOrder: 100 + index,
      minutes: Math.max(3, examples.length * 2), steps, quiz: { question, options, answer, explanation: idea } };
  });
}
