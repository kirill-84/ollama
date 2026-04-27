import 'server-only';
import { env } from '@/lib/env';
import {
    userRepository,
    type User,
} from '@/lib/db/repositories/user.repository';

export async function getCurrentUser(): Promise<User> {
    const existing = await userRepository.findByEmail(env.MVP_USER_EMAIL);
    if (existing) return existing;
    return userRepository.create({ email: env.MVP_USER_EMAIL });
}
