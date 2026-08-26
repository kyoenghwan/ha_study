/**
 * FA (Flow Atom) — 권한 부여·회수 비즈니스 플로우.
 *
 * 규칙:
 * - 가장 먼저 권한 검증 RA 를 호출한다.
 * - 전역 상태(Zustand 등)를 변경하지 않는다. 결과만 반환하고 상태 갱신은 UI 가 한다.
 * - 현재는 OA 가 각 플로우에 1개뿐이므로 역순 롤백 체인이 필요하지 않다.
 *   이벤트 로그 OA 가 추가되면 Saga 롤백을 붙여야 한다 (롤백 원자는 이미 준비됨).
 */
import type {
  GrantRoleInput,
  GrantRoleResult,
  RevokeRoleInput,
  RevokeRoleResult,
} from './DA_auth';
import { ROLE_LABEL } from './CA_auth';
import {
  RA_AUTH_CAN_GRANT_ROLE,
  RA_AUTH_IS_VALID_SCOPE,
} from './RA_auth';
import { OA_AUTH_GRANT_ROLE } from './OA_grant_role';
import { OA_AUTH_REVOKE_ROLE } from './OA_revoke_role';

export const FA_AUTH_GRANT_ROLE = async (
  input: GrantRoleInput,
): Promise<GrantRoleResult> => {
  const { authContext, targetUserId, roleCode, scopeType, scopeId, memo } = input;

  if (!RA_AUTH_CAN_GRANT_ROLE(authContext, roleCode, scopeType, scopeId)) {
    return {
      success: false,
      errorCode: 'PERMISSION_DENIED',
      message: `${ROLE_LABEL[roleCode] ?? roleCode} 권한을 부여할 수 있는 권한이 없습니다.`,
    };
  }

  if (!targetUserId) {
    return { success: false, errorCode: 'INVALID_TARGET', message: '대상 계정이 지정되지 않았습니다.' };
  }

  if (targetUserId === authContext.userId) {
    return {
      success: false,
      errorCode: 'INVALID_TARGET',
      message: '자신에게 권한을 부여할 수 없습니다.',
    };
  }

  if (!RA_AUTH_IS_VALID_SCOPE(roleCode, scopeType, scopeId)) {
    return {
      success: false,
      errorCode: 'INVALID_SCOPE',
      message: `${ROLE_LABEL[roleCode] ?? roleCode} 권한에 맞지 않는 적용 범위입니다.`,
    };
  }

  const result = await OA_AUTH_GRANT_ROLE({
    targetUserId,
    roleCode,
    scopeType,
    scopeId,
    grantedBy: authContext.userId,
    memo,
  });

  if (!result.ok || !result.grantId) {
    return {
      success: false,
      errorCode: 'DB_ERROR',
      message: result.error ?? '권한을 저장하지 못했습니다.',
    };
  }

  return { success: true, data: { grantId: result.grantId } };
};

export const FA_AUTH_REVOKE_ROLE = async (
  input: RevokeRoleInput,
): Promise<RevokeRoleResult> => {
  const { authContext, grantId, targetUserId, roleCode, scopeType, scopeId } = input;

  if (!RA_AUTH_CAN_GRANT_ROLE(authContext, roleCode, scopeType, scopeId)) {
    return {
      success: false,
      errorCode: 'PERMISSION_DENIED',
      message: `${ROLE_LABEL[roleCode] ?? roleCode} 권한을 회수할 수 있는 권한이 없습니다.`,
    };
  }

  // 자기 권한을 스스로 회수하면 관리자가 0명이 되어 복구가 불가능해질 수 있다.
  if (targetUserId === authContext.userId) {
    return {
      success: false,
      errorCode: 'SELF_REVOKE_FORBIDDEN',
      message: '자신의 권한은 스스로 회수할 수 없습니다. 다른 상위 관리자에게 요청하세요.',
    };
  }

  if (!grantId) {
    return { success: false, errorCode: 'INVALID_TARGET', message: '회수할 권한이 지정되지 않았습니다.' };
  }

  const result = await OA_AUTH_REVOKE_ROLE({ grantId });
  if (!result.ok) {
    return {
      success: false,
      errorCode: 'DB_ERROR',
      message: result.error ?? '권한을 회수하지 못했습니다.',
    };
  }

  return { success: true };
};
