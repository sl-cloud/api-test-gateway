import type { FastifyBaseLogger, FastifyRequest } from 'fastify';
import { setTimeout as sleep } from 'node:timers/promises';
import { buildSignedWebhookHeaders, type SignedWebhookHeaders } from './webhook-signing.js';
import type { AppConfig } from '../config/index.js';

const JWT_PATTERN = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g;
const BEARER_PATTERN = /\bBearer\s+\S+/gi;
const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const LONG_HEX_OR_BASE64_PATTERN = /\b[A-Za-z0-9+/]{32,}={0,2}\b/g;

/** Value-pattern scrub: JWT-shaped strings, bearer tokens, emails, long hex/base64 blobs. */
function scrubValue(value: string): string {
  return value
    .replace(JWT_PATTERN, '[redacted-jwt]')
    .replace(BEARER_PATTERN, '[redacted-bearer]')
    .replace(EMAIL_PATTERN, '[redacted-email]')
    .replace(LONG_HEX_OR_BASE64_PATTERN, '[redacted-token]');
}

/** Trims stack frames to app code (drops node_modules/node:internal noise) and scrubs values. */
function sanitiseStack(stack: string | undefined): string {
  if (!stack) {
    return '';
  }
  return stack
    .split('\n')
    .filter((line) => !line.includes('node_modules') && !line.includes('node:internal'))
    .map(scrubValue)
    .join('\n');
}

export interface ErrorReportRequestContext {
  method: string;
  routePattern: string;
  statusCode: number;
  requestId: string;
}

export interface ErrorReportEvent {
  project: string;
  environment: string;
  commitSha: string;
  error: { name: string; message: string; stackSanitised: string };
  request: ErrorReportRequestContext;
  occurredAt: string;
}

const PROJECT_NAME = 'api-test-gateway';

/** Builds the sanitised event payload (source-side, layer 1 of §15.4). Never includes the request body, headers, or env vars. */
export function buildErrorReportEvent(
  error: Error,
  request: ErrorReportRequestContext,
  config: Pick<AppConfig, 'NODE_ENV' | 'COMMIT_SHA'>,
): ErrorReportEvent {
  return {
    project: PROJECT_NAME,
    environment: config.NODE_ENV,
    commitSha: config.COMMIT_SHA,
    error: {
      name: error.name,
      message: scrubValue(error.message),
      stackSanitised: sanitiseStack(error.stack),
    },
    request,
    occurredAt: new Date().toISOString(),
  };
}

export function requestContextFromFastify(
  request: FastifyRequest,
  statusCode: number,
): ErrorReportRequestContext {
  return {
    method: request.method,
    routePattern: request.routeOptions.url ?? request.url,
    statusCode,
    requestId: request.id,
  };
}

const MAX_ATTEMPTS = 3;
const BASE_DELAY_MS = 200;

/**
 * Fire-and-forget: builds a sanitised error event and POSTs it, HMAC-signed, to
 * ERROR_WEBHOOK_URL. Never throws and never affects the request path; retries
 * internally then swallows and logs on final failure. No-op when unconfigured.
 */
export function reportError(
  error: Error,
  requestContext: ErrorReportRequestContext,
  config: Pick<AppConfig, 'NODE_ENV' | 'COMMIT_SHA' | 'ERROR_WEBHOOK_URL' | 'ERROR_WEBHOOK_SECRET'>,
  logger: FastifyBaseLogger,
): void {
  if (!config.ERROR_WEBHOOK_URL || !config.ERROR_WEBHOOK_SECRET) {
    return;
  }

  const url = config.ERROR_WEBHOOK_URL;
  const secret = config.ERROR_WEBHOOK_SECRET;
  const event = buildErrorReportEvent(error, requestContext, config);
  const rawBody = JSON.stringify(event);
  const headers = buildSignedWebhookHeaders('error.reported', secret, rawBody);

  void sendWithRetry(url, rawBody, headers, logger);
}

async function sendWithRetry(
  url: string,
  rawBody: string,
  headers: SignedWebhookHeaders,
  logger: FastifyBaseLogger,
): Promise<void> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const response = await fetch(url, { method: 'POST', headers: { ...headers }, body: rawBody });
      if (response.ok) {
        return;
      }
      logger.warn({ status: response.status, attempt }, 'error-reporter: non-OK response');
    } catch (err) {
      logger.warn({ err, attempt }, 'error-reporter: request failed');
    }

    if (attempt < MAX_ATTEMPTS) {
      await sleep(BASE_DELAY_MS * 2 ** (attempt - 1));
    }
  }

  logger.warn('error-reporter: giving up after max attempts, dropping error event');
}
