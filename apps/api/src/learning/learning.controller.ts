import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';
import { User } from '@prisma/client';
import { AuthGuard, CurrentUser } from '../auth/auth.guard';
import { UCI_PATTERN } from '../chess/chess-rules';
import { LearningService } from './learning.service';

class OpeningAttemptDto {
  @IsArray() @ArrayMaxSize(100) @Matches(UCI_PATTERN, { each: true }) moves!: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(50) @IsInt({ each: true }) @Min(0, { each: true }) @Max(99, { each: true }) plies?: number[];
  @IsIn(['w', 'b']) side!: 'w' | 'b';
  @IsBoolean() hintUsed!: boolean;
  @IsInt() @Min(0) @Max(10000) mistakes!: number;
  @IsOptional() @IsArray() @ArrayMaxSize(50) @IsInt({ each: true }) @Min(0, { each: true }) @Max(1000, { each: true }) positionMistakes?: number[];
  @IsString() @MinLength(8) @MaxLength(100) requestId!: string;
}
class ImportGamesDto {
  @IsIn(['chesscom', 'lichess']) platform!: 'chesscom' | 'lichess';
  @IsString() @MinLength(2) @MaxLength(80) @Matches(/^[A-Za-z0-9_-]+$/) username!: string;
}
class ReviewGameDto { @IsInt() @Min(0) @Max(2000) ply!: number; }
class ReportQuery { @IsOptional() @Type(() => Number) @IsIn([7, 28, 90, 365]) days = 28; }
class PlanQuery { @IsOptional() @IsIn(['start', 'improve']) track: 'start' | 'improve' = 'improve'; }

@Controller('learning')
@UseGuards(AuthGuard)
export class LearningController {
  constructor(private readonly learning: LearningService) {}
  @Get('plan') plan(@CurrentUser() user: User, @Query() query: PlanQuery) { return this.learning.plan(user.id, query.track); }
  @Get('report') report(@CurrentUser() user: User, @Query() query: ReportQuery) { return this.learning.report(user.id, query.days); }
  @Get('repertoires') repertoires(@CurrentUser() user: User) { return this.learning.repertoires(user.id); }
  @Get('repertoires/:id') repertoire(@CurrentUser() user: User, @Param('id') id: string) { return this.learning.repertoire(user.id, id); }
  @Post('repertoires/:id/select') selectRepertoire(@CurrentUser() user: User, @Param('id') id: string) { return this.learning.selectRepertoire(user.id, id); }
  @Post('games/import') importGames(@CurrentUser() user: User, @Body() body: ImportGamesDto) { return this.learning.importGames(user.id, body.platform, body.username); }
  @Get('games') games(@CurrentUser() user: User) { return this.learning.games(user.id); }
  @Get('games/:id') game(@CurrentUser() user: User, @Param('id') id: string) { return this.learning.game(user.id, id); }
  @Post('games/:id/review') reviewGame(@CurrentUser() user: User, @Param('id') id: string, @Body() body: ReviewGameDto) { return this.learning.reviewGameMove(user.id, id, body.ply); }
  @Post('openings/:id/attempt') openingAttempt(@CurrentUser() user: User, @Param('id') id: string, @Body() body: OpeningAttemptDto) {
    return this.learning.openingAttempt(user.id, id, body.moves, body.plies, body.side, body.hintUsed, body.mistakes, body.positionMistakes, body.requestId);
  }
}
