import { timingSafeEqual } from 'node:crypto';
import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';
import fastifyBasicAuth from '@fastify/basic-auth';
import { jsonSchemaTransform } from 'fastify-type-provider-zod';

function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * Serves interactive API docs at /docs, gated by HTTP Basic Auth.
 * Only registers when DOCS_USERNAME and DOCS_PASSWORD are both set,
 * so it stays off by default rather than accidentally exposing routes.
 */
export const docsPlugin = fp(async function docsPlugin(app: FastifyInstance): Promise<void> {
  const { DOCS_USERNAME, DOCS_PASSWORD } = app.appConfig;
  if (!DOCS_USERNAME || !DOCS_PASSWORD) {
    app.log.info('DOCS_USERNAME/DOCS_PASSWORD not set, skipping /docs registration');
    return;
  }

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

  await app.register(fastifyBasicAuth, {
    validate: async (username, password, _req, reply) => {
      const userOk = safeCompare(username, DOCS_USERNAME);
      const passOk = safeCompare(password, DOCS_PASSWORD);
      if (!userOk || !passOk) {
        reply.header('WWW-Authenticate', 'Basic realm="docs"');
        throw new Error('invalid docs credentials');
      }
    },
    authenticate: { realm: 'docs' },
  });

  await app.register(async (scope) => {
    scope.addHook('onRequest', scope.basicAuth);
    await scope.register(fastifySwaggerUi, { routePrefix: '/docs' });
  });
});
