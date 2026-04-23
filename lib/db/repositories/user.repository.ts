import 'server-only';
import type { UserModel } from '@/app/generated/prisma/models';
import { prisma } from '@/lib/db/client';

export type User = UserModel;

export interface IUserRepository {
  findByEmail(email: string): Promise<User | null>;
  create(data: { email: string; name?: string }): Promise<User>;
}

export class UserRepository implements IUserRepository {
  async findByEmail(email: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { email } });
  }

  async create(data: { email: string; name?: string }): Promise<User> {
    return prisma.user.create({ data });
  }
}

export const userRepository = new UserRepository();