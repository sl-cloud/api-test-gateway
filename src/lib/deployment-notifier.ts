import { randomUUID } from 'node:crypto';
import type { FastifyBaseLogger } from 'fastify';
import { buildSignedWebhookHeaders } from './webhook-signing.js';
import type { AppConfig } from '../config/index.js';

const PROJECT_NAME = 'api-test-gateway';
const REPOSITORY = 'sl-cloud/api-test-gateway';

export interface DeploymentCompletedEvent {
  project: string;
  event: 'deployment.completed';
  repository: string;
  branch: string;
  commitSha: string;
  baseSha: string;
  environment: string;
  ciRunUrl: string;
  deployedAt: string;
}

export interface NotifyResult {
  ok: boolean;
  status?: number;
}

/**
 * Signs and sends the same deployment.completed event deploy-staging.yml
 * sends after a CI deploy, so a run can be requested from inside the app
 * (e.g. an admin-triggered "run tests against what's live now" action)
 * without waiting for the next real deploy.
 */
export async function notifyDeploymentCompleted(
  params: { branch: string; baseSha?: string },
  config: Pick<AppConfig, 'NODE_ENV' | 'COMMIT_SHA' | 'CONTROL_PLANE_URL' | 'CP_WEBHOOK_SECRET'>,
  logger: FastifyBaseLogger,
): Promise<NotifyResult> {
  if (!config.CONTROL_PLANE_URL || !config.CP_WEBHOOK_SECRET) {
    return { ok: false };
  }

  const event: DeploymentCompletedEvent = {
    project: PROJECT_NAME,
    event: 'deployment.completed',
    repository: REPOSITORY,
    branch: params.branch,
    commitSha: config.COMMIT_SHA,
    baseSha: params.baseSha ?? '',
    environment: config.NODE_ENV,
    ciRunUrl: '',
    deployedAt: new Date().toISOString(),
  };
  const rawBody = JSON.stringify(event);
  const headers = buildSignedWebhookHeaders(
    'deployment.completed',
    config.CP_WEBHOOK_SECRET,
    rawBody,
    randomUUID(),
  );

  try {
    const response = await fetch(`${config.CONTROL_PLANE_URL}/api/v1/webhooks/github-ci`, {
      method: 'POST',
      headers: { ...headers },
      body: rawBody,
    });
    if (!response.ok) {
      logger.warn({ status: response.status }, 'deployment-notifier: non-OK response');
    }
    return { ok: response.ok, status: response.status };
  } catch (err) {
    logger.warn({ err }, 'deployment-notifier: request failed');
    return { ok: false };
  }
}
