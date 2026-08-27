import type { Room, Reservation, BankInfo, AdminBarcodeItem, MasterBarcode, UserAccount } from '../types';

export const INITIAL_MASTER_BARCODE: MasterBarcode = {
  type: 'number',
  value: '*M091063684*',
  updatedAt: '2026-08-05',
};

export const INITIAL_USERS: UserAccount[] = [
  {
    id: 'user-1',
    userId: 'user1',
    password: '123',
    name: '홍길동',
    phone: '010-1234-5678',
    role: 'user',
    points: 20000,
  },
  {
    id: 'user-2',
    userId: 'admin',
    password: '123',
    name: '최고관리자',
    phone: '010-9999-8888',
    role: 'admin',
    points: 999000,
  },
];

export const getTodayDateString = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const getOffsetDateString = (offsetDays: number) => {
  const today = new Date();
  today.setDate(today.getDate() + offsetDays);
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const INITIAL_BANK_INFO: BankInfo = {
  bankName: '신한은행',
  accountNumber: '110-384-918234',
  accountHolder: '(주)르하임 여의도점',
};

export const INITIAL_ROOMS: Room[] = [
  // 🏢 여의도점 공부방
  {
    id: 'room-yeouido-1',
    name: '스터디 존 A (4인실)',
    capacity: 4,
    description: '집중이 잘되는 조명과 화이트보드가 준비된 4인실 공부방입니다.',
    branchId: 'yeouido',
  },
  {
    id: 'room-yeouido-2',
    name: '스터디 존 B (6인실)',
    capacity: 6,
    description: '개별 모니터와 콘센트가 구비된 그룹 스터디용 6인실입니다.',
    branchId: 'yeouido',
  },
  {
    id: 'room-yeouido-3',
    name: '세미나룸 C (10인실)',
    capacity: 10,
    description: '대형 빔프로젝터와 음향 장비가 완비된 단체 세미나용 10인실입니다.',
    branchId: 'yeouido',
  },

  // 🏢 대방역 공부방
  {
    id: 'room-daebang-1',
    name: '포커스 스터디룸 A (4인실)',
    capacity: 4,
    description: '공기청정기와 와이드 화이트보드가 설치된 4인 전용 스터디룸입니다.',
    branchId: 'daebang',
  },
  {
    id: 'room-daebang-2',
    name: '그룹 비즈니스룸 B (6인실)',
    capacity: 6,
    description: '개별 모니터와 멀티탭이 완비된 중형 그룹 스터디룸입니다.',
    branchId: 'daebang',
  },
  {
    id: 'room-daebang-3',
    name: '대방 세미나홀 C (10인실)',
    capacity: 10,
    description: '빔프로젝터, 대형 스크린이 구비된 대형 세미나룸입니다.',
    branchId: 'daebang',
  },
  // 🏢 마포점 공부방
  {
    id: 'room-mapo-1',
    name: '포커스 몰입룸 (2인실)',
    capacity: 2,
    description: '조용하고 아늑한 1:1 과외 및 집중 몰입 전용 2인실입니다.',
    branchId: 'mapo',
  },
  {
    id: 'room-mapo-2',
    name: '프리미엄 스터디룸 (4인실)',
    capacity: 4,
    description: '공기청정기와 와이드 화이트보드가 설치된 4인실입니다.',
    branchId: 'mapo',
  },
  {
    id: 'room-mapo-3',
    name: '그룹 스터디룸 (8인실)',
    capacity: 8,
    description: '개별 모니터와 멀티탭이 완비된 중형 스터디룸입니다.',
    branchId: 'mapo',
  },
  {
    id: 'room-mapo-4',
    name: '마포 대형 세미나홀 (15인실)',
    capacity: 15,
    description: '빔프로젝터, 대형 스크린, 마이크가 구비된 대형 홀입니다.',
    branchId: 'mapo',
  },
];

// 관리자 사전 등록 바코드 초기 데이터 (*M091063684* 규격 포맷)
export const INITIAL_ADMIN_BARCODES: AdminBarcodeItem[] = [
  {
    id: 'bc-1',
    barcodeId: '*M091063684*',
    status: 'assigned',
    assignedToUserName: '홍길동',
    assignedReservationId: 'res-1',
    createdAt: '2026-08-01',
  },
  {
    id: 'bc-2',
    barcodeId: '*M091063685*',
    status: 'assigned',
    assignedToUserName: '김철수',
    assignedReservationId: 'res-2',
    createdAt: '2026-08-01',
  },
  {
    id: 'bc-3',
    barcodeId: '*M091063686*',
    status: 'used',
    assignedToUserName: '이영희',
    assignedReservationId: 'res-3',
    createdAt: '2026-08-02',
  },
  {
    id: 'bc-4',
    barcodeId: '*M091063687*',
    status: 'assigned',
    assignedToUserName: '박지성',
    assignedReservationId: 'res-4',
    createdAt: '2026-08-02',
  },
  {
    id: 'bc-5',
    barcodeId: '*M091063688*',
    status: 'available',
    createdAt: '2026-08-03',
  },
  {
    id: 'bc-6',
    barcodeId: '*M091063689*',
    status: 'available',
    createdAt: '2026-08-03',
  },
  {
    id: 'bc-7',
    barcodeId: '*M091063690*',
    status: 'available',
    createdAt: '2026-08-04',
  },
];

export const INITIAL_RESERVATIONS: Reservation[] = [
  {
    id: 'res-1',
    roomId: 'room-1',
    date: getTodayDateString(),
    startTime: '09:00',
    endTime: '11:00',
    userName: '홍길동',
    userPhone: '010-1234-5678',
    costPoints: 16000,
    costAmount: 16000,
    paymentMethod: 'points',
    paymentStatus: 'paid',
    barcodeId: '*M091063684*',
    barcodeStatus: 'valid',
  },
  {
    id: 'res-2',
    roomId: 'room-1',
    date: getTodayDateString(),
    startTime: '14:30',
    endTime: '16:00',
    userName: '김철수',
    userPhone: '010-9876-5432',
    costPoints: 12000,
    costAmount: 12000,
    paymentMethod: 'bank_transfer',
    paymentStatus: 'deposit_pending',
    barcodeId: '*M091063685*',
    barcodeStatus: 'valid',
  },
  {
    id: 'res-3',
    roomId: 'room-2',
    date: getTodayDateString(),
    startTime: '11:00',
    endTime: '13:00',
    userName: '이영희',
    userPhone: '010-1111-2222',
    costPoints: 16000,
    costAmount: 16000,
    paymentMethod: 'points',
    paymentStatus: 'paid',
    barcodeId: '*M091063686*',
    barcodeStatus: 'used',
  },
  {
    id: 'res-4',
    roomId: 'room-3',
    date: getOffsetDateString(1),
    startTime: '13:00',
    endTime: '15:30',
    userName: '박지성',
    userPhone: '010-3333-4444',
    costPoints: 20000,
    costAmount: 20000,
    paymentMethod: 'bank_transfer',
    paymentStatus: 'paid',
    barcodeId: '*M091063687*',
    barcodeStatus: 'valid',
    isLongTerm: true,
  },
];
