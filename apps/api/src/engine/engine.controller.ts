import { Body, Controller, Get, NotFoundException, Param, Post, Query } from '@nestjs/common';
import { IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import { Throttle } from '@nestjs/throttler';
import { EngineService } from './engine.service';
import { PrismaService } from '../database/prisma.service';
import { ENGINE_DIFFICULTIES, type EngineDifficulty } from './engine-strength';

class FenQuery { @IsString() @MaxLength(200) fen!: string; }
class AnalysisDto extends FenQuery {
  @IsOptional() @IsInt() @Min(1) @Max(18) depth = 12;
  @IsOptional() @IsInt() @Min(1) @Max(3) multipv = 1;
}
class MoveAnalysisDto extends AnalysisDto {
  @IsString() @Matches(/^[a-h][1-8][a-h][1-8][qrbn]?$/, { message: 'move deve ser um lance UCI, por exemplo e2e4 ou a7a8q.' })
  move!: string;
}
class EngineMoveDto extends FenQuery {
  @IsOptional() @IsIn(ENGINE_DIFFICULTIES) difficulty: EngineDifficulty = 'intermediate';
}

@Controller()
export class EngineController {
  constructor(private readonly engine: EngineService, private readonly db: PrismaService) {}
  @Get('endgames') endgames() { return this.db.endgame.findMany({ orderBy: { id: 'asc' } }); }
  @Get('endgames/evaluate') @Throttle({ default: { limit: 60, ttl: 60_000 } })
  evaluate(@Query() query: FenQuery) { return this.engine.evaluateEndgame(query.fen); }
  @Get('endgames/:id') async endgame(@Param('id') id: string) {
    const item = await this.db.endgame.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Final não encontrado.');
    return item;
  }
  @Post('analysis') @Throttle({ default: { limit: 30, ttl: 60_000 } })
  analyze(@Body() body: AnalysisDto) { return this.engine.analyze(body.fen, body.depth, body.multipv); }
  @Post('analysis/move') @Throttle({ default: { limit: 15, ttl: 60_000 } })
  analyzeMove(@Body() body: MoveAnalysisDto) { return this.engine.analyzeMove(body.fen, body.move, body.depth); }
  @Post('engine/move') @Throttle({ default: { limit: 30, ttl: 60_000 } })
  engineMove(@Body() body: EngineMoveDto) { return this.engine.play(body.fen, body.difficulty); }
}
