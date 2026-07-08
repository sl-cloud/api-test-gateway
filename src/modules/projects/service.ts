import { eq, and, or } from 'drizzle-orm';
import type { Db } from '../../db/index.js';
import { projectsTable, projectMembersTable, usersTable, type Project } from '../../db/schema.js';
import { NotFoundError, ForbiddenError, ConflictError, ValidationError } from '../../lib/errors.js';
import type { CurrentUser } from '../../types/current-user.js';
import { canViewProject, canManageProject, canManageMembers } from './policies.js';
import type { CreateProjectBody, UpdateProjectBody } from './schemas.js';

async function isMemberOf(db: Db, projectId: string, userId: string): Promise<boolean> {
  const membership = await db.query.projectMembersTable.findFirst({
    where: and(
      eq(projectMembersTable.projectId, projectId),
      eq(projectMembersTable.userId, userId),
    ),
  });
  return Boolean(membership);
}

export async function createProject(
  db: Db,
  currentUser: CurrentUser,
  input: CreateProjectBody,
): Promise<Project> {
  const [created] = await db
    .insert(projectsTable)
    .values({ name: input.name, description: input.description, ownerId: currentUser.id })
    .returning();
  if (!created) throw new Error('insert returned no row');
  return created;
}

export async function getProject(db: Db, currentUser: CurrentUser, id: string): Promise<Project> {
  const project = await db.query.projectsTable.findFirst({ where: eq(projectsTable.id, id) });
  if (!project) {
    throw new NotFoundError('project not found');
  }

  const member = await isMemberOf(db, id, currentUser.id);
  if (!canViewProject(currentUser, project, member)) {
    // 404, not 403: non-members must not learn the project exists.
    throw new NotFoundError('project not found');
  }

  return project;
}

export async function listProjects(
  db: Db,
  currentUser: CurrentUser,
  showAll: boolean,
): Promise<Project[]> {
  if (showAll && currentUser.role === 'admin') {
    return db.select().from(projectsTable);
  }

  const memberships = await db
    .select({ projectId: projectMembersTable.projectId })
    .from(projectMembersTable)
    .where(eq(projectMembersTable.userId, currentUser.id));
  const memberProjectIds = memberships.map((m) => m.projectId);

  if (memberProjectIds.length === 0) {
    return db.select().from(projectsTable).where(eq(projectsTable.ownerId, currentUser.id));
  }

  return db
    .select()
    .from(projectsTable)
    .where(
      or(
        eq(projectsTable.ownerId, currentUser.id),
        ...memberProjectIds.map((id) => eq(projectsTable.id, id)),
      ),
    );
}

export async function updateProject(
  db: Db,
  currentUser: CurrentUser,
  id: string,
  patch: UpdateProjectBody,
): Promise<Project> {
  const project = await getProject(db, currentUser, id);

  if (!canManageProject(currentUser, project)) {
    throw new ForbiddenError('only the owner or an admin may update this project');
  }
  if (project.status === 'archived') {
    throw new ConflictError('project is archived and read-only');
  }

  const [updated] = await db
    .update(projectsTable)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(projectsTable.id, id))
    .returning();
  if (!updated) throw new NotFoundError('project not found');
  return updated;
}

export async function archiveProject(
  db: Db,
  currentUser: CurrentUser,
  id: string,
): Promise<Project> {
  const project = await getProject(db, currentUser, id);
  if (!canManageProject(currentUser, project)) {
    throw new ForbiddenError('only the owner or an admin may archive this project');
  }

  const [updated] = await db
    .update(projectsTable)
    .set({ status: 'archived', updatedAt: new Date() })
    .where(eq(projectsTable.id, id))
    .returning();
  if (!updated) throw new NotFoundError('project not found');
  return updated;
}

export async function deleteProject(db: Db, currentUser: CurrentUser, id: string): Promise<void> {
  const project = await getProject(db, currentUser, id);
  if (!canManageProject(currentUser, project)) {
    throw new ForbiddenError('only the owner or an admin may delete this project');
  }
  await db.delete(projectsTable).where(eq(projectsTable.id, id));
}

export async function addMember(
  db: Db,
  currentUser: CurrentUser,
  projectId: string,
  userId: string,
): Promise<void> {
  const project = await getProject(db, currentUser, projectId);
  if (!canManageMembers(currentUser, project)) {
    throw new ForbiddenError('only the owner or an admin may manage members');
  }
  if (project.status === 'archived') {
    throw new ConflictError('project is archived and read-only');
  }

  const targetUser = await db.query.usersTable.findFirst({ where: eq(usersTable.id, userId) });
  if (!targetUser) {
    throw new ValidationError('userId does not reference an existing user', 'invalid_member');
  }

  await db.insert(projectMembersTable).values({ projectId, userId }).onConflictDoNothing();
}

export async function removeMember(
  db: Db,
  currentUser: CurrentUser,
  projectId: string,
  userId: string,
): Promise<void> {
  const project = await getProject(db, currentUser, projectId);
  if (!canManageMembers(currentUser, project)) {
    throw new ForbiddenError('only the owner or an admin may manage members');
  }
  if (project.status === 'archived') {
    throw new ConflictError('project is archived and read-only');
  }

  await db
    .delete(projectMembersTable)
    .where(
      and(eq(projectMembersTable.projectId, projectId), eq(projectMembersTable.userId, userId)),
    );
}

export { isMemberOf };
