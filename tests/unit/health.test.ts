import { describe, it, expect, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app.js';
import type { AppConfig } from '../../src/config/index.js';
import type { DbPool } from '../../src/db/client.js';

const baseConfig: AppConfig = {
  NODE_ENV: 'test',
  PORT: 3000,
  LOG_LEVEL: 'silent',
  DATABASE_URL: 'postgres://user:pass@localhost:5432/db',
  JWT_SECRET: 'a'.repeat(32),
  COMMIT_SHA: 'test-sha',
};

function fakeDb(queryImpl: () => Promise<unknown>): DbPool {
  return {
    query: queryImpl,
    end: async () => undefined,
  } as unknown as DbPool;
}

describe('GET /health/ready: unreachable database', () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app.close();
  });

  it('returns 503 when the database ping fails', async () => {
    app = await buildApp({
      config: baseConfig,
      db: fakeDb(() => Promise.reject(new Error('connection refused'))),
    });
    await app.ready();

    const response = await app.inject({ method: 'GET', url: '/health/ready' });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({
      status: 'unavailable',
      reason: 'database_unreachable',
    });
  });

  it('does not leak the underlying error message to the client', async () => {
    app = await buildApp({
      config: baseConfig,
      db: fakeDb(() => Promise.reject(new Error('super secret connection string'))),
    });
    await app.ready();

    const response = await app.inject({ method: 'GET', url: '/health/ready' });

    expect(response.body).not.toContain('super secret connection string');
  });
});

describe('GET /health/live: reports commit sha from config', () => {
  it('returns the commitSha from the injected config', async () => {
    const app = await buildApp({
      config: { ...baseConfig, COMMIT_SHA: 'abc1234' },
      db: fakeDb(() => Promise.resolve()),
    });
    await app.ready();

    const response = await app.inject({ method: 'GET', url: '/health/live' });

    expect(response.json()).toMatchObject({ commitSha: 'abc1234' });

    await app.close();
  });
});
