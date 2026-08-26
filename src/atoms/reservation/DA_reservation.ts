import type { PaymentMethod, Reservation, Role } from '../../types';

export interface AuthContext {
  userId: string;
  roles: Role[];
}

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

