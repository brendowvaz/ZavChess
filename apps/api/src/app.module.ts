import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { PrismaService } from './database/prisma.service';
import { AuthService } from './auth/auth.service';
import { AuthController } from './auth/auth.controller';
import { AuthGuard } from './auth/auth.guard';
import { ContentController } from './content/content.controller';
import { ContentService } from './content/content.service';
import { EngineService } from './engine/engine.service';
import { EngineController } from './engine/engine.controller';

@Module({
  imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }])],
  controllers: [AuthController, ContentController, EngineController],
  providers: [PrismaService, AuthService, AuthGuard, ContentService, EngineService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
