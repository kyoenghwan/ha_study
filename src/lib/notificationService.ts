import { fetchDbNotificationSettings, fetchDbUsers } from './supabase';
import { writeNotificationDebugLog } from './notificationDebug';

export interface NotificationSettings {
  soundEnabled: boolean;
  telegramEnabled: boolean;
  telegramBotToken: string;
  telegramChatId: string;
  notifyOnChargeRequest: boolean;
  notifyOnTransferRequest: boolean;
}

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

/**
 * 프론트엔드에서 직접 Telegram Bot API를 호출하여 메시지를 발송합니다.
 */
export const sendTelegramMessage = async (
  botToken: string,
  chatId: string,
  text: string,
): Promise<{ success: boolean; error?: string }> => {
  let token = botToken?.trim() || '';
  const targetChatId = chatId?.trim() || '';

  // 토큰이 전달되지 않은 경우 DB 설정에서 최신 토큰 조회
  if (!token) {
    try {
      const dbSettings = await fetchDbNotificationSettings();
      if (dbSettings?.telegramBotToken) {
        token = dbSettings.telegramBotToken.trim();
      }
    } catch { /* ignore */ }
  }

  if (!token || !targetChatId) {
    console.warn('[Telegram] 발송 취소: 봇 토큰이나 Chat ID가 없습니다.');
    return { success: false, error: '봇 토큰이나 Chat ID가 입력되지 않았습니다.' };
  }

  try {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: targetChatId, text, parse_mode: 'HTML' }),
    });
    const data = await res.json();
    if (data.ok) {
      return { success: true };
    } else {
      return { success: false, error: data.description || '텔레그램 발송 실패' };
    }
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return { success: false, error: '네트워크 연결 오류: ' + errorMessage };
  }
};

/**
 * DB에서 최신 봇 토큰과 글로벌 chatId를 가져오는 헬퍼
 */
const getLatestTelegramSettings = async (settings: NotificationSettings): Promise<{ token: string; chatId: string }> => {
  let token = settings.telegramBotToken || '';
  let chatId = settings.telegramChatId || '';

  // DB에서 최신 설정 직접 조회 (가장 신뢰할 수 있는 소스)
  try {
    const dbSettings = await fetchDbNotificationSettings();
    if (dbSettings) {
      if (!token) token = dbSettings.telegramBotToken || '';
      if (!chatId) chatId = dbSettings.telegramChatId || '';
    }
  } catch (e) {
    console.warn('[Telegram] DB 알림 설정 조회 실패:', e);
  }

  // localStorage 최종 fallback
  if (!chatId || !token) {
    try {
      const saved = localStorage.getItem('lheureux_notification_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (!chatId) chatId = parsed.telegramChatId || '';
        if (!token) token = parsed.telegramBotToken || '';
      }
    } catch { /* ignore */ }
  }

  return { token, chatId };
};

/**
 * 충전 신청 알림 트리거
 */
