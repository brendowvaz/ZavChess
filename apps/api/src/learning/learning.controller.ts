import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsInt, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';
import { User } from '@prisma/client';
import { AuthGuard, CurrentUser } from '../auth/auth.guard';
import { UCI_PATTERN } from '../chess/chess-rules';
import { LearningService } from './learning.service';

class OpeningAttemptDto {
  @IsArray() @ArrayMaxSize(100) @Matches(UCI_PATTERN, { each: true }) moves!: string[];
  @IsIn(['w', 'b']) side!: 'w' | 'b';
  @IsBoolean() hintUsed!: boolean;
  @IsInt() @Min(0) @Max(10000) mistakes!: number;
  @IsString() @MinLength(8) @MaxLength(100) requestId!: string;
}

@Controller('learning')
@UseGuards(AuthGuard)
export class LearningController {
  constructor(private readonly learning: LearningService) {}
  @Get('plan') plan(@CurrentUser() user: User) { return this.learning.plan(user.id); }
  @Get('report') report(@CurrentUser() user: User) { return this.learning.report(user.id); }
  @Post('openings/:id/attempt') openingAttempt(@CurrentUser() user: User, @Param('id') id: string, @Body() body: OpeningAttemptDto) {
    return this.learning.openingAttempt(user.id, id, body.moves, body.side, body.hintUsed, body.mistakes, body.requestId);
  }
}
