import Fastify, { type FastifyInstance } from 'fastify';
import rateLimit from '@fastify/rate-limit';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import type { AppConfig } from './config/index.js';
import { buildLoggerOptions } from './lib/logger.js';
import { generateRequestId } from './lib/request-id.js';
import { createDbPool, type DbPool } from './db/client.js';
import { errorHandlerPlugin } from './plugins/error-handler.js';
import { authPlugin } from './plugins/auth.js';
import { docsPlugin } from './plugins/docs.js';
import { healthRoutes } from './modules/health/routes.js';
import { authRoutes } from './modules/auth/routes.js';
import { userRoutes } from './modules/users/routes.js';
import { projectRoutes } from './modules/projects/routes.js';
import { taskRoutes } from './modules/tasks/routes.js';

export interface BuildAppOptions {
  config: AppConfig;
  /** Injectable for tests (e.g. a pool pointed at a test database). */
  db?: DbPool;
}

export async function buildApp(options: BuildAppOptions): Promise<FastifyInstance> {
  const { config } = options;

  const app = Fastify({
    logger: buildLoggerOptions(config),
    genReqId: (req) => (req.headers['x-request-id'] as string | undefined) ?? generateRequestId(),
    requestIdHeader: 'x-request-id',
  });

  app.decorate('appConfig', config);
  app.decorate('db', options.db ?? createDbPool(config));

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  app.addHook('onSend', async (request, reply, payload) => {
    reply.header('x-request-id', request.id);
    return payload;
  });

  await app.register(errorHandlerPlugin);
  await app.register(authPlugin);
  await app.register(docsPlugin);
  await app.register(rateLimit, { global: false });
  await app.register(authRoutes);
  await app.register(userRoutes);
  await app.register(projectRoutes);
  await app.register(taskRoutes);
  await app.register(healthRoutes);

  app.addHook('onClose', async (instance) => {
    await instance.db.end();
  });

  return app;
}
