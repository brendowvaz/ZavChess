import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { Prisma, User } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { hashPassword, verifyPassword } from './password';

export const publicUser = (user: User) => ({ id: user.id, name: user.name, email: user.email, rating: user.rating, xp: user.xp });
export const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex');

@Injectable()
export class AuthService {
  constructor(private readonly db: PrismaService) {}

  async register(name: string, email: string, password: string) {
    try {
      const user = await this.db.user.create({ data: { name: name.trim(), email: email.trim().toLowerCase(), passwordHash: await hashPassword(password) } });
      return this.createSession(user);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException('Este e-mail já está cadastrado.');
      throw error;
    }
  }

  async login(email: string, password: string) {
    const user = await this.db.user.findUnique({ where: { email: email.trim().toLowerCase() } });
    // Equal-cost password work makes unknown e-mails less distinguishable by timing.
    const valid = await verifyPassword(password, user?.passwordHash || '00000000000000000000000000000000:' + '00'.repeat(64));
    if (!user || !valid) throw new UnauthorizedException('E-mail ou senha incorretos.');
    return this.createSession(user);
  }

  private async createSession(user: User) {
    const token = randomBytes(32).toString('base64url');
    await this.db.session.deleteMany({ where: { userId: user.id, expiresAt: { lt: new Date() } } });
    await this.db.session.create({ data: { userId: user.id, tokenHash: tokenHash(token), expiresAt: new Date(Date.now() + 7 * 86_400_000) } });
    return { token, user: publicUser(user) };
  }
}
