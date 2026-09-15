import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { Chess } from 'chess.js';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { EngineAnalysis, EngineMove } from './analysis-contract';
import { analyzeMoveWithEngine, legalAnalysisLine, parseAnalysisPosition, validateAnalysisDepth } from './analysis-coach';
import { parseExactUciInfo } from './analysis-uci';
import { chooseWeakenedMove, parseRankedEngineMove, type RankedEngineMove } from './weakened-move';
import {
  emptyStrengthCapabilities,
  readStrengthOption,
  strengthSettings,
  type EngineDifficulty,
} from './engine-strength';

type Evaluation = { category: string; dtz: number | null; dtm: number | null; moves: { uci: string; san: string; category: string; dtz: number | null }[] };
type StockfishRequest = { kind: 'analysis'; depth: number } | { kind: 'move'; difficulty: EngineDifficulty };

function parsePosition(fen: string) {
  try { return new Chess(fen); }
  catch { throw new BadRequestException('Posição FEN inválida.'); }
}

@Injectable()
export class EngineService {
  private activeAnalyses = 0;
  private readonly tablebaseCache = new Map<string, { expiresAt: number; data: Evaluation }>();
  private readonly pendingTablebase = new Map<string, Promise<Evaluation>>();

  async evaluateEndgame(fen: string): Promise<Evaluation> {
    const chess = parsePosition(fen);
    if (chess.board().flat().filter(Boolean).length > 7) throw new BadRequestException('O treino de finais aceita até 7 peças, incluindo os reis.');
    if (chess.fen().split(' ')[2] !== '-') throw new BadRequestException('A tablebase não aceita direitos de roque.');
    const key = chess.fen();
    const cached = this.tablebaseCache.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.data;
    const pending = this.pendingTablebase.get(key);
    if (pending) return pending;
    if (this.pendingTablebase.size >= 2) throw new ServiceUnavailableException('Aguarde a avaliação do final em andamento.');
    const request = this.fetchTablebase(key);
    this.pendingTablebase.set(key, request);
    try { return await request; }
    finally { this.pendingTablebase.delete(key); }
  }

  private async fetchTablebase(fen: string): Promise<Evaluation> {
    try {
      const response = await fetch(`https://tablebase.lichess.ovh/standard?fen=${encodeURIComponent(fen)}`, { signal: AbortSignal.timeout(8000), headers: { 'User-Agent': 'ZavChess/0.1 (local educational app)' } });
      if (!response.ok) throw new Error(`Tablebase HTTP ${response.status}`);
      const body = await response.json() as Evaluation;
      if (typeof body.category !== 'string' || !Array.isArray(body.moves)) throw new Error('Resposta de tablebase inválida');
      const data = { category: body.category, dtz: body.dtz, dtm: body.dtm, moves: body.moves.map(({ uci, san, category, dtz }) => ({ uci, san, category, dtz })) };
      if (this.tablebaseCache.size >= 500) this.tablebaseCache.delete(this.tablebaseCache.keys().next().value!);
      this.tablebaseCache.set(fen, { expiresAt: Date.now() + 86_400_000, data });
      return data;
    } catch { throw new ServiceUnavailableException('A tablebase está indisponível. Verifique a conexão e tente novamente.'); }
  }

  async analyzeMove(fen: string, move: string, depth = 12) {
    return analyzeMoveWithEngine(fen, move, depth, (position, requestedDepth) => this.analyze(position, requestedDepth));
  }

  async analyze(fen: string, depth: number): Promise<EngineAnalysis> {
    validateAnalysisDepth(depth);
    const chess = parseAnalysisPosition(fen);
    if (chess.isGameOver()) return { fen: chess.fen(), bestMove: null, score: { type: chess.isCheckmate() ? 'mate' : 'cp', value: 0 }, depth: 0, pv: [], engine: 'Regras do xadrez: posição terminada' };
    return this.executeStockfish(chess.fen(), { kind: 'analysis', depth });
  }

  async play(fen: string, difficulty: EngineDifficulty): Promise<EngineMove> {
    const chess = parseAnalysisPosition(fen);
    if (chess.isGameOver()) return { fen: chess.fen(), bestMove: null, engine: 'Regras do xadrez: posição terminada', difficulty, elo: null };
    return this.executeStockfish(chess.fen(), { kind: 'move', difficulty });
  }

  private executeStockfish(fen: string, request: { kind: 'analysis'; depth: number }): Promise<EngineAnalysis>;
  private executeStockfish(fen: string, request: { kind: 'move'; difficulty: EngineDifficulty }): Promise<EngineMove>;
  private async executeStockfish(fen: string, request: StockfishRequest): Promise<EngineAnalysis | EngineMove> {
    const enginePath = process.env.STOCKFISH_PATH || resolve(__dirname, '../../../../.local/stockfish/stockfish.exe');
    if (!existsSync(enginePath)) throw new ServiceUnavailableException('Stockfish não instalado. Execute scripts/setup-stockfish.ps1.');
    if (this.activeAnalyses >= 2) throw new ServiceUnavailableException('O motor está ocupado. Tente novamente em alguns segundos.');
    this.activeAnalyses++;
    try { return await this.runStockfish(enginePath, fen, request); }
    finally { this.activeAnalyses--; }
  }

