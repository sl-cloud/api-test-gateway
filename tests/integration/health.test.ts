import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestApp } from '../helpers/build-app.js';

describe('health endpoints', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health/live returns 200 with status ok', async () => {
    const response = await app.inject({ method: 'GET', url: '/health/live' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: 'ok' });
  });

  it('GET /health/live includes an x-request-id response header', async () => {
    const response = await app.inject({ method: 'GET', url: '/health/live' });

    expect(response.headers['x-request-id']).toBeTruthy();
  });

  it('echoes an inbound x-request-id back on the response', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health/live',
      headers: { 'x-request-id': 'test-request-id-123' },
    });

    expect(response.headers['x-request-id']).toBe('test-request-id-123');
  });

  it('GET /health/ready returns 200 with status ok when the database is reachable', async () => {
    const response = await app.inject({ method: 'GET', url: '/health/ready' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: 'ok' });
  });

  it('GET /health/ready reports the commit sha', async () => {
    const response = await app.inject({ method: 'GET', url: '/health/ready' });

    expect(response.json()).toHaveProperty('commitSha');
  });
});
