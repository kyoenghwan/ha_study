import { supabase } from '../../lib/supabase';

export type TelegramResult = { success: boolean; error?: string; skipped?: boolean };

export const OA_NOTIFICATION_SEND_TELEGRAM = async (
  body: Record<string, unknown>,
): Promise<TelegramResult> => {
  const { data, error } = await supabase.functions.invoke<{ success?: boolean; error?: string }>(
    'telegram-notification',
    { body },
  );
  if (error) return { success: false, error: error.message };
  return { success: data?.success === true, error: data?.error };
};