  private runStockfish(enginePath: string, fen: string, request: StockfishRequest) {
    return new Promise<EngineAnalysis | EngineMove>((resolveResult, reject) => {
      const process = spawn(enginePath, [], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
      let buffer = '';
      let engine = 'Stockfish';
      let evaluation: ReturnType<typeof parseExactUciInfo> = null;
      let capabilities = emptyStrengthCapabilities();
      let selectedElo: number | null = null;
      let moveSearch: { depth: number | null; movetimeMs: number; weakening: NonNullable<ReturnType<typeof strengthSettings>>['weakening'] } | null = null;
      const rankedMovesByDepth = new Map<number, Map<number, RankedEngineMove>>();
      let finished = false;
      const fail = () => finish(new ServiceUnavailableException('Não foi possível concluir a análise do Stockfish.'));
      const timer = setTimeout(fail, 12_000);
      const finish = (error?: Error, result?: EngineAnalysis | EngineMove) => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        process.kill();
        if (error) reject(error);
        else if (result) resolveResult(result);
        else reject(new ServiceUnavailableException('O motor não retornou uma resposta completa.'));
      };
      process.on('error', fail);
      process.stdin.on('error', fail);
      process.on('exit', () => { if (!finished) fail(); });
      process.stderr.on('data', () => { /* Drain stderr; never send engine internals to clients. */ });
      process.stdout.on('data', (chunk: Buffer) => {
        buffer += chunk.toString();
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (finished) break;
          if (line.startsWith('id name ')) engine = line.slice(8);
          if (line.startsWith('option name ')) capabilities = readStrengthOption(line, capabilities);
          if (line === 'uciok') {
            const commands = ['setoption name Threads value 1', 'setoption name Hash value 32'];
            if (request.kind === 'move') {
              const settings = strengthSettings(request.difficulty, capabilities);
              if (!settings) {
                finish(new ServiceUnavailableException('Esta instalação do Stockfish não oferece controle de dificuldade.'));
                continue;
              }
              selectedElo = settings.elo;
              moveSearch = { depth: settings.depth, movetimeMs: settings.movetimeMs, weakening: settings.weakening };
              commands.push(...settings.commands);
            }
            process.stdin.write(`${commands.join('\n')}\nisready\n`);
          }
          if (line === 'readyok') {
            if (request.kind === 'analysis') {
              process.stdin.write(`position fen ${fen}\ngo depth ${request.depth} movetime 1800\n`);
            } else if (moveSearch) {
              const depth = moveSearch.depth === null ? '' : ` depth ${moveSearch.depth}`;
              process.stdin.write(`position fen ${fen}\ngo movetime ${moveSearch.movetimeMs}${depth}\n`);
            } else {
              fail();
            }
          }
          const info = parseExactUciInfo(line);
          if (info && (!evaluation || info.depth >= evaluation.depth)) evaluation = info;
          if (request.kind === 'move' && moveSearch?.weakening) {
            const candidate = parseRankedEngineMove(line);
            if (candidate) {
              const atDepth = rankedMovesByDepth.get(candidate.depth) ?? new Map<number, RankedEngineMove>();
              atDepth.set(candidate.multipv, candidate);
              rankedMovesByDepth.set(candidate.depth, atDepth);
            }
          }
          if (line.startsWith('bestmove ')) {
            const engineMove = line.split(/\s+/)[1];
            if (request.kind === 'move') {
              const rankedMoves = [...rankedMovesByDepth.values()].sort((a, b) => {
                if (a.size !== b.size) return b.size - a.size;
                return (b.values().next().value?.depth ?? 0) - (a.values().next().value?.depth ?? 0);
              })[0]?.values() ?? [];
              const move = moveSearch?.weakening
                ? chooseWeakenedMove(rankedMoves, moveSearch.weakening) ?? engineMove
                : engineMove;
              if (!move || legalAnalysisLine(fen, [move], 'alternative-pv').moves.length !== 1) { fail(); continue; }
              finish(undefined, { fen, bestMove: move, engine, difficulty: request.difficulty, elo: selectedElo });
              continue;
            }
            if (!evaluation || evaluation.pv[0] !== engineMove) { fail(); continue; }
            const legal = legalAnalysisLine(fen, evaluation.pv, 'alternative-pv');
            if (!legal.moves.length) { fail(); continue; }
            evaluation.pv = legal.moves;
            finish(undefined, { fen, bestMove: engineMove, ...evaluation, engine });
          }
        }
      });
      process.stdin.write('uci\n');
    });
  }
}
