import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from '../../src/lib/password.js';

describe('password hashing', () => {
  it('hashes a password to an argon2id string distinct from the input', async () => {
    const hash = await hashPassword('correct horse battery staple');
    expect(hash).not.toBe('correct horse battery staple');
    expect(hash).toMatch(/^\$argon2id\$/);
  });

  it('verifies a correct password against its hash', async () => {
    const hash = await hashPassword('correct horse battery staple');
    await expect(verifyPassword(hash, 'correct horse battery staple')).resolves.toBe(true);
  });

  it('rejects an incorrect password', async () => {
    const hash = await hashPassword('correct horse battery staple');
    await expect(verifyPassword(hash, 'wrong password')).resolves.toBe(false);
  });
});
