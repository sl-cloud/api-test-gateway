import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestApp } from '../helpers/build-app.js';
import { createDb } from '../../src/db/index.js';
import { usersTable } from '../../src/db/schema.js';
import { eq } from 'drizzle-orm';

async function registerAndLogin(app: FastifyInstance, email: string) {
  await app.inject({
    method: 'POST',
    url: '/api/v1/auth/register',
    payload: { email, password: 'a_valid_password', displayName: 'Test User' },
  });
  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    payload: { email, password: 'a_valid_password' },
  });
  return res.json<{ accessToken: string }>().accessToken;
}

describe('users endpoints', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /users returns 403 for a non-admin', async () => {
    const token = await registerAndLogin(app, `member-${Date.now()}@example.com`);
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/users',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it('GET /users returns 200 with a paginated list for an admin', async () => {
    const email = `admin-${Date.now()}@example.com`;
    const token = await registerAndLogin(app, email);
    const db = createDb(app.db);
    await db.update(usersTable).set({ role: 'admin' }).where(eq(usersTable.email, email));

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/users',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveProperty('items');
    expect(res.json()).toHaveProperty('total');
  });

  it('PATCH /users/:id lets an admin deactivate another user, blocking their login', async () => {
    const targetEmail = `target-${Date.now()}@example.com`;
    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { email: targetEmail, password: 'a_valid_password', displayName: 'Target' },
    });
    const db = createDb(app.db);
    const target = await db.query.usersTable.findFirst({
      where: eq(usersTable.email, targetEmail),
    });

    const adminEmail = `admin2-${Date.now()}@example.com`;
    const adminToken = await registerAndLogin(app, adminEmail);
    await db.update(usersTable).set({ role: 'admin' }).where(eq(usersTable.email, adminEmail));

    const patchRes = await app.inject({
      method: 'PATCH',
      url: `/api/v1/users/${target?.id}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { isActive: false },
    });
    expect(patchRes.statusCode).toBe(200);

    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: targetEmail, password: 'a_valid_password' },
    });
    expect(loginRes.statusCode).toBe(401);
  });

  it('rejects an already-issued token on a protected route after the user is deactivated', async () => {
    const targetEmail = `target2-${Date.now()}@example.com`;
    const targetToken = await registerAndLogin(app, targetEmail);
    const db = createDb(app.db);
    const target = await db.query.usersTable.findFirst({
      where: eq(usersTable.email, targetEmail),
    });

    const adminEmail = `admin4-${Date.now()}@example.com`;
    const adminToken = await registerAndLogin(app, adminEmail);
    await db.update(usersTable).set({ role: 'admin' }).where(eq(usersTable.email, adminEmail));

    const patchRes = await app.inject({
      method: 'PATCH',
      url: `/api/v1/users/${target?.id}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { isActive: false },
    });
    expect(patchRes.statusCode).toBe(200);

    const meRes = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: { authorization: `Bearer ${targetToken}` },
    });
    expect(meRes.statusCode).toBe(401);
  });

  it('PATCH /users/:id returns 403 for a non-admin', async () => {
    const memberEmail = `member2-${Date.now()}@example.com`;
    const memberToken = await registerAndLogin(app, memberEmail);
    const db = createDb(app.db);
    const member = await db.query.usersTable.findFirst({
      where: eq(usersTable.email, memberEmail),
    });

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/users/${member?.id}`,
      headers: { authorization: `Bearer ${memberToken}` },
      payload: { role: 'admin' },
    });
    expect(res.statusCode).toBe(403);
  });

  it('PATCH /users/:id returns 404 for a nonexistent user', async () => {
    const adminEmail = `admin3-${Date.now()}@example.com`;
    const adminToken = await registerAndLogin(app, adminEmail);
    const db = createDb(app.db);
    await db.update(usersTable).set({ role: 'admin' }).where(eq(usersTable.email, adminEmail));

    const res = await app.inject({
      method: 'PATCH',
      url: '/api/v1/users/00000000-0000-0000-0000-000000000000',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { role: 'admin' },
    });
    expect(res.statusCode).toBe(404);
  });
});
