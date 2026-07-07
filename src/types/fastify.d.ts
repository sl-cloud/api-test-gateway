import type { AppConfig } from '../config/index.js';
import type { DbPool } from '../db/client.js';

declare module 'fastify' {
  interface FastifyInstance {
    appConfig: AppConfig;
    db: DbPool;
  }
}
