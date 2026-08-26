/**
 * QA (Query Atom) — 권한 조회. 읽기 전용이며 쓰기를 하지 않는다.
 */
import { supabase } from '../../lib/supabase';
import type { RoleCode, RoleGrant, RoleScopeType } from './DA_auth';

/** user_roles 테이블 행. 컬럼 추가 시 여기만 수정한다. */
interface UserRoleRow {
  id: string;
  user_id: string;
  role_code: RoleCode;
  scope_type: RoleScopeType;
  scope_id: string | null;
  granted_by: string | null;
  granted_at: string;
  revoked_at: string | null;
  memo: string | null;
}

const toGrant = (r: UserRoleRow): RoleGrant => ({
  id: r.id,
  userId: r.user_id,
  roleCode: r.role_code,
  scopeType: r.scope_type,
  scopeId: r.scope_id,
  grantedBy: r.granted_by,
  grantedAt: r.granted_at,
  revokedAt: r.revoked_at,
  memo: r.memo,
});

/**
 * 특정 계정의 활성 권한을 조회한다.
 * 조회 실패 시 빈 배열을 반환한다. 호출부는 빈 배열을 '권한 없음'으로 해석하되,
 * 레거시 계정은 RA_AUTH_GRANTS_FROM_LEGACY_ROLE 로 보완한다.
 */
export const QA_AUTH_FETCH_USER_ROLES = async (userId: string): Promise<RoleGrant[]> => {
  if (!userId) return [];
  try {
    const { data, error } = await supabase
      .from('user_roles')
      .select('*')
      .eq('user_id', userId)
      .is('revoked_at', null);
    if (error || !data) return [];
    return (data as UserRoleRow[]).map(toGrant);
  } catch (err) {
    console.warn('[DB] user_roles 조회 실패:', err);
    return [];
  }
};

/**
 * 전체 계정의 활성 권한을 조회한다. 관리자 화면의 회원 목록 표시에 사용한다.
 * 반환값은 userId 를 키로 하는 맵이다.
 */
export const QA_AUTH_FETCH_ALL_ROLES = async (): Promise<Record<string, RoleGrant[]>> => {
  try {
    const { data, error } = await supabase
      .from('user_roles')
      .select('*')
      .is('revoked_at', null);
    if (error || !data) return {};
    return (data as UserRoleRow[]).reduce<Record<string, RoleGrant[]>>((acc, row) => {
      const grant = toGrant(row);
      (acc[grant.userId] ??= []).push(grant);
      return acc;
    }, {});
  } catch (err) {
    console.warn('[DB] user_roles 전체 조회 실패:', err);
    return {};
  }
};
