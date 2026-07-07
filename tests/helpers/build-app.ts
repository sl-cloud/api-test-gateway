import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app.js';
import { loadConfig } from '../../src/config/index.js';

/**
 * Test-only defaults. These deliberately target `localhost` and the
 * *published* DB port, not the compose service name `db`, because
 * integration tests run as a host process (`npm test`, or CI's own
 * runner), not inside the app container, so a container-internal hostname
 * like `db` would not resolve.
 *
 * Real env vars (e.g. CI's own DATABASE_URL, or a developer's .env sourced
 * into the shell) always take precedence: these are fallbacks only.
 */
const TEST_DEFAULTS = {
  NODE_ENV: 'test',
  DATABASE_URL: `postgres://gateway:gateway_dev_password@localhost:${process.env.DB_HOST_PORT ?? '5432'}/gateway`,
  JWT_SECRET: 'test_only_jwt_secret_not_for_any_real_use_32ch',
  LOG_LEVEL: 'silent',
} as const;

/**
 * Builds an app instance for integration tests, wired to a real database.
 * Requires the `db` compose service (or an equivalent reachable Postgres)
 * to already be running.
 */
export async function buildTestApp(): Promise<FastifyInstance> {
  const config = loadConfig({ ...TEST_DEFAULTS, ...process.env });

  return buildApp({ config });
}
