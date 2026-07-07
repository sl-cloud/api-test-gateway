import closeWithGrace from 'close-with-grace';
import { loadConfig } from './config/index.js';
import { buildApp } from './app.js';

async function main(): Promise<void> {
  const config = loadConfig();

  const app = await buildApp({ config });

  closeWithGrace({ delay: 5000 }, async ({ err }) => {
    if (err) {
      app.log.error({ err }, 'closing app due to error');
    }
    await app.close();
  });

  try {
    await app.listen({ host: '0.0.0.0', port: config.PORT });
  } catch (err) {
    app.log.error({ err }, 'failed to start server');
    process.exit(1);
  }
}

main().catch((err: unknown) => {
  console.error('fatal startup error:', err);
  process.exit(1);
});
