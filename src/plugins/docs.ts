import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';
import { jsonSchemaTransform } from 'fastify-type-provider-zod';

/**
 * Serves interactive API docs at /docs, open to the public (read-only:
 * self-registration is separately gated, see auth/routes.ts).
 */
export const docsPlugin = fp(async function docsPlugin(app: FastifyInstance): Promise<void> {
  // Routes gate access via a requireAuth/requireAdmin preHandler rather than
  // per-route `schema.security`; mirror that into the generated OpenAPI doc
  // so Swagger UI's "Authorize" bearer token actually gets sent on them.
  app.addHook('onRoute', (route) => {
    const preHandlers = Array.isArray(route.preHandler) ? route.preHandler : [route.preHandler];
    const isProtected = preHandlers.some((fn) => fn === app.requireAuth || fn === app.requireAdmin);
    if (isProtected) {
      route.schema = { ...route.schema, security: [{ bearerAuth: [] }] };
    }
  });

  await app.register(fastifySwagger, {
    openapi: {
      info: {
        title: 'api-test-gateway',
        description: 'Demo REST API under continuous automated test.',
        version: app.appConfig.COMMIT_SHA,
      },
      components: {
        securitySchemes: {
          bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        },
      },
    },
    transform: jsonSchemaTransform,
  });

  await app.register(fastifySwaggerUi, { routePrefix: '/docs' });
});
