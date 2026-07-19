import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { buildTestApp } from '../helpers/build-app.js';
import { createDb } from '../../src/db/index.js';
import { usersTable } from '../../src/db/schema.js';

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

async function registerAdminAndLogin(app: FastifyInstance, email: string) {
  await registerAndLogin(app, email);
  const db = createDb(app.db);
  await db.update(usersTable).set({ role: 'admin' }).where(eq(usersTable.email, email));
  return registerAndLogin(app, email); // re-login so the token/session reflects the new role
}

describe('POST /api/v1/tests/trigger', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestApp({
      CONTROL_PLANE_URL: 'https://cp.example.dev',
      CP_WEBHOOK_SECRET: 'a-secret-at-least-16-chars',
    });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns 401 with no Authorization header', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/v1/tests/trigger', payload: {} });
    expect(res.statusCode).toBe(401);
  });

  it('returns 403 for a non-admin', async () => {
    const token = await registerAndLogin(app, `member-${Date.now()}@example.com`);
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/tests/trigger',
      headers: { authorization: `Bearer ${token}` },
      payload: {},
    });
    expect(res.statusCode).toBe(403);
  });

  it('signs and sends a deployment.completed event, returns 200 for an admin', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 201 });
    vi.stubGlobal('fetch', fetchMock);

    const token = await registerAdminAndLogin(app, `admin-${Date.now()}@example.com`);
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/tests/trigger',
      headers: { authorization: `Bearer ${token}` },
      payload: { branch: 'main' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ triggered: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toBe('https://cp.example.dev/api/v1/webhooks/github-ci');
  });

  it('returns 502 when the control plane is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));

    const token = await registerAdminAndLogin(app, `admin-${Date.now()}@example.com`);
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/tests/trigger',
      headers: { authorization: `Bearer ${token}` },
      payload: {},
    });

    expect(res.statusCode).toBe(502);
  });
});
