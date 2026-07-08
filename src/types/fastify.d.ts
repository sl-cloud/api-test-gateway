import type { AppConfig } from '../config/index.js';
import type { DbPool } from '../db/client.js';

export interface CurrentUser {
  id: string;
  role: 'admin' | 'member';
}

declare module 'fastify' {
  interface FastifyInstance {
    appConfig: AppConfig;
    db: DbPool;
    requireAuth: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireAdmin: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
  interface FastifyRequest {
    currentUser: CurrentUser;
  }
}
