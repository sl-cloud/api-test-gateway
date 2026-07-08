import { describe, it, expect } from 'vitest';
import {
  AppError,
  NotFoundError,
  ForbiddenError,
  ConflictError,
  ValidationError,
  UnauthorizedError,
} from '../../src/lib/errors.js';

describe('error hierarchy', () => {
  it('NotFoundError has statusCode 404 and default code', () => {
    const err = new NotFoundError('project not found');
    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(404);
    expect(err.code).toBe('not_found');
    expect(err.message).toBe('project not found');
  });

  it('ForbiddenError has statusCode 403 and default code', () => {
    const err = new ForbiddenError('not allowed');
    expect(err.statusCode).toBe(403);
    expect(err.code).toBe('forbidden');
  });

  it('ConflictError has statusCode 409 and default code', () => {
    const err = new ConflictError('project is archived');
    expect(err.statusCode).toBe(409);
    expect(err.code).toBe('conflict');
  });

  it('ValidationError has statusCode 422 and default code', () => {
    const err = new ValidationError('invalid status transition');
    expect(err.statusCode).toBe(422);
    expect(err.code).toBe('validation_error');
  });

  it('UnauthorizedError has statusCode 401 and default code', () => {
    const err = new UnauthorizedError('invalid credentials');
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe('unauthorized');
  });

  it('allows overriding the default code', () => {
    const err = new ConflictError('email already registered', 'email_taken');
    expect(err.code).toBe('email_taken');
  });
});
