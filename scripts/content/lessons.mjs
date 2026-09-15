import assert from 'node:assert/strict';
import { DEFAULT_POSITION, legalPosition, playUci, replay } from './lib.mjs';

const quiz = (question, options, answer, explanation) => ({ question, options, answer, explanation });
const step = (title, text, board = {}) => ({ title, text, ...board });

// Each entry has its own teaching objective, explanation, exercise and feedback.
// The generator only attaches real source lines and consistent contract fields.
const fundamentals = [
  {
    slug: 'mapa-do-tabuleiro', title: 'Encontre uma casa no tabuleiro', minutes: 3,
    description: 'Leia coordenadas e use o centro como referência.',
    idea: 'As colunas recebem letras de a até h; as fileiras, números de 1 até 8. Uma casa é identificada primeiro pela coluna, depois pela fileira: e4. As casas d4, e4, d5 e e5 formam o centro.',
    practice: 'Imagine a posição inicial com as brancas embaixo. Localize a1, h8 e e4. Ao virar o tabuleiro para as pretas, os nomes das casas continuam iguais: muda apenas o ponto de vista.',
    quiz: quiz('Qual nome identifica uma casa da coluna e e da quarta fileira?', ['4e', 'e4', 'd4', 'e5'], 1, 'A coordenada começa pela letra da coluna e termina com o número da fileira: e4.'),
  },
  {
    slug: 'objetivo-do-jogo', title: 'O objetivo é dar xeque-mate', minutes: 3,
    description: 'Diferencie ganhar material de encerrar a partida.',
    idea: 'Você vence por xeque-mate quando o rei adversário está atacado e não existe lance legal que elimine o ataque. O rei não é capturado. Ganhar peças costuma ajudar, mas uma vantagem material não impede um mate contra você.',
    practice: 'Antes de procurar uma captura, verifique a segurança dos dois reis. Se seu rei está em xeque, sua resposta precisa resolver esse xeque; uma ameaça do outro lado do tabuleiro não basta.',
    quiz: quiz('Qual situação define xeque-mate?', ['Capturar a dama', 'Ter mais peças', 'Rei atacado sem defesa legal', 'Rei sem lances, mesmo sem xeque'], 2, 'Mate exige xeque e ausência de qualquer resposta legal. Sem xeque, a falta de lances legais é afogamento.'),
  },
  {
    slug: 'movimento-da-torre', title: 'Torre: linhas e colunas', minutes: 3,
    description: 'Trace caminhos retos e reconheça bloqueios.',
    idea: 'A torre anda quantas casas puder em linha reta, pela mesma coluna ou fileira. Ela não salta peças. Uma peça sua bloqueia o caminho; uma adversária pode ser capturada, encerrando o movimento naquela casa.',
    practice: 'Imagine uma torre em d4 num tabuleiro vazio. Ela alcança d8 e h4, mas não g7. Coloque mentalmente um peão branco em d6: a torre branca não pode atravessá-lo para chegar a d7.',
    quiz: quiz('Sem bloqueios, qual casa uma torre em d4 alcança em um lance?', ['g7', 'e5', 'f5', 'd8'], 3, 'd8 pertence à mesma coluna de d4. As outras casas exigiriam movimento diagonal ou de cavalo.'),
  },
  {
    slug: 'movimento-do-bispo', title: 'Bispo: diagonais e cores', minutes: 3,
    description: 'Reconheça o alcance diagonal e a cor permanente do bispo.',
    idea: 'O bispo anda pelas diagonais sem saltar peças. Como cada diagonal preserva a cor das casas, um bispo que começa numa casa clara permanece em casas claras durante toda a partida.',
    practice: 'De c1, acompanhe a diagonal d2, e3, f4, g5 e h6. Na posição inicial, o peão de d2 bloqueia essa saída. Avançar um peão pode abrir uma diagonal para o bispo.',
    quiz: quiz('O que um bispo faz ao mover-se normalmente?', ['Permanece na mesma cor de casas', 'Troca de cor a cada lance', 'Salta a primeira peça', 'Move-se apenas uma casa'], 0, 'Todos os movimentos diagonais de um bispo preservam a cor das casas.'),
  },
  {
    slug: 'movimento-da-dama', title: 'Dama: alcance e responsabilidade', minutes: 3,
    description: 'Combine linhas retas e diagonais sem confundir poder com segurança.',
    idea: 'A dama combina os movimentos da torre e do bispo: fileiras, colunas e diagonais. Ela não salta peças. Seu grande alcance torna a dama forte, mas também faz perder tempos quando sai cedo e é atacada por peças menores.',
    practice: 'Imagine uma dama em d4. Ela pode ir a d7, g4 ou g7 se o caminho estiver livre. Não pode ir a f5. Antes de aproximá-la do rei adversário, confira se ela ficará protegida.',
    quiz: quiz('Qual movimento não corresponde ao da dama em d4?', ['d4–g7', 'd4–f5', 'd4–d7', 'd4–g4'], 1, 'f5 não está na mesma fileira, coluna ou diagonal de d4.'),
  },
  {
    slug: 'movimento-do-cavalo', title: 'Cavalo: salto em L', minutes: 4,
    description: 'Encontre destinos do cavalo mesmo com peças no caminho.',
    idea: 'O cavalo desloca-se duas casas em uma direção e uma na direção perpendicular. Ele pode saltar peças, mas não termina sobre uma peça da própria cor. Cada salto muda a cor da casa ocupada.',
    practice: 'De g1, o cavalo branco pode saltar para f3 mesmo com peões na segunda fileira. Num tabuleiro vazio, procure todos os destinos de um cavalo em d4 e depois compare com um cavalo em a1.',
    quiz: quiz('Qual lance do cavalo branco é possível na posição inicial?', ['g1–g3', 'g1–e1', 'g1–f3', 'g1–h1'], 2, 'g1–f3 tem o deslocamento em L; o cavalo salta as peças intermediárias e f3 está livre.'),
  },
  {
    slug: 'movimento-do-rei', title: 'Rei: proximidade com segurança', minutes: 3,
    description: 'Entenda por que os reis não podem ficar lado a lado.',
    idea: 'O rei move-se uma casa em qualquer direção, desde que a casa de destino não esteja atacada. Os reis atacam as casas vizinhas; por isso, não podem ocupar casas adjacentes.',
    practice: 'Num final, desenhe mentalmente as oito casas ao redor do rei adversário. Elas ficam proibidas para o seu rei. Uma captura com o rei só é legal se a peça capturada não estiver protegida por um ataque que continue existindo.',
    quiz: quiz('Por que um rei não pode se colocar ao lado do outro?', ['Porque só anda em diagonal', 'Porque deve ficar na primeira fileira', 'Porque reis não participam dos finais', 'Porque entraria numa casa atacada'], 3, 'Um rei controla as casas adjacentes. Entrar no alcance do outro rei deixaria o próprio rei em xeque.'),
  },
  {
    slug: 'movimento-do-peao', title: 'Peão: avanço e captura', minutes: 4,
    description: 'Separe a direção de avanço da direção de captura.',
    idea: 'O peão avança uma casa para a frente se ela estiver vazia. Partindo da fileira inicial, pode avançar duas se ambas estiverem livres. Ele captura uma casa na diagonal para a frente e nunca recua.',
    practice: 'Para as brancas, um peão em e4 avança para e5 e captura em d5 ou f5. Para as pretas, um peão em e5 avança para e4 e captura em d4 ou f4. A orientação da tela não muda essas regras.',
    quiz: quiz('Um peão branco em e4 pode capturar normalmente em qual casa?', ['d5', 'e5', 'd3', 'e3'], 0, 'A captura do peão branco ocorre uma casa na diagonal rumo à oitava fileira: d5 ou f5.'),
  },
  {
    slug: 'capturas-e-defensores', title: 'Antes de capturar, conte defensores', minutes: 4,
    description: 'Avalie a recaptura antes de comemorar uma peça ganha.',
    idea: 'Uma peça aparentemente disponível pode estar protegida. Antes de capturar, imagine a posição resultante e procure as recapturas legais do adversário. Contar atacantes ajuda, mas a ordem das trocas e os xeques podem mudar o resultado.',
    practice: 'Use a sequência: quem captura, quem recaptura e qual material sobra? Refaça a contagem depois de cada troca, pois uma coluna aberta pode revelar o ataque de uma torre que antes estava bloqueada.',
    quiz: quiz('Qual é a melhor verificação antes de uma captura?', ['Somente o valor da peça alvo', 'As recapturas e a posição resultante', 'A cor da casa de origem', 'O número do lance'], 1, 'A captura altera linhas e defensores. A posição depois da resposta importa mais do que a aparência inicial da peça alvo.'),
  },
  {
    slug: 'responder-ao-xeque', title: 'Três maneiras de enfrentar um xeque', minutes: 4,
    description: 'Organize a busca por respostas legais.',
    idea: 'Contra um xeque, considere mover o rei, capturar a peça atacante ou bloquear a linha de ataque. Nem sempre as três opções existem. Um xeque de cavalo não pode ser bloqueado; num xeque duplo, é necessário mover o rei.',
    practice: 'Ao receber um xeque, identifique a peça que ataca e trace o caminho até o rei. Depois teste cada defesa, verificando se ela realmente remove todos os ataques ao rei.',
    quiz: quiz('Qual resposta não resolve um xeque de cavalo por si só?', ['Mover o rei para casa segura', 'Capturar o cavalo legalmente', 'Colocar uma peça entre cavalo e rei', 'Capturar o cavalo com o rei, se seguro'], 2, 'O cavalo salta; não há uma linha intermediária que possa ser bloqueada.'),
  },
  {
    slug: 'mate-e-afogamento', title: 'Mate ou afogamento?', minutes: 4,
    description: 'Observe o xeque antes de concluir que o jogo foi vencido.',
    idea: 'Se o lado com a vez não dispõe de lance legal, olhe para o rei: atacado significa xeque-mate; sem ataque significa afogamento e empate. Considere os lances de todas as peças, não apenas os movimentos do rei.',
    practice: 'Em finais de dama contra rei, faça duas perguntas antes de um lance sem xeque: o rei adversário terá casa legal? Há outra peça adversária que possa jogar? Se ambas as respostas forem não, há risco de afogamento.',
    quiz: quiz('O lado com a vez não tem lance legal e seu rei não está em xeque. Qual o resultado?', ['Vitória de quem tem mais material', 'Xeque-mate', 'A partida continua com passe', 'Empate por afogamento'], 3, 'Sem xeque e sem qualquer lance legal, a posição é de afogamento.'),
  },
  {
    slug: 'roque-com-seguranca', title: 'Quando o roque é permitido', minutes: 5,
    description: 'Confira caminho, histórico e ataques antes de rocar.',
    idea: 'No roque, rei e torre se movem no mesmo lance. Eles não podem ter se movido antes; o caminho entre eles deve estar livre. O rei não pode estar em xeque nem atravessar ou terminar em casa atacada.',
    practice: 'No roque pequeno branco, o rei vai de e1 a g1 e a torre de h1 a f1. Um ataque à torre não proíbe o roque por si só. Já um ataque à casa f1 impede a passagem do rei.',
    quiz: quiz('Qual situação impede o roque pequeno branco?', ['A casa f1 está atacada', 'A torre h1 está atacada, sem afetar o rei', 'O adversário já fez roque', 'A dama ainda está em d1'], 0, 'O rei não pode atravessar f1 se essa casa estiver atacada.'),
  },
  {
    slug: 'captura-en-passant', title: 'En passant: uma oportunidade imediata', minutes: 5,
    description: 'Reconheça a captura especial logo após o avanço duplo.',
    idea: 'Se um peão adversário avança duas casas e termina ao lado do seu peão, pode existir captura en passant: seu peão vai à casa atravessada e o peão adversário é retirado. A oportunidade vale apenas na resposta imediatamente seguinte.',
    practice: 'Imagine um peão branco em e5 e um preto que acaba de jogar d7–d5. As brancas podem considerar e5–d6 en passant. A captura ainda precisa respeitar a segurança do rei, pois a retirada dos dois peões pode abrir uma linha.',
    quiz: quiz('Quando a captura en passant deve ser feita?', ['A qualquer momento da partida', 'Na resposta imediata ao avanço duplo', 'Somente depois do roque', 'Apenas na promoção'], 1, 'Se você escolhe outra resposta, perde aquela oportunidade de capturar en passant.'),
  },
  {
    slug: 'escolha-da-promocao', title: 'Promoção: você escolhe a peça', minutes: 4,
    description: 'Conheça todas as escolhas e o motivo de considerar alternativas.',
    idea: 'Ao chegar à última fileira, o peão é substituído por dama, torre, bispo ou cavalo da mesma cor. Não é necessário ter perdido essa peça antes. A dama costuma ser a escolha mais forte, mas uma promoção menor pode evitar afogamento ou dar um xeque útil.',
    practice: 'Antes de confirmar a promoção, verifique xeques, afogamento e ameaças do adversário. Em UCI, a escolha aparece no fim do lance: e7e8q promove a dama; e7e8n promove a cavalo.',
    quiz: quiz('Qual conjunto contém todas as promoções permitidas?', ['Dama e rei', 'Apenas dama', 'Dama, torre, bispo e cavalo', 'Qualquer peça capturada'], 2, 'Essas quatro peças são permitidas; não se promove a rei nem se mantém o peão.'),
  },
  {
    slug: 'valor-e-atividade', title: 'Valor das peças e atividade', minutes: 4,
    description: 'Use valores aproximados sem tratar a posição como uma soma cega.',
    idea: 'Como referência inicial, use peão 1, cavalo e bispo cerca de 3, torre 5 e dama 9. Esses números ajudam a comparar trocas, mas atividade, segurança do rei e possibilidade de promoção podem pesar mais.',
    practice: 'Trocar uma torre por um bispo sem compensação costuma perder material. Porém, antes de rejeitar uma troca, procure um mate forçado ou um peão prestes a promover. O rei não recebe um preço de troca.',
    quiz: quiz('Como devem ser usados os valores das peças?', ['Como regra que supera qualquer mate', 'Como garantia de vitória', 'Como pontuação oficial do resultado', 'Como estimativa que depende da posição'], 3, 'Os valores são uma ferramenta de avaliação material. Eles não substituem cálculo nem segurança do rei.'),
  },
  {
    slug: 'rotina-antes-de-jogar', title: 'Uma rotina antes de cada lance', minutes: 4,
    description: 'Crie um hábito curto para reduzir perdas de peças.',
    idea: 'Comece pela ameaça do último lance adversário. Depois procure xeques, capturas e ameaças para ambos os lados. Escolha candidatos e imagine a resposta mais forte contra cada um antes de mover.',
    practice: 'Ao decidir um lance, faça uma última inspeção: meu rei continua seguro? Deixei uma peça sem defesa? O adversário tem um xeque ou captura que eu não calculei? Uma rotina curta é mais útil do que jogar apenas por impulso.',
    quiz: quiz('Qual pergunta deve abrir a análise após o lance adversário?', ['O que esse lance ameaça ou modifica?', 'Como posso repetir meu lance anterior?', 'Qual peça ainda não movi, sem olhar o tabuleiro?', 'Como dar qualquer xeque imediatamente?'], 0, 'Entender a mudança criada pelo adversário ajuda a evitar que seu plano ignore uma ameaça urgente.'),
  },
];

