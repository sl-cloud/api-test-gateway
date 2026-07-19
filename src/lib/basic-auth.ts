import { timingSafeEqual } from 'node:crypto';

export function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/** Parses an `Authorization: Basic <base64>` header into a username/password pair. */
export function parseBasicAuthHeader(
  header: string | undefined,
): { username: string; password: string } | undefined {
  if (!header?.startsWith('Basic ')) return undefined;
  const decoded = Buffer.from(header.slice('Basic '.length), 'base64').toString('utf8');
  const sepIndex = decoded.indexOf(':');
  if (sepIndex === -1) return undefined;
  return { username: decoded.slice(0, sepIndex), password: decoded.slice(sepIndex + 1) };
}
