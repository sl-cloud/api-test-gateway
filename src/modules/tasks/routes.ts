import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { createDb } from '../../db/index.js';
import { createTask, getTask, listTasks, updateTask, deleteTask } from './service.js';
import {
  createTaskBodySchema,
  updateTaskBodySchema,
  listTasksQuerySchema,
  taskResponseSchema,
  listTasksResponseSchema,
} from './schemas.js';

const projectIdParamsSchema = z.object({ id: z.string().uuid() });
const taskIdParamsSchema = z.object({ id: z.string().uuid() });

export async function taskRoutes(app: FastifyInstance): Promise<void> {
  const server = app.withTypeProvider<ZodTypeProvider>();
  const db = createDb(app.db);

  server.post(
    '/api/v1/projects/:id/tasks',
    {
      schema: {
        params: projectIdParamsSchema,
        body: createTaskBodySchema,
        response: { 201: taskResponseSchema },
      },
      preHandler: app.requireAuth,
    },
    async (request, reply) =>
      reply
        .status(201)
        .send(await createTask(db, request.currentUser, request.params.id, request.body)),
  );

  server.get(
    '/api/v1/projects/:id/tasks',
    {
      schema: {
        params: projectIdParamsSchema,
        querystring: listTasksQuerySchema,
        response: { 200: listTasksResponseSchema },
      },
      preHandler: app.requireAuth,
    },
    async (request) => listTasks(db, request.currentUser, request.params.id, request.query),
  );

  server.get(
    '/api/v1/tasks/:id',
    {
      schema: { params: taskIdParamsSchema, response: { 200: taskResponseSchema } },
      preHandler: app.requireAuth,
    },
    async (request) => getTask(db, request.currentUser, request.params.id),
  );

  server.patch(
    '/api/v1/tasks/:id',
    {
      schema: {
        params: taskIdParamsSchema,
        body: updateTaskBodySchema,
        response: { 200: taskResponseSchema },
      },
      preHandler: app.requireAuth,
    },
    async (request) => updateTask(db, request.currentUser, request.params.id, request.body),
  );

  server.delete(
    '/api/v1/tasks/:id',
    { schema: { params: taskIdParamsSchema }, preHandler: app.requireAuth },
    async (request, reply) => {
      await deleteTask(db, request.currentUser, request.params.id);
      return reply.status(204).send();
    },
  );
}
