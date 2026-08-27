/**
 * 🔔 르하임 스터디카페 실시간 알림 서비스
 * - 브라우저 Web Audio API 기반 딩동(Ding-Dong) 사운드 효과음
 * - 브라우저 시스템 푸시 알림 (Web Notification API)
 * - 텔레그램(Telegram) 봇 실시간 스마트폰 푸시 알림
 */

export interface NotificationSettings {
  soundEnabled: boolean;
  telegramEnabled: boolean;
  telegramBotToken: string;
  telegramChatId: string;
  notifyOnChargeRequest: boolean;
  notifyOnTransferRequest: boolean;
}

export const OFFICIAL_TELEGRAM_BOT_TOKEN = '8608083217:AAFsHtMNceMV9T__xq_y18_7EWbIAelzMAs';

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  soundEnabled: true,
  telegramEnabled: true,
  telegramBotToken: '8608083217:AAFsHtMNceMV9T__xq_y18_7EWbIAelzMAs',
  telegramChatId: '',
  notifyOnChargeRequest: true,
  notifyOnTransferRequest: true,
};

/**
 * 🔊 1. Web Audio API 기반 맑은 '딩동~ 🔔' 알림 효과음 재생
 * 외부 mp3 파일 다운로드 없이 브라우저 자체 오디오 신시사이저로 100% 즉시 재생
 */
export const playNotificationSound = () => {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    // 첫 번째 음: 높은 솔 (784Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(783.99, now);
    gain1.gain.setValueAtTime(0, now);
    gain1.gain.linearRampToValueAtTime(0.3, now + 0.05);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.4);

    // 두 번째 음: 미 (659.25Hz)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(659.25, now + 0.2);
    gain2.gain.setValueAtTime(0, now + 0.2);
    gain2.gain.linearRampToValueAtTime(0.4, now + 0.25);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.2);
    osc2.stop(now + 0.9);
  } catch (err) {
    console.warn('[NotificationSound] 사운드 재생 실패:', err);
  }
};

/**
 * 📱 2. 브라우저 시스템 알림 (Web Notification)
 */
export const requestNotificationPermission = async (): Promise<boolean> => {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission !== 'denied') {
    const perm = await Notification.requestPermission();
    return perm === 'granted';
  }
  return false;
};

export const sendBrowserNotification = (title: string, body: string) => {
  try {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, {
        body,
        icon: '/favicon.ico',
      });
    }
  } catch (err) {
    console.warn('[BrowserNotification] 브라우저 알림 실패:', err);
  }
};

/**
 * 📲 3. 텔레그램(Telegram) 봇 실시간 메시지 발송
 */
export const sendTelegramMessage = async (
  botToken: string,
  chatId: string,
  text: string
): Promise<{ success: boolean; error?: string }> => {
  const token = (botToken && botToken.trim()) ? botToken.trim() : OFFICIAL_TELEGRAM_BOT_TOKEN;
  const targetChatId = chatId ? chatId.trim() : '';

  if (!token || !targetChatId) {
    console.warn('[Telegram] 발송 취소: Chat ID가 설정되지 않았습니다.');
    return { success: false, error: '채팅 ID(Chat ID)가 입력되지 않았습니다.' };
  }

  try {
    const url = `https://api.telegram.org/bot${botToken.trim()}/sendMessage`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId.trim(),
        text,
        parse_mode: 'HTML',
      }),
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
 * 🔔 4. 통합 알림 트리거 헬퍼 (충전 신청용)
 */
export const triggerChargeRequestNotification = async (
  settings: NotificationSettings,
  info: {
    userName: string;
    userId: string;
    userPhone: string;
    amount: number;
    branchName?: string;
  }
) => {
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
  const tokenToUse = settings.telegramBotToken || OFFICIAL_TELEGRAM_BOT_TOKEN;
  // localStorage fallback
  let chatIdToUse = settings.telegramChatId;
  if (!chatIdToUse) {
    try {
      const saved = localStorage.getItem('lheureux_notification_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        chatIdToUse = parsed.telegramChatId;
      }
    } catch {}
  }

  if (chatIdToUse && (settings.telegramEnabled !== false)) {
    const branchText = info.branchName ? `\n🏢 <b>지점</b>: ${info.branchName}` : '';
    const message = `🔔 <b>[르하임 스터디카페] 포인트 충전 신청</b>${branchText}\n\n` +
      `👤 <b>회원명</b>: ${info.userName} (${info.userId})\n` +
      `📞 <b>연락처</b>: ${info.userPhone}\n` +
      `💰 <b>신청 금액</b>: <b>${info.amount.toLocaleString()} P</b>\n` +
      `⏰ <b>신청 일시</b>: ${new Date().toLocaleString('ko-KR')}\n\n` +
      `👉 <i>관리자 콘솔에서 입금 확인 후 승인해 주세요!</i>`;

    const res = await sendTelegramMessage(tokenToUse, chatIdToUse, message);
    console.log('[Telegram Notification Result]:', res);
  }
};

/**
 * 🔄 5. 통합 알림 트리거 헬퍼 (지점 간 이전 신청용)
 */
export const triggerTransferRequestNotification = async (
  settings: NotificationSettings,
  info: {
    userName: string;
    userId: string;
    fromBranchName: string;
    toBranchName: string;
    amount: number;
    reason?: string;
  }
) => {
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
  const tokenToUse = settings.telegramBotToken || OFFICIAL_TELEGRAM_BOT_TOKEN;
  let chatIdToUse = settings.telegramChatId;
  if (!chatIdToUse) {
    try {
      const saved = localStorage.getItem('lheureux_notification_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        chatIdToUse = parsed.telegramChatId;
      }
    } catch {}
  }

  if (chatIdToUse && (settings.telegramEnabled !== false)) {
    const message = `🔄 <b>[르하임 스터디카페] 지점 간 포인트 이전 신청</b>\n\n` +
      `👤 <b>회원명</b>: ${info.userName} (${info.userId})\n` +
      `🏢 <b>이전 경로</b>: ${info.fromBranchName} ➔ <b>${info.toBranchName}</b>\n` +
      `💰 <b>이전 금액</b>: <b>${info.amount.toLocaleString()} P</b>\n` +
      `📝 <b>이전 사유</b>: ${info.reason || '사유 없음'}\n` +
      `⏰ <b>신청 일시</b>: ${new Date().toLocaleString('ko-KR')}\n\n` +
      `👉 <i>관리자 콘솔에서 확인 후 승인해 주세요!</i>`;

    const res = await sendTelegramMessage(tokenToUse, chatIdToUse, message);
    console.log('[Telegram Transfer Notification Result]:', res);
  }
};
