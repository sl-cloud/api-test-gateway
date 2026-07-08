import { describe, it, expect } from 'vitest';
import Fastify from 'fastify';
import rateLimit from '@fastify/rate-limit';
import { errorHandlerPlugin } from '../../src/plugins/error-handler.js';

async function buildTestFastify() {
  const app = Fastify();
  await app.register(errorHandlerPlugin);
  await app.register(rateLimit, { global: false });
  app.get('/limited', { config: { rateLimit: { max: 1, timeWindow: '1 minute' } } }, async () => ({
    ok: true,
  }));
  return app;
}

describe('error handler', () => {
  it('surfaces a rate-limit error as 429 with a problem+json body, not 500', async () => {
    const app = await buildTestFastify();

    const first = await app.inject({ method: 'GET', url: '/limited' });
    expect(first.statusCode).toBe(200);

    const second = await app.inject({ method: 'GET', url: '/limited' });
    expect(second.statusCode).toBe(429);
    expect(second.headers['content-type']).toContain('application/problem+json');
    expect(second.json()).toMatchObject({ status: 429 });
    expect(second.json()).toHaveProperty('code');
    expect(second.json()).not.toHaveProperty('stack');
  });
});
