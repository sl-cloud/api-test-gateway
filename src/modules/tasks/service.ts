import { eq, and } from 'drizzle-orm';
import type { Db } from '../../db/index.js';
import { tasksTable, projectsTable, type Task, type Project } from '../../db/schema.js';
import { NotFoundError, ForbiddenError, ConflictError, ValidationError } from '../../lib/errors.js';
import type { CurrentUser } from '../../types/current-user.js';
import { canCreateOrEditTask, canDeleteTask, canViewProject } from '../projects/policies.js';
import { isMemberOf } from '../projects/service.js';
import { isValidTransition } from './transitions.js';
import type { CreateTaskBody, UpdateTaskBody, ListTasksQuery } from './schemas.js';

async function loadProjectForMutation(
  db: Db,
  currentUser: CurrentUser,
  projectId: string,
): Promise<{ project: Project; isMember: boolean }> {
  const project = await db.query.projectsTable.findFirst({
    where: eq(projectsTable.id, projectId),
  });
  if (!project) throw new NotFoundError('project not found');

  const member = await isMemberOf(db, projectId, currentUser.id);
  if (!canViewProject(currentUser, project, member)) {
    throw new NotFoundError('project not found');
  }
  return { project, isMember: member };
}

export async function createTask(
  db: Db,
  currentUser: CurrentUser,
  projectId: string,
  input: CreateTaskBody,
): Promise<Task> {
  const { project, isMember } = await loadProjectForMutation(db, currentUser, projectId);

  if (!canCreateOrEditTask(currentUser, project, isMember)) {
    throw new ForbiddenError('only project members or the owner may create tasks');
  }
  if (project.status === 'archived') {
    throw new ConflictError('project is archived and read-only');
  }

  if (input.assigneeId) {
    const assigneeIsMember =
      input.assigneeId === project.ownerId || (await isMemberOf(db, projectId, input.assigneeId));
    if (!assigneeIsMember) {
      throw new ValidationError('assignee must be a member of the project', 'invalid_assignee');
    }
  }

  const [created] = await db
    .insert(tasksTable)
    .values({
      projectId,
      title: input.title,
      description: input.description,
      priority: input.priority,
      assigneeId: input.assigneeId,
      dueDate: input.dueDate,
      createdBy: currentUser.id,
    })
    .returning();
  if (!created) throw new Error('insert returned no row');
  return created;
}

export async function getTask(db: Db, currentUser: CurrentUser, taskId: string): Promise<Task> {
  const task = await db.query.tasksTable.findFirst({ where: eq(tasksTable.id, taskId) });
  if (!task) throw new NotFoundError('task not found');

  await loadProjectForMutation(db, currentUser, task.projectId);
  return task;
}

export async function listTasks(
  db: Db,
  currentUser: CurrentUser,
  projectId: string,
  query: ListTasksQuery,
): Promise<Task[]> {
  await loadProjectForMutation(db, currentUser, projectId);

  const conditions = [eq(tasksTable.projectId, projectId)];
  if (query.status) conditions.push(eq(tasksTable.status, query.status));
  if (query.assigneeId) conditions.push(eq(tasksTable.assigneeId, query.assigneeId));

  return db
    .select()
    .from(tasksTable)
    .where(and(...conditions));
}

export async function updateTask(
  db: Db,
  currentUser: CurrentUser,
  taskId: string,
  patch: UpdateTaskBody,
): Promise<Task> {
  const task = await db.query.tasksTable.findFirst({ where: eq(tasksTable.id, taskId) });
  if (!task) throw new NotFoundError('task not found');

  const { project, isMember } = await loadProjectForMutation(db, currentUser, task.projectId);

  if (!canCreateOrEditTask(currentUser, project, isMember)) {
    throw new ForbiddenError('only project members or the owner may edit tasks');
  }
  if (project.status === 'archived') {
    throw new ConflictError('project is archived and read-only');
  }
  if (patch.status && !isValidTransition(task.status, patch.status)) {
    throw new ValidationError(
      `cannot transition task from ${task.status} to ${patch.status}`,
      'invalid_status_transition',
    );
  }
  if (patch.assigneeId) {
    const assigneeIsMember =
      patch.assigneeId === project.ownerId ||
      (await isMemberOf(db, task.projectId, patch.assigneeId));
    if (!assigneeIsMember) {
      throw new ValidationError('assignee must be a member of the project', 'invalid_assignee');
    }
  }

  const [updated] = await db
    .update(tasksTable)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(tasksTable.id, taskId))
    .returning();
  if (!updated) throw new NotFoundError('task not found');
  return updated;
}

export async function deleteTask(db: Db, currentUser: CurrentUser, taskId: string): Promise<void> {
  const task = await db.query.tasksTable.findFirst({ where: eq(tasksTable.id, taskId) });
  if (!task) throw new NotFoundError('task not found');

  const { project } = await loadProjectForMutation(db, currentUser, task.projectId);

  if (!canDeleteTask(currentUser, project)) {
    throw new ForbiddenError('only the owner or an admin may delete tasks');
  }
  if (project.status === 'archived') {
    throw new ConflictError('project is archived and read-only');
  }

  await db.delete(tasksTable).where(eq(tasksTable.id, taskId));
}
