import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { notifyDeploymentCompleted } from '../../lib/deployment-notifier.js';

const triggerBodySchema = z.object({
  branch: z.string().min(1).default('main'),
});

const triggerResponseSchema = z.object({
  triggered: z.boolean(),
});

export async function testRoutes(app: FastifyInstance): Promise<void> {
  const server = app.withTypeProvider<ZodTypeProvider>();

  server.post(
    '/api/v1/tests/trigger',
    {
      schema: {
        body: triggerBodySchema,
        response: { 200: triggerResponseSchema, 502: triggerResponseSchema },
      },
      preHandler: app.requireAdmin,
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      const result = await notifyDeploymentCompleted(
        { branch: request.body.branch },
        app.appConfig,
        request.log,
      );
      if (!result.ok) {
        return reply.status(502).send({ triggered: false });
      }
      return { triggered: true };
    },
  );
}
