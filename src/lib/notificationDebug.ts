export type NotificationDebugLevel = 'info' | 'success' | 'warn' | 'error';

export interface NotificationDebugEntry {
  timestamp: string;
  traceId: string;
  stage: string;
  level: NotificationDebugLevel;
  details?: Record<string, unknown>;
}

const STORAGE_KEY = 'lheureux_notification_debug_logs';
const MAX_ENTRIES = 100;

declare global {
  interface Window {
    __LHEUREUX_NOTIFICATION_LOGS__?: NotificationDebugEntry[];
    clearLheureuxNotificationLogs?: () => void;
  }
}

const readLogs = (): NotificationDebugEntry[] => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') as NotificationDebugEntry[];
  } catch {
    return [];
  }
};

export const writeNotificationDebugLog = (
  traceId: string,
  stage: string,
  level: NotificationDebugLevel,
  details?: Record<string, unknown>,
) => {
  const entry: NotificationDebugEntry = {
    timestamp: new Date().toISOString(),
    traceId,
    stage,
    level,
    details,
  };
  const logs = [...readLogs(), entry].slice(-MAX_ENTRIES);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
  window.__LHEUREUX_NOTIFICATION_LOGS__ = logs;
  window.clearLheureuxNotificationLogs = () => {
    localStorage.removeItem(STORAGE_KEY);
    window.__LHEUREUX_NOTIFICATION_LOGS__ = [];
    console.info('[TelegramDebug] 알림 진단 로그를 삭제했습니다.');
  };

  const method = level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'info';
  console[method](`[TelegramDebug][${traceId}][${stage}]`, details || {});
};

if (typeof window !== 'undefined') {
  window.__LHEUREUX_NOTIFICATION_LOGS__ = readLogs();
}
