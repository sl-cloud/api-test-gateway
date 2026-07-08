import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq } from 'drizzle-orm';
import { verifyAccessToken } from '../lib/jwt.js';
import { UnauthorizedError, ForbiddenError } from '../lib/errors.js';
import { usersTable } from '../db/schema.js';
import { createDb } from '../db/index.js';

export const authPlugin = fp(async function authPlugin(app: FastifyInstance): Promise<void> {
  app.decorate(
    'requireAuth',
    async function requireAuth(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
      const header = request.headers.authorization;
      if (!header?.startsWith('Bearer ')) {
        throw new UnauthorizedError('missing or malformed Authorization header');
      }
      const token = header.slice('Bearer '.length);
      const payload = verifyAccessToken(token, app.appConfig.JWT_SECRET);

      const db = createDb(app.db);
      const user = await db.query.usersTable.findFirst({
        where: eq(usersTable.id, payload.sub),
      });

      if (!user || !user.isActive) {
        throw new UnauthorizedError('user is inactive or no longer exists');
      }

      request.currentUser = { id: user.id, role: user.role };
    },
  );

  app.decorate(
    'requireAdmin',
    async function requireAdmin(request: FastifyRequest, reply: FastifyReply): Promise<void> {
      await app.requireAuth(request, reply);
      if (request.currentUser.role !== 'admin') {
        throw new ForbiddenError('admin role required');
      }
    },
  );
});