const tactics = [
  ['mate-em-um', 'Mate em um: feche todas as fugas', 'mateIn1', 'beginner',
    'Procure um xeque que não permita captura, bloqueio ou fuga. Não basta atacar o rei: todas as respostas precisam falhar.',
    'Antes de reproduzir a solução, enumere as casas de fuga do rei e veja quais peças suas as controlam.',
    quiz('O que precisa ser confirmado num candidato a mate em um?', ['Só que a dama dá xeque', 'Que não existe resposta legal ao xeque', 'Que uma torre será ganha depois', 'Que o lance é uma captura'], 1, 'Um xeque é mate apenas se o adversário não pode eliminá-lo de nenhuma forma legal.')],
  ['mate-em-dois', 'Mate em dois: calcule a defesa', 'mateIn2', 'beginner',
    'Planeje seu primeiro lance, a melhor resposta adversária e o lance de mate. Um primeiro lance atraente não basta se existir uma defesa que você esqueceu.',
    'Pause após a primeira jogada da solução e tente encontrar a resposta defensiva antes de continuar o replay.',
    quiz('Ao calcular mate em dois, de qual lado você também deve procurar os melhores lances?', ['Apenas do atacante', 'De nenhum, basta decorar', 'Do defensor', 'Somente de quem tem mais peças'], 2, 'A combinação precisa funcionar contra a melhor defesa, não só contra uma resposta conveniente.')],
  ['garfo', 'Garfo: duas ameaças em um lance', 'fork', 'beginner',
    'Um garfo ataca dois ou mais alvos de uma vez. Cavalos produzem garfos conhecidos, mas peões, bispos, torres, dama e até o rei também podem criar ataques duplos.',
    'Identifique os dois alvos no exemplo e confira se a peça que dá o garfo pode ser capturada com segurança.',
    quiz('Por que um garfo com xeque costuma ser forte?', ['Porque cavalos valem mais que damas', 'Porque o adversário perde a vez', 'Porque o rei pode ser capturado', 'Porque responder ao xeque tem prioridade'], 3, 'O adversário precisa resolver o xeque, o que pode deixar o segundo alvo exposto.')],
  ['cravada', 'Cravada: uma peça com mobilidade limitada', 'pin', 'intermediate',
    'Uma peça cravada encobre um alvo importante numa linha de ataque. Se o alvo é o rei, movimentos que o exponham a xeque são ilegais; se é outra peça, a decisão depende do custo material e das ameaças.',
    'Localize atacante, peça intermediária e alvo atrás dela. Antes de explorar a cravada, confira se o adversário pode quebrar a linha ou atacar a peça que crava.',
    quiz('Quando uma cravada impede legalmente a peça de sair da linha?', ['Quando sair expõe o próprio rei a xeque', 'Sempre que há uma dama atrás', 'Somente na abertura', 'Quando a peça é um cavalo, em qualquer posição'], 0, 'A segurança do próprio rei é uma obrigação legal. Cravadas a outras peças podem ser rompidas se a compensação justificar.')],
  ['espeto', 'Espeto: o alvo mais valioso vem à frente', 'skewer', 'intermediate',
    'No espeto, uma peça importante é atacada na frente de outra na mesma linha. Ao se afastar, ela pode deixar a peça de trás disponível para captura.',
    'Trace a linha do atacante e observe a ordem dos alvos. Calcule para onde a peça da frente pode ir e se essa resposta cria uma ameaça maior.',
    quiz('Qual descrição corresponde melhor a um espeto?', ['Uma peça bloqueia um ataque ao próprio rei', 'Um alvo valioso na frente precisa sair, expondo outro atrás', 'Dois cavalos se defendem', 'Um peão avança sem captura'], 1, 'A sequência de alvos numa mesma linha é a característica central do espeto.')],
  ['ataque-descoberto', 'Ataque descoberto: abra a linha', 'discoveredAttack', 'intermediate',
    'Mover uma peça pode liberar o ataque de outra que estava atrás. O lance fica especialmente forte quando a peça que sai também cria uma ameaça.',
    'Compare a posição antes e depois do movimento: qual linha foi aberta? Depois encontre a ameaça produzida pela peça que se moveu.',
    quiz('O que cria um ataque descoberto?', ['Mover apenas o rei', 'Repetir a posição', 'Retirar um bloqueio da linha de outra peça', 'Promover obrigatoriamente a dama'], 2, 'A peça que se desloca revela a ação de uma peça de longo alcance atrás dela.')],
  ['xeque-duplo', 'Xeque duplo: dois ataques ao rei', 'doubleCheck', 'intermediate',
    'No xeque duplo, duas peças atacam o rei ao mesmo tempo. A defesa precisa mover o rei; bloquear ou capturar apenas um dos atacantes não elimina o outro ataque.',
    'Localize as duas peças que dão xeque. Liste as casas legais do rei antes de avançar para o próximo lance da linha.',
    quiz('Qual tipo de resposta é necessário num xeque duplo?', ['Mover qualquer peão', 'Bloquear apenas uma linha', 'Atacar a dama rival', 'Mover o rei para resolver os dois ataques'], 3, 'O rei deve sair dos dois ataques. A nova casa também precisa estar segura.')],
  ['desvio-do-defensor', 'Desvio: afaste o defensor', 'deflection', 'intermediate',
    'Uma peça pode sustentar uma defesa essencial. O desvio procura obrigá-la ou induzi-la a abandonar essa função, permitindo uma captura ou ataque decisivo.',
    'Pergunte qual peça defende o alvo principal e como sua função muda durante a combinação. Calcule também se ela pode recusar a oferta.',
    quiz('Qual é a ideia do desvio?', ['Afastar uma peça de sua função defensiva', 'Trocar sempre as damas', 'Evitar qualquer captura', 'Mover todos os peões'], 0, 'O alvo imediato pode ser apenas um meio de remover o defensor de uma casa ou peça mais importante.')],
  ['atracao', 'Atração: leve o alvo à casa certa', 'attraction', 'intermediate',
    'A atração procura levar uma peça adversária a uma casa onde uma sequência tática funciona. A casa de destino importa tanto quanto a peça atraída.',
    'Encontre a casa desejada pelo atacante e a continuação que só passa a funcionar quando o adversário chega ali.',
    quiz('O que você deve identificar primeiro numa combinação de atração?', ['O número da partida', 'A casa para a qual o alvo será levado', 'A peça de menor valor no tabuleiro', 'Uma troca de peões aleatória'], 1, 'A força da combinação depende da vulnerabilidade criada na casa de destino.')],
  ['peca-pendurada', 'Peça pendurada: ganhe sem se precipitar', 'hangingPiece', 'beginner',
    'Uma peça pendurada está disponível para ganho material sem compensação suficiente. Mesmo assim, confira se capturá-la permite um mate, uma promoção ou uma sequência de xeques contra você.',
    'Identifique a peça vulnerável, faça a captura mentalmente e só então procure a melhor resposta adversária.',
    quiz('Qual cuidado é necessário ao capturar uma peça sem defesa aparente?', ['Nenhum, toda captura ganha', 'Ver apenas seu valor', 'Verificar ameaças e respostas táticas adversárias', 'Capturar sempre com a dama'], 2, 'Uma peça pode funcionar como isca. O ganho só é real depois de considerar a resposta mais forte.')],
  ['peca-presa', 'Peça presa: elimine as saídas', 'trappedPiece', 'intermediate',
    'Uma peça pode estar defendida e ainda assim ficar presa, sem casas seguras diante de um ataque. O plano é controlar suas saídas antes de atacá-la definitivamente.',
    'Liste as casas de fuga da peça alvo e marque quais já estão controladas. Verifique se uma troca pode criar uma saída inesperada.',
    quiz('O que caracteriza uma peça presa?', ['Ela nunca se moveu', 'Ela é sempre um bispo', 'Ela está na primeira fileira', 'Ela não encontra saída segura diante da ameaça'], 3, 'O elemento decisivo é a falta de mobilidade segura, e não o tipo da peça ou sua casa inicial.')],
  ['liberacao', 'Liberação: desocupe a casa ou a linha', 'clearance', 'intermediate',
    'Às vezes uma peça sua ocupa a casa ou bloqueia a linha de que outra peça precisa. Um lance de liberação remove esse obstáculo, podendo envolver uma oferta de material.',
    'Observe qual espaço fica livre após o primeiro lance tático e qual peça passa a usá-lo.',
    quiz('Qual resultado um lance de liberação busca?', ['Disponibilizar uma casa ou linha para outra peça', 'Fechar todas as diagonais próprias', 'Apenas ganhar um peão isolado', 'Trocar o lado com a vez'], 0, 'O movimento prepara a ação de outra peça ao retirar um obstáculo da própria posição.')],
  ['interferencia', 'Interferência: corte a comunicação', 'interference', 'advanced',
    'A interferência coloca uma peça numa linha importante do adversário para cortar a defesa ou a comunicação entre peças. É preciso calcular as possíveis capturas na casa de bloqueio.',
    'Encontre a linha defensiva interrompida e compare as consequências de cada peça adversária capturar o bloqueador.',
    quiz('Qual é a função de uma interferência?', ['Aumentar a distância entre seus reis', 'Interromper uma linha útil ao adversário', 'Repetir lances sem objetivo', 'Promover um peão automaticamente'], 1, 'Ao cortar a linha, uma peça defensora pode deixar de proteger o alvo principal.')],
  ['sacrificio-calculado', 'Sacrifício: exija uma continuação concreta', 'sacrifice', 'advanced',
    'Um sacrifício oferece material por uma vantagem concreta, como mate, recuperação de material ou ataque duradouro. A oferta não se justifica apenas por parecer bonita.',
    'Reproduza a linha do puzzle e marque quando o material é oferecido. Antes disso, calcule a aceitação e uma recusa plausível.',
    quiz('O que deve sustentar um sacrifício tático?', ['A esperança de um erro', 'O desejo de surpreender, sem calcular', 'Uma continuação concreta que compense o material', 'A regra de sempre atacar'], 2, 'Cálculo e avaliação da posição final ajudam a distinguir uma combinação de uma perda de material.')],
  ['promocao-tatica', 'Promoção como recurso tático', 'promotion', 'intermediate',
    'Um peão próximo da última fileira cria ameaças que podem superar o valor das peças. Calcule a promoção, possíveis capturas e os xeques da nova peça.',
    'Localize o peão que pode promover e conte os tempos necessários. No replay, observe a letra final do lance UCI para identificar a peça escolhida.',
    quiz('Qual lance UCI indica promoção a cavalo?', ['e7e8q', 'e7e8r', 'e7e8b', 'e7e8n'], 3, 'Em UCI, n representa knight, o cavalo; q, r e b representam dama, torre e bispo.')],
  ['defesa-ativa', 'Lance defensivo: resolva a ameaça', 'defensiveMove', 'intermediate',
    'Uma tática também pode servir para defender: eliminar uma ameaça, criar fuga para o rei ou devolver material. Comece identificando o que o adversário faria se você ignorasse a posição.',
    'Escreva a ameaça adversária em uma frase. Só depois compare as defesas e verifique se alguma também cria uma contra-ameaça.',
    quiz('Qual é o primeiro passo para encontrar uma boa defesa?', ['Procurar qualquer xeque', 'Capturar a peça mais próxima', 'Mover a dama sem calcular', 'Identificar a ameaça concreta'], 3, 'Sem compreender a ameaça, um lance aparentemente ativo pode deixar o problema principal sem resposta.')],
];

