import { describe, it, expect } from 'vitest';
import {
  canViewProject,
  canManageProject,
  canManageMembers,
  canCreateOrEditTask,
  canDeleteTask,
} from '../../src/modules/projects/policies.js';
import type { Project } from '../../src/db/schema.js';

const project = { id: 'p1', ownerId: 'owner-1', status: 'active' } as Project;
const owner = { id: 'owner-1', role: 'member' as const };
const member = { id: 'member-1', role: 'member' as const };
const stranger = { id: 'stranger-1', role: 'member' as const };
const admin = { id: 'admin-1', role: 'admin' as const };

describe('canViewProject', () => {
  it('allows the owner', () => expect(canViewProject(owner, project, false)).toBe(true));
  it('allows a member', () => expect(canViewProject(member, project, true)).toBe(true));
  it('allows an admin who is not a member', () =>
    expect(canViewProject(admin, project, false)).toBe(true));
  it('denies a non-member non-admin', () =>
    expect(canViewProject(stranger, project, false)).toBe(false));
});

describe('canManageProject', () => {
  it('allows the owner', () => expect(canManageProject(owner, project)).toBe(true));
  it('allows an admin', () => expect(canManageProject(admin, project)).toBe(true));
  it('denies a member who is not the owner', () =>
    expect(canManageProject(member, project)).toBe(false));
});

describe('canManageMembers', () => {
  it('allows the owner', () => expect(canManageMembers(owner, project)).toBe(true));
  it('denies a plain member', () => expect(canManageMembers(member, project)).toBe(false));
});

describe('canCreateOrEditTask', () => {
  it('allows the owner', () => expect(canCreateOrEditTask(owner, project, false)).toBe(true));
  it('allows a member', () => expect(canCreateOrEditTask(member, project, true)).toBe(true));
  it('denies a non-member', () =>
    expect(canCreateOrEditTask(stranger, project, false)).toBe(false));
});

describe('canDeleteTask', () => {
  it('allows the owner', () => expect(canDeleteTask(owner, project)).toBe(true));
  it('allows an admin', () => expect(canDeleteTask(admin, project)).toBe(true));
  it('denies a plain member', () => expect(canDeleteTask(member, project)).toBe(false));
});
