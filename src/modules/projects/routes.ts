import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { createDb } from '../../db/index.js';
import {
  createProject,
  getProject,
  listProjects,
  updateProject,
  archiveProject,
  deleteProject,
  addMember,
  removeMember,
} from './service.js';
import {
  createProjectBodySchema,
  updateProjectBodySchema,
  addMemberBodySchema,
  listProjectsQuerySchema,
  projectResponseSchema,
  listProjectsResponseSchema,
} from './schemas.js';

const idParamsSchema = z.object({ id: z.string().uuid() });
const memberParamsSchema = z.object({ id: z.string().uuid(), userId: z.string().uuid() });

export async function projectRoutes(app: FastifyInstance): Promise<void> {
  const server = app.withTypeProvider<ZodTypeProvider>();
  const db = createDb(app.db);

  server.post(
    '/api/v1/projects',
    {
      schema: { body: createProjectBodySchema, response: { 201: projectResponseSchema } },
      preHandler: app.requireAuth,
    },
    async (request, reply) =>
      reply.status(201).send(await createProject(db, request.currentUser, request.body)),
  );

  server.get(
    '/api/v1/projects',
    {
      schema: {
        querystring: listProjectsQuerySchema,
        response: { 200: listProjectsResponseSchema },
      },
      preHandler: app.requireAuth,
    },
    async (request) => listProjects(db, request.currentUser, request.query.all ?? false),
  );

  server.get(
    '/api/v1/projects/:id',
    {
      schema: { params: idParamsSchema, response: { 200: projectResponseSchema } },
      preHandler: app.requireAuth,
    },
    async (request) => getProject(db, request.currentUser, request.params.id),
  );

  server.patch(
    '/api/v1/projects/:id',
    {
      schema: {
        params: idParamsSchema,
        body: updateProjectBodySchema,
        response: { 200: projectResponseSchema },
      },
      preHandler: app.requireAuth,
    },
    async (request) => updateProject(db, request.currentUser, request.params.id, request.body),
  );

  server.post(
    '/api/v1/projects/:id/archive',
    {
      schema: { params: idParamsSchema, response: { 200: projectResponseSchema } },
      preHandler: app.requireAuth,
    },
    async (request) => archiveProject(db, request.currentUser, request.params.id),
  );

  server.delete(
    '/api/v1/projects/:id',
    { schema: { params: idParamsSchema }, preHandler: app.requireAuth },
    async (request, reply) => {
      await deleteProject(db, request.currentUser, request.params.id);
      return reply.status(204).send();
    },
  );

  server.post(
    '/api/v1/projects/:id/members',
    { schema: { params: idParamsSchema, body: addMemberBodySchema }, preHandler: app.requireAuth },
    async (request, reply) => {
      await addMember(db, request.currentUser, request.params.id, request.body.userId);
      return reply.status(204).send();
    },
  );

  server.delete(
    '/api/v1/projects/:id/members/:userId',
    { schema: { params: memberParamsSchema }, preHandler: app.requireAuth },
    async (request, reply) => {
      await removeMember(db, request.currentUser, request.params.id, request.params.userId);
      return reply.status(204).send();
    },
  );
}
