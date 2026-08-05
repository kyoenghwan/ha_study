import type { Room, Reservation, BankInfo } from '../types';

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
  {
    id: 'room-1',
    name: '스터디 존 A (4인실)',
    capacity: 4,
    description: '집중이 잘되는 조명과 화이트보드가 준비된 4인실 공부방입니다.',
  },
  {
    id: 'room-2',
    name: '스터디 존 B (6인실)',
    capacity: 6,
    description: '개별 모니터와 콘센트가 구비된 그룹 스터디용 6인실입니다.',
  },
  {
    id: 'room-3',
    name: '세미나룸 C (10인실)',
    capacity: 10,
    description: '대형 빔프로젝터와 음향 장비가 완비된 단체 세미나용 10인실입니다.',
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
    barcodeId: 'LH-20260805-1029',
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
    barcodeId: 'LH-20260805-4812',
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
    barcodeId: 'LH-20260805-7731',
    barcodeStatus: 'used',
  },
  {
    id: 'res-4',
    roomId: 'room-3',
    date: getOffsetDateString(1), // 내일 날짜
    startTime: '13:00',
    endTime: '15:30',
    userName: '박지성',
    userPhone: '010-3333-4444',
    costPoints: 20000,
    costAmount: 20000,
    paymentMethod: 'bank_transfer',
    paymentStatus: 'paid',
    barcodeId: 'LH-20260805-9018',
    barcodeStatus: 'valid',
    isLongTerm: true,
  },
];

