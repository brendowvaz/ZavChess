import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';
import type { User } from '@prisma/client';
import { AuthGuard, CurrentUser } from '../auth/auth.guard';
import { CommunityService } from './community.service';
class CreateGroup { @IsString() @MinLength(2) @MaxLength(80) name!: string; }
class JoinGroup { @IsString() @Matches(/^[a-fA-F0-9]{24}$/) inviteCode!: string; }
@Controller('community')
@UseGuards(AuthGuard)
export class CommunityController {
  constructor(private readonly community: CommunityService) {}
  @Get('groups') groups(@CurrentUser() user: User) { return this.community.groups(user.id); }
  @Post('groups') create(@CurrentUser() user: User, @Body() body: CreateGroup) { return this.community.create(user.id, body.name); }
  @Post('join') join(@CurrentUser() user: User, @Body() body: JoinGroup) { return this.community.join(user.id, body.inviteCode); }
  @Get('groups/:id') group(@CurrentUser() user: User, @Param('id') id: string) { return this.community.group(user.id, id); }
  @Post('groups/:id/leave') leave(@CurrentUser() user: User, @Param('id') id: string) { return this.community.leave(user.id, id); }
}
