import { describe, it, expect } from 'vitest';
import jwt from 'jsonwebtoken';
import { signAccessToken, verifyAccessToken } from '../../src/lib/jwt.js';
import { UnauthorizedError } from '../../src/lib/errors.js';

const SECRET = 'test_only_jwt_secret_not_for_any_real_use_32ch';

describe('jwt helper', () => {
  it('signs a token that verifies back to the same payload', () => {
    const token = signAccessToken({ sub: 'user-1', role: 'member' }, SECRET);
    const payload = verifyAccessToken(token, SECRET);
    expect(payload.sub).toBe('user-1');
    expect(payload.role).toBe('member');
  });

  it('sets a 1 hour expiry', () => {
    const token = signAccessToken({ sub: 'user-1', role: 'member' }, SECRET);
    const decoded = jwt.decode(token) as { exp: number; iat: number };
    expect(decoded.exp - decoded.iat).toBe(3600);
  });

  it('throws UnauthorizedError for a token signed with a different secret', () => {
    const token = signAccessToken(
      { sub: 'user-1', role: 'member' },
      'a_completely_different_secret_value_32ch',
    );
    expect(() => verifyAccessToken(token, SECRET)).toThrow(UnauthorizedError);
  });

  it('throws UnauthorizedError for a malformed token', () => {
    expect(() => verifyAccessToken('not-a-jwt', SECRET)).toThrow(UnauthorizedError);
  });

  it('throws UnauthorizedError for an expired token', () => {
    const expired = jwt.sign({ sub: 'user-1', role: 'member' }, SECRET, { expiresIn: -1 });
    expect(() => verifyAccessToken(expired, SECRET)).toThrow(UnauthorizedError);
  });
});
