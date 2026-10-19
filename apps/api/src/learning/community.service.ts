import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../database/prisma.service';
import { calculateStreak } from '../chess/chess-rules';

@Injectable()
export class CommunityService {
  constructor(private readonly db: PrismaService) {}
  async groups(userId: string) {
    const groups = await this.db.studyGroup.findMany({ where: { members: { some: { userId } } }, orderBy: { createdAt: 'asc' },
      select: { id: true, name: true, inviteCode: true, _count: { select: { members: true } } } });
    return groups.map(group => ({ id: group.id, name: group.name, inviteCode: group.inviteCode, members: group._count.members }));
  }
  async create(userId: string, name: string) {
    if (name.trim().length < 2) throw new BadRequestException('Dê um nome ao grupo.');
    return this.db.studyGroup.create({ data: { name: name.trim(), inviteCode: randomBytes(12).toString('hex'), members: { create: { userId } } },
      select: { id: true, name: true, inviteCode: true } });
  }
  async join(userId: string, inviteCode: string) {
    const group = await this.db.studyGroup.findUnique({ where: { inviteCode: inviteCode.trim().toLowerCase() } });
    if (!group) throw new NotFoundException('Convite não encontrado. Confira o código com quem convidou você.');
    await this.db.studyGroupMember.upsert({ where: { groupId_userId: { groupId: group.id, userId } }, create: { groupId: group.id, userId }, update: {} });
    return { id: group.id, name: group.name };
  }
  async leave(userId: string, id: string) {
    await this.db.studyGroupMember.deleteMany({ where: { groupId: id, userId } });
    return { left: true };
  }
  async group(userId: string, id: string) {
    const group = await this.db.studyGroup.findFirst({ where: { id, members: { some: { userId } } },
      include: { members: { select: { userId: true, user: { select: { id: true, name: true, rating: true } } } } } });
    if (!group) throw new NotFoundException('Grupo não encontrado.');
    const users = group.members.map(member => member.userId);
    const [activities, solved] = await Promise.all([
      this.db.activity.findMany({ where: { userId: { in: users } }, select: { userId: true, type: true, createdAt: true } }),
      this.db.puzzleAttempt.groupBy({ by: ['userId'], where: { userId: { in: users }, solved: true }, _count: { _all: true } }),
    ]);
    const since = Date.now() - 7 * 86_400_000;
    const leaderboard = group.members.map(member => {
      const rows = activities.filter(activity => activity.userId === member.userId);
      const week = rows.filter(activity => activity.createdAt.getTime() >= since);
      return { ...member.user, streak: calculateStreak(rows.map(row => row.createdAt)), puzzles: solved.find(row => row.userId === member.userId)?._count._all ?? 0,
        weekly: { puzzles: week.filter(row => row.type === 'puzzle').length, openings: week.filter(row => row.type === 'opening').length, lessons: week.filter(row => row.type === 'lesson').length } };
    });
    const total = leaderboard.reduce((sum, member) => ({ puzzles: sum.puzzles + member.weekly.puzzles, openings: sum.openings + member.weekly.openings, lessons: sum.lessons + member.weekly.lessons }), { puzzles: 0, openings: 0, lessons: 0 });
    return { id: group.id, name: group.name, inviteCode: group.inviteCode, leaderboard, weekly: total,
      goals: { puzzles: Math.max(10, users.length * 5), openings: Math.max(4, users.length * 2), lessons: Math.max(4, users.length * 2) } };
  }
}
