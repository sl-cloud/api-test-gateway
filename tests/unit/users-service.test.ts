import { describe, it, expect, vi } from 'vitest';
import { updateUser } from '../../src/modules/users/service.js';
import { NotFoundError } from '../../src/lib/errors.js';

function fakeDbWithUpdate(updated: unknown) {
  return {
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue(updated ? [updated] : []),
        }),
      }),
    }),
  };
}

describe('updateUser', () => {
  it('updates role and isActive and returns the public shape', async () => {
    const db = fakeDbWithUpdate({
      id: 'u1',
      email: 'a@example.com',
      displayName: 'A',
      role: 'admin',
      isActive: false,
    });
    const result = await updateUser(db as never, 'u1', { role: 'admin', isActive: false });
    expect(result).toEqual({
      id: 'u1',
      email: 'a@example.com',
      displayName: 'A',
      role: 'admin',
      isActive: false,
    });
  });

  it('throws NotFoundError when the user id does not exist', async () => {
    const db = fakeDbWithUpdate(undefined);
    await expect(updateUser(db as never, 'missing', { role: 'admin' })).rejects.toThrow(
      NotFoundError,
    );
  });
});