const openingLessons = [
  ['italiana', 'Italiana: desenvolva mirando o centro', 'Italian Game', 'beginner',
    'A Italiana desenvolve o bispo para c4 depois de e4, e5 e Cf3. O bispo pressiona f7, mas isso não dispensa desenvolvimento, roque e atenção às respostas centrais.',
    'Após a linha, procure como retirar o cavalo de b1 e preparar a segurança do rei. Evite mover o mesmo bispo repetidamente sem uma razão concreta.',
    quiz('Qual prioridade combina com a Italiana?', ['Trazer peças ao jogo e cuidar do rei', 'Mover a dama várias vezes para caçar peões', 'Abandonar o centro', 'Prometer mate em f7 contra toda defesa'], 0, 'A pressão em f7 é uma característica da posição; desenvolvimento e segurança continuam fundamentais.')],
  ['espanhola', 'Espanhola: pressão sobre o cavalo de c6', 'Ruy Lopez', 'beginner',
    'Na Espanhola, o bispo branco vai a b5 e pressiona o cavalo de c6, que ajuda a sustentar e5. A abertura envolve tensão central; a pressão não significa que o peão e5 já esteja ganho.',
    'Identifique o defensor de e5 e calcule possíveis recapturas antes de trocar em c6. Pergunte como a troca altera os peões e libera linhas.',
    quiz('O que Bb5 faz na posição básica da Espanhola?', ['Dá xeque-mate', 'Pressiona o cavalo de c6', 'Promove um peão', 'Impede todo roque das pretas'], 1, 'O bispo ataca o cavalo de c6, peça relacionada à defesa do centro preto.')],
  ['escocesa', 'Escocesa: abra o centro com preparo', 'Scotch Game', 'beginner',
    'A Escocesa usa d4 cedo para confrontar o peão e5. Abrir o centro aumenta a importância do desenvolvimento e da segurança do rei, porque as peças passam a atuar por linhas mais livres.',
    'Depois da linha, veja quais colunas e diagonais podem se abrir após uma captura em d4. Conte as peças desenvolvidas dos dois lados.',
    quiz('Qual é a ideia central de d4 na Escocesa?', ['Fechar o jogo para sempre', 'Levar o rei ao centro', 'Confrontar e5 e abrir o centro', 'Atacar a torre a8 imediatamente'], 2, 'O avanço d4 disputa o centro e permite trocas que abrem linhas.')],
  ['quatro-cavalos', 'Quatro Cavalos: desenvolvimento coerente', 'Four Knights Game', 'beginner',
    'Os dois lados desenvolvem os cavalos para casas naturais e disputam o centro. A simetria inicial não dispensa escolhas: a saída dos bispos e o momento de avançar d4 ou d5 mudam os planos.',
    'Observe como os cavalos apoiam casas centrais. Escolha uma peça ainda parada e explique qual casa de desenvolvimento melhora sua ação.',
    quiz('O desenvolvimento dos quatro cavalos garante o quê?', ['Vitória das brancas', 'Empate obrigatório', 'Ausência de táticas', 'Peças mais próximas da disputa central'], 3, 'Desenvolver melhora a atividade, mas o resultado depende das decisões seguintes.')],
  ['siciliana', 'Siciliana: resposta assimétrica a e4', 'Sicilian Defense', 'intermediate',
    'Ao responder e4 com c5, as pretas disputam d4 com um peão lateral. A estrutura fica assimétrica, o que pode oferecer planos diferentes para cada lado sem garantir vantagem imediata.',
    'Marque a casa d4, atacada pelo peão de c5. Ao explorar variantes mais longas, observe quando ocorre cxd4 e como a coluna c pode se abrir para as pretas.',
    quiz('Qual casa o peão preto de c5 controla?', ['d4', 'd6', 'c4', 'e4'], 0, 'O peão preto captura na diagonal rumo à primeira fileira; de c5, controla b4 e d4.')],
  ['francesa', 'Francesa: prepare o contra-ataque central', 'French Defense', 'intermediate',
    'A resposta e6 prepara d5 contra o centro branco. Ela também ocupa a diagonal do bispo de c8; desenvolver esse bispo e atacar a cadeia de peões são problemas importantes em muitas variantes.',
    'Na posição após e6, localize o peão de d7 e imagine sua chegada a d5. Observe como o peão de e6 apoia esse avanço e limita a saída do bispo de c8.',
    quiz('Qual avanço central e6 normalmente prepara?', ['h5', 'd5', 'a5', 'g5'], 1, 'O peão em e6 protege d5, permitindo confrontar o centro branco.')],
  ['caro-kann', 'Caro-Kann: sustente d5 com c6', 'Caro-Kann Defense', 'beginner',
    'A resposta c6 prepara d5 apoiado pelo peão da coluna c. Diferentemente de e6 imediato, c6 não fecha a diagonal do bispo de c8; o desenvolvimento desse bispo dependerá da variante.',
    'Identifique a casa d5 e compare os caminhos do bispo de c8 com os da Defesa Francesa. Não confunda essa possibilidade de desenvolvimento com uma obrigação de jogar o bispo cedo em toda linha.',
    quiz('Qual avanço c6 prepara na Caro-Kann?', ['b5 obrigatório', 'f5 obrigatório', 'd5', 'h6'], 2, 'c6 sustenta d5 e organiza a disputa do centro.')],
  ['escandinava', 'Escandinava: confronte e4 imediatamente', 'Scandinavian Defense', 'beginner',
    'A Escandinava responde e4 com d5, atacando o peão central branco já no primeiro lance. Após a troca, existem planos com a dama ou com o cavalo; desenvolver com tempos úteis continua importante.',
    'Se a dama recapturar cedo em d5, procure lances de desenvolvimento que possam atacá-la. Evite concluir que toda saída de dama é um erro: compare a posição concreta.',
    quiz('Qual tensão define a posição inicial da Escandinava?', ['Bispo em b5 contra cavalo c6', 'Peão c5 contra d4', 'Reis em oposição', 'Peão d5 atacando e4'], 3, 'O avanço preto d5 confronta diretamente o peão branco em e4.')],
  ['gambito-da-dama', 'Gambito da Dama: pressione o centro', "Queen's Gambit", 'beginner',
    'Depois de d4 e d5, c4 oferece um peão lateral para pressionar o centro preto. Aceitar o peão não encerra a discussão: as brancas podem buscar recuperá-lo e construir atividade.',
    'Trace o ataque do peão de c4 sobre d5. Ao estudar a aceitação, observe o custo de tentar manter o peão extra com muitos avanços laterais.',
    quiz('Qual objetivo combina com c4 no Gambito da Dama?', ['Pressionar o peão central de d5', 'Dar xeque imediato', 'Abrir a coluna h', 'Preparar o roque sem desenvolver peças'], 0, 'c4 confronta d5 e procura modificar a estrutura central.')],
  ['gambito-recusado', 'Gambito da Dama Recusado: sustente o centro', "Queen's Gambit Declined", 'intermediate',
    'Com e6, as pretas sustentam d5 e mantêm a tensão central. O bispo de c8 exige um plano de desenvolvimento, e as trocas no centro alteram quais diagonais ficam abertas.',
    'Observe quais peões defendem d5 e qual peça tem a saída limitada por e6. Ao avançar no estudo, compare desenvolver primeiro com resolver a tensão imediatamente.',
    quiz('Qual peça costuma exigir atenção após e6?', ['Torre h8 já ativa', 'Bispo c8', 'Rei branco em g1 desde o início', 'Dama branca promovida'], 1, 'O peão e6 ocupa uma casa da diagonal do bispo de c8, tornando seu desenvolvimento uma questão de planejamento.')],
  ['eslava', 'Eslava: proteja d5 com o peão c', 'Slav Defense', 'intermediate',
    'A Eslava sustenta d5 com c6 após d4, d5 e c4. Isso mantém a diagonal inicial do bispo de c8 disponível, embora o momento de desenvolvê-lo dependa das ameaças sobre o centro e a ala da dama.',
    'Compare c6 com e6: quais casas cada peão controla e qual diagonal muda? Depois observe as possibilidades de captura em c4 sem tentar decorar todas as variantes.',
    quiz('Como as pretas sustentam d5 na Eslava básica?', ['Com h6', 'Com uma torre em d8 no primeiro lance', 'Com c6', 'Com roque imediato'], 2, 'O peão de c6 defende d5 e preserva, inicialmente, a diagonal do bispo de c8.')],
  ['inglesa', 'Inglesa: controle d5 de longe', 'English Opening', 'intermediate',
    'A Inglesa começa com c4 e controla d5 com um peão lateral. Ela permite estruturas variadas e transposições: ordens de lances diferentes podem chegar à mesma posição.',
    'Identifique d5 e pense como um cavalo em c3 pode aumentar o controle central. Compare posições completas, incluindo a vez de jogar, em vez de apenas o nome da abertura.',
    quiz('O que significa uma transposição de abertura?', ['Trocar as cores das peças', 'Mover duas peças sem roque', 'Repetir sempre a mesma jogada', 'Chegar à mesma posição por outra ordem de lances'], 3, 'As posições podem coincidir mesmo quando a sequência de lances foi diferente.')],
];

