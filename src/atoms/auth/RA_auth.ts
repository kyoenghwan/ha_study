/**
 * RA (Rule Atom) — 권한 판정 순수 함수.
 *
 * 외부 의존성(DB, fetch, window, localStorage)을 절대 포함하지 않는다.
 * 화면 분기와 서버측 검증이 같은 규칙을 쓰도록 여기에만 규칙을 둔다.
 */
import type { AuthContext, RoleCode, RoleGrant, RoleScopeType } from './DA_auth';
import { ADMIN_CONSOLE_MIN_RANK, LEGACY_ROLE_MAP, ROLE_RANK, ROLE_SCOPE_LEVEL } from './CA_auth';

/** 회수되지 않은 권한만 남긴다. */
export const RA_AUTH_ACTIVE_GRANTS = (grants: RoleGrant[]): RoleGrant[] =>
  grants.filter((g) => g.revokedAt === null);

/** 보유한 권한 중 가장 높은 등급. 권한이 없으면 0. */
export const RA_AUTH_MAX_RANK = (grants: RoleGrant[]): number =>
  RA_AUTH_ACTIVE_GRANTS(grants).reduce(
    (max, g) => Math.max(max, ROLE_RANK[g.roleCode] ?? 0),
    0,
  );

/**
 * 특정 권한 보유 여부.
 * scopeId 를 지정하면 해당 범위의 권한만 인정한다.
 * platform 범위 권한은 하위 범위를 모두 포함하므로 항상 통과시킨다.
 */
export const RA_AUTH_HAS_ROLE = (
  grants: RoleGrant[],
  roleCode: RoleCode,
  scopeId?: string | null,
): boolean =>
  RA_AUTH_ACTIVE_GRANTS(grants).some((g) => {
    if (g.roleCode !== roleCode) return false;
    if (scopeId === undefined) return true;
    if (g.scopeType === 'platform') return true;
    return g.scopeId === scopeId;
  });

/** 관리 콘솔(관리자 대시보드)에 접근할 수 있는지. */
export const RA_AUTH_CAN_ACCESS_ADMIN_CONSOLE = (grants: RoleGrant[]): boolean =>
  RA_AUTH_MAX_RANK(grants) >= ADMIN_CONSOLE_MIN_RANK;

/** 플랫폼 전체 관리자인지. */
export const RA_AUTH_IS_PLATFORM_ADMIN = (grants: RoleGrant[]): boolean =>
  RA_AUTH_HAS_ROLE(grants, 'PLATFORM_ADMIN');

/**
 * 특정 지점을 관리할 수 있는지.
 * platform 권한은 모든 지점, brand 권한은 해당 브랜드 하위 지점(향후 brands 테이블 도입 시
 * 브랜드-지점 매핑을 인자로 받아 판정), branch 권한은 자기 지점만 관리한다.
 */
export const RA_AUTH_CAN_MANAGE_BRANCH = (
  grants: RoleGrant[],
  branchId: string,
): boolean =>
  RA_AUTH_ACTIVE_GRANTS(grants).some((g) => {
    if ((ROLE_RANK[g.roleCode] ?? 0) < ADMIN_CONSOLE_MIN_RANK) return false;
    if (g.scopeType === 'platform') return true;
    // brand 범위는 brands/branches 테이블 도입 후 매핑 판정을 추가한다.
    // 그 전까지는 자기 자신과 일치하는 범위만 인정한다.
    return g.scopeId === branchId;
  });

/** 로그인한 사용자인지 (권한이 하나라도 있으면 인증된 것으로 본다). */
export const RA_AUTH_IS_AUTHENTICATED = (authContext: AuthContext): boolean =>
  Boolean(authContext.userId) && RA_AUTH_ACTIVE_GRANTS(authContext.grants).length > 0;

/**
 * 대상 권한을 부여/회수할 수 있는지.
 *
 * 원칙:
 * - 최상위(PLATFORM_ADMIN)는 동급까지 부여할 수 있다. 관리자를 추가로 임명하는 것이
 *   이 기능의 주된 용도이므로 동급 부여를 막으면 관리자를 늘릴 방법이 없어진다.
 * - 그 아래 등급은 자신보다 낮은 권한만 부여할 수 있다 (권한 상승 방지).
 * - 부여하려는 범위를 관리할 수 있어야 한다.
 * - platform 범위 권한은 PLATFORM_ADMIN 만 다룰 수 있다.
 */
export const RA_AUTH_CAN_GRANT_ROLE = (
  authContext: AuthContext,
  roleCode: RoleCode,
  scopeType: RoleScopeType,
  scopeId?: string | null,
): boolean => {
  const grants = RA_AUTH_ACTIVE_GRANTS(authContext.grants);
  if (!authContext.userId || grants.length === 0) return false;

  const actorRank = RA_AUTH_MAX_RANK(grants);
  const targetRank = ROLE_RANK[roleCode] ?? 0;
  if (targetRank === 0) return false;

  // 최상위 권한자만 동급 부여가 가능하다. 그 아래는 자신보다 낮은 권한만 부여한다.
  if (!RA_AUTH_IS_PLATFORM_ADMIN(grants) && targetRank >= actorRank) return false;

  if (scopeType === 'platform') {
    return RA_AUTH_IS_PLATFORM_ADMIN(grants);
  }
  if (!scopeId) return false;
  return RA_AUTH_CAN_MANAGE_BRANCH(grants, scopeId);
};

/**
 * 권한 코드와 범위의 조합이 유효한지.
 * 예: BRANCH_ADMIN 은 platform 범위를 가질 수 없다.
 */
export const RA_AUTH_IS_VALID_SCOPE = (
  roleCode: RoleCode,
  scopeType: RoleScopeType,
  scopeId?: string | null,
): boolean => {
  if (ROLE_SCOPE_LEVEL[roleCode] !== scopeType) return false;
  if (scopeType === 'platform') return !scopeId;
  return Boolean(scopeId);
};

/**
 * user_roles 에 행이 없는 레거시 계정을 위한 fallback.
 * users.role 값을 활성 권한 한 건으로 해석한다.
 * user_roles 이관이 끝나면 제거한다.
 */
export const RA_AUTH_GRANTS_FROM_LEGACY_ROLE = (
  userId: string,
  legacyRole: string,
): RoleGrant[] => {
  const roleCode = LEGACY_ROLE_MAP[legacyRole];
  if (!roleCode) return [];
  return [
    {
      id: `legacy-${userId}`,
      userId,
      roleCode,
      scopeType: 'platform',
      scopeId: null,
      grantedBy: null,
      grantedAt: '',
      revokedAt: null,
      memo: 'users.role fallback (user_roles 미이관 계정)',
    },
  ];
};
