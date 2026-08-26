/**
 * CA (Config Atom) — 권한 도메인의 상수.
 * 실행 로직을 포함하지 않는다.
 *
 * rank 값은 DB의 role_definitions.rank 와 일치해야 한다.
 * (docs/db/migrations/002_rbac.sql)
 */
import type { RoleCode, RoleScopeType } from './DA_auth';

/** 권한 등급. 클수록 상위 권한이다. */
export const ROLE_RANK: Record<RoleCode, number> = {
  PLATFORM_ADMIN: 100,
  BRAND_ADMIN: 80,
  BRANCH_OWNER: 60,
  BRANCH_ADMIN: 50,
  STAFF: 30,
  CUSTOMER: 10,
};

/** 화면 표시용 명칭. */
export const ROLE_LABEL: Record<RoleCode, string> = {
  PLATFORM_ADMIN: '플랫폼 관리자',
  BRAND_ADMIN: '브랜드 관리자',
  BRANCH_OWNER: '지점 오너',
  BRANCH_ADMIN: '지점 관리자',
  STAFF: '지점 직원',
  CUSTOMER: '일반 고객',
};

/** 각 권한이 가질 수 있는 범위. */
export const ROLE_SCOPE_LEVEL: Record<RoleCode, RoleScopeType> = {
  PLATFORM_ADMIN: 'platform',
  BRAND_ADMIN: 'brand',
  BRANCH_OWNER: 'branch',
  BRANCH_ADMIN: 'branch',
  STAFF: 'branch',
  CUSTOMER: 'platform',
};

/** 설계상 부여 가능한 전체 권한 목록 (표시 순서 = 상위 권한부터). */
export const ASSIGNABLE_ROLE_CODES: RoleCode[] = [
  'PLATFORM_ADMIN',
  'BRAND_ADMIN',
  'BRANCH_OWNER',
  'BRANCH_ADMIN',
  'STAFF',
];

/**
 * 현재 UI에서 실제로 부여할 수 있는 권한.
 *
 * brand/branch 범위 권한은 `user_roles.scope_id`(UUID)가 가리킬
 * `brands`/`branches` 테이블이 아직 없어 저장이 불가능하다.
 * 지점 테이블을 도입하면 ASSIGNABLE_ROLE_CODES 전체로 확장한다.
 */
export const CURRENTLY_ASSIGNABLE_ROLE_CODES: RoleCode[] = ['PLATFORM_ADMIN'];

/**
 * 관리 콘솔 접근에 필요한 최소 등급.
 * BRANCH_ADMIN 이상이면 관리 화면에 들어갈 수 있다.
 */
export const ADMIN_CONSOLE_MIN_RANK = ROLE_RANK.BRANCH_ADMIN;

/** user_roles 에 행이 없는 레거시 계정을 해석하기 위한 fallback 매핑. */
export const LEGACY_ROLE_MAP: Record<string, RoleCode> = {
  admin: 'PLATFORM_ADMIN',
  user: 'CUSTOMER',
};
