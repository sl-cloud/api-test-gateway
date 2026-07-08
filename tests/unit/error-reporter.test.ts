import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  buildErrorReportEvent,
  reportError,
  requestContextFromFastify,
} from '../../src/lib/error-reporter.js';
import type { FastifyBaseLogger, FastifyRequest } from 'fastify';

function fakeLogger(): FastifyBaseLogger {
  return {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  } as unknown as FastifyBaseLogger;
}

const baseRequestContext = {
  method: 'GET',
  routePattern: '/projects/:id',
  statusCode: 500,
  requestId: 'req-1',
};

describe('buildErrorReportEvent', () => {
  it('never includes the request body, headers, or env vars, and scrubs secrets from the message/stack', () => {
    const error = new Error(
      'failed for user a@example.com with Bearer abc.def.ghi and token aGVsbG93b3JsZGhlbGxvd29ybGRoZWxsb3dvcmxk',
    );
    error.stack = `Error: boom\n    at handler (/app/src/modules/tasks/service.ts:10:5)\n    at node_modules/fastify/lib/handleRequest.js:1:1`;

    const event = buildErrorReportEvent(error, baseRequestContext, {
      NODE_ENV: 'production',
      COMMIT_SHA: 'abc123',
    });

    expect(event.project).toBe('api-test-gateway');
    expect(event.environment).toBe('production');
    expect(event.commitSha).toBe('abc123');
    expect(event.request).toEqual(baseRequestContext);
    expect(event.error.message).not.toContain('a@example.com');
    expect(event.error.message).not.toContain('Bearer abc.def.ghi');
    expect(event.error.stackSanitised).toContain('modules/tasks/service.ts');
    expect(event.error.stackSanitised).not.toContain('node_modules');
    expect(JSON.stringify(event)).not.toMatch(/authorization|cookie/i);
  });

  it('masks a JWT-shaped string in the error message', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.dGVzdHNpZ25hdHVyZQ';
    const error = new Error(`invalid token ${jwt}`);

    const event = buildErrorReportEvent(error, baseRequestContext, {
      NODE_ENV: 'production',
      COMMIT_SHA: 'abc123',
    });

    expect(event.error.message).not.toContain(jwt);
    expect(event.error.message).toContain('[redacted-jwt]');
  });
});

describe('requestContextFromFastify', () => {
  it('reads method, route pattern, and request id off the fastify request', () => {
    const request = {
      method: 'POST',
      url: '/projects/123',
      id: 'req-42',
      routeOptions: { url: '/projects/:id' },
    } as unknown as FastifyRequest;

    expect(requestContextFromFastify(request, 500)).toEqual({
      method: 'POST',
      routePattern: '/projects/:id',
      statusCode: 500,
      requestId: 'req-42',
    });
  });
});

describe('reportError', () => {
  const config = {
    NODE_ENV: 'production' as const,
    COMMIT_SHA: 'abc123',
    ERROR_WEBHOOK_URL: 'https://cp.example.dev/api/v1/webhooks/error-report',
    ERROR_WEBHOOK_SECRET: 'a-secret-at-least-16-chars',
  };

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('is a no-op when ERROR_WEBHOOK_URL or ERROR_WEBHOOK_SECRET is unset', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    reportError(
      new Error('boom'),
      baseRequestContext,
      { ...config, ERROR_WEBHOOK_URL: undefined },
      fakeLogger(),
    );
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('POSTs a signed request and does not retry on success', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 202 });
    vi.stubGlobal('fetch', fetchMock);

    reportError(new Error('boom'), baseRequestContext, config, fakeLogger());
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(config.ERROR_WEBHOOK_URL);
    const headers = init.headers as Record<string, string>;
    expect(headers['X-Portfolio-Event']).toBe('error.reported');
    expect(headers['X-Portfolio-Signature']).toMatch(/^sha256=[0-9a-f]{64}$/);
  });

  it('retries up to 3 attempts on failure, then swallows and logs, never throwing', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('network down'));
    vi.stubGlobal('fetch', fetchMock);
    const logger = fakeLogger();

    expect(() => reportError(new Error('boom'), baseRequestContext, config, logger)).not.toThrow();
    await new Promise((resolve) => setTimeout(resolve, 800));

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('giving up'));
  });
});
