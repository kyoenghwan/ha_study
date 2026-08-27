export interface Branch {
  id: string;
  name: string;
  fullName: string;
  address: string;
  description?: string;
}

export type PaymentMethod = 'points' | 'bank_transfer';
export type PaymentStatus = 'paid' | 'deposit_pending';
export type BarcodeStatus = 'valid' | 'used' | 'cancelled';

export interface Room {
  id: string;
  name: string;
  capacity: number;
  description: string;
  branchId?: string; // 'yeouido' | 'mapo' 등 지점 식별자
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

export interface UserAccount {
  id: string;
  userId: string;
  password?: string;
  name: string;
  phone: string;
  role: Role;
  isSuperAdmin?: boolean; // 최고 관리자(전 지점 총괄) 여부
  adminRoleCode?: 'PLATFORM_ADMIN' | 'BRANCH_OWNER' | 'BRANCH_ADMIN' | 'STAFF' | 'CUSTOMER'; // 세부 관리자 등급
  points: number;
  branchPoints?: Record<string, number>; // 지점별 독립 포인트 계좌: { 'yeouido': 20000, 'daebang': 10000 }
  branchIds?: string[]; // 담당 지점 목록 (다중 지점 관리 지원: ['yeouido', 'mapo'] 등)
}

export interface PointTransaction {
  id: string;
  userId: string;
  userName: string;
  branchId?: string; // 충전/사용/환불 대상 지점 식별자
  type: 'charge_request' | 'charge_approved' | 'use' | 'refund';
  amount: number;
  description: string;
  status: 'pending' | 'completed' | 'cancelled';
  createdAt: string;
}

export type Role = 'admin' | 'user';


export interface PointTransferRequest {
  id: string;
  userId: string;
  userName: string;
  userPhone?: string;
  fromBranchId: string;
  toBranchId: string;
  amount: number;
  reason?: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  approvedAt?: string;
}

