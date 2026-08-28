import { OA_NOTIFICATION_SEND_TELEGRAM } from '../atoms/notification/OA_send_telegram';
import {
  FA_NOTIFICATION_SEND_CHARGE_REQUEST,
  FA_NOTIFICATION_SEND_TRANSFER_REQUEST,
} from '../atoms/notification/FA_send_notification';

export interface NotificationSettings {
  soundEnabled: boolean;
  telegramEnabled: boolean;
  /** @deprecated 봇 토큰은 서버 Secret에서만 관리합니다. */
  telegramBotToken: string;
  telegramChatId: string;
  notifyOnChargeRequest: boolean;
  notifyOnTransferRequest: boolean;
}

/** @deprecated 보안상 프론트엔드에는 봇 토큰을 두지 않습니다. */
export const OFFICIAL_TELEGRAM_BOT_TOKEN = '';

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  soundEnabled: true,
  telegramEnabled: true,
  telegramBotToken: '',
  telegramChatId: '',
  notifyOnChargeRequest: true,
  notifyOnTransferRequest: true,
};

export const playNotificationSound = () => {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;
    const tones = [
      { frequency: 783.99, start: 0, duration: 0.4, gain: 0.3 },
      { frequency: 659.25, start: 0.2, duration: 0.7, gain: 0.4 },
    ];
    tones.forEach((tone) => {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(tone.frequency, now + tone.start);
      gain.gain.setValueAtTime(0, now + tone.start);
      gain.gain.linearRampToValueAtTime(tone.gain, now + tone.start + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + tone.start + tone.duration);
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start(now + tone.start);
      oscillator.stop(now + tone.start + tone.duration);
    });
  } catch (error) {
    console.warn('[NotificationSound] 알림음 재생 실패:', error);
  }
};

export const requestNotificationPermission = async (): Promise<boolean> => {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  return (await Notification.requestPermission()) === 'granted';
};

export const sendBrowserNotification = (title: string, body: string) => {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, { body, icon: '/pwa-192x192.png' });
  }
};

/** 관리자 설정 화면의 Telegram 연결 시험용. 토큰 인자는 하위 호환만 유지하며 서버로 보내지 않습니다. */
export const sendTelegramMessage = async (
  _botToken: string,
  chatId: string,
  text: string,
): Promise<{ success: boolean; error?: string }> => {
  if (!chatId.trim()) return { success: false, error: 'Telegram Chat ID를 입력해 주세요.' };
  return OA_NOTIFICATION_SEND_TELEGRAM({ type: 'test', chatId: chatId.trim(), text });
};

export const triggerChargeRequestNotification = async (
  settings: NotificationSettings,
  info: {
    transactionId: string;
    userName: string;
    userId: string;
    userPhone: string;
    amount: number;
    branchName?: string;
    branchId?: string;
  },
) => {
  return FA_NOTIFICATION_SEND_CHARGE_REQUEST(settings, info.transactionId);
};

export const triggerTransferRequestNotification = async (
  settings: NotificationSettings,
  info: {
    requestId?: string;
    userName: string;
    userId: string;
    fromBranchName: string;
    toBranchName: string;
    toBranchId?: string;
    amount: number;
    reason?: string;
  },
) => {
  return FA_NOTIFICATION_SEND_TRANSFER_REQUEST(settings, info);
};
