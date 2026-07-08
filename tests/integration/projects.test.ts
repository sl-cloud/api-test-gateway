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
  const db = createDb(app.db);
  const user = await db.query.usersTable.findFirst({ where: eq(usersTable.email, email) });
  return { token: res.json<{ accessToken: string }>().accessToken, userId: user!.id };
}

describe('projects endpoints', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('any authenticated user can create a project and becomes its owner', async () => {
    const { token, userId } = await registerAndLogin(app, `owner-${Date.now()}@example.com`);
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/projects',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'My Project' },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json<{ ownerId: string }>().ownerId).toBe(userId);
  });

  it('returns 404 (not 403) for a non-member viewing a project', async () => {
    const owner = await registerAndLogin(app, `owner2-${Date.now()}@example.com`);
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/projects',
      headers: { authorization: `Bearer ${owner.token}` },
      payload: { name: 'Private Project' },
    });
    const projectId = createRes.json<{ id: string }>().id;

    const stranger = await registerAndLogin(app, `stranger-${Date.now()}@example.com`);
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectId}`,
      headers: { authorization: `Bearer ${stranger.token}` },
    });
    expect(res.statusCode).toBe(404);
  });

  it('a member added to a project can view it', async () => {
    const owner = await registerAndLogin(app, `owner3-${Date.now()}@example.com`);
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/projects',
      headers: { authorization: `Bearer ${owner.token}` },
      payload: { name: 'Team Project' },
    });
    const projectId = createRes.json<{ id: string }>().id;

    const member = await registerAndLogin(app, `member2-${Date.now()}@example.com`);
    await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/members`,
      headers: { authorization: `Bearer ${owner.token}` },
      payload: { userId: member.userId },
    });

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectId}`,
      headers: { authorization: `Bearer ${member.token}` },
    });
    expect(res.statusCode).toBe(200);
  });

  it('a plain member cannot archive a project (403)', async () => {
    const owner = await registerAndLogin(app, `owner4-${Date.now()}@example.com`);
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/projects',
      headers: { authorization: `Bearer ${owner.token}` },
      payload: { name: 'Guarded Project' },
    });
    const projectId = createRes.json<{ id: string }>().id;

    const member = await registerAndLogin(app, `member3-${Date.now()}@example.com`);
    await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/members`,
      headers: { authorization: `Bearer ${owner.token}` },
      payload: { userId: member.userId },
    });

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/archive`,
      headers: { authorization: `Bearer ${member.token}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it('mutating an archived project returns 409', async () => {
    const owner = await registerAndLogin(app, `owner5-${Date.now()}@example.com`);
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/projects',
      headers: { authorization: `Bearer ${owner.token}` },
      payload: { name: 'Archive Me' },
    });
    const projectId = createRes.json<{ id: string }>().id;

    await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/archive`,
      headers: { authorization: `Bearer ${owner.token}` },
    });

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/projects/${projectId}`,
      headers: { authorization: `Bearer ${owner.token}` },
      payload: { name: 'New Name' },
    });
    expect(res.statusCode).toBe(409);
  });

  describe('archived project member management', () => {
    // Registered once and reused by both tests below (rather than per-test)
    // to stay within the auth endpoints' rate limit for this test file.
    let owner: { token: string; userId: string };
    let helper: { token: string; userId: string };

    beforeAll(async () => {
      owner = await registerAndLogin(app, `owner6-${Date.now()}@example.com`);
      helper = await registerAndLogin(app, `helper6-${Date.now()}@example.com`);
    });

    it('adding a member to an archived project returns 409', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/projects',
        headers: { authorization: `Bearer ${owner.token}` },
        payload: { name: 'Archive Before Add' },
      });
      const projectId = createRes.json<{ id: string }>().id;

      await app.inject({
        method: 'POST',
        url: `/api/v1/projects/${projectId}/archive`,
        headers: { authorization: `Bearer ${owner.token}` },
      });

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/projects/${projectId}/members`,
        headers: { authorization: `Bearer ${owner.token}` },
        payload: { userId: helper.userId },
      });
      expect(res.statusCode).toBe(409);
    });

    it('removing a member from an archived project returns 409', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/projects',
        headers: { authorization: `Bearer ${owner.token}` },
        payload: { name: 'Archive Before Remove' },
      });
      const projectId = createRes.json<{ id: string }>().id;

      await app.inject({
        method: 'POST',
        url: `/api/v1/projects/${projectId}/members`,
        headers: { authorization: `Bearer ${owner.token}` },
        payload: { userId: helper.userId },
      });

      await app.inject({
        method: 'POST',
        url: `/api/v1/projects/${projectId}/archive`,
        headers: { authorization: `Bearer ${owner.token}` },
      });

      const res = await app.inject({
        method: 'DELETE',
        url: `/api/v1/projects/${projectId}/members/${helper.userId}`,
        headers: { authorization: `Bearer ${owner.token}` },
      });
      expect(res.statusCode).toBe(409);
    });
  });
});
