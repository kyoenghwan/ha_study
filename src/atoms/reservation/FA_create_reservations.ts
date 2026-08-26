import type { Reservation } from '../../types';
import { RESERVATION_SLOT_PRICE } from './CA_reservation';
import type { CreateReservationsInput, CreateReservationsResult } from './DA_reservation';
import {
  RA_RESERVATION_CAN_CREATE,
  RA_RESERVATION_HAS_CONFLICT,
  RA_RESERVATION_IS_PAST_SLOT,
  RA_RESERVATION_IS_VALID_SLOT,
} from './RA_reservation';

export const FA_CREATE_RESERVATIONS = (input: CreateReservationsInput): CreateReservationsResult => {
  if (!RA_RESERVATION_CAN_CREATE(input.authContext)) {
    return { success: false, errorCode: 'PERMISSION_DENIED', message: '예약 권한이 없습니다.' };
  }
  if (!input.userName.trim() || !/^01\d-?\d{3,4}-?\d{4}$/.test(input.userPhone.trim())) {
    return { success: false, errorCode: 'INVALID_CUSTOMER', message: '예약자 이름과 올바른 휴대전화 번호를 입력해 주세요.' };
  }
  if (input.slots.length === 0 || input.slots.some((slot) => !RA_RESERVATION_IS_VALID_SLOT(slot))) {
    return { success: false, errorCode: 'INVALID_SLOT', message: '올바른 30분 단위 예약 시간을 선택해 주세요.' };
  }
  const now = input.now ?? new Date();
  if (input.slots.some((slot) => RA_RESERVATION_IS_PAST_SLOT(slot, now))) {
    return { success: false, errorCode: 'PAST_SLOT', message: '이미 지난 시간은 예약할 수 없습니다.' };
  }
  const slotKeys = input.slots.map((slot) => `${slot.date}|${slot.start}|${slot.end}`);
  if (new Set(slotKeys).size !== slotKeys.length) {
    return { success: false, errorCode: 'DUPLICATE_SLOT', message: '중복 선택된 예약 시간이 있습니다.' };
  }
  if (input.slots.some((slot) => RA_RESERVATION_HAS_CONFLICT(input.roomId, slot, input.reservations))) {
    return { success: false, errorCode: 'RESERVATION_CONFLICT', message: '선택한 시간 중 이미 예약된 시간이 있습니다. 새로고침 후 다시 선택해 주세요.' };
  }

  const totalCost = input.slots.length * RESERVATION_SLOT_PRICE;
  if (input.paymentMethod === 'points' && input.availablePoints < totalCost) {
    return { success: false, errorCode: 'INSUFFICIENT_POINTS', message: `보유 포인트가 부족합니다. (필요: ${totalCost.toLocaleString()}P)` };
  }

  const batchId = `${Date.now()}-${crypto.randomUUID()}`;
  const created = input.slots.map<Reservation>((slot, index) => ({
    id: `res-${batchId}-${index}`,
    roomId: input.roomId,
    date: slot.date,
    startTime: slot.start,
    endTime: slot.end,
    userName: input.userName.trim(),
    userPhone: input.userPhone.trim(),
    costPoints: RESERVATION_SLOT_PRICE,
    costAmount: RESERVATION_SLOT_PRICE,
    paymentMethod: input.paymentMethod,
    paymentStatus: input.paymentMethod === 'points' ? 'paid' : 'deposit_pending',
    barcodeId: input.barcodeId,
    barcodeStatus: 'valid',
  }));

  return { success: true, data: { reservations: created, totalCost } };
};

