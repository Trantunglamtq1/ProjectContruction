import type { UserDto } from '../types/auth';
import type { ProjectMemberDto } from './projectApi';

export function eligibleProjectUsers(users: UserDto[], members: ProjectMemberDto[]) {
  const assignedIds = new Set(members.map(member => member.userId));
  return users.filter(user => user.isActive && ['Submitter', 'Reviewer', 'Approver'].includes(user.roleName ?? '') && !assignedIds.has(user.id));
}

export async function assignProjectMembers(
  projectId: string,
  userIds: string[],
  assign: (projectId: string, userId: string) => Promise<ProjectMemberDto>,
) {
  const ids = [...new Set(userIds)];
  const results = await Promise.allSettled(ids.map(async id => assign(projectId, id)));
  const succeeded: ProjectMemberDto[] = [];
  const failedIds: string[] = [];
  results.forEach((result, index) => {
    if (result.status === 'fulfilled') succeeded.push(result.value);
    else failedIds.push(ids[index]);
  });
  return { succeeded, failedIds };
}
