export type PaymentMethod = 'points' | 'bank_transfer';
export type PaymentStatus = 'paid' | 'deposit_pending';
export type BarcodeStatus = 'valid' | 'used' | 'cancelled';

export interface Room {
  id: string;
  name: string;
  capacity: number;
  description: string;
}

export interface Reservation {
  id: string;
  roomId: string;
  date: string; // YYYY-MM-DD (e.g., '2026-06-07')
  startTime: string; // HH:MM (e.g., '09:00')
  endTime: string; // HH:MM (e.g., '10:30')
  userName: string;
  userPhone: string;
  costPoints?: number; // 3차 고도화 포인트 차감 기록용
  costAmount?: number; // 원화 환산 금액 (원)
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  barcodeId: string;
  barcodeStatus: BarcodeStatus;
  isLongTerm?: boolean;
}

export interface BankInfo {
  bankName: string;
  accountNumber: string;
  accountHolder: string;
}

export interface AdminBarcodeItem {
  id: string;
  barcodeId: string; // 예: '*M091063684*'
  status: 'available' | 'assigned' | 'used';
  assignedToUserName?: string;
  assignedReservationId?: string;
  createdAt: string;
}

export interface MasterBarcode {
  type: 'number' | 'image';
  value: string;
  updatedAt: string;
}

export type Role = 'admin' | 'user';

