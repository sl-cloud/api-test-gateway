import { describe, it, expect, vi } from 'vitest';
import Fastify from 'fastify';
import { authPlugin } from '../../src/plugins/auth.js';
import { signAccessToken } from '../../src/lib/jwt.js';
import { errorHandlerPlugin } from '../../src/plugins/error-handler.js';
import { createDb } from '../../src/db/index.js';

vi.mock('../../src/db/index.js', () => ({
  createDb: vi.fn(),
}));

const SECRET = 'test_only_jwt_secret_not_for_any_real_use_32ch';

// Fake raw pool, opaque to the mocked createDb(); mirrors the shape used in
// tests/unit/health.test.ts so app.db stays consistent with how it's used elsewhere.
function fakePool() {
  return { query: vi.fn(), end: vi.fn() };
}

function fakeDb(user: { id: string; role: 'admin' | 'member'; isActive: boolean } | undefined) {
  return {
    query: {
      usersTable: {
        findFirst: vi.fn().mockResolvedValue(user),
      },
    },
  };
}

async function buildTestFastify(db: unknown) {
  vi.mocked(createDb).mockReturnValue(db as never);
  const app = Fastify();
  app.decorate('appConfig', { JWT_SECRET: SECRET } as never);
  app.decorate('db', fakePool() as never);
  await app.register(errorHandlerPlugin);
  await app.register(authPlugin);
  app.get('/protected', { preHandler: app.requireAuth }, async (request) => ({
    userId: request.currentUser.id,
  }));
  app.get('/admin-only', { preHandler: app.requireAdmin }, async () => ({ ok: true }));
  return app;
}

describe('auth plugin', () => {
  it('rejects a request with no Authorization header', async () => {
    const app = await buildTestFastify(fakeDb(undefined));
    const res = await app.inject({ method: 'GET', url: '/protected' });
    expect(res.statusCode).toBe(401);
  });

  it('rejects a malformed Authorization header', async () => {
    const app = await buildTestFastify(fakeDb(undefined));
    const res = await app.inject({
      method: 'GET',
      url: '/protected',
      headers: { authorization: 'NotBearer abc' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('accepts a valid token for an active user and sets currentUser', async () => {
    const app = await buildTestFastify(fakeDb({ id: 'user-1', role: 'member', isActive: true }));
    const token = signAccessToken({ sub: 'user-1', role: 'member' }, SECRET);
    const res = await app.inject({
      method: 'GET',
      url: '/protected',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ userId: 'user-1' });
  });

  it('rejects a valid token for a deactivated user', async () => {
    const app = await buildTestFastify(fakeDb({ id: 'user-1', role: 'member', isActive: false }));
    const token = signAccessToken({ sub: 'user-1', role: 'member' }, SECRET);
    const res = await app.inject({
      method: 'GET',
      url: '/protected',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(401);
  });

  it('rejects a non-admin on an admin-only route', async () => {
    const app = await buildTestFastify(fakeDb({ id: 'user-1', role: 'member', isActive: true }));
    const token = signAccessToken({ sub: 'user-1', role: 'member' }, SECRET);
    const res = await app.inject({
      method: 'GET',
      url: '/admin-only',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it('accepts an admin on an admin-only route', async () => {
    const app = await buildTestFastify(fakeDb({ id: 'user-1', role: 'admin', isActive: true }));
    const token = signAccessToken({ sub: 'user-1', role: 'admin' }, SECRET);
    const res = await app.inject({
      method: 'GET',
      url: '/admin-only',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
  });
});
