import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { IsEmail, IsString, Length, Matches } from 'class-validator';
import { Transform } from 'class-transformer';
import { Throttle } from '@nestjs/throttler';
import { User } from '@prisma/client';
import { AuthService, publicUser } from './auth.service';
import { AuthGuard, AuthRequest, CurrentUser } from './auth.guard';
import { PrismaService } from '../database/prisma.service';

class LoginDto {
  @IsEmail() @Length(3, 191) @Transform(({ value }) => typeof value === 'string' ? value.trim() : value) email!: string;
  @IsString() @Length(8, 128) password!: string;
}
class RegisterDto extends LoginDto {
  @IsString() @Length(2, 80) @Matches(/\S/) @Transform(({ value }) => typeof value === 'string' ? value.trim() : value) name!: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService, private readonly db: PrismaService) {}
  @Post('register') @Throttle({ default: { limit: 10, ttl: 60_000 } })
  register(@Body() body: RegisterDto) { return this.auth.register(body.name, body.email, body.password); }
  @Post('login') @Throttle({ default: { limit: 10, ttl: 60_000 } })
  login(@Body() body: LoginDto) { return this.auth.login(body.email, body.password); }
  @Get('me') @UseGuards(AuthGuard)
  me(@CurrentUser() user: User) { return publicUser(user); }
  @Post('logout') @UseGuards(AuthGuard)
  async logout(@Req() request: AuthRequest) { await this.db.session.deleteMany({ where: { id: request.sessionId } }); return { ok: true }; }
}
