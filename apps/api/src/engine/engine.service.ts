import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { Chess } from 'chess.js';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

type Score = { type: 'cp' | 'mate'; value: number };
type Evaluation = { category: string; dtz: number | null; dtm: number | null; moves: { uci: string; san: string; category: string; dtz: number | null }[] };

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

  async analyze(fen: string, depth: number) {
    const chess = parsePosition(fen);
    if (chess.isGameOver()) return { fen: chess.fen(), bestMove: null, score: { type: chess.isCheckmate() ? 'mate' : 'cp', value: 0 }, depth: 0, pv: [], engine: 'Regras do xadrez: posição terminada' };
    const enginePath = process.env.STOCKFISH_PATH || resolve(__dirname, '../../../../.local/stockfish/stockfish.exe');
    if (!existsSync(enginePath)) throw new ServiceUnavailableException('Stockfish não instalado. Execute scripts/setup-stockfish.ps1.');
    if (this.activeAnalyses >= 2) throw new ServiceUnavailableException('O motor está ocupado. Tente novamente em alguns segundos.');
    this.activeAnalyses++;
    try { return await this.runStockfish(enginePath, chess.fen(), depth); }
    finally { this.activeAnalyses--; }
  }

  private runStockfish(enginePath: string, fen: string, requestedDepth: number) {
    return new Promise<{ fen: string; bestMove: string | null; score: Score; depth: number; pv: string[]; engine: string }>((resolveResult, reject) => {
      const process = spawn(enginePath, [], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
      let buffer = '';
      let engine = 'Stockfish';
      let depth = 0;
      let score: Score = { type: 'cp', value: 0 };
      let pv: string[] = [];
      let finished = false;
      const fail = () => finish(new ServiceUnavailableException('Não foi possível concluir a análise do Stockfish.'));
      const timer = setTimeout(fail, 12_000);
      const finish = (error?: Error, bestMove: string | null = null) => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        process.kill();
        if (error) reject(error);
        else resolveResult({ fen, bestMove, score, depth, pv, engine });
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
          if (line.startsWith('id name ')) engine = line.slice(8);
          if (line === 'uciok') process.stdin.write('setoption name Threads value 1\nsetoption name Hash value 32\nisready\n');
          if (line === 'readyok') process.stdin.write(`position fen ${fen}\ngo depth ${requestedDepth} movetime 1800\n`);
          const scoreMatch = line.match(/\bscore (cp|mate) (-?\d+)/);
          if (line.startsWith('info ') && scoreMatch) {
            score = { type: scoreMatch[1] as 'cp' | 'mate', value: Number(scoreMatch[2]) };
            depth = Number(line.match(/\bdepth (\d+)/)?.[1] || depth);
            pv = line.match(/\bpv (.+)$/)?.[1].trim().split(' ') || [];
          }
          if (line.startsWith('bestmove ')) {
            const move = line.split(' ')[1];
            finish(undefined, move === '(none)' || move === '0000' ? null : move);
          }
        }
      });
      process.stdin.write('uci\n');
    });
  }
}
