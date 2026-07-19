import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { createDb } from '../../db/index.js';
import { ForbiddenError, UnauthorizedError } from '../../lib/errors.js';
import { safeCompare, parseBasicAuthHeader } from '../../lib/basic-auth.js';
import { registerUser, loginUser, getCurrentUser } from './service.js';
import {
  registerBodySchema,
  loginBodySchema,
  userResponseSchema,
  loginResponseSchema,
} from './schemas.js';

export async function authRoutes(app: FastifyInstance): Promise<void> {
  const server = app.withTypeProvider<ZodTypeProvider>();
  const db = createDb(app.db);

  server.post(
    '/api/v1/auth/register',
    {
      schema: { body: registerBodySchema, response: { 201: userResponseSchema } },
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      if (!app.appConfig.REGISTRATION_ENABLED) {
        throw new ForbiddenError('self-registration is disabled', 'registration_disabled');
      }

      const { DOCS_USERNAME, DOCS_PASSWORD } = app.appConfig;
      if (DOCS_USERNAME && DOCS_PASSWORD) {
        const creds = parseBasicAuthHeader(request.headers.authorization);
        const ok =
          creds &&
          safeCompare(creds.username, DOCS_USERNAME) &&
          safeCompare(creds.password, DOCS_PASSWORD);
        if (!ok) {
          reply.header('WWW-Authenticate', 'Basic realm="registration"');
          throw new UnauthorizedError(
            'registration requires credentials',
            'registration_requires_auth',
          );
        }
      }

      const user = await registerUser(db, request.body);
      return reply.status(201).send(user);
    },
  );

  server.post(
    '/api/v1/auth/login',
    {
      schema: { body: loginBodySchema, response: { 200: loginResponseSchema } },
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    },
    async (request) => {
      return loginUser(db, app.appConfig, request.body);
    },
  );

  server.get(
    '/api/v1/auth/me',
    { schema: { response: { 200: userResponseSchema } }, preHandler: app.requireAuth },
    async (request) => {
      return getCurrentUser(db, request.currentUser.id);
    },
  );
}
