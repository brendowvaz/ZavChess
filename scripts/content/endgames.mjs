import assert from 'node:assert/strict';
import { cachedDownload, legalPosition, playUci, sha256 } from './lib.mjs';

// Original teaching setups, not positions attributed to historical games.
// No Lucena/Philidor labels: every position is independently probed by Syzygy.
const setups = [
  ['dama-reduzir-espaco', 'Dama: reduzir o espaço do rei', 'Coordene rei e dama para conduzir o rei adversário à borda.', '7k/8/5K2/8/8/3Q4/8/8 w - - 0 1', 'Dar xeque-mate sem afogar o rei.', 'beginner', ['Restrinja uma fileira ou coluna de cada vez.', 'Aproxime seu rei para proteger as casas de fuga.', 'Antes de um lance sem xeque, confira se o adversário ainda pode jogar.']],
  ['dama-rei-central', 'Dama contra rei no centro', 'Comece a técnica de mate com o rei defensor ainda ativo.', '8/4k3/8/8/3K4/8/8/Q7 w - - 0 1', 'Levar o rei à borda e completar o mate.', 'beginner', ['A dama corta caminhos; o rei ajuda a fechar a rede.', 'Evite perseguir o rei só com xeques.', 'Mantenha a dama fora do alcance do rei adversário.']],
  ['dama-defesa', 'Defender contra a dama', 'Jogue com as pretas e observe como o rei atacante precisa colaborar.', '8/4k3/8/8/3K4/8/8/Q7 b - - 0 1', 'Prolongar a resistência e identificar oportunidades de afogamento.', 'intermediate', ['Procure casas centrais seguras.', 'Ataque uma dama desprotegida quando isso for legal.', 'A resistência correta não garante empate nesta posição.']],
  ['torre-cortar-rei', 'Torre: cortar o rei', 'Use a torre para limitar o rei adversário e aproxime o seu rei.', '7k/8/5K2/8/8/8/8/R7 w - - 0 1', 'Dar mate com rei e torre.', 'beginner', ['A torre pode cortar uma fileira inteira.', 'Proteja a torre se ela se aproximar do rei adversário.', 'O rei atacante precisa controlar casas de fuga.']],
  ['torre-rei-central', 'Torre contra rei no centro', 'Pratique a coordenação sem depender de um mate imediato.', '8/5k2/8/8/3K4/8/1R6/8 w - - 0 1', 'Conduzir o rei à borda e dar mate.', 'intermediate', ['Crie uma barreira com a torre.', 'Aproxime o rei antes de reduzir novamente o espaço.', 'Um lance de espera pode melhorar a oposição dos reis.']],
  ['torre-defesa', 'Resistir contra a torre', 'O defensor procura manter mobilidade enquanto o atacante coordena as peças.', '8/5k2/8/8/3K4/8/1R6/8 b - - 0 1', 'Encontrar a defesa mais longa indicada pela tablebase.', 'intermediate', ['Fique longe da borda quando possível.', 'Aproxime-se de uma torre que não esteja protegida.', 'Compare a resistência em lances; não confunda isso com empate.']],
  ['peao-rei-na-sexta', 'Peão: rei na sexta fileira', 'O rei branco já ocupa uma casa importante à frente do peão.', '4k3/8/4K3/4P3/8/8/8/8 w - - 0 1', 'Promover o peão mantendo a coordenação.', 'beginner', ['O rei abre caminho antes de o peão avançar.', 'Confira a resposta do rei adversário a cada lance.', 'Não permita que o peão fique sem proteção.']],
  ['peao-oposicao', 'Oposição em final de peão', 'Observe como a vez de jogar influencia a passagem do rei.', '8/8/4k3/8/4K3/4P3/8/8 w - - 0 1', 'Determinar o resultado e escolher um lance que o preserve.', 'intermediate', ['Reis na mesma coluna podem disputar a oposição.', 'O peão oferece tempos de espera, mas eles são finitos.', 'Consulte a categoria da posição antes de prometer vitória.']],
  ['peao-oposicao-pretas', 'Oposição: a vez das pretas', 'A mesma disposição de peças permite comparar a importância do tempo.', '8/8/4k3/8/4K3/4P3/8/8 b - - 0 1', 'Defender o melhor resultado disponível para as pretas.', 'intermediate', ['Compare com a posição em que as brancas têm a vez.', 'Mantenha o rei diante do peão quando isso sustentar a defesa.', 'A categoria de cada resposta muda de perspectiva.']],
  ['peao-torre-canto', 'Peão de torre e rei no canto', 'O rei defensor ocupa a casa de promoção do peão da coluna a.', 'k7/P7/K7/8/8/8/8/8 w - - 0 1', 'Reconhecer o recurso de empate e explicar por que o peão não passa.', 'beginner', ['O peão de torre não tem uma coluna do outro lado para contornar o rei.', 'Observe o afogamento quando o rei não dispõe de casas.', 'Não aplique automaticamente regras de peões centrais.']],
  ['peao-promocao', 'Promover com segurança', 'Um peão passado está a um passo da promoção, com os reis afastados.', '8/2P3k1/4K3/8/8/8/8/8 w - - 0 1', 'Promover e converter a vantagem material.', 'beginner', ['Escolha explicitamente a peça de promoção.', 'Uma dama costuma facilitar a conversão, mas ainda é preciso evitar afogamento.', 'O treino continua depois de promover.']],
  ['peao-preto-promocao', 'Promoção com as pretas', 'Pratique a direção do peão preto e a mudança de perspectiva.', '8/8/8/8/8/4k3/4p3/K7 b - - 0 1', 'Promover o peão preto e vencer o final.', 'beginner', ['Peões pretos promovem na primeira fileira.', 'A cor com a vez está no campo side.', 'Confira as casas legais do rei branco após a promoção.']],
  ['bispo-peao-torre', 'Bispo e peão de torre: o canto', 'Investigue a relação entre a cor do bispo e a casa de promoção.', 'k7/P7/KB6/8/8/8/8/8 w - - 0 1', 'Explicar o empate com o rei defensor no canto.', 'advanced', ['O bispo não controla a casa a8 nesta posição.', 'Material extra não basta para expulsar o rei do canto.', 'Teste movimentos do rei e observe as posições de afogamento.']],
  ['torre-contra-peao', 'Torre contra peão passado', 'A torre enfrenta um peão preto que se aproxima da promoção.', '8/8/8/8/4k3/4p3/K7/7R w - - 0 1', 'Encontrar um plano que preserve o resultado da tablebase.', 'intermediate', ['Calcule a promoção antes de dar um xeque lateral.', 'O rei deve colaborar se houver tempo.', 'Compare bloqueio, ataque ao peão e xeques.']],
  ['dama-contra-peao', 'Dama contra peão avançado', 'Calcule os xeques e o risco de promoção do peão preto.', '8/8/8/8/8/2p5/K1k5/7Q w - - 0 1', 'Coordenar dama e rei sem permitir uma promoção favorável ao adversário.', 'advanced', ['Não suponha que todos os peões na penúltima fileira sejam equivalentes.', 'Verifique o alcance da dama em cada diagonal.', 'Use a tablebase para comparar os lances candidatos.']],
  ['peoes-corrida', 'Corrida de peões passados', 'Dois peões afastados exigem contar lances e considerar os reis.', '7k/P7/8/8/8/8/7p/K7 w - - 0 1', 'Calcular a corrida e escolher a promoção adequada.', 'intermediate', ['Conte quem promove primeiro.', 'Uma promoção com xeque pode mudar o ritmo da corrida.', 'Depois de promover, reavalie a posição inteira.']],
];

