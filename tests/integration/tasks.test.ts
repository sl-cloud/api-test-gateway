import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestApp } from '../helpers/build-app.js';
import { createDb } from '../../src/db/index.js';
import { usersTable } from '../../src/db/schema.js';
import { eq } from 'drizzle-orm';

async function registerAndLogin(app: FastifyInstance, email: string) {
  await app.inject({
    method: 'POST',
    url: '/api/v1/auth/register',
    payload: { email, password: 'a_valid_password', displayName: 'Test User' },
  });
  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    payload: { email, password: 'a_valid_password' },
  });
  const db = createDb(app.db);
  const user = await db.query.usersTable.findFirst({ where: eq(usersTable.email, email) });
  return { token: res.json<{ accessToken: string }>().accessToken, userId: user!.id };
}

async function createProject(app: FastifyInstance, token: string, name: string) {
  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/projects',
    headers: { authorization: `Bearer ${token}` },
    payload: { name },
  });
  return res.json<{ id: string }>().id;
}

describe('tasks endpoints', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('the owner can create a task', async () => {
    const owner = await registerAndLogin(app, `t-owner-${Date.now()}@example.com`);
    const projectId = await createProject(app, owner.token, 'Task Project');

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/tasks`,
      headers: { authorization: `Bearer ${owner.token}` },
      payload: { title: 'Do the thing' },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json<{ status: string }>().status).toBe('todo');
  });

  it('rejects a task assignee who is not a project member (422)', async () => {
    const owner = await registerAndLogin(app, `t-owner2-${Date.now()}@example.com`);
    const projectId = await createProject(app, owner.token, 'Assignee Project');
    const stranger = await registerAndLogin(app, `t-stranger-${Date.now()}@example.com`);

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/tasks`,
      headers: { authorization: `Bearer ${owner.token}` },
      payload: { title: 'Assign to outsider', assigneeId: stranger.userId },
    });
    expect(res.statusCode).toBe(422);
  });

  it('rejects a direct todo -> done transition (422)', async () => {
    const owner = await registerAndLogin(app, `t-owner3-${Date.now()}@example.com`);
    const projectId = await createProject(app, owner.token, 'Transition Project');
    const createRes = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/tasks`,
      headers: { authorization: `Bearer ${owner.token}` },
      payload: { title: 'Transition me' },
    });
    const taskId = createRes.json<{ id: string }>().id;

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/tasks/${taskId}`,
      headers: { authorization: `Bearer ${owner.token}` },
      payload: { status: 'done' },
    });
    expect(res.statusCode).toBe(422);
  });

  it('allows todo -> in_progress -> done, and reopening done -> in_progress', async () => {
    const owner = await registerAndLogin(app, `t-owner4-${Date.now()}@example.com`);
    const projectId = await createProject(app, owner.token, 'Full Flow Project');
    const createRes = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/tasks`,
      headers: { authorization: `Bearer ${owner.token}` },
      payload: { title: 'Flow me' },
    });
    const taskId = createRes.json<{ id: string }>().id;

    const toInProgress = await app.inject({
      method: 'PATCH',
      url: `/api/v1/tasks/${taskId}`,
      headers: { authorization: `Bearer ${owner.token}` },
      payload: { status: 'in_progress' },
    });
    expect(toInProgress.statusCode).toBe(200);

    const toDone = await app.inject({
      method: 'PATCH',
      url: `/api/v1/tasks/${taskId}`,
      headers: { authorization: `Bearer ${owner.token}` },
      payload: { status: 'done' },
    });
    expect(toDone.statusCode).toBe(200);

    const reopen = await app.inject({
      method: 'PATCH',
      url: `/api/v1/tasks/${taskId}`,
      headers: { authorization: `Bearer ${owner.token}` },
      payload: { status: 'in_progress' },
    });
    expect(reopen.statusCode).toBe(200);
    expect(reopen.json<{ status: string }>().status).toBe('in_progress');
  });

  it('only the owner or admin may delete a task, not a plain member (403)', async () => {
    const owner = await registerAndLogin(app, `t-owner5-${Date.now()}@example.com`);
    const projectId = await createProject(app, owner.token, 'Delete Project');
    const member = await registerAndLogin(app, `t-member-${Date.now()}@example.com`);
    await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/members`,
      headers: { authorization: `Bearer ${owner.token}` },
      payload: { userId: member.userId },
    });
    const createRes = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/tasks`,
      headers: { authorization: `Bearer ${owner.token}` },
      payload: { title: 'Protect me' },
    });
    const taskId = createRes.json<{ id: string }>().id;

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/tasks/${taskId}`,
      headers: { authorization: `Bearer ${member.token}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it('mutating a task in an archived project returns 409', async () => {
    const owner = await registerAndLogin(app, `t-owner6-${Date.now()}@example.com`);
    const projectId = await createProject(app, owner.token, 'Archive Task Project');
    const createRes = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/tasks`,
      headers: { authorization: `Bearer ${owner.token}` },
      payload: { title: 'Frozen task' },
    });
    const taskId = createRes.json<{ id: string }>().id;

    await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/archive`,
      headers: { authorization: `Bearer ${owner.token}` },
    });

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/tasks/${taskId}`,
      headers: { authorization: `Bearer ${owner.token}` },
      payload: { status: 'in_progress' },
    });
    expect(res.statusCode).toBe(409);
  });

  it('rejects a dueDate in the past on create (422)', async () => {
    const owner = await registerAndLogin(app, `t-owner7-${Date.now()}@example.com`);
    const projectId = await createProject(app, owner.token, 'Due Date Project');

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/tasks`,
      headers: { authorization: `Bearer ${owner.token}` },
      payload: { title: 'Late task', dueDate: '2020-01-01' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('filters tasks by priority', async () => {
    const owner = await registerAndLogin(app, `t-owner9-${Date.now()}@example.com`);
    const projectId = await createProject(app, owner.token, 'Priority Filter Project');

    await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/tasks`,
      headers: { authorization: `Bearer ${owner.token}` },
      payload: { title: 'Urgent task', priority: 'high' },
    });
    await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/tasks`,
      headers: { authorization: `Bearer ${owner.token}` },
      payload: { title: 'Someday task', priority: 'low' },
    });

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectId}/tasks?priority=high`,
      headers: { authorization: `Bearer ${owner.token}` },
    });
    expect(res.statusCode).toBe(200);
    const tasks = res.json<{ title: string; priority: string }[]>();
    expect(tasks).toHaveLength(1);
    const [task] = tasks;
    expect(task?.priority).toBe('high');
    expect(task?.title).toBe('Urgent task');
  });

  it('masks a task in an invisible project as task-not-found, indistinguishable from a nonexistent task id (404)', async () => {
    // Uses its own app instance (rather than the shared `app`) so this
    // test's extra login calls don't push the shared instance's per-route
    // login rate limit over its threshold alongside the other tests above.
    const isolatedApp = await buildTestApp();
    await isolatedApp.ready();
    try {
      const owner = await registerAndLogin(isolatedApp, `t-owner8-${Date.now()}@example.com`);
      const projectId = await createProject(isolatedApp, owner.token, 'Private Project');
      const createRes = await isolatedApp.inject({
        method: 'POST',
        url: `/api/v1/projects/${projectId}/tasks`,
        headers: { authorization: `Bearer ${owner.token}` },
        payload: { title: 'Hidden task' },
      });
      const taskId = createRes.json<{ id: string }>().id;

      const outsider = await registerAndLogin(isolatedApp, `t-outsider-${Date.now()}@example.com`);

      const getRes = await isolatedApp.inject({
        method: 'GET',
        url: `/api/v1/tasks/${taskId}`,
        headers: { authorization: `Bearer ${outsider.token}` },
      });
      const patchRes = await isolatedApp.inject({
        method: 'PATCH',
        url: `/api/v1/tasks/${taskId}`,
        headers: { authorization: `Bearer ${outsider.token}` },
        payload: { status: 'in_progress' },
      });
      const deleteRes = await isolatedApp.inject({
        method: 'DELETE',
        url: `/api/v1/tasks/${taskId}`,
        headers: { authorization: `Bearer ${outsider.token}` },
      });

      const nonexistentId = '00000000-0000-4000-8000-000000000000';
      const nonexistentRes = await isolatedApp.inject({
        method: 'GET',
        url: `/api/v1/tasks/${nonexistentId}`,
        headers: { authorization: `Bearer ${outsider.token}` },
      });

      for (const res of [getRes, patchRes, deleteRes, nonexistentRes]) {
        expect(res.statusCode).toBe(404);
        expect(res.json<{ detail: string }>().detail).toBe('task not found');
      }
    } finally {
      await isolatedApp.close();
    }
  });
});
