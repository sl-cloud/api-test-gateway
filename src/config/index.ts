import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

  DATABASE_URL: z.string().url().or(z.string().startsWith('postgres')),

  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),

  ERROR_WEBHOOK_URL: z.string().url().optional(),
  ERROR_WEBHOOK_SECRET: z.string().min(16).optional(),

  // Both must be set for /docs to register; unset means no docs route at all.
  DOCS_USERNAME: z.string().min(1).optional(),
  DOCS_PASSWORD: z.string().min(8).optional(),

  // Set to false on staging/public deploys to close public self-registration.
  REGISTRATION_ENABLED: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),

  COMMIT_SHA: z.string().default('dev'),
});

export type AppConfig = z.infer<typeof envSchema>;

let cached: AppConfig | undefined;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const result = envSchema.safeParse(env);

  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }

  return result.data;
}

/** Cached accessor for use outside the boot path (e.g. inside request handlers). */
export function getConfig(): AppConfig {
  cached ??= loadConfig();
  return cached;
}

/** Test-only: clears the cache so a test can re-load config with different env vars. */
export function resetConfigCache(): void {
  cached = undefined;
}
