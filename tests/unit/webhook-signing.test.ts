import { describe, it, expect } from 'vitest';
import { signWebhookBody, buildSignedWebhookHeaders } from '../../src/lib/webhook-signing.js';

describe('signWebhookBody', () => {
  it('produces a stable sha256= hex signature for the same inputs', () => {
    const sig1 = signWebhookBody('secret', 1700000000, '{"a":1}');
    const sig2 = signWebhookBody('secret', 1700000000, '{"a":1}');
    expect(sig1).toBe(sig2);
    expect(sig1).toMatch(/^sha256=[0-9a-f]{64}$/);
  });

  it('changes when the body changes', () => {
    const sig1 = signWebhookBody('secret', 1700000000, '{"a":1}');
    const sig2 = signWebhookBody('secret', 1700000000, '{"a":2}');
    expect(sig1).not.toBe(sig2);
  });

  it('changes when the timestamp changes', () => {
    const sig1 = signWebhookBody('secret', 1700000000, '{"a":1}');
    const sig2 = signWebhookBody('secret', 1700000001, '{"a":1}');
    expect(sig1).not.toBe(sig2);
  });

  it('changes when the secret changes', () => {
    const sig1 = signWebhookBody('secret-a', 1700000000, '{"a":1}');
    const sig2 = signWebhookBody('secret-b', 1700000000, '{"a":1}');
    expect(sig1).not.toBe(sig2);
  });
});

describe('buildSignedWebhookHeaders', () => {
  it('builds headers whose signature verifies against the timestamp and body', () => {
    const rawBody = '{"hello":"world"}';
    const headers = buildSignedWebhookHeaders('error.reported', 'secret', rawBody);

    expect(headers['X-Portfolio-Event']).toBe('error.reported');
    expect(headers['Content-Type']).toBe('application/json');
    expect(headers['X-Portfolio-Delivery']).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );

    const timestampSeconds = Number(headers['X-Portfolio-Timestamp']);
    const expectedSignature = signWebhookBody('secret', timestampSeconds, rawBody);
    expect(headers['X-Portfolio-Signature']).toBe(expectedSignature);
  });

  it('uses a caller-supplied delivery id when given', () => {
    const headers = buildSignedWebhookHeaders('deployment.completed', 'secret', '{}', 'fixed-id');
    expect(headers['X-Portfolio-Delivery']).toBe('fixed-id');
  });
});
