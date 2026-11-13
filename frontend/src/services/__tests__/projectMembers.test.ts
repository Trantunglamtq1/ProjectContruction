import { describe, expect, it, vi } from 'vitest';
import type { UserDto } from '../../types/auth';
import type { ProjectMemberDto } from '../projectApi';
import { assignProjectMembers, eligibleProjectUsers } from '../projectMembers';

const user = (id: string, roleName: string | null = 'Submitter', isActive = true): UserDto => ({
  id, roleName, isActive, username: id, email: `${id}@example.test`, fullName: id, roleId: null, createdAt: '',
});
const member = (userId: string): ProjectMemberDto => ({ userId, username: userId, fullName: userId, email: '', roleName: 'Submitter', assignedAt: '' });

describe('eligible project members', () => {
  it('hides assigned members and only offers active business users', () => {
    const users = [user('existing'), user('new'), user('reviewer', 'Reviewer'), user('approver', 'Approver'),
      user('admin', 'Admin'), user('pending', null), user('inactive', 'Submitter', false)];
    expect(eligibleProjectUsers(users, [member('existing')]).map(u => u.id)).toEqual(['new', 'reviewer', 'approver']);
  });
  it('immediately removes all added users and offers revoked users again', () => {
    const users = [user('one'), user('two')];
    expect(eligibleProjectUsers(users, [member('one'), member('two')])).toEqual([]);
    expect(eligibleProjectUsers(users, [member('two')]).map(u => u.id)).toEqual(['one']);
  });
});

describe('assigning multiple project members', () => {
  it('assigns every distinct selection to the captured project', async () => {
    const assign = vi.fn(async (_project: string, id: string) => member(id));
    const result = await assignProjectMembers('project-a', ['one', 'two', 'one'], assign);
    expect(assign.mock.calls).toEqual([['project-a', 'one'], ['project-a', 'two']]);
    expect(result.succeeded.map(m => m.userId)).toEqual(['one', 'two']);
    expect(result.failedIds).toEqual([]);
  });
  it('keeps only failures for retry without discarding successful assignments', async () => {
    const assign = vi.fn(async (_project: string, id: string) => {
      if (id === 'two') throw new Error('Unavailable');
      return member(id);
    });
    const result = await assignProjectMembers('project-a', ['one', 'two', 'three'], assign);
    expect(result.succeeded.map(m => m.userId)).toEqual(['one', 'three']);
    expect(result.failedIds).toEqual(['two']);
  });
  it('handles synchronous request failures and empty selections', async () => {
    const assign = vi.fn(() => { throw new Error('Request rejected'); });
    expect(await assignProjectMembers('project-a', ['one'], assign)).toEqual({ succeeded: [], failedIds: ['one'] });
    assign.mockClear();
    expect(await assignProjectMembers('project-a', [], assign)).toEqual({ succeeded: [], failedIds: [] });
    expect(assign).not.toHaveBeenCalled();
  });
});