export const ENDGAME_SEEDS = setups.map(([slug, title, description, fen, goal, level, tips]) => ({
  id: `endgame-${slug}`, slug, title, description, fen, goal, level, side: fen.split(' ')[1], tips,
}));

export async function importEndgames(options) {
  const evidence = [];
  for (const endgame of ENDGAME_SEEDS) {
    const game = legalPosition(endgame.fen);
    assert.ok(!game.isGameOver(), `Posição inicial já encerrada: ${endgame.slug}`);
    const url = `https://tablebase.lichess.ovh/standard?fen=${encodeURIComponent(endgame.fen)}`;
    const downloaded = await cachedDownload(`tablebase/${endgame.slug}.json`, url, {
      ...options, license: 'Tablebase facts; freely redistributable (Syzygy terms)',
      licenseUrl: 'https://github.com/syzygy1/tb#terms-of-use',
    });
    const probe = JSON.parse(downloaded.bytes);
    assert.ok(['win', 'draw', 'loss', 'cursed-win', 'blessed-loss', 'maybe-win', 'maybe-loss'].includes(probe.category));
    assert.ok(probe.moves?.length > 0);
    const legalMoves = game.moves({ verbose: true }).map((m) => `${m.from}${m.to}${m.promotion ?? ''}`).sort();
    assert.deepEqual(probe.moves.map((m) => m.uci).sort(), legalMoves, `Tablebase e chess.js discordam: ${endgame.slug}`);
    for (const move of probe.moves) {
      const copy = legalPosition(endgame.fen);
      assert.equal(playUci(copy, move.uci).san, move.san);
    }
    evidence.push({ id: endgame.id, fenSha256: sha256(endgame.fen), category: probe.category, dtz: probe.dtz, dtm: probe.dtm ?? null, source: downloaded.metadata });
    console.log(`Syzygy ${endgame.slug}: ${probe.category}, DTZ ${probe.dtz}`);
  }
  return { endgames: ENDGAME_SEEDS, provenance: {
    origin: 'Posições didáticas compostas originalmente; não atribuídas a partidas históricas.',
    validation: 'Legalidade com chess.js; resultado e lista completa de lances consultados na API Syzygy do Lichess.',
    perspective: 'category da posição = lado com a vez; category de um lance = adversário após esse lance.',
    evidence,
  } };
}
