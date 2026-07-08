import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { createDb } from '../../db/index.js';
import { listUsers, updateUser } from './service.js';
import {
  listUsersQuerySchema,
  updateUserBodySchema,
  publicUserSchema,
  listUsersResponseSchema,
} from './schemas.js';

export async function userRoutes(app: FastifyInstance): Promise<void> {
  const server = app.withTypeProvider<ZodTypeProvider>();
  const db = createDb(app.db);

  server.get(
    '/api/v1/users',
    {
      schema: { querystring: listUsersQuerySchema, response: { 200: listUsersResponseSchema } },
      preHandler: app.requireAdmin,
    },
    async (request) => listUsers(db, request.query),
  );

  server.patch(
    '/api/v1/users/:id',
    {
      schema: {
        params: z.object({ id: z.string().uuid() }),
        body: updateUserBodySchema,
        response: { 200: publicUserSchema },
      },
      preHandler: app.requireAdmin,
    },
    async (request) => updateUser(db, request.params.id, request.body),
  );
}