export const triggerChargeRequestNotification = async (
  settings: NotificationSettings,
  info: {
    transactionId?: string;
    userName: string;
    userId: string;
    userPhone: string;
    amount: number;
    branchName?: string;
    branchId?: string;
  },
): Promise<{ success: boolean; error?: string; skipped?: boolean }> => {
  const traceId = info.transactionId || `charge-${Date.now()}`;

  if (!settings.telegramEnabled || !settings.notifyOnChargeRequest) {
    writeNotificationDebugLog(traceId, 'NOTIFICATION_SKIPPED', 'warn', {
      telegramEnabled: settings.telegramEnabled,
      notifyOnChargeRequest: settings.notifyOnChargeRequest,
    });
    return { success: true, skipped: true };
  }

  // 1. 소리 알림
  if (settings.soundEnabled) {
    playNotificationSound();
  }

  // 2. 브라우저 푸시 알림
  sendBrowserNotification(
    '🔔 [르하임] 포인트 충전 신청 접수!',
    `${info.userName} (${info.userId}) 님이 ${info.amount.toLocaleString()}P 충전을 신청했습니다.`
  );

  // 3. 텔레그램 알림
  let { token: tokenToUse, chatId: chatIdToUse } = await getLatestTelegramSettings(settings);

  writeNotificationDebugLog(traceId, 'TELEGRAM_SETTINGS_LOADED', 'info', {
    hasToken: !!tokenToUse,
    hasGlobalChatId: !!chatIdToUse,
    branchId: info.branchId,
  });

  // 🌟 계정별 텔레그램 알림 라우팅:
  // 1순위: 해당 지점 담당 관리자 중 telegramChatId가 있는 관리자
  // 2순위: 최고 관리자 계정 중 telegramChatId가 있는 관리자
  try {
    const users = await fetchDbUsers();
    if (info.branchId) {
      const branchAdmins = users.filter(u => u.role === 'admin' && u.branchIds?.includes(info.branchId!));
      const adminWithChatId = branchAdmins.find(u => u.telegramChatId?.trim());
      if (adminWithChatId && adminWithChatId.telegramChatId) {
        chatIdToUse = adminWithChatId.telegramChatId.trim();
        writeNotificationDebugLog(traceId, 'BRANCH_ADMIN_FOUND', 'success', {
          adminUserId: adminWithChatId.userId,
          chatId: chatIdToUse,
        });
      }
    }
    
    // 지점 관리자의 Chat ID가 없으면 최고 관리자 계정의 Chat ID로 폴백
    if (!chatIdToUse) {
      const superAdmin = users.find(u => 
        (u.userId === 'admin' || u.userId === 'kyoenghwan' || u.isSuperAdmin || u.adminRoleCode === 'PLATFORM_ADMIN') && 
        Boolean(u.telegramChatId?.trim())
      );
      if (superAdmin && superAdmin.telegramChatId) {
        chatIdToUse = superAdmin.telegramChatId.trim();
        writeNotificationDebugLog(traceId, 'SUPER_ADMIN_FALLBACK_FOUND', 'info', {
          superAdminId: superAdmin.userId,
          chatId: chatIdToUse,
        });
      }
    }
  } catch (e) {
    console.warn('[Telegram] 관리자 조회 실패:', e);
  }

  if (!chatIdToUse) {
    writeNotificationDebugLog(traceId, 'TELEGRAM_NO_RECIPIENT', 'error', {
      message: 'chatId가 설정되지 않아 텔레그램 알림을 보내지 못했습니다.',
    });
    return { success: false, error: 'chatId가 설정되지 않아 텔레그램 알림을 보내지 못했습니다.' };
  }

  if (!tokenToUse) {
    writeNotificationDebugLog(traceId, 'TELEGRAM_NO_TOKEN', 'error', {
      message: '봇 토큰이 없습니다.',
    });
    return { success: false, error: '봇 토큰이 설정되지 않았습니다.' };
  }

  const branchText = info.branchName ? `\n🏢 <b>지점</b>: ${info.branchName}` : '';
  const message = `🔔 <b>[르하임 스터디카페] 포인트 충전 신청</b>${branchText}\n\n` +
    `👤 <b>회원명</b>: ${info.userName} (${info.userId})\n` +
    `📞 <b>연락처</b>: ${info.userPhone}\n` +
    `💰 <b>신청 금액</b>: <b>${info.amount.toLocaleString()} P</b>\n` +
    `⏰ <b>신청 일시</b>: ${new Date().toLocaleString('ko-KR')}\n\n` +
    `👉 <i>관리자 콘솔에서 입금 확인 후 승인해 주세요!</i>`;

  const res = await sendTelegramMessage(tokenToUse, chatIdToUse, message);
  writeNotificationDebugLog(traceId, res.success ? 'TELEGRAM_SEND_SUCCESS' : 'TELEGRAM_SEND_FAILED', res.success ? 'success' : 'error', {
    chatId: chatIdToUse,
    error: res.error,
  });
  return res;
};

/**
 * 지점 간 이전 신청 알림 트리거
 */
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
): Promise<{ success: boolean; error?: string; skipped?: boolean }> => {
  if (!settings.telegramEnabled || !settings.notifyOnTransferRequest) {
    return { success: true, skipped: true };
  }

  // 1. 소리 알림
  if (settings.soundEnabled) {
    playNotificationSound();
  }

  // 2. 브라우저 푸시 알림
  sendBrowserNotification(
    '🔄 [르하임] 지점 간 포인트 이전 신청 접수!',
    `${info.userName} (${info.fromBranchName} ➔ ${info.toBranchName}, ${info.amount.toLocaleString()}P)`
  );

  // 3. 텔레그램 알림
  let { token: tokenToUse, chatId: chatIdToUse } = await getLatestTelegramSettings(settings);

  if (info.toBranchId) {
    try {
      const users = await fetchDbUsers();
      const branchAdmins = users.filter(u => u.role === 'admin' && u.branchIds?.includes(info.toBranchId!));
      const adminWithChatId = branchAdmins.find(u => u.telegramChatId);
      if (adminWithChatId && adminWithChatId.telegramChatId) {
        chatIdToUse = adminWithChatId.telegramChatId;
      }
    } catch (e) {
      console.warn('[Telegram] 지점 관리자 조회 실패:', e);
    }
  }

  if (!chatIdToUse || !tokenToUse) {
    console.warn('[Telegram] chatId 또는 봇 토큰이 없어 텔레그램 알림을 보내지 못했습니다.');
    return { success: false, error: 'chatId 또는 봇 토큰이 없습니다.' };
  }

  const message = `🔄 <b>[르하임 스터디카페] 지점 간 포인트 이전 신청</b>\n\n` +
    `👤 <b>회원명</b>: ${info.userName} (${info.userId})\n` +
    `🏢 <b>이전 경로</b>: ${info.fromBranchName} ➔ <b>${info.toBranchName}</b>\n` +
    `💰 <b>이전 금액</b>: <b>${info.amount.toLocaleString()} P</b>\n` +
    `📝 <b>이전 사유</b>: ${info.reason || '사유 없음'}\n` +
    `⏰ <b>신청 일시</b>: ${new Date().toLocaleString('ko-KR')}\n\n` +
    `👉 <i>관리자 콘솔에서 확인 후 승인해 주세요!</i>`;

  return sendTelegramMessage(tokenToUse, chatIdToUse, message);
};
