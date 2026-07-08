import { eq, sql } from 'drizzle-orm';
import type { Db } from '../../db/index.js';
import { usersTable } from '../../db/schema.js';
import { NotFoundError } from '../../lib/errors.js';
import type { ListUsersQuery, UpdateUserBody } from './schemas.js';

export interface PublicUserWithStatus {
  id: string;
  email: string;
  displayName: string;
  role: 'admin' | 'member';
  isActive: boolean;
}

export async function listUsers(
  db: Db,
  query: ListUsersQuery,
): Promise<{ items: PublicUserWithStatus[]; total: number }> {
  const offset = (query.page - 1) * query.pageSize;

  const [items, totalResult] = await Promise.all([
    db
      .select({
        id: usersTable.id,
        email: usersTable.email,
        displayName: usersTable.displayName,
        role: usersTable.role,
        isActive: usersTable.isActive,
      })
      .from(usersTable)
      .limit(query.pageSize)
      .offset(offset),
    db.select({ count: sql<number>`count(*)::int` }).from(usersTable),
  ]);

  return { items, total: totalResult[0]?.count ?? 0 };
}

export async function updateUser(
  db: Db,
  id: string,
  patch: UpdateUserBody,
): Promise<PublicUserWithStatus> {
  const [updated] = await db.update(usersTable).set(patch).where(eq(usersTable.id, id)).returning({
    id: usersTable.id,
    email: usersTable.email,
    displayName: usersTable.displayName,
    role: usersTable.role,
    isActive: usersTable.isActive,
  });

  if (!updated) {
    throw new NotFoundError('user not found');
  }

  return updated;
}
