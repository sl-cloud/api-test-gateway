import { eq } from 'drizzle-orm';
import { loadConfig } from '../config/index.js';
import { createDbPool } from './client.js';
import { createDb } from './index.js';
import { usersTable } from './schema.js';
import { hashPassword } from '../lib/password.js';

const SEED_PASSWORD = 'dev_only_seed_password_not_for_prod';

const SEED_USERS: Array<{ email: string; displayName: string; role: 'admin' | 'member' }> = [
  { email: 'admin@example.com', displayName: 'Admin', role: 'admin' },
  { email: 'alice@example.com', displayName: 'Alice', role: 'member' },
  { email: 'bob@example.com', displayName: 'Bob', role: 'member' },
];

async function main(): Promise<void> {
  const config = loadConfig();
  const pool = createDbPool(config);
  const db = createDb(pool);

  try {
    const passwordHash = await hashPassword(SEED_PASSWORD);

    for (const seedUser of SEED_USERS) {
      const existing = await db.query.usersTable.findFirst({
        where: eq(usersTable.email, seedUser.email),
      });
      if (existing) {
        console.log(`skip: ${seedUser.email} already exists`);
        continue;
      }
      await db.insert(usersTable).values({ ...seedUser, passwordHash });
      console.log(`created: ${seedUser.email} (${seedUser.role})`);
    }
  } finally {
    await pool.end();
  }
}

main().catch((err: unknown) => {
  console.error('seed failed:', err);
  process.exit(1);
});
