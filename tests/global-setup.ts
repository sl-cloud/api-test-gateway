import { loadConfig } from '../src/config/index.js';
import { createDbPool } from '../src/db/client.js';
import { createDb } from '../src/db/index.js';
import { usersTable } from '../src/db/schema.js';
import { hashPassword } from '../src/lib/password.js';

const TEST_DATABASE_URL = `postgres://gateway:gateway_dev_password@localhost:${process.env.DB_HOST_PORT ?? '5432'}/gateway`;

/**
 * Registration hands the very first user in the whole `users` table the
 * `admin` role (see auth/service.ts). Integration tests assert plain
 * `member` registration in many places, so this seeds one throwaway user
 * directly (bypassing the API) before any test runs, guaranteeing every
 * test-suite registration is "not first" without every test needing to know
 * about that precondition.
 */
export default async function globalSetup(): Promise<void> {
  const config = loadConfig({
    NODE_ENV: 'test',
    DATABASE_URL: process.env.DATABASE_URL ?? TEST_DATABASE_URL,
    JWT_SECRET: 'test_only_jwt_secret_not_for_any_real_use_32ch',
    LOG_LEVEL: 'silent',
    DOCS_USERNAME: undefined,
    DOCS_PASSWORD: undefined,
  });
  const pool = createDbPool(config);
  const db = createDb(pool);

  const existing = await db.query.usersTable.findFirst({
    where: (users, { eq }) => eq(users.email, 'test-suite-bootstrap@example.com'),
  });
  if (!existing) {
    await db.insert(usersTable).values({
      email: 'test-suite-bootstrap@example.com',
      passwordHash: await hashPassword('unused_bootstrap_password'),
      displayName: 'Test Suite Bootstrap',
      role: 'member',
    });
  }

  await pool.end();
}