const endgameLessons = [
  ['rei-ativo', 'Ative o rei no final', 'peao-rei-na-sexta', 'beginner',
    'Com poucas peças, o rei pode apoiar peões e controlar casas de entrada. Ativá-lo não significa ignorar ataques: cada passo ainda deve terminar em casa segura.',
    quiz('Por que o rei ganha importância prática em muitos finais?', ['Porque pode ajudar a promover e bloquear peões', 'Porque passa a saltar peças', 'Porque não pode mais receber xeque', 'Porque pode ser trocado'], 0, 'Com menos ameaças de mate, o rei costuma participar mais da disputa de casas e da promoção.')],
  ['oposicao-direta', 'Entenda a oposição direta', 'peao-oposicao', 'intermediate',
    'Na oposição direta, os reis se enfrentam numa mesma coluna ou fileira com uma casa entre eles. A vez de jogar importa: ceder passagem pode permitir que o outro rei avance.',
    quiz('Que elemento precisa acompanhar a disposição dos reis ao avaliar a oposição?', ['A cor do tabuleiro na tela', 'Quem tem a vez e os tempos de peão disponíveis', 'A quantidade de torres capturadas', 'O nome da partida'], 1, 'A oposição depende da obrigação de jogar e dos lances de espera que ainda existem.')],
  ['tempos-no-final', 'Um tempo pode mudar o resultado', 'peao-oposicao-pretas', 'intermediate',
    'Duas posições com peças nas mesmas casas podem ter resultados diferentes se mudar o lado com a vez. Um avanço de peão pode funcionar como tempo de espera, mas também abandona casas e não pode ser desfeito.',
    quiz('Qual característica torna o avanço de peão um recurso que exige cuidado?', ['O peão pode voltar depois', 'O adversário perde a vez', 'O avanço é irreversível', 'Todo avanço dá xeque'], 2, 'Como o peão não recua, gastar um tempo de peão pode mudar permanentemente a estrutura.')],
  ['peao-de-torre', 'Por que o peão de torre é especial', 'peao-torre-canto', 'beginner',
    'No canto, o rei defensor tem poucos caminhos, mas o atacante também perde espaço para contornar. Um peão de torre com o rei rival na casa de promoção pode levar a empate apesar do peão extra.',
    quiz('Qual detalhe diferencia o peão da coluna a de um peão central?', ['Ele anda duas casas sempre', 'Ele promove a rei', 'Ele captura para trás', 'Só há espaço de manobra de um lado da coluna'], 3, 'A borda reduz as possibilidades de contorno e ajuda a explicar certos empates com peão de torre.')],
  ['converter-promocao', 'A partida continua depois da promoção', 'peao-promocao', 'beginner',
    'Promover muda o material, mas não encerra automaticamente a partida. Com dama contra rei, restrinja o espaço, aproxime seu rei e confira o risco de afogamento antes de cada lance sem xeque.',
    quiz('Depois de promover a dama, qual cuidado continua necessário?', ['Evitar afogamento e coordenar o rei', 'Parar porque a vitória é automática', 'Mover apenas a dama para sempre', 'Oferecer empate em toda posição'], 0, 'A conversão exige lances legais e uma rede de mate; uma dama extra não impede um empate por afogamento.')],
  ['promocao-das-pretas', 'Conte a promoção das pretas', 'peao-preto-promocao', 'beginner',
    'Peões pretos avançam em direção à primeira fileira. Ao treinar com o tabuleiro invertido, use as coordenadas para evitar confundir a direção de avanço com a posição da tela.',
    quiz('Em qual fileira um peão preto promove?', ['Oitava', 'Primeira', 'Quarta', 'Segunda'], 1, 'As pretas avançam rumo à primeira fileira; as brancas, rumo à oitava.')],
  ['mate-com-dama', 'Dama e rei: construa a rede', 'dama-reduzir-espaco', 'beginner',
    'Use a dama para reduzir a área do rei adversário e o rei para controlar as casas restantes. Dar xeques sem um plano pode apenas deslocar o defensor sem aproximar o mate.',
    quiz('Qual coordenação facilita o mate de dama e rei?', ['Deixar o rei próprio sempre distante', 'Encostar a dama sem proteção no rei rival', 'Dama restringe espaço e rei fecha fugas', 'Capturar o rei adversário'], 2, 'A ação conjunta reduz as casas legais do defensor e permite criar um xeque sem resposta.')],
  ['mate-com-torre', 'Torre e rei: corte e aproxime', 'torre-cortar-rei', 'intermediate',
    'A torre cria uma barreira numa fileira ou coluna. O rei se aproxima para apoiar a redução do espaço. Proteja a torre quando o rei adversário puder alcançá-la.',
    quiz('Qual é uma função típica da torre nessa técnica?', ['Saltar sobre o rei', 'Controlar diagonais', 'Promover um peão inexistente', 'Cortar uma fileira ou coluna'], 3, 'A barreira da torre limita a movimentação do rei defensor enquanto o rei atacante se aproxima.')],
  ['bispo-cor-promocao', 'Bispo: confira a cor da promoção', 'bispo-peao-torre', 'advanced',
    'Com bispo e peão de torre, o controle da casa de promoção pode decidir a conversão. Neste exercício, o bispo não controla a8 e o rei defensor já está no canto; a tablebase confirma o empate.',
    quiz('Que relação precisa ser verificada nesse final?', ['A cor das casas do bispo e da casa de promoção', 'A altura visual da peça', 'A última abertura jogada', 'O valor da dama fora do tabuleiro'], 0, 'Um bispo que não controla a casa de promoção pode ser incapaz de expulsar o rei defensor do canto.')],
  ['torre-peao-passado', 'Torre contra peão: calcule a corrida', 'torre-contra-peao', 'intermediate',
    'Contra um peão avançado, a torre precisa considerar promoção, xeques e apoio do rei. Um xeque lateral só ajuda se não permitir que o peão avance em melhores condições depois.',
    quiz('Antes de dar um xeque lateral, o que merece cálculo?', ['Somente o valor da torre', 'O avanço do peão e a segurança do bloqueio', 'A cor do fundo da tela', 'A possibilidade de roque neste final'], 1, 'É necessário verificar a corrida de promoção e como a resposta do rei afeta o controle do peão.')],
  ['corrida-de-peoes', 'Corrida: promover com xeque importa', 'peoes-corrida', 'intermediate',
    'Conte os lances de cada peão, mas observe o efeito da promoção. Se a nova peça dá xeque, o adversário precisa responder antes de continuar sua própria corrida.',
    quiz('Por que uma promoção com xeque pode mudar uma corrida?', ['Porque promove dois peões', 'Porque encerra toda partida', 'Porque obriga uma resposta ao xeque', 'Porque muda as cores dos reis'], 2, 'Responder ao xeque pode consumir o tempo que o adversário usaria para promover.')],
  ['ler-syzygy', 'Leia a tablebase sem inverter o resultado', 'dama-contra-peao', 'advanced',
    'A categoria geral da API descreve o lado com a vez. A categoria listada dentro de um lance descreve o adversário depois desse lance. DTZ se relaciona ao próximo lance de peão ou captura; não é uma contagem universal até o mate.',
    quiz('Como interpretar a categoria de um movimento retornado pela API de finais?', ['Sempre do ponto de vista das brancas', 'Sempre do ponto de vista de quem iniciou o treino', 'Como número de lances até o mate', 'Do ponto de vista de quem jogará depois dele'], 3, 'Após o movimento, a vez muda. Além disso, categorias condicionais exigem atenção à regra dos 50 lances.')],
];

