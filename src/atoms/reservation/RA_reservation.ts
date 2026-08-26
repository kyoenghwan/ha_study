import type { Reservation } from '../../types';
import { RESERVATION_SLOT_MINUTES } from './CA_reservation';
import type { AuthContext, ReservationSlotInput } from './DA_reservation';
import { RA_AUTH_IS_AUTHENTICATED } from '../auth/RA_auth';

// 예약 생성은 인증된 계정이면 가능하다. 권한 판정 규칙은 auth 도메인이 SSOT다.
export const RA_RESERVATION_CAN_CREATE = (authContext: AuthContext): boolean =>
  RA_AUTH_IS_AUTHENTICATED(authContext);

export const RA_RESERVATION_TIME_TO_MINUTES = (time: string): number | null => {
  if (!/^([01]\d|2[0-3]):[0-5]\d$|^24:00$/.test(time)) return null;
  const [hour, minute] = time.split(':').map(Number);
  if (hour === 24 && minute !== 0) return null;
  return hour * 60 + minute;
};

export const RA_RESERVATION_IS_VALID_SLOT = (slot: ReservationSlotInput): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(slot.date)) return false;
  const start = RA_RESERVATION_TIME_TO_MINUTES(slot.start);
  const end = RA_RESERVATION_TIME_TO_MINUTES(slot.end);
  return start !== null && end !== null && start < end &&
    start % RESERVATION_SLOT_MINUTES === 0 && end % RESERVATION_SLOT_MINUTES === 0;
};

export const RA_RESERVATION_IS_PAST_SLOT = (slot: ReservationSlotInput, now: Date): boolean => {
  // 슬롯의 종료 시각(slot.end)이 현재 시각(now) 이전일 때만 지난 슬롯으로 판정
  // 진행 중인 현재 슬롯(예: 02:30~03:00 중 02:46)은 정상 예약 가능
  let slotEndDateStr = `${slot.date}T${slot.end}:00`;
  if (slot.end === '24:00') {
    slotEndDateStr = `${slot.date}T23:59:59`;
  }
  const slotEnd = new Date(slotEndDateStr);
  return Number.isNaN(slotEnd.getTime()) || slotEnd.getTime() <= now.getTime();
};

export const RA_RESERVATION_HAS_CONFLICT = (
  roomId: string,
  slot: ReservationSlotInput,
  reservations: Reservation[],
): boolean => {
  const start = RA_RESERVATION_TIME_TO_MINUTES(slot.start)!;
  const end = RA_RESERVATION_TIME_TO_MINUTES(slot.end)!;
  return reservations.some((reservation) => {
    if (reservation.barcodeStatus === 'cancelled' || reservation.roomId !== roomId || reservation.date !== slot.date) return false;
    const existingStart = RA_RESERVATION_TIME_TO_MINUTES(reservation.startTime);
    const existingEnd = RA_RESERVATION_TIME_TO_MINUTES(reservation.endTime);
    return existingStart !== null && existingEnd !== null && existingStart < end && existingEnd > start;
  });
};

