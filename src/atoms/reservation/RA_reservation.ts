import type { Reservation } from '../../types';
import { RESERVATION_SLOT_MINUTES } from './CA_reservation';
import type { AuthContext, ReservationSlotInput } from './DA_reservation';

export const RA_RESERVATION_CAN_CREATE = (authContext: AuthContext): boolean =>
  Boolean(authContext.userId) && authContext.roles.some((role) => role === 'user' || role === 'admin');

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
  const slotStart = new Date(`${slot.date}T${slot.start}:00`);
  return Number.isNaN(slotStart.getTime()) || slotStart.getTime() < now.getTime();
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

