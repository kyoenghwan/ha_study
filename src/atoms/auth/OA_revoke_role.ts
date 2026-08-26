/**
 * OA (Operation Atom) — 권한 회수 쓰기.
 *
 * 회수는 삭제가 아니라 revoked_at 설정이다 (이력 보존).
 * 권한 검증은 하지 않는다. 호출 전에 FA 가 RA 로 검증해야 한다.
 */
import { supabase } from '../../lib/supabase';
import type { RoleRollbackData } from './DA_auth';

export interface RevokeRoleOperationInput {
  grantId: string;
}

export interface RevokeRoleOperationResult {
  ok: boolean;
  error?: string;
  rollbackData: RoleRollbackData;
}

export const OA_AUTH_REVOKE_ROLE = async (
  input: RevokeRoleOperationInput,
): Promise<RevokeRoleOperationResult> => {
  try {
    // 롤백을 위해 이전 값을 먼저 읽어 둔다.
    const { data: before } = await supabase
      .from('user_roles')
      .select('revoked_at')
      .eq('id', input.grantId)
      .maybeSingle();

    const previousRevokedAt = (before as { revoked_at: string | null } | null)?.revoked_at ?? null;

    const { error } = await supabase
      .from('user_roles')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', input.grantId);

    if (error) {
      console.error('[DB] 권한 회수 실패:', error);
      return { ok: false, error: error.message, rollbackData: {} };
    }

    return { ok: true, rollbackData: { grantId: input.grantId, previousRevokedAt } };
  } catch (err) {
    console.error('[DB] 권한 회수 예외:', err);
    return { ok: false, error: String(err), rollbackData: {} };
  }
};

/** 권한 회수를 되돌린다 (Saga 역순 롤백용). */
export const OA_AUTH_ROLLBACK_REVOKE_ROLE = async (
  rollbackData: RoleRollbackData,
): Promise<void> => {
  if (!rollbackData.grantId) return;
  try {
    await supabase
      .from('user_roles')
      .update({ revoked_at: rollbackData.previousRevokedAt ?? null })
      .eq('id', rollbackData.grantId);
  } catch (err) {
    console.error('[DB] 권한 회수 롤백 실패:', err);
  }
};
