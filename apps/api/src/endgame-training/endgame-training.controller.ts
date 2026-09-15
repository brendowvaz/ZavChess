import { Body, Controller, Get, Header, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ArrayMaxSize, IsArray, IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { EndgameTrainingService } from './endgame-training.service';
import { LIMITS, THEMES, type Theme } from './domain';

export class GenerateEndgameQuery {
  @IsIn(THEMES) theme!: Theme;
  @IsOptional() @IsString() @MaxLength(200) excludeFen?: string;
  @IsOptional() @IsIn(['lucena', 'philidor']) lesson?: string;
}
export class EndgamePositionDto {
  @IsString() @MaxLength(200) initialFen!: string;
  @IsArray() @ArrayMaxSize(LIMITS.history) @IsString({ each: true })
  @Matches(/^[a-h][1-8][a-h][1-8][qrbn]?$/, { each: true }) history: string[] = [];
}
export class EndgameTurnDto extends EndgamePositionDto {
  @IsString() @Matches(/^[a-h][1-8][a-h][1-8][qrbn]?$/) move!: string;
}

// Public, stateless training. The parent may integrate authenticated progress separately.
@Controller('endgame-training')
export class EndgameTrainingController {
  constructor(private readonly training: EndgameTrainingService) {}
  @Get('generate') @Header('Cache-Control', 'no-store') @Throttle({ default: { limit: 12, ttl: 60_000 } })
  generate(@Query() query: GenerateEndgameQuery) { return this.training.generate(query.theme, query.excludeFen, query.lesson); }
  @Post('position') @Throttle({ default: { limit: 60, ttl: 60_000 } })
  position(@Body() body: EndgamePositionDto) { return this.training.position(body); }
  @Post('move') @Throttle({ default: { limit: 60, ttl: 60_000 } })
  move(@Body() body: EndgameTurnDto) { return this.training.turn(body); }
}
