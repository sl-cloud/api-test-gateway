import type { CurrentUser } from '../../types/current-user.js';
import type { Project } from '../../db/schema.js';

export function canViewProject(user: CurrentUser, project: Project, isMember: boolean): boolean {
  return user.role === 'admin' || project.ownerId === user.id || isMember;
}

export function canManageProject(user: CurrentUser, project: Project): boolean {
  return user.role === 'admin' || project.ownerId === user.id;
}

export function canManageMembers(user: CurrentUser, project: Project): boolean {
  return canManageProject(user, project);
}

export function canCreateOrEditTask(
  user: CurrentUser,
  project: Project,
  isMember: boolean,
): boolean {
  return project.ownerId === user.id || isMember;
}

export function canDeleteTask(user: CurrentUser, project: Project): boolean {
  return user.role === 'admin' || project.ownerId === user.id;
}