export function buildLessons(openings, puzzles, endgames) {
  const lessons = [];
  const origins = [];
  function add(slug, title, category, level, description, minutes, steps, question, source) {
    const id = `lesson-${slug}`;
    lessons.push({ id, slug, title, category, level, description,
      sortOrder: lessons.length + 1, minutes, steps, quiz: question });
    origins.push({ id, ...source });
  }
  for (const item of fundamentals) {
    add(item.slug, item.title, 'fundamentals', 'beginner', item.description, item.minutes,
      [step('Entenda a ideia', item.idea), step('Pratique a observação', item.practice)], item.quiz,
      { type: 'original-editorial', reference: 'https://lichess.org/learn' });
  }
  const usedPuzzles = new Set();
  for (const [slug, title, theme, preferredLevel, idea, practice, question] of tactics) {
    const target = { beginner: 950, intermediate: 1700, advanced: 2350 }[preferredLevel];
    const puzzle = puzzles.filter((p) => p.themes.includes(theme) && !usedPuzzles.has(p.id))
      .sort((a, b) => Math.abs(a.rating - target) - Math.abs(b.rating - target) || a.id.localeCompare(b.id))[0];
    assert.ok(puzzle, `Amostra sem tema necessário à aula: ${theme}`);
    usedPuzzles.add(puzzle.id);
    const game = legalPosition(puzzle.fen);
    const opponentMove = playUci(game, puzzle.moves[0]);
    const level = puzzle.rating < 1400 ? 'beginner' : puzzle.rating < 2000 ? 'intermediate' : 'advanced';
    add(slug, title, 'tactics', level, `Reconheça o motivo ${title.split(':')[0].toLowerCase()} em um puzzle real.`, 6,
      [step('Reconheça o padrão', idea),
        step('Observe o lance adversário', `Puzzle Lichess ${puzzle.id}, rating ${puzzle.rating}. O último lance adversário é ${opponentMove.san}. Reproduza esse lance para chegar ao problema.`, { fen: puzzle.fen, moves: [puzzle.moves[0]] }),
        step('Calcule e confira', `${practice} A linha a seguir é a solução publicada pelo Lichess; os lances alternam os dois lados.`, { fen: game.fen(), moves: puzzle.moves.slice(1) })],
      question, { type: 'lichess-puzzle', puzzleId: puzzle.id, theme, sourceUrl: puzzle.sourceUrl });
  }
  for (const [slug, title, name, level, idea, practice, question] of openingLessons) {
    const opening = openings.filter((o) => o.name === name).sort((a, b) => a.moves.length - b.moves.length)[0];
    assert.ok(opening, `Nome oficial de abertura ausente: ${name}`);
    add(slug, title, 'openings', level, `Estude a ideia inicial da abertura ${title.split(':')[0]}.`, 5,
      [step('Entenda o plano', idea),
        step('Reproduza a linha de referência', `Linha ${opening.eco} — ${opening.name}, do catálogo Lichess. ${practice}`, { fen: DEFAULT_POSITION, moves: opening.moves }),
        step('Revise sem decorar', 'Volte à posição inicial e repita a linha explicando cada disputa central e cada desenvolvimento. A linha de catálogo identifica a abertura; não é uma garantia de melhor jogo em todas as variantes.')],
      question, { type: 'lichess-opening', openingId: opening.id, sourceUrl: opening.sourceUrl });
  }
  for (const [slug, title, endgameSlug, level, idea, question] of endgameLessons) {
    const endgame = endgames.find((e) => e.slug === endgameSlug);
    assert.ok(endgame);
    // The lesson starts from the exact same position as the independent endgame drill.
    replay(endgame.fen, []);
    add(slug, title, 'endgames', level, `Pratique ${title.toLowerCase()} numa posição de poucas peças.`, 6,
      [step('Entenda o plano', idea),
        step('Treine a posição', `${endgame.goal} ${endgame.tips.join(' ')}`, { fen: endgame.fen }),
        step('Compare suas escolhas', 'Consulte a tablebase para os lances candidatos. Interprete a categoria da posição pela cor com a vez e a categoria de cada lance pela cor adversária após esse lance. DTZ não substitui a explicação do plano, e resultados condicionais exigem atenção à regra dos 50 lances.')],
      question, { type: 'original-endgame-probed-by-syzygy', endgameId: endgame.id,
        sourceUrl: `https://tablebase.lichess.ovh/standard?fen=${encodeURIComponent(endgame.fen)}` });
  }
  return { lessons, provenance: {
    language: 'pt-BR', authorship: 'Textos originais preparados com assistência de IA para Zav Chess.',
    license: 'Sem licença adicional atribuída ao texto original; sujeito à licença definida pelo projeto.',
    editorialStatus: 'pending-human-review', motorValidatedText: false,
    origins,
  } };
}
