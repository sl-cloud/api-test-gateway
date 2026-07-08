import { describe, it, expect } from 'vitest';
import { usersTable, projectsTable, projectMembersTable, tasksTable } from '../../src/db/schema.js';

describe('db schema', () => {
  it('exports the four TaskBoard tables', () => {
    expect(usersTable).toBeDefined();
    expect(projectsTable).toBeDefined();
    expect(projectMembersTable).toBeDefined();
    expect(tasksTable).toBeDefined();
  });
});
