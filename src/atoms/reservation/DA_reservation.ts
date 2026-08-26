import type { PaymentMethod, Reservation } from '../../types';
import type { AuthContext } from '../auth/DA_auth';

// 권한 컨텍스트는 auth 도메인이 SSOT다. 도메인마다 따로 정의하지 않는다.
export type { AuthContext };

export interface ReservationSlotInput {
  date: string;
  start: string;
  end: string;
}

export interface CreateReservationsInput {
  authContext: AuthContext;
  roomId: string;
  slots: ReservationSlotInput[];
  reservations: Reservation[];
  userName: string;
  userPhone: string;
  paymentMethod: PaymentMethod;
  availablePoints: number;
  barcodeId: string;
  now?: Date;
}

export type ReservationErrorCode =
  | 'PERMISSION_DENIED'
  | 'INVALID_CUSTOMER'
  | 'INVALID_SLOT'
  | 'PAST_SLOT'
  | 'DUPLICATE_SLOT'
  | 'RESERVATION_CONFLICT'
  | 'INSUFFICIENT_POINTS';

export interface CreateReservationsResult {
  success: boolean;
  data?: { reservations: Reservation[]; totalCost: number };
  errorCode?: ReservationErrorCode;
  message?: string;
}

