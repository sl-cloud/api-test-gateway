import { describe, it, expect } from 'vitest';
import { isValidTransition } from '../../src/modules/tasks/transitions.js';

describe('isValidTransition', () => {
  it('allows todo -> in_progress', () =>
    expect(isValidTransition('todo', 'in_progress')).toBe(true));
  it('allows in_progress -> done', () =>
    expect(isValidTransition('in_progress', 'done')).toBe(true));
  it('allows done -> in_progress (reopen)', () =>
    expect(isValidTransition('done', 'in_progress')).toBe(true));
  it('allows a no-op same-status update', () =>
    expect(isValidTransition('todo', 'todo')).toBe(true));
  it('rejects todo -> done directly', () => expect(isValidTransition('todo', 'done')).toBe(false));
  it('rejects in_progress -> todo', () =>
    expect(isValidTransition('in_progress', 'todo')).toBe(false));
  it('rejects done -> todo', () => expect(isValidTransition('done', 'todo')).toBe(false));
});
