import { supabase } from '../../lib/supabase';
import { writeNotificationDebugLog } from '../../lib/notificationDebug';

export type TelegramResult = { success: boolean; error?: string; skipped?: boolean };

export const OA_NOTIFICATION_SEND_TELEGRAM = async (
  body: Record<string, unknown>,
): Promise<TelegramResult> => {
  const traceId = String(body.transactionId || body.requestId || `test-${Date.now()}`);
  writeNotificationDebugLog(traceId, 'EDGE_INVOKE_START', 'info', {
    functionName: 'telegram-notification',
    type: body.type,
  });

  const { data, error } = await supabase.functions.invoke<{ success?: boolean; error?: string }>(
    'telegram-notification',
    { body },
  );
  if (error) {
    let responseStatus: number | undefined;
    let responseBody: unknown;
    const context = (error as { context?: unknown }).context;
    if (context instanceof Response) {
      responseStatus = context.status;
      try {
        responseBody = await context.clone().json();
      } catch {
        responseBody = await context.clone().text().catch(() => undefined);
      }
    }
    const errorMessage = typeof responseBody === 'object' && responseBody !== null && 'error' in responseBody
      ? String((responseBody as { error: unknown }).error)
      : error.message;
    writeNotificationDebugLog(traceId, 'EDGE_INVOKE_ERROR', 'error', {
      message: error.message,
      responseStatus,
      responseBody,
    });
    return { success: false, error: errorMessage };
  }

  const success = data?.success === true;
  writeNotificationDebugLog(traceId, 'EDGE_INVOKE_RESULT', success ? 'success' : 'error', {
    success,
    serverError: data?.error,
  });
  return { success, error: data?.error };
};
