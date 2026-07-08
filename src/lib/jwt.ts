import jwt from 'jsonwebtoken';
import { UnauthorizedError } from './errors.js';

export interface AccessTokenPayload {
  sub: string;
  role: 'admin' | 'member';
}

const EXPIRES_IN_SECONDS = 3600;

export function signAccessToken(payload: AccessTokenPayload, secret: string): string {
  return jwt.sign(payload, secret, { expiresIn: EXPIRES_IN_SECONDS, algorithm: 'HS256' });
}

export function verifyAccessToken(token: string, secret: string): AccessTokenPayload {
  try {
    const decoded = jwt.verify(token, secret, { algorithms: ['HS256'] });
    if (typeof decoded === 'string' || !('sub' in decoded) || !('role' in decoded)) {
      throw new UnauthorizedError('invalid token payload');
    }
    return { sub: decoded.sub as string, role: decoded.role as AccessTokenPayload['role'] };
  } catch (err) {
    if (err instanceof UnauthorizedError) throw err;
    throw new UnauthorizedError('invalid or expired token');
  }
}
