import { eq } from 'drizzle-orm';
import type { Db } from '../../db/index.js';
import type { AppConfig } from '../../config/index.js';
import { usersTable } from '../../db/schema.js';
import { hashPassword, verifyPassword } from '../../lib/password.js';
import { signAccessToken } from '../../lib/jwt.js';
import { ConflictError, UnauthorizedError } from '../../lib/errors.js';
import type { RegisterBody, LoginBody } from './schemas.js';

export interface PublicUser {
  id: string;
  email: string;
  displayName: string;
  role: 'admin' | 'member';
}

export async function registerUser(db: Db, input: RegisterBody): Promise<PublicUser> {
  const existing = await db.query.usersTable.findFirst({
    where: eq(usersTable.email, input.email),
  });
  if (existing) {
    throw new ConflictError('email is already registered', 'email_taken');
  }

  const passwordHash = await hashPassword(input.password);
  const [created] = await db
    .insert(usersTable)
    .values({
      email: input.email,
      passwordHash,
      displayName: input.displayName,
      role: 'member',
    })
    .returning();

  if (!created) {
    throw new Error('insert returned no row');
  }

  return {
    id: created.id,
    email: created.email,
    displayName: created.displayName,
    role: created.role,
  };
}

export async function loginUser(
  db: Db,
  config: Pick<AppConfig, 'JWT_SECRET'>,
  input: LoginBody,
): Promise<{ accessToken: string }> {
  const user = await db.query.usersTable.findFirst({ where: eq(usersTable.email, input.email) });
  if (!user || !user.isActive) {
    throw new UnauthorizedError('invalid email or password');
  }

  const passwordMatches = await verifyPassword(user.passwordHash, input.password);
  if (!passwordMatches) {
    throw new UnauthorizedError('invalid email or password');
  }

  const accessToken = signAccessToken({ sub: user.id, role: user.role }, config.JWT_SECRET);
  return { accessToken };
}

export async function getCurrentUser(db: Db, userId: string): Promise<PublicUser> {
  const user = await db.query.usersTable.findFirst({ where: eq(usersTable.id, userId) });
  if (!user) {
    throw new UnauthorizedError('user no longer exists');
  }
  return { id: user.id, email: user.email, displayName: user.displayName, role: user.role };
}
