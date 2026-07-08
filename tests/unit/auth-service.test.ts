import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerUser, loginUser } from '../../src/modules/auth/service.js';
import { ConflictError, UnauthorizedError } from '../../src/lib/errors.js';

function fakeDb(existingUser: unknown = undefined) {
  return {
    query: { usersTable: { findFirst: vi.fn().mockResolvedValue(existingUser) } },
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([
          {
            id: 'new-user-id',
            email: 'new@example.com',
            displayName: 'New User',
            role: 'member',
            isActive: true,
            passwordHash: 'hashed',
            createdAt: new Date(),
          },
        ]),
      }),
    }),
  };
}

describe('registerUser', () => {
  it('creates a member-role user with a hashed password', async () => {
    const db = fakeDb(undefined);
    const result = await registerUser(db as never, {
      email: 'new@example.com',
      password: 'a_valid_password',
      displayName: 'New User',
    });
    expect(result.role).toBe('member');
    expect(result.email).toBe('new@example.com');
    expect(db.insert).toHaveBeenCalled();
  });

  it('rejects registering an email that already exists', async () => {
    const db = fakeDb({ id: 'existing', email: 'new@example.com' });
    await expect(
      registerUser(db as never, {
        email: 'new@example.com',
        password: 'a_valid_password',
        displayName: 'New User',
      }),
    ).rejects.toThrow(ConflictError);
  });
});

describe('loginUser', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects login for a nonexistent email', async () => {
    const db = fakeDb(undefined);
    await expect(
      loginUser(
        db as never,
        { JWT_SECRET: 'test_only_jwt_secret_not_for_any_real_use_32ch' },
        { email: 'nope@example.com', password: 'whatever' },
      ),
    ).rejects.toThrow(UnauthorizedError);
  });

  it('rejects login for a deactivated user even with the right password', async () => {
    const argon2 = await import('argon2');
    const passwordHash = await argon2.hash('correct_password', { type: argon2.argon2id });
    const db = fakeDb({
      id: 'user-1',
      email: 'a@example.com',
      passwordHash,
      role: 'member',
      isActive: false,
    });
    await expect(
      loginUser(
        db as never,
        { JWT_SECRET: 'test_only_jwt_secret_not_for_any_real_use_32ch' },
        { email: 'a@example.com', password: 'correct_password' },
      ),
    ).rejects.toThrow(UnauthorizedError);
  });
});
