import { describe, it, expect, vi, afterEach } from 'vitest';
import type { FastifyBaseLogger } from 'fastify';
import { notifyDeploymentCompleted } from '../../src/lib/deployment-notifier.js';

function fakeLogger(): FastifyBaseLogger {
  return {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  } as unknown as FastifyBaseLogger;
}

const config = {
  NODE_ENV: 'production' as const,
  COMMIT_SHA: 'abc123',
  CONTROL_PLANE_URL: 'https://cp.example.dev',
  CP_WEBHOOK_SECRET: 'a-secret-at-least-16-chars',
};

describe('notifyDeploymentCompleted', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('is a no-op when CONTROL_PLANE_URL or CP_WEBHOOK_SECRET is unset', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const result = await notifyDeploymentCompleted(
      { branch: 'main' },
      { ...config, CONTROL_PLANE_URL: undefined },
      fakeLogger(),
    );

    expect(result.ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('POSTs a signed deployment.completed event to the control plane webhook path', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 201 });
    vi.stubGlobal('fetch', fetchMock);

    const result = await notifyDeploymentCompleted({ branch: 'main' }, config, fakeLogger());

    expect(result).toEqual({ ok: true, status: 201 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${config.CONTROL_PLANE_URL}/api/v1/webhooks/github-ci`);

    const headers = init.headers as Record<string, string>;
    expect(headers['X-Portfolio-Event']).toBe('deployment.completed');
    expect(headers['X-Portfolio-Signature']).toMatch(/^sha256=[0-9a-f]{64}$/);

    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({
      project: 'api-test-gateway',
      event: 'deployment.completed',
      repository: 'sl-cloud/api-test-gateway',
      branch: 'main',
      commitSha: 'abc123',
      environment: 'production',
    });
  });

  it('reports ok: false without throwing when the control plane responds non-OK', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500 });
    vi.stubGlobal('fetch', fetchMock);
    const logger = fakeLogger();

    const result = await notifyDeploymentCompleted({ branch: 'main' }, config, logger);

    expect(result).toEqual({ ok: false, status: 500 });
    expect(logger.warn).toHaveBeenCalled();
  });

  it('reports ok: false without throwing when the request itself fails', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('network down'));
    vi.stubGlobal('fetch', fetchMock);
    const logger = fakeLogger();

    const result = await notifyDeploymentCompleted({ branch: 'main' }, config, logger);

    expect(result).toEqual({ ok: false });
    expect(logger.warn).toHaveBeenCalled();
  });
});
