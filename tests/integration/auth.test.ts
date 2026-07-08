import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestApp } from '../helpers/build-app.js';

describe('auth endpoints', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('registers a new user as role member', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email: `user-${Date.now()}@example.com`,
        password: 'a_valid_password',
        displayName: 'Test User',
      },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json<{ role: string }>().role).toBe('member');
  });

  it('rejects registering a duplicate email with 409', async () => {
    const email = `dup-${Date.now()}@example.com`;
    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { email, password: 'a_valid_password', displayName: 'Test User' },
    });
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { email, password: 'a_valid_password', displayName: 'Test User' },
    });
    expect(res.statusCode).toBe(409);
  });

  it('logs in a registered user and returns an access token', async () => {
    const email = `login-${Date.now()}@example.com`;
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
    expect(res.statusCode).toBe(200);
    expect(res.json<{ accessToken: string }>().accessToken).toBeTruthy();
  });

  it('rejects login with wrong password with 401', async () => {
    const email = `wrongpw-${Date.now()}@example.com`;
    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { email, password: 'a_valid_password', displayName: 'Test User' },
    });
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email, password: 'wrong_password' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('GET /auth/me returns the current user for a valid token', async () => {
    const email = `me-${Date.now()}@example.com`;
    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { email, password: 'a_valid_password', displayName: 'Test User' },
    });
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email, password: 'a_valid_password' },
    });
    const { accessToken } = loginRes.json<{ accessToken: string }>();
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json<{ email: string }>().email).toBe(email);
  });

  it('GET /auth/me returns 401 with no token', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/auth/me' });
    expect(res.statusCode).toBe(401);
  });
});
