import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ArrayMaxSize, IsArray, IsBoolean, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { User } from '@prisma/client';
import { ContentService } from './content.service';
import { AuthGuard, CurrentUser } from '../auth/auth.guard';
import { UCI_PATTERN } from '../chess/chess-rules';
import { PrismaService } from '../database/prisma.service';

class PageQuery {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100_000) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 30;
}
class OpeningQuery extends PageQuery {
  @IsOptional() @IsString() @MaxLength(100) search = '';
}
class PuzzleQuery extends PageQuery {
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(4000) minRating = 600;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(4000) maxRating = 1800;
  @IsOptional() @IsString() @MaxLength(80) theme = '';
}
class AnswerDto { @IsInt() @Min(0) @Max(20) answer!: number; }
class AttemptDto {
  @IsArray() @ArrayMaxSize(100) @Matches(UCI_PATTERN, { each: true }) moves!: string[];
  @IsOptional() @IsBoolean() hintUsed = false;
}

@Controller()
export class ContentController {
  constructor(private readonly content: ContentService, private readonly db: PrismaService) {}
  @Get('health') async health() { await this.db.$queryRaw`SELECT 1`; return { status: 'ok', database: 'connected' }; }
  @Get('lessons') lessons() { return this.content.lessons(); }
  @Get('lessons/:id') lesson(@Param('id') id: string) { return this.content.lesson(id); }
  @Post('lessons/:id/complete') @UseGuards(AuthGuard)
  complete(@CurrentUser() user: User, @Param('id') id: string, @Body() body: AnswerDto) { return this.content.completeLesson(user.id, id, body.answer); }
  @Get('openings') openings(@Query() query: OpeningQuery) { return this.content.openings(query.search, query.page, query.pageSize); }
  @Get('openings/:id') opening(@Param('id') id: string) { return this.content.opening(id); }
  @Get('puzzles') puzzles(@Query() query: PuzzleQuery) { return this.content.puzzles(query.minRating, query.maxRating, query.theme, query.page, query.pageSize); }
  @Post('puzzles/:id/attempt') @UseGuards(AuthGuard)
  attempt(@CurrentUser() user: User, @Param('id') id: string, @Body() body: AttemptDto) { return this.content.attemptPuzzle(user.id, id, body.moves, body.hintUsed); }
  @Get('progress') @UseGuards(AuthGuard) progress(@CurrentUser() user: User) { return this.content.progress(user.id); }
  @Get('dashboard') @UseGuards(AuthGuard) dashboard(@CurrentUser() user: User) { return this.content.dashboard(user); }
}
