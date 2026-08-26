/**
 * OA (Operation Atom) — 권한 부여 쓰기.
 *
 * 권한 검증은 하지 않는다. 호출 전에 FA 가 RA 로 검증해야 한다.
 * 실패 복구를 위해 rollbackData 를 반환한다.
 */
import { supabase } from '../../lib/supabase';
import type { RoleCode, RoleRollbackData, RoleScopeType } from './DA_auth';

export interface GrantRoleOperationInput {
  targetUserId: string;
  roleCode: RoleCode;
  scopeType: RoleScopeType;
  scopeId?: string | null;
  grantedBy: string;
  memo?: string;
}

export interface GrantRoleOperationResult {
  ok: boolean;
  error?: string;
  grantId?: string;
  rollbackData: RoleRollbackData;
}

export const OA_AUTH_GRANT_ROLE = async (
  input: GrantRoleOperationInput,
): Promise<GrantRoleOperationResult> => {
  try {
    const { data, error } = await supabase
      .from('user_roles')
      .insert({
        user_id: input.targetUserId,
        role_code: input.roleCode,
        scope_type: input.scopeType,
        scope_id: input.scopeType === 'platform' ? null : (input.scopeId ?? null),
        granted_by: input.grantedBy,
        memo: input.memo ?? null,
      })
      .select('id')
      .single();

    if (error || !data) {
      console.error('[DB] 권한 부여 실패:', error);
      return {
        ok: false,
        error: error?.message ?? '권한 부여에 실패했습니다.',
        rollbackData: {},
      };
    }

    const grantId = (data as { id: string }).id;
    return { ok: true, grantId, rollbackData: { grantId } };
  } catch (err) {
    console.error('[DB] 권한 부여 예외:', err);
    return { ok: false, error: String(err), rollbackData: {} };
  }
};

/**
 * 권한 부여를 되돌린다 (Saga 역순 롤백용).
 * 부여 직후의 취소이므로 이력을 남기지 않고 행을 삭제한다.
 */
export const OA_AUTH_ROLLBACK_GRANT_ROLE = async (
  rollbackData: RoleRollbackData,
): Promise<void> => {
  if (!rollbackData.grantId) return;
  try {
    await supabase.from('user_roles').delete().eq('id', rollbackData.grantId);
  } catch (err) {
    console.error('[DB] 권한 부여 롤백 실패:', err);
  }
};
