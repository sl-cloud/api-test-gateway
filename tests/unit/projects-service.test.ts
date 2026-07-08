import { describe, it, expect, vi } from 'vitest';
import { getProject } from '../../src/modules/projects/service.js';
import { NotFoundError } from '../../src/lib/errors.js';

function fakeDb({
  project,
  isMember,
}: {
  project: { id: string; ownerId: string; status: string } | undefined;
  isMember: boolean;
}) {
  return {
    query: {
      projectsTable: { findFirst: vi.fn().mockResolvedValue(project) },
      projectMembersTable: {
        findFirst: vi
          .fn()
          .mockResolvedValue(isMember ? { projectId: project?.id, userId: 'someone' } : undefined),
      },
    },
  };
}

describe('getProject', () => {
  it('returns the project for its owner', async () => {
    const db = fakeDb({
      project: { id: 'p1', ownerId: 'owner-1', status: 'active' },
      isMember: false,
    });
    const result = await getProject(db as never, { id: 'owner-1', role: 'member' }, 'p1');
    expect(result.id).toBe('p1');
  });

  it('throws NotFoundError (not Forbidden) for a non-member to avoid resource enumeration', async () => {
    const db = fakeDb({
      project: { id: 'p1', ownerId: 'owner-1', status: 'active' },
      isMember: false,
    });
    await expect(
      getProject(db as never, { id: 'stranger-1', role: 'member' }, 'p1'),
    ).rejects.toThrow(NotFoundError);
  });

  it('throws NotFoundError when the project does not exist', async () => {
    const db = fakeDb({ project: undefined, isMember: false });
    await expect(
      getProject(db as never, { id: 'anyone', role: 'member' }, 'missing'),
    ).rejects.toThrow(NotFoundError);
  });
});
