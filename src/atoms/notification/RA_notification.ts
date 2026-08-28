import type { UserAccount } from '../../types';

export const RA_NOTIFICATION_CAN_RECEIVE_BRANCH = (
  user: UserAccount | null,
  activeRole: 'admin' | 'user' | null,
  branchId: string,
): boolean => {
  if (!user || activeRole !== 'admin' || !branchId) return false;
  if (user.isSuperAdmin || user.adminRoleCode === 'PLATFORM_ADMIN') return true;
  return user.role === 'admin' && Boolean(user.branchIds?.includes(branchId));
};
