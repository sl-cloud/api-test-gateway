import { describe, it, expect } from 'vitest';
import { loadConfig } from '../../src/config/index.js';

const validEnv = {
  NODE_ENV: 'test',
  PORT: '3000',
  LOG_LEVEL: 'silent',
  DATABASE_URL: 'postgres://user:pass@localhost:5432/db',
  JWT_SECRET: 'a'.repeat(32),
};

describe('loadConfig', () => {
  it('parses a valid environment', () => {
    const config = loadConfig(validEnv);

    expect(config.NODE_ENV).toBe('test');
    expect(config.PORT).toBe(3000);
    expect(config.DATABASE_URL).toBe(validEnv.DATABASE_URL);
    expect(config.COMMIT_SHA).toBe('dev'); // default when unset
  });

  it('defaults NODE_ENV to development when unset', () => {
    const { NODE_ENV: _omit, ...rest } = validEnv;
    const config = loadConfig(rest);

    expect(config.NODE_ENV).toBe('development');
  });

  it('coerces PORT to a number', () => {
    const config = loadConfig({ ...validEnv, PORT: '4321' });

    expect(config.PORT).toBe(4321);
  });

  it('throws naming the offending variable when JWT_SECRET is too short', () => {
    expect(() => loadConfig({ ...validEnv, JWT_SECRET: 'too-short' })).toThrowError(/JWT_SECRET/);
  });

  it('throws when DATABASE_URL is missing', () => {
    const { DATABASE_URL: _omit, ...rest } = validEnv;

    expect(() => loadConfig(rest)).toThrowError(/DATABASE_URL/);
  });

  it('rejects an invalid NODE_ENV value', () => {
    expect(() => loadConfig({ ...validEnv, NODE_ENV: 'staging-typo' })).toThrowError(/NODE_ENV/);
  });

  it('leaves the optional error webhook config undefined when unset', () => {
    const config = loadConfig(validEnv);

    expect(config.ERROR_WEBHOOK_URL).toBeUndefined();
    expect(config.ERROR_WEBHOOK_SECRET).toBeUndefined();
  });

  it('accepts the error webhook config when both fields are valid', () => {
    const config = loadConfig({
      ...validEnv,
      ERROR_WEBHOOK_URL: 'https://cp.example.dev/api/v1/webhooks/error-report',
      ERROR_WEBHOOK_SECRET: 'a'.repeat(16),
    });

    expect(config.ERROR_WEBHOOK_URL).toBe('https://cp.example.dev/api/v1/webhooks/error-report');
  });
});
