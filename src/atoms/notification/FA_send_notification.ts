import type { NotificationSettings } from '../../lib/notificationService';
import { OA_NOTIFICATION_SEND_TELEGRAM, type TelegramResult } from './OA_send_telegram';

export const FA_NOTIFICATION_SEND_CHARGE_REQUEST = async (
  settings: NotificationSettings,
  transactionId: string,
): Promise<TelegramResult> => {
  if (!settings.telegramEnabled || !settings.notifyOnChargeRequest) {
    return { success: true, skipped: true };
  }
  if (!transactionId) return { success: false, error: '충전 신청 ID가 없습니다.' };
  return OA_NOTIFICATION_SEND_TELEGRAM({ type: 'charge_request', transactionId });
};

export const FA_NOTIFICATION_SEND_TRANSFER_REQUEST = async (
  settings: NotificationSettings,
  payload: Record<string, unknown>,
): Promise<TelegramResult> => {
  if (!settings.telegramEnabled || !settings.notifyOnTransferRequest) {
    return { success: true, skipped: true };
  }
  return OA_NOTIFICATION_SEND_TELEGRAM({ type: 'transfer_request', ...payload });
};
