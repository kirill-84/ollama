import { describe, it, expect, afterEach, afterAll } from 'vitest';
import { userRepository } from '@/lib/db/repositories/user.repository';
import { prisma } from '@/lib/db/client';

describe('UserRepository', () => {
  afterEach(async () => {
    await prisma.user.deleteMany({});
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('create создаёт пользователя с переданными полями', async () => {
    const user = await userRepository.create({
      email: 'alice@example.com',
      name: 'Alice',
    });

    expect(user.id).toBeTruthy();
    expect(user.email).toBe('alice@example.com');
    expect(user.name).toBe('Alice');
    expect(user.createdAt).toBeInstanceOf(Date);
    expect(user.updatedAt).toBeInstanceOf(Date);
  });

  it('create создаёт пользователя без name', async () => {
    const user = await userRepository.create({ email: 'bob@example.com' });

    expect(user.email).toBe('bob@example.com');
    expect(user.name).toBeNull();
  });

  it('findByEmail возвращает существующего пользователя', async () => {
    await userRepository.create({
      email: 'carol@example.com',
      name: 'Carol',
    });

    const found = await userRepository.findByEmail('carol@example.com');

    expect(found).not.toBeNull();
    expect(found?.email).toBe('carol@example.com');
    expect(found?.name).toBe('Carol');
  });

  it('findByEmail возвращает null, если пользователя нет', async () => {
    const result = await userRepository.findByEmail('nonexistent@example.com');
    expect(result).toBeNull();
  });

  it('create с дублирующимся email кидает ошибку', async () => {
    await userRepository.create({ email: 'dup@example.com' });

    await expect(
      userRepository.create({ email: 'dup@example.com' }),
    ).rejects.toThrow();
  });
});
