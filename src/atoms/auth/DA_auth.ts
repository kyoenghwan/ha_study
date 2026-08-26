/**
 * DA (Data Atom) — 권한 도메인의 타입 정의.
 * 실행 로직을 포함하지 않는다.
 *
 * 스키마 근거: docs/db/schema.md 1.3.0 §8 role_definitions, §9 user_roles
 */

/** 권한 코드. role_definitions.code 와 1:1로 대응한다. */
export type RoleCode =
  | 'PLATFORM_ADMIN'
  | 'BRAND_ADMIN'
  | 'BRANCH_OWNER'
  | 'BRANCH_ADMIN'
  | 'STAFF'
  | 'CUSTOMER';

/** 권한이 적용되는 범위. platform 범위는 scopeId 를 갖지 않는다. */
export type RoleScopeType = 'platform' | 'brand' | 'branch';

/** user_roles 한 행에 대응하는 활성 권한 부여 내역. */
export interface RoleGrant {
  id: string;
  userId: string;
  roleCode: RoleCode;
  scopeType: RoleScopeType;
  /** platform 범위이면 null. brand/branch 범위이면 해당 대상의 id. */
  scopeId: string | null;
  grantedBy: string | null;
  grantedAt: string;
  /** null 이면 활성 권한. 값이 있으면 회수된 권한. */
  revokedAt: string | null;
  memo: string | null;
}

/**
 * 요청자의 권한 컨텍스트.
 * 모든 FA/QA/OA 의 input 에 포함되어야 한다.
 */
export interface AuthContext {
  userId: string;
  /** 활성 권한 목록. 비어 있으면 미인증으로 취급한다. */
  grants: RoleGrant[];
}

/** 권한 부여 요청 입력. */
export interface GrantRoleInput {
  authContext: AuthContext;
  targetUserId: string;
  roleCode: RoleCode;
  scopeType: RoleScopeType;
  scopeId?: string | null;
  memo?: string;
}

/** 권한 회수 요청 입력. */
export interface RevokeRoleInput {
  authContext: AuthContext;
  /** 회수 대상 user_roles.id */
  grantId: string;
  /** 대상 계정. 권한 검증에 사용한다. */
  targetUserId: string;
  roleCode: RoleCode;
  scopeType: RoleScopeType;
  scopeId?: string | null;
}

export type AuthErrorCode =
  | 'PERMISSION_DENIED'
  | 'INVALID_TARGET'
  | 'INVALID_ROLE'
  | 'INVALID_SCOPE'
  | 'SELF_REVOKE_FORBIDDEN'
  | 'DB_ERROR';

export interface GrantRoleResult {
  success: boolean;
  data?: { grantId: string };
  errorCode?: AuthErrorCode;
  message?: string;
}

export interface RevokeRoleResult {
  success: boolean;
  errorCode?: AuthErrorCode;
  message?: string;
}

/**
 * OA 가 실패 복구를 위해 반환하는 데이터.
 * 다중 OA 트랜잭션에서 역순 롤백에 사용한다.
 */
export interface RoleRollbackData {
  /** 부여를 되돌릴 때 필요한 행 id */
  grantId?: string;
  /** 회수를 되돌릴 때 복원할 이전 revoked_at 값 */
  previousRevokedAt?: string | null;
}
