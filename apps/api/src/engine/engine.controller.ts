import { Body, Controller, Get, NotFoundException, Param, Post, Query } from '@nestjs/common';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { Throttle } from '@nestjs/throttler';
import { EngineService } from './engine.service';
import { PrismaService } from '../database/prisma.service';

class FenQuery { @IsString() @MaxLength(200) fen!: string; }
class AnalysisDto extends FenQuery { @IsOptional() @IsInt() @Min(1) @Max(18) depth = 12; }

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
  analyze(@Body() body: AnalysisDto) { return this.engine.analyze(body.fen, body.depth); }
}
