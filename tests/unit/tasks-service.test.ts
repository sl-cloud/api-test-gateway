import { describe, it, expect, vi } from 'vitest';
import { updateTask } from '../../src/modules/tasks/service.js';
import { ValidationError } from '../../src/lib/errors.js';

function fakeDbForUpdate({
  project,
  task,
  isMember,
}: {
  project: { id: string; ownerId: string; status: string };
  task: { id: string; projectId: string; status: string; assigneeId: string | null };
  isMember: boolean;
}) {
  return {
    query: {
      projectsTable: { findFirst: vi.fn().mockResolvedValue(project) },
      projectMembersTable: {
        findFirst: vi.fn().mockResolvedValue(isMember ? { userId: 'x' } : undefined),
      },
      tasksTable: { findFirst: vi.fn().mockResolvedValue(task) },
    },
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ ...task, status: 'done' }]),
        }),
      }),
    }),
  };
}

describe('updateTask', () => {
  it('rejects an invalid status transition with ValidationError', async () => {
    const db = fakeDbForUpdate({
      project: { id: 'p1', ownerId: 'owner-1', status: 'active' },
      task: { id: 't1', projectId: 'p1', status: 'todo', assigneeId: null },
      isMember: false,
    });
    await expect(
      updateTask(db as never, { id: 'owner-1', role: 'member' }, 't1', { status: 'done' }),
    ).rejects.toThrow(ValidationError);
  });
});
