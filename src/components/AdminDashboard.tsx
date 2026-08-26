import React, { useState } from 'react';
import type { Room, Reservation, BankInfo, PaymentMethod, AdminBarcodeItem, MasterBarcode, UserAccount, PointTransaction } from '../types';
import { 
  Plus, Trash2, Calendar, Edit2, CheckCircle2, AlertCircle, 
  CreditCard, BarChart3, QrCode, Settings, Check, Search, Coins, Landmark, CalendarRange, Camera, Upload, Users 
} from 'lucide-react';
import { BarcodeView } from './BarcodeView';
import type { RoleCode, RoleGrant } from '../atoms/auth/DA_auth';
import { CURRENTLY_ASSIGNABLE_ROLE_CODES, ROLE_LABEL } from '../atoms/auth/CA_auth';

interface AdminDashboardProps {
  rooms: Room[];
  reservations: Reservation[];
  bankInfo: BankInfo;
  users?: UserAccount[];
  pointTransactions?: PointTransaction[];
  adminBarcodes?: AdminBarcodeItem[];
  masterBarcode?: MasterBarcode;
  onAddRoom: (room: Omit<Room, 'id'>) => void;
  onEditRoom?: (roomId: string, room: Omit<Room, 'id'>) => void;
  onDeleteRoom: (roomId: string) => void;
  onCancelReservation: (resId: string) => void;
  onEditReservation: (
    resId: string,
    updated: { roomId: string; date: string; startTime: string; endTime: string; userName: string; userPhone: string }
  ) => { success: boolean; message?: string };
  onAddBulkReservations: (reservations: Reservation[]) => void;
  onTogglePaymentStatus: (resId: string) => void;
  onVerifyBarcode: (barcodeId: string) => { success: boolean; message: string; reservation?: Reservation };
  onUpdateBankInfo: (newInfo: BankInfo) => void;
  onAddAdminBarcode?: (barcodeId: string) => void;
  onDeleteAdminBarcode?: (id: string) => void;
  onUpdateReservationBarcode?: (resId: string, newBarcodeId: string) => void;
  onUpdateMasterBarcode?: (barcode: MasterBarcode) => void;
  onApprovePointCharge?: (txId: string) => void;
  onManualAdjustPoint?: (userId: string, amount: number, reason: string) => void;
  /** 계정별 활성 권한 맵 (user_roles). key = users.id */
  userGrants?: Record<string, RoleGrant[]>;
  /** 요청자가 해당 권한을 부여·회수할 수 있는지. RA_AUTH_CAN_GRANT_ROLE 결과 */
  canManageRole?: (roleCode: RoleCode) => boolean;
  onGrantRole?: (targetUserId: string, roleCode: RoleCode) => Promise<{ success: boolean; message?: string }>;
  onRevokeRole?: (
    grantId: string,
    targetUserId: string,
    roleCode: RoleCode,
  ) => Promise<{ success: boolean; message?: string }>;
}

type TabType = 'rooms_reservations' | 'long_term_bulk' | 'point_management' | 'user_management' | 'revenue_analytics' | 'barcode_management' | 'bank_settings';

const generateTimeOptions = () => {
  const options: string[] = [];
  for (let hour = 6; hour <= 24; hour++) {
    const hStr = String(hour).padStart(2, '0');
    options.push(`${hStr}:00`);
    if (hour < 24) {
      options.push(`${hStr}:30`);
    }
  }
  return options;
};

const TIME_OPTIONS = generateTimeOptions();

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  rooms,
  reservations,
  bankInfo,
  users = [],
  pointTransactions = [],
  adminBarcodes = [],
  masterBarcode,
  onAddRoom,
  onEditRoom,
  onDeleteRoom,
  onCancelReservation,
  onEditReservation,
  onAddBulkReservations,
  onTogglePaymentStatus,
  onVerifyBarcode,
  onUpdateBankInfo,
  onAddAdminBarcode,
  onDeleteAdminBarcode,
  onUpdateReservationBarcode,
  onUpdateMasterBarcode,
  onApprovePointCharge,
  onManualAdjustPoint,
  userGrants = {},
  canManageRole,
  onGrantRole,
  onRevokeRole,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('rooms_reservations');

  // 룸 수정 모달 상태
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [editRoomName, setEditRoomName] = useState('');
  const [editRoomCapacity, setEditRoomCapacity] = useState(4);
  const [editRoomDescription, setEditRoomDescription] = useState('');

  // 룸별 예약 내역 접기/펼치기 상태 (기본: 모두 접힘)
  const [expandedRoomIds, setExpandedRoomIds] = useState<Record<string, boolean>>({});

  const toggleRoomReservations = (roomId: string) => {
    setExpandedRoomIds((prev) => ({
      ...prev,
      [roomId]: !prev[roomId],
    }));
  };

  const handleStartEditRoom = (room: Room) => {
    setEditingRoom(room);
    setEditRoomName(room.name);
    setEditRoomCapacity(room.capacity);
    setEditRoomDescription(room.description);
  };

  const handleSaveEditRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRoom || !onEditRoom) return;
    if (!editRoomName.trim()) {
      alert('공부방 이름을 입력해 주세요.');
      return;
    }
    onEditRoom(editingRoom.id, {
      name: editRoomName.trim(),
      capacity: editRoomCapacity,
      description: editRoomDescription.trim(),
    });
    setEditingRoom(null);
  };

  // 권한 변경 진행 중인 계정. 다중 클릭을 프레임워크 단계에서 차단한다.
  const [pendingRoleUserId, setPendingRoleUserId] = useState<string | null>(null);

  /** 현재 요청자가 UI에서 부여할 수 있는 권한 목록. */
  const assignableRoles = CURRENTLY_ASSIGNABLE_ROLE_CODES.filter(
    (code) => canManageRole?.(code) ?? false,
  );

  const handleGrantRoleClick = async (user: UserAccount, roleCode: RoleCode) => {
    if (pendingRoleUserId) return;
    if (!onGrantRole) return;
    if (!confirm(`'${user.name}'(${user.userId}) 계정에 ${ROLE_LABEL[roleCode]} 권한을 부여할까요?`)) return;
    setPendingRoleUserId(user.id);
    try {
      const res = await onGrantRole(user.id, roleCode);
      alert(res.success
        ? `'${user.name}' 계정에 ${ROLE_LABEL[roleCode]} 권한을 부여했습니다.`
        : res.message ?? '권한 부여에 실패했습니다.');
    } finally {
      setPendingRoleUserId(null);
    }
  };

  const handleRevokeRoleClick = async (user: UserAccount, grant: RoleGrant) => {
    if (pendingRoleUserId) return;
    if (!onRevokeRole) return;
    if (!confirm(`'${user.name}'(${user.userId}) 계정의 ${ROLE_LABEL[grant.roleCode]} 권한을 회수할까요?`)) return;
    setPendingRoleUserId(user.id);
    try {
      const res = await onRevokeRole(grant.id, user.id, grant.roleCode);
      alert(res.success
        ? `'${user.name}' 계정의 ${ROLE_LABEL[grant.roleCode]} 권한을 회수했습니다.`
        : res.message ?? '권한 회수에 실패했습니다.');
    } finally {
      setPendingRoleUserId(null);
    }
  };

  // 방 추가 모달
  const [showAddRoomModal, setShowAddRoomModal] = useState(false);
  const [roomName, setRoomName] = useState('');
  const [capacity, setCapacity] = useState(4);
  const [description, setDescription] = useState('');

  // 예약 수정 모달
  const [editingRes, setEditingRes] = useState<Reservation | null>(null);
  const [editRoomId, setEditRoomId] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editStartTime, setEditStartTime] = useState('09:00');
  const [editEndTime, setEditEndTime] = useState('11:00');
  const [editUserName, setEditUserName] = useState('');
  const [editUserPhone, setEditUserPhone] = useState('');
  const [editError, setEditError] = useState('');

  // 장기 일괄 예약 폼 상태
  const [bulkRoomId, setBulkRoomId] = useState<string>(rooms[0]?.id || '');
  const [bulkFromDate, setBulkFromDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [bulkToDate, setBulkToDate] = useState<string>(
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [bulkDays, setBulkDays] = useState<number[]>([1, 3, 5]); // 월(1), 수(3), 금(5) 기본 선택
  const [bulkStartTime, setBulkStartTime] = useState<string>('14:00');
  const [bulkEndTime, setBulkEndTime] = useState<string>('16:00');
  const [bulkUserName, setBulkUserName] = useState<string>('');
  const [bulkUserPhone, setBulkUserPhone] = useState<string>('');
  const [bulkPaymentMethod, setBulkPaymentMethod] = useState<PaymentMethod>('points');
  const [bulkConflicts, setBulkConflicts] = useState<Array<{ date: string; time: string; existingUser: string }>>([]);
  const [bulkSuccessMsg, setBulkSuccessMsg] = useState<string>('');

  // 바코드 검증 및 관리 상태
  const [scanBarcodeId, setScanBarcodeId] = useState<string>('');
  const [scanResult, setScanResult] = useState<{ success: boolean; message: string } | null>(null);
  const [barcodeSearchTerm, setBarcodeSearchTerm] = useState<string>('');
  const [barcodeFilterStatus, setBarcodeFilterStatus] = useState<'all' | 'valid' | 'used' | 'cancelled'>('all');
  const [newBarcodeInputValue, setNewBarcodeInputValue] = useState<string>('*M091063691*');
  const [editingBarcodeResId, setEditingBarcodeResId] = useState<string | null>(null);
  const [customBarcodeResInput, setCustomBarcodeResInput] = useState<string>('');

  // 계좌 정보 설정 폼 상태
  const [bankName, setBankName] = useState(bankInfo.bankName);
  const [accountNumber, setAccountNumber] = useState(bankInfo.accountNumber);
  const [accountHolder, setAccountHolder] = useState(bankInfo.accountHolder);
  const [bankSaveMsg, setBankSaveMsg] = useState(false);

  // 룸 추가 처리
  const handleAddRoomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomName.trim()) return;
    onAddRoom({ name: roomName, capacity, description });
    setRoomName('');
    setCapacity(4);
    setDescription('');
    setShowAddRoomModal(false);
  };

  // 예약 수정 모달 오픈
  const openEditModal = (res: Reservation) => {
    setEditingRes(res);
    setEditRoomId(res.roomId);
    setEditDate(res.date);
    setEditStartTime(res.startTime);
    setEditEndTime(res.endTime);
    setEditUserName(res.userName);
    setEditUserPhone(res.userPhone);
    setEditError('');
  };

  // 예약 수정 제출
  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRes) return;
    const result = onEditReservation(editingRes.id, {
      roomId: editRoomId,
      date: editDate,
      startTime: editStartTime,
      endTime: editEndTime,
      userName: editUserName,
      userPhone: editUserPhone,
    });

    if (result.success) {
      setEditingRes(null);
    } else {
      setEditError(result.message || '예약 수정 중 오류가 발생했습니다.');
    }
  };

  // 장기 일괄 예약 제출 & 충돌 검사
  const handleBulkSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setBulkConflicts([]);
    setBulkSuccessMsg('');

    if (!bulkRoomId) {
      alert('공부방을 선택해 주세요.');
      return;
    }
    if (!bulkUserName.trim() || !bulkUserPhone.trim()) {
      alert('예약자 이름과 연락처를 입력해 주세요.');
      return;
    }
    if (bulkDays.length === 0) {
      alert('최소 1개 이상의 요일을 선택해 주세요.');
      return;
    }

    const startMin = timeToMinutes(bulkStartTime);
    const endMin = timeToMinutes(bulkEndTime);

    if (startMin >= endMin) {
      alert('시작 시간은 종료 시간보다 앞서야 합니다.');
      return;
    }

    // 날짜 범위 루프
    const startD = new Date(bulkFromDate);
    const endD = new Date(bulkToDate);
    const targetDates: string[] = [];

    const cur = new Date(startD);
    while (cur <= endD) {
      const dayOfWeek = cur.getDay(); // 0(일)~6(토)
      if (bulkDays.includes(dayOfWeek)) {
        const year = cur.getFullYear();
        const month = String(cur.getMonth() + 1).padStart(2, '0');
        const day = String(cur.getDate()).padStart(2, '0');
        targetDates.push(`${year}-${month}-${day}`);
      }
      cur.setDate(cur.getDate() + 1);
    }

    if (targetDates.length === 0) {
      alert('선택하신 기간 및 요일에 해당하는 날짜가 없습니다.');
      return;
    }

    // 충돌 검사
    const conflicts: Array<{ date: string; time: string; existingUser: string }> = [];

    targetDates.forEach((dateStr) => {
      const existing = reservations.find((r) => {
        if (r.roomId !== bulkRoomId || r.date !== dateStr) return false;
        const rStart = timeToMinutes(r.startTime);
        const rEnd = timeToMinutes(r.endTime);
        return rStart < endMin && rEnd > startMin;
      });

      if (existing) {
        conflicts.push({
          date: dateStr,
          time: `${existing.startTime}~${existing.endTime}`,
          existingUser: existing.userName,
        });
      }
    });

    if (conflicts.length > 0) {
      setBulkConflicts(conflicts);
      return;
    }

    // 충돌 없으면 일괄 생성
    const durationHours = (endMin - startMin) / 60;
    const costPerDay = (durationHours * 2) * 4000;

    const newBulkList: Reservation[] = targetDates.map((dateStr, idx) => {
      const cleanDate = dateStr.replace(/-/g, '');
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      return {
        id: `res-bulk-${Date.now()}-${idx}`,
        roomId: bulkRoomId,
        date: dateStr,
        startTime: bulkStartTime,
        endTime: bulkEndTime,
        userName: bulkUserName,
        userPhone: bulkUserPhone,
        costPoints: costPerDay,
        costAmount: costPerDay,
        paymentMethod: bulkPaymentMethod,
        paymentStatus: bulkPaymentMethod === 'points' ? 'paid' : 'deposit_pending',
        barcodeId: `LH-${cleanDate}-${randomSuffix}`,
        barcodeStatus: 'valid',
        isLongTerm: true,
      };
    });

    onAddBulkReservations(newBulkList);
    setBulkSuccessMsg(
      `총 ${targetDates.length}회 일괄 예약이 정상 등록되었습니다! (총 금액: ${(costPerDay * targetDates.length).toLocaleString()}원)`
    );
  };

  // 계좌 정보 저장 처리
  const handleBankSave = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateBankInfo({
      bankName,
      accountNumber,
      accountHolder,
    });
    setBankSaveMsg(true);
    setTimeout(() => setBankSaveMsg(false), 3000);
  };

  // 시간 문자열 -> 분 환산
  const timeToMinutes = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };

  // 매출 & 시간대 통계 집계
  const totalRevenue = reservations.reduce((sum, r) => sum + (r.costAmount || 4000), 0);
  const paidRevenue = reservations
    .filter((r) => r.paymentStatus === 'paid')
    .reduce((sum, r) => sum + (r.costAmount || 4000), 0);
  const pendingRevenue = reservations
    .filter((r) => r.paymentStatus === 'deposit_pending')
    .reduce((sum, r) => sum + (r.costAmount || 4000), 0);

  const pointsCount = reservations.filter((r) => r.paymentMethod === 'points').length;
  const bankCount = reservations.filter((r) => r.paymentMethod === 'bank_transfer').length;

  // 시간대 구간별 예약 분배 (06~09, 09~12, 12~15, 15~18, 18~21, 21~24)
  const timeSlotsBreakdown = [
    { label: '06:00 ~ 09:00 (이른 아침)', range: [6, 9] },
    { label: '09:00 ~ 12:00 (오전 스터디)', range: [9, 12] },
    { label: '12:00 ~ 15:00 (오후 집중)', range: [12, 15] },
    { label: '15:00 ~ 18:00 (늦은 오후)', range: [15, 18] },
    { label: '18:00 ~ 21:00 (저녁 피크)', range: [18, 21] },
    { label: '21:00 ~ 24:00 (야간 공부)', range: [21, 24] },
  ].map((slot) => {
    const count = reservations.filter((r) => {
      const startH = parseInt((r.startTime || '00:00').split(':')[0], 10);
      return !isNaN(startH) && startH >= slot.range[0] && startH < slot.range[1];
    }).length;
    return { ...slot, count };
  });

  const maxSlotCount = Math.max(...timeSlotsBreakdown.map((s) => s.count), 1);

  // 바코드 관리 필터링
  const filteredBarcodes = reservations.filter((r) => {
    const barcodeId = r.barcodeId || '';
    const userName = r.userName || '';
    const userPhone = r.userPhone || '';
    const matchText =
      barcodeId.toLowerCase().includes(barcodeSearchTerm.toLowerCase()) ||
      userName.toLowerCase().includes(barcodeSearchTerm.toLowerCase()) ||
      userPhone.includes(barcodeSearchTerm);

    if (barcodeFilterStatus === 'all') return matchText;
    return matchText && r.barcodeStatus === barcodeFilterStatus;
  });

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#eef0f4]">
      {/* 관리자 탭 서브 네비게이션 */}
      <div className="bg-[#ffffff] border-b border-[#e5e8eb] px-4 pt-2.5 flex gap-1 overflow-x-auto shrink-0 shadow-sm">
        <button
          onClick={() => setActiveTab('rooms_reservations')}
          className={`px-3.5 py-3 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-all whitespace-nowrap ${
            activeTab === 'rooms_reservations'
              ? 'border-[#a67c48] text-[#a67c48]'
              : 'border-transparent text-[#8b95a1] hover:text-[#191f28]'
          }`}
        >
          <Calendar size={15} /> 룸 & 예약 관리
        </button>

        <button
          onClick={() => setActiveTab('long_term_bulk')}
          className={`px-3.5 py-3 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-all whitespace-nowrap ${
            activeTab === 'long_term_bulk'
              ? 'border-[#a67c48] text-[#a67c48]'
              : 'border-transparent text-[#8b95a1] hover:text-[#191f28]'
          }`}
        >
          <CalendarRange size={15} /> 장기 일괄 예약
        </button>

        <button
          onClick={() => setActiveTab('point_management')}
          className={`px-3.5 py-3 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-all whitespace-nowrap ${
            activeTab === 'point_management'
              ? 'border-[#a67c48] text-[#a67c48]'
              : 'border-transparent text-[#8b95a1] hover:text-[#191f28]'
          }`}
        >
          <Coins size={15} /> 포인트/입금 승인
          {pointTransactions.filter(t => t.status === 'pending').length > 0 && (
            <span className="bg-[#e93d3d] text-white text-xs font-bold px-1.5 py-0.2 rounded-full ml-1">
              {pointTransactions.filter(t => t.status === 'pending').length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('user_management')}
          className={`px-3.5 py-3 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-all whitespace-nowrap ${
            activeTab === 'user_management'
              ? 'border-[#a67c48] text-[#a67c48]'
              : 'border-transparent text-[#8b95a1] hover:text-[#191f28]'
          }`}
        >
          <Users size={15} /> 회원 통합 관제
        </button>

        <button
          onClick={() => setActiveTab('revenue_analytics')}
          className={`px-3.5 py-3 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-all whitespace-nowrap ${
            activeTab === 'revenue_analytics'
              ? 'border-[#a67c48] text-[#a67c48]'
              : 'border-transparent text-[#8b95a1] hover:text-[#191f28]'
          }`}
        >
          <BarChart3 size={15} /> 매출 & 시간대 통계
        </button>

        <button
          onClick={() => setActiveTab('barcode_management')}
          className={`px-3.5 py-3 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-all whitespace-nowrap ${
            activeTab === 'barcode_management'
              ? 'border-[#a67c48] text-[#a67c48]'
              : 'border-transparent text-[#8b95a1] hover:text-[#191f28]'
          }`}
        >
          <QrCode size={15} /> 바코드 검증 / 발급
        </button>

        <button
          onClick={() => setActiveTab('bank_settings')}
          className={`px-3.5 py-3 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-all whitespace-nowrap ${
            activeTab === 'bank_settings'
              ? 'border-[#a67c48] text-[#a67c48]'
              : 'border-transparent text-[#8b95a1] hover:text-[#191f28]'
          }`}
        >
          <Settings size={15} /> 통장 계좌 설정
        </button>
      </div>

      {/* 탭 콘텐츠 영역 */}
      <div className="flex-1 overflow-y-auto p-5 space-y-6">
        {/* TAB 1: 룸 및 예약 관리 */}
        {activeTab === 'rooms_reservations' && (
          <div className="space-y-5">
            <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-[#e5e8eb] shadow-sm">
              <div>
                <h2 className="text-base font-bold text-[#191f28]">스터디룸 및 예약 목록</h2>
                <p className="text-xs text-[#8b95a1] pt-0.5">공부방을 추가/삭제하거나 실제 예약자의 예약을 변경/취소합니다.</p>
              </div>
              <button
                onClick={() => setShowAddRoomModal(true)}
                className="gold-btn flex items-center gap-1.5 text-xs py-2.5 px-3.5 rounded-xl shadow"
              >
                <Plus size={15} /> 새 룸 추가
              </button>
            </div>

            {/* 방 카드 목록 */}
            <div className="space-y-4">
              {rooms.length === 0 ? (
                <div className="text-center py-10 text-[#8e8e93] border border-dashed border-[#e5e5ea] rounded-xl bg-white">
                  등록된 공부방이 없습니다. 방을 추가해 주세요.
                </div>
              ) : (
                rooms.map((room) => {
                  const roomResList = reservations
                    .filter((r) => r.roomId === room.id)
                    .sort((a, b) => `${a.date}T${a.startTime}`.localeCompare(`${b.date}T${b.startTime}`));
                  const isExpanded = expandedRoomIds[room.id] ?? false;

                  return (
                    <div key={room.id} className="bg-[#ffffff] border border-[#e5e8eb] rounded-2xl overflow-hidden shadow-sm">
                      {/* 룸 정보 및 수정/삭제/예약확인 헤더 */}
                      <div className="p-4 flex justify-between items-start bg-[#fdfdfd] border-b border-[#f0f0f2]">
                        <div className="space-y-1.5 flex-1 pr-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-base font-bold text-[#191f28]">{room.name}</h3>
                            <span className="text-[11px] text-[#a67c48] bg-[#a67c48]/10 px-2.5 py-0.5 rounded-full font-bold">
                              정원 {room.capacity}명
                            </span>
                          </div>
                          <p className="text-xs text-[#8b95a1] leading-relaxed">{room.description}</p>
                        </div>

                        {/* 룸 컨트롤 버튼 그룹: 수정 & 삭제 */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => handleStartEditRoom(room)}
                            className="text-xs font-bold text-[#a67c48] bg-[#a67c48]/10 hover:bg-[#a67c48]/20 border border-[#a67c48]/30 px-2.5 py-1.5 rounded-xl flex items-center gap-1 transition-all"
                            title="룸 정보 수정"
                          >
                            <Edit2 size={13} />
                            <span>수정</span>
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`'${room.name}'을(를) 삭제하시겠습니까? 관련된 전체 예약 내역도 삭제됩니다.`)) {
                                onDeleteRoom(room.id);
                              }
                            }}
                            className="text-xs font-bold text-[#e93d3d] bg-[#e93d3d]/10 hover:bg-[#e93d3d]/20 border border-[#e93d3d]/30 px-2.5 py-1.5 rounded-xl flex items-center gap-1 transition-all"
                            title="룸 삭제"
                          >
                            <Trash2 size={13} />
                            <span>삭제</span>
                          </button>
                        </div>
                      </div>

                      {/* 📅 예약 내역 접기/펼치기 토글 바 */}
                      <div className="px-4 py-3 bg-[#f8f9fc] flex justify-between items-center">
                        <span className="text-xs font-bold text-[#4e5968] flex items-center gap-1.5">
                          <Calendar size={14} className="text-[#a67c48]" />
                          <span>예약 내역</span>
                          <strong className={`px-2 py-0.5 rounded-full text-[11px] ${roomResList.length > 0 ? 'bg-[#a67c48] text-white font-bold' : 'bg-[#8b95a1]/20 text-[#8b95a1]'}`}>
                            {roomResList.length}건
                          </strong>
                        </span>

                        <button
                          onClick={() => toggleRoomReservations(room.id)}
                          className="text-xs font-bold text-[#a67c48] bg-white border border-[#a67c48]/30 px-3 py-1.5 rounded-xl hover:bg-[#a67c48]/10 transition-all flex items-center gap-1 shadow-sm"
                        >
                          <span>{isExpanded ? '예약 내역 접기 ▲' : '예약 내역 보기 ▼'}</span>
                        </button>
                      </div>

                      {/* 펼쳤을 때만 노출되는 예약 내역 리스트 */}
                      {isExpanded && (
                        <div className="p-4 border-t border-[#e5e8eb] bg-[#ffffff] space-y-3">
                          {roomResList.length === 0 ? (
                            <p className="text-xs text-[#8b95a1] py-4 text-center italic bg-[#f8f9fc] rounded-xl border border-dashed border-[#e5e8eb]">
                              현재 등록된 예약이 없습니다.
                            </p>
                          ) : (
                            <div className="space-y-2.5">
                              {roomResList.map((res) => (
                                <div
                                  key={res.id}
                                  className="flex flex-col sm:flex-row sm:items-center justify-between bg-[#f8f9fc] border border-[#e5e8eb] p-3 rounded-xl gap-2"
                                >
                                  <div className="text-xs space-y-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="font-bold text-[#191f28]">{res.userName}</span>
                                      <span className="text-[#8b95a1]">({res.userPhone})</span>
                                      {res.isLongTerm && (
                                        <span className="text-[10px] bg-[#28a745]/10 text-[#28a745] font-bold px-2 py-0.5 rounded-full">
                                          장기 과외
                                        </span>
                                      )}
                                      <span
                                        onClick={() => onTogglePaymentStatus(res.id)}
                                        className={`cursor-pointer text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5 transition-all ${
                                          res.paymentStatus === 'paid'
                                            ? 'bg-[#28a745]/10 text-[#28a745]'
                                            : 'bg-[#f59e0b]/10 text-[#f59e0b]'
                                        }`}
                                        title="결제 상태 변경 (클릭)"
                                      >
                                        {res.paymentStatus === 'paid' ? '결제/입금 완료' : '무통장 입금 대기'}
                                      </span>
                                    </div>
                                    <p className="text-[#8b95a1] flex items-center gap-1 pt-0.5">
                                      <Calendar size={12} className="text-[#a67c48]" />
                                      <span>{res.date}</span>
                                      <span className="font-bold text-[#191f28]">{res.startTime} ~ {res.endTime}</span>
                                      <span className="text-[10px] text-[#8b95a1] pl-2 font-mono">
                                        | 바코드: {res.barcodeId}
                                      </span>
                                    </p>
                                  </div>

                                  <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                                    <button
                                      onClick={() => openEditModal(res)}
                                      className="gold-btn-outline text-xs py-1 px-2.5 rounded-lg flex items-center gap-1 font-semibold"
                                    >
                                      <Edit2 size={12} /> 시간/룸 변경
                                    </button>
                                    <button
                                      onClick={() => {
                                        if (confirm(`'${res.userName}'님의 예약을 취소하시겠습니까?`)) {
                                          onCancelReservation(res.id);
                                        }
                                      }}
                                      className="text-xs text-[#e93d3d] hover:bg-[#e93d3d]/10 border border-[#e93d3d]/30 font-semibold py-1 px-2.5 rounded-lg transition-colors"
                                    >
                                      취소
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* TAB 2: 장기 사용자 1:1 과외 일괄 예약 */}
        {activeTab === 'long_term_bulk' && (
          <div className="bg-[#ffffff] border border-[#e5e5ea] rounded-xl p-5 space-y-5 shadow-sm">
            <div>
              <h2 className="text-base font-bold text-[#1c1c1e] flex items-center gap-1.5">
                <CalendarRange className="text-[#b09168]" size={18} /> 장기 사용자 (1:1 과외 등) 일괄 예약 등록
              </h2>
              <p className="text-xs text-[#8e8e93] mt-1">
                기간(From ~ To)과 선택 요일, 연속 시간대를 지정하여 한 달 치 이상의 스케줄을 한 번에 일괄 등록합니다.
                중복된 기존 예약이 있는 경우 즉시 경고 메시지를 표출합니다.
              </p>
            </div>

            {bulkSuccessMsg && (
              <div className="p-3 bg-[#34c759]/10 border border-[#34c759]/30 rounded-xl text-xs text-[#34c759] font-bold flex items-center gap-2">
                <CheckCircle2 size={16} /> {bulkSuccessMsg}
              </div>
            )}

            {bulkConflicts.length > 0 && (
              <div className="p-4 bg-[#ff3b30]/10 border border-[#ff3b30]/30 rounded-xl space-y-2 text-xs text-[#ff3b30]">
                <div className="font-bold flex items-center gap-1.5 text-sm">
                  <AlertCircle size={18} /> 다음 {bulkConflicts.length}개 일자에 이미 기존 예약이 등록되어 있습니다!
                </div>
                <p className="text-[11px] text-[#ff3b30]/80">해당 날짜 및 시간대의 중복을 해소하신 후 다시 시도해 주세요.</p>
                <div className="max-h-40 overflow-y-auto space-y-1 pt-1">
                  {bulkConflicts.map((c, idx) => (
                    <div key={idx} className="bg-white/80 p-2 rounded border border-[#ff3b30]/20 font-medium">
                      • {c.date} ({c.time}) - 기존 예약자: <strong>{c.existingUser}</strong>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <form onSubmit={handleBulkSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="text-xs font-bold text-[#1c1c1e]">대상 공부방 선택</label>
                  <select
                    value={bulkRoomId}
                    onChange={(e) => setBulkRoomId(e.target.value)}
                    className="form-input text-xs"
                    required
                  >
                    {rooms.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} (정원 {r.capacity}명)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="text-xs font-bold text-[#1c1c1e]">결제 방식</label>
                  <select
                    value={bulkPaymentMethod}
                    onChange={(e) => setBulkPaymentMethod(e.target.value as PaymentMethod)}
                    className="form-input text-xs"
                  >
                    <option value="points">포인트 차감 (즉시 결제)</option>
                    <option value="bank_transfer">무통장 입금 (입금 대기)</option>
                  </select>
                </div>
              </div>

              {/* 기간 선택 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="text-xs font-bold text-[#1c1c1e]">시작일 (From)</label>
                  <input
                    type="date"
                    value={bulkFromDate}
                    onChange={(e) => setBulkFromDate(e.target.value)}
                    className="form-input text-xs"
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="text-xs font-bold text-[#1c1c1e]">종료일 (To)</label>
                  <input
                    type="date"
                    value={bulkToDate}
                    onChange={(e) => setBulkToDate(e.target.value)}
                    className="form-input text-xs"
                    required
                  />
                </div>
              </div>

              {/* 요일 다중 선택 */}
              <div className="form-group">
                <label className="text-xs font-bold text-[#1c1c1e] mb-1 block">반복 적용 요일 선택</label>
                <div className="flex gap-2 flex-wrap">
                  {[
                    { day: 1, label: '월요일' },
                    { day: 2, label: '화요일' },
                    { day: 3, label: '수요일' },
                    { day: 4, label: '목요일' },
                    { day: 5, label: '금요일' },
                    { day: 6, label: '토요일' },
                    { day: 0, label: '일요일' },
                  ].map((item) => {
                    const isSelected = bulkDays.includes(item.day);
                    return (
                      <button
                        type="button"
                        key={item.day}
                        onClick={() => {
                          if (isSelected) {
                            setBulkDays(bulkDays.filter((d) => d !== item.day));
                          } else {
                            setBulkDays([...bulkDays, item.day]);
                          }
                        }}
                        className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all ${
                          isSelected
                            ? 'bg-[#b09168] text-white border-[#b09168]'
                            : 'bg-[#f8f9fa] text-[#8e8e93] border-[#e5e5ea] hover:border-[#b09168]'
                        }`}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 시간대 선택 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="text-xs font-bold text-[#1c1c1e]">고정 시작 시간</label>
                  <select
                    value={bulkStartTime}
                    onChange={(e) => setBulkStartTime(e.target.value)}
                    className="form-input text-xs"
                  >
                    {TIME_OPTIONS.slice(0, -1).map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="text-xs font-bold text-[#1c1c1e]">고정 종료 시간</label>
                  <select
                    value={bulkEndTime}
                    onChange={(e) => setBulkEndTime(e.target.value)}
                    className="form-input text-xs"
                  >
                    {TIME_OPTIONS.slice(1).map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 이용자 정보 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="text-xs font-bold text-[#1c1c1e]">예약자 이름 (강사/수강생)</label>
                  <input
                    type="text"
                    value={bulkUserName}
                    onChange={(e) => setBulkUserName(e.target.value)}
                    placeholder="예: 강동원 (1:1 수학과외)"
                    className="form-input text-xs"
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="text-xs font-bold text-[#1c1c1e]">예약자 연락처</label>
                  <input
                    type="text"
                    value={bulkUserPhone}
                    onChange={(e) => setBulkUserPhone(e.target.value)}
                    placeholder="예: 010-8888-9999"
                    className="form-input text-xs"
                    required
                  />
                </div>
              </div>

              <button type="submit" className="gold-btn w-full py-3 text-xs font-bold rounded-xl mt-2">
                중복 검사 및 장기 일괄 예약 확정 등록
              </button>
            </form>
          </div>
        )}

        {/* TAB 3: 포인트 / 무통장 입금 승인 & 환불 내역 관제 */}
        {activeTab === 'point_management' && (
          <div className="space-y-6">
            <div className="bg-white border border-[#e5e5ea] p-5 rounded-2xl shadow-sm space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-base font-bold text-[#1c1c1e] flex items-center gap-2">
                    <Coins className="text-[#b09168]" size={20} /> 포인트 충전 & 무통장 입금 승인 관리
                  </h3>
                  <p className="text-xs text-[#8e8e93] mt-1">
                    이용자의 무통장 입금을 확인한 후 승인 버튼을 누르시면 해당 회원 계정으로 포인트가 즉시 지급됩니다.
                  </p>
                </div>
                <span className="text-xs font-bold bg-[#b09168]/10 text-[#b09168] px-3 py-1.5 rounded-full border border-[#b09168]/30">
                  승인 대기: {pointTransactions.filter(t => t.status === 'pending').length}건
                </span>
              </div>

              {/* 포인트 신청 & 환불 내역 목록 테이블 */}
              <div className="overflow-x-auto border border-[#e5e5ea] rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#f8f9fa] border-b border-[#e5e5ea] text-[#1c1c1e]">
                    <tr>
                      <th className="p-3">신청 일시</th>
                      <th className="p-3">회원명 (아이디)</th>
                      <th className="p-3">유형</th>
                      <th className="p-3">신청 금액</th>
                      <th className="p-3">내용 / 메모</th>
                      <th className="p-3">상태</th>
                      <th className="p-3 text-center">관리 조치</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e5e5ea]">
                    {pointTransactions.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-[#8e8e93]">
                          포인트 충전 또는 환불 신청 내역이 없습니다.
                        </td>
                      </tr>
                    ) : (
                      pointTransactions.map((tx) => (
                        <tr key={tx.id} className="hover:bg-[#f8f9fa]">
                          <td className="p-3 text-[#8e8e93] font-mono">{(tx.createdAt || '').split('T')[0] || '-'}</td>
                          <td className="p-3 font-bold text-[#1c1c1e]">
                            {tx.userName} <span className="text-[10px] text-[#8e8e93] font-normal">({tx.userId})</span>
                          </td>
                          <td className="p-3 font-bold">
                            {tx.type === 'charge_request' && <span className="text-[#007aff]">무통장 충전 신청</span>}
                            {tx.type === 'charge_approved' && <span className="text-[#34c759]">충전 승인 완료</span>}
                            {tx.type === 'use' && <span className="text-[#ff9500]">포인트 사용</span>}
                            {tx.type === 'refund' && <span className="text-[#ff3b30]">포인트 환불</span>}
                          </td>
                          <td className="p-3 font-extrabold text-[#1c1c1e]">
                            {tx.amount.toLocaleString()} P
                          </td>
                          <td className="p-3 text-[#8e8e93] max-w-[200px] truncate">{tx.description}</td>
                          <td className="p-3 font-bold">
                            {tx.status === 'pending' && <span className="text-[#ff9500] bg-[#ff9500]/10 px-2 py-0.5 rounded">입금대기</span>}
                            {tx.status === 'completed' && <span className="text-[#34c759] bg-[#34c759]/10 px-2 py-0.5 rounded">처리완료</span>}
                            {tx.status === 'cancelled' && <span className="text-[#8e8e93] bg-[#8e8e93]/10 px-2 py-0.5 rounded">취소됨</span>}
                          </td>
                          <td className="p-3 text-center">
                            {tx.status === 'pending' && onApprovePointCharge && (
                              <button
                                onClick={() => onApprovePointCharge(tx.id)}
                                className="gold-btn py-1.5 px-3 text-[11px] font-bold rounded-lg shadow-sm"
                              >
                                입금확인 & 승인
                              </button>
                            )}
                            {tx.status === 'completed' && (
                              <span className="text-[10px] text-[#8e8e93]">완료됨</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: 회원 통합 관제 & 포인트 수동 지급/차감 */}
        {activeTab === 'user_management' && (
          <div className="space-y-6">
            <div className="bg-white border border-[#e5e5ea] p-5 rounded-2xl shadow-sm space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-base font-bold text-[#1c1c1e] flex items-center gap-2">
                    <Users className="text-[#b09168]" size={20} /> 회원 통합 관제 & 포인트 수동 조율
                  </h3>
                  <p className="text-xs text-[#8e8e93] mt-1">
                    등록된 모든 회원 목록 및 포인트 잔액을 확인하고, 필요 시 수동으로 포인트를 지급하거나 차감할 수 있습니다.
                  </p>
                </div>
                <span className="text-xs font-bold bg-[#b09168]/10 text-[#b09168] px-3 py-1.5 rounded-full border border-[#b09168]/30">
                  총 회원: {users.length}명
                </span>
              </div>

              {/* 회원 목록 데이터 테이블 */}
              <div className="overflow-x-auto border border-[#e5e5ea] rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#f8f9fa] border-b border-[#e5e5ea] text-[#1c1c1e]">
                    <tr>
                      <th className="p-3">성함</th>
                      <th className="p-3">아이디</th>
                      <th className="p-3">연락처</th>
                      <th className="p-3">회원 권한</th>
                      <th className="p-3">보유 포인트 잔액</th>
                      <th className="p-3 text-center">포인트 수동 지급/차감</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e5e5ea]">
                    {users.map((u) => (
                      <tr key={u.id} className="hover:bg-[#f8f9fa]">
                        <td className="p-3 font-bold text-[#1c1c1e]">{u.name}</td>
                        <td className="p-3 font-mono text-[#8e8e93]">{u.userId}</td>
                        <td className="p-3 text-[#8e8e93]">{u.phone}</td>
                        <td className="p-3 font-bold">
                          <div className="flex flex-wrap items-center gap-1">
                            {(userGrants[u.id] ?? []).filter((g) => g.roleCode !== 'CUSTOMER').length === 0 ? (
                              <span className="text-[#8e8e93] bg-[#f0f0f2] px-2 py-0.5 rounded text-[10px]">
                                일반 회원
                              </span>
                            ) : (
                              (userGrants[u.id] ?? [])
                                .filter((g) => g.roleCode !== 'CUSTOMER')
                                .map((g) => (
                                  <span
                                    key={g.id}
                                    className="inline-flex items-center gap-1 text-[#b09168] bg-[#b09168]/10 px-2 py-0.5 rounded text-[10px]"
                                  >
                                    {ROLE_LABEL[g.roleCode] ?? g.roleCode}
                                    {(canManageRole?.(g.roleCode) ?? false) && onRevokeRole && (
                                      <button
                                        type="button"
                                        disabled={pendingRoleUserId !== null}
                                        onClick={() => void handleRevokeRoleClick(u, g)}
                                        title={`${ROLE_LABEL[g.roleCode] ?? g.roleCode} 권한 회수`}
                                        className="text-[#ff3b30] font-extrabold px-0.5"
                                      >
                                        ×
                                      </button>
                                    )}
                                  </span>
                                ))
                            )}
                            {assignableRoles
                              .filter((code) => !(userGrants[u.id] ?? []).some((g) => g.roleCode === code))
                              .map((code) => (
                                <button
                                  key={code}
                                  type="button"
                                  disabled={pendingRoleUserId !== null}
                                  onClick={() => void handleGrantRoleClick(u, code)}
                                  className="text-[#8e8e93] border border-[#e5e5ea] bg-[#f8f9fa] px-2 py-0.5 rounded text-[10px] font-bold"
                                >
                                  + {ROLE_LABEL[code] ?? code}
                                </button>
                              ))}
                          </div>
                        </td>
                        <td className="p-3 font-extrabold text-[#b09168]">
                          {(u.points || 0).toLocaleString()} P
                        </td>
                        <td className="p-3 text-center space-x-1">
                          <button
                            onClick={() => {
                              const amountStr = prompt(`'${u.name}' 회원님에게 지급할 포인트 금액을 입력해 주세요:`, '10000');
                              if (amountStr) {
                                const amt = parseInt(amountStr, 10);
                                if (!isNaN(amt) && amt > 0 && onManualAdjustPoint) {
                                  onManualAdjustPoint(u.id, amt, '관리자 수동 지급');
                                }
                              }
                            }}
                            className="bg-[#34c759]/10 text-[#34c759] border border-[#34c759]/30 py-1 px-2.5 rounded-lg font-bold text-[11px] hover:bg-[#34c759]/20"
                          >
                            + 지급
                          </button>
                          <button
                            onClick={() => {
                              const amountStr = prompt(`'${u.name}' 회원님에게서 차감할 포인트 금액을 입력해 주세요:`, '5000');
                              if (amountStr) {
                                const amt = parseInt(amountStr, 10);
                                if (!isNaN(amt) && amt > 0 && onManualAdjustPoint) {
                                  onManualAdjustPoint(u.id, -amt, '관리자 수동 차감');
                                }
                              }
                            }}
                            className="bg-[#ff3b30]/10 text-[#ff3b30] border border-[#ff3b30]/30 py-1 px-2.5 rounded-lg font-bold text-[11px] hover:bg-[#ff3b30]/20"
                          >
                            - 차감
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: 매출 & 시간대 통계 */}
        {activeTab === 'revenue_analytics' && (
          <div className="space-y-6">
            {/* 요약 메트릭 카드 */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white border border-[#e5e5ea] p-4 rounded-xl shadow-sm space-y-2">
                <span className="text-xs font-bold text-[#8e8e93] flex items-center gap-1">
                  <Coins size={14} className="text-[#b09168]" /> 누적 총 매출액
                </span>
                <div className="text-xl font-extrabold text-[#1c1c1e]">{totalRevenue.toLocaleString()}원</div>
                <div className="text-[10px] text-[#8e8e93]">
                  입금 완료: <span className="text-[#34c759] font-bold">{paidRevenue.toLocaleString()}원</span> | 입금
                  대기: <span className="text-[#ff9500] font-bold">{pendingRevenue.toLocaleString()}원</span>
                </div>
              </div>

              <div className="bg-white border border-[#e5e5ea] p-4 rounded-xl shadow-sm space-y-2">
                <span className="text-xs font-bold text-[#8e8e93] flex items-center gap-1">
                  <Calendar size={14} className="text-[#b09168]" /> 누적 예약 건수
                </span>
                <div className="text-xl font-extrabold text-[#1c1c1e]">{reservations.length}건</div>
                <div className="text-[10px] text-[#8e8e93]">
                  장기 과외 예약: <span className="text-[#b09168] font-bold">{reservations.filter(r => r.isLongTerm).length}건</span>
                </div>
              </div>

              <div className="bg-white border border-[#e5e5ea] p-4 rounded-xl shadow-sm space-y-2">
                <span className="text-xs font-bold text-[#8e8e93] flex items-center gap-1">
                  <CreditCard size={14} className="text-[#b09168]" /> 결제 수단 비율
                </span>
                <div className="text-sm font-bold text-[#1c1c1e] flex justify-between items-center pt-1">
                  <span>포인트 결제: {pointsCount}건</span>
                  <span>무통장 입금: {bankCount}건</span>
                </div>
                <div className="w-full bg-[#f0f0f2] h-2 rounded-full overflow-hidden flex">
                  <div
                    style={{ width: `${(pointsCount / (reservations.length || 1)) * 100}%` }}
                    className="bg-[#b09168] h-full"
                  />
                  <div
                    style={{ width: `${(bankCount / (reservations.length || 1)) * 100}%` }}
                    className="bg-[#007aff] h-full"
                  />
                </div>
              </div>
            </div>

            {/* 시간대별 이용률 분포 차트 */}
            <div className="bg-white border border-[#e5e5ea] p-5 rounded-xl shadow-sm space-y-4">
              <div>
                <h3 className="text-sm font-bold text-[#1c1c1e] flex items-center gap-1.5">
                  <BarChart3 className="text-[#b09168]" size={16} /> 룸 사용 시간대별 피크타임 가동 현황
                </h3>
                <p className="text-xs text-[#8e8e93]">하루 중 사용자가 몰리는 핵심 스스터디 시간대를 파악할 수 있습니다.</p>
              </div>

              <div className="space-y-3 pt-2">
                {timeSlotsBreakdown.map((slot, idx) => {
                  const percentage = Math.round((slot.count / maxSlotCount) * 100);
                  return (
                    <div key={idx} className="space-y-1">
                      <div className="flex justify-between text-xs font-semibold text-[#1c1c1e]">
                        <span>{slot.label}</span>
                        <span className="text-[#b09168] font-bold">{slot.count}건 이용</span>
                      </div>
                      <div className="w-full bg-[#f8f9fa] border border-[#e5e5ea] h-3 rounded-full overflow-hidden">
                        <div
                          style={{ width: `${percentage}%` }}
                          className="bg-gradient-to-r from-[#b09168]/70 to-[#b09168] h-full rounded-full transition-all duration-500"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: 바코드 검증 & 사전 등록 풀(Pool) 관리 */}
        {activeTab === 'barcode_management' && (
          <div className="space-y-6">
            {/* 0. 대표 출입 바코드 사진 등록 & 번호 수동 설정 카드 */}
            <div className="bg-[#ffffff] border-2 border-[#b09168]/40 p-5 rounded-2xl shadow-md space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-sm font-extrabold text-[#1c1c1e] flex items-center gap-1.5">
                    <Camera className="text-[#b09168]" size={20} /> 이용자 대표 출입 바코드 등록 (사진 촬영 / 번호 입력)
                  </h3>
                  <p className="text-xs text-[#8e8e93]">
                    바코드 사진을 찍어 업로드하거나 번호를 입력하면, 예약 완료된 모든 이용자의 출입 화면에 활성화되어 노출됩니다.
                  </p>
                </div>
                <span className="text-[10px] font-bold text-[#b09168] border border-[#b09168]/30 px-2.5 py-1 rounded-full bg-[#b09168]/10 shrink-0">
                  현재 상태: {masterBarcode?.type === 'image' ? '🖼️ 사진 이미지 바코드' : '🔢 번호 바코드'}
                </span>
              </div>

              {/* 등록 방법 탭 및 입력 폼 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                {/* 방법 A: 사진 촬영 / 이미지 파일 업로드 */}
                <div className="border border-[#e5e5ea] rounded-xl p-3.5 bg-[#f8f9fa] space-y-2">
                  <h4 className="text-xs font-bold text-[#1c1c1e] flex items-center gap-1">
                    <Upload size={14} className="text-[#b09168]" /> 1. 바코드 사진 촬영 / 파일 업로드
                  </h4>
                  <p className="text-[11px] text-[#8e8e93]">실물 바코드 사진(JPG, PNG)을 올리시면 이용자 팝업에 바코드 사진으로 노출됩니다.</p>
                  
                  <label className="gold-btn w-full py-2.5 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 cursor-pointer text-center">
                    <Camera size={16} /> 사진 촬영 / 파일 선택
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file && onUpdateMasterBarcode) {
                          const reader = new FileReader();
                          reader.onload = (event) => {
                            const dataUrl = event.target?.result as string;
                            onUpdateMasterBarcode({
                              type: 'image',
                              value: dataUrl,
                              updatedAt: new Date().toISOString().split('T')[0],
                            });
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                  </label>
                </div>

                {/* 방법 B: 바코드 번호 직접 입력 */}
                <div className="border border-[#e5e5ea] rounded-xl p-3.5 bg-[#f8f9fa] space-y-2">
                  <h4 className="text-xs font-bold text-[#1c1c1e] flex items-center gap-1">
                    <QrCode size={14} className="text-[#b09168]" /> 2. 바코드 번호 직접 입력
                  </h4>
                  <p className="text-[11px] text-[#8e8e93]">예: *M091063684* 번호를 입력하시면 막대 바코드로 렌더링됩니다.</p>
                  
                  <div className="flex gap-2">
                    <input
                      type="text"
                      defaultValue={masterBarcode?.type === 'number' ? masterBarcode.value : '*M091063684*'}
                      id="master-barcode-num-input"
                      placeholder="예: *M091063684*"
                      className="form-input text-xs flex-1 py-2"
                    />
                    <button
                      onClick={() => {
                        const el = document.getElementById('master-barcode-num-input') as HTMLInputElement;
                        const val = el?.value?.trim();
                        if (val && onUpdateMasterBarcode) {
                          const formatted = val.startsWith('*') ? val : `*${val}*`;
                          onUpdateMasterBarcode({
                            type: 'number',
                            value: formatted,
                            updatedAt: new Date().toISOString().split('T')[0],
                          });
                        }
                      }}
                      className="gold-btn-outline px-3 py-2 text-xs font-bold rounded-xl shrink-0"
                    >
                      번호 저장
                    </button>
                  </div>
                </div>
              </div>

              {/* 현재 적용 중인 대표 바코드 미리보기 */}
              <div className="bg-[#f8f9fa] p-3 rounded-xl border border-[#e5e5ea] text-center space-y-1">
                <p className="text-[10px] font-bold text-[#8e8e93] pb-1">현재 이용자 출입 모달에 노출되는 바코드 미리보기</p>
                {masterBarcode?.type === 'image' ? (
                  <img
                    src={masterBarcode.value}
                    alt="등록된 대표 바코드 사진"
                    className="max-h-48 object-contain mx-auto rounded-lg border border-[#e5e5ea]"
                  />
                ) : (
                  <BarcodeView value={masterBarcode?.value || '*M091063684*'} height={75} />
                )}
              </div>
            </div>
            {/* 1. 관리자 고유 바코드 사전 등록 풀 (Pool) */}
            <div className="bg-white border border-[#e5e5ea] p-5 rounded-xl shadow-sm space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-sm font-bold text-[#1c1c1e] flex items-center gap-1.5">
                    <QrCode className="text-[#b09168]" size={18} /> 관리자 바코드 등록 풀 (Pool)
                  </h3>
                  <p className="text-xs text-[#8e8e93]">
                    이용자 예약 시 무작위 생성이 아닌, 아래 등록된 바코드(*M091063684* 규격)가 순서대로 발급됩니다.
                  </p>
                </div>
                <span className="text-xs font-bold text-[#b09168] bg-[#b09168]/10 px-2.5 py-1 rounded-full">
                  등록된 바코드: {adminBarcodes?.length || 0}개
                </span>
              </div>

              {/* 바코드 신규 등록 폼 */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newBarcodeInputValue}
                  onChange={(e) => setNewBarcodeInputValue(e.target.value)}
                  placeholder="등록할 바코드 입력 (예: *M091063684*)"
                  className="form-input flex-1 text-xs"
                />
                <button
                  onClick={() => {
                    if (!newBarcodeInputValue.trim()) return;
                    if (onAddAdminBarcode) {
                      onAddAdminBarcode(newBarcodeInputValue.trim());
                      setNewBarcodeInputValue(`*M091063${Math.floor(1000 + Math.random() * 9000)}*`);
                    }
                  }}
                  className="gold-btn px-4 py-2 text-xs font-bold rounded-xl shrink-0 flex items-center gap-1"
                >
                  <Plus size={14} /> 바코드 추가
                </button>
              </div>

              {/* 등록된 바코드 목록 가로 스크롤 카드 */}
              <div className="flex gap-2.5 overflow-x-auto pb-2 pt-1">
                {adminBarcodes?.map((item) => (
                  <div
                    key={item.id}
                    className={`min-w-[170px] p-2.5 rounded-xl border text-center space-y-1.5 shrink-0 relative ${
                      item.status === 'available'
                        ? 'bg-[#34c759]/5 border-[#34c759]/30'
                        : item.status === 'assigned'
                        ? 'bg-[#b09168]/5 border-[#b09168]/30'
                        : 'bg-[#8e8e93]/10 border-[#8e8e93]/30'
                    }`}
                  >
                    <div className="flex justify-between items-center text-[9px] font-bold">
                      <span
                        className={`px-1.5 py-0.5 rounded ${
                          item.status === 'available'
                            ? 'bg-[#34c759] text-white'
                            : item.status === 'assigned'
                            ? 'bg-[#b09168] text-white'
                            : 'bg-[#8e8e93] text-white'
                        }`}
                      >
                        {item.status === 'available' ? '사용 가능' : item.status === 'assigned' ? '이용자 할당' : '입장 완료'}
                      </span>
                      {onDeleteAdminBarcode && (
                        <button
                          onClick={() => onDeleteAdminBarcode(item.id)}
                          className="text-[#ff3b30] hover:opacity-80 p-0.5"
                          title="바코드 삭제"
                        >
                          &times;
                        </button>
                      )}
                    </div>

                    <div className="font-mono text-xs font-extrabold text-[#1c1c1e] pt-1">
                      {item.barcodeId}
                    </div>

                    <p className="text-[9px] text-[#8e8e93] truncate">
                      {item.assignedToUserName ? `${item.assignedToUserName}님 이용중` : '대기 중 (미발급)'}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* 2. 바코드 스캐너 실시간 검증 */}
            <div className="bg-white border border-[#e5e5ea] p-5 rounded-xl shadow-sm space-y-4">
              <div>
                <h3 className="text-sm font-bold text-[#1c1c1e] flex items-center gap-1.5">
                  <QrCode className="text-[#b09168]" size={18} /> 출입 바코드 실시간 스캔 검증 / 입장 처리 (Check-In)
                </h3>
                <p className="text-xs text-[#8e8e93]">이용자의 출입증 바코드 번호를 입력하여 입장을 승인/완료 처리합니다.</p>
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={scanBarcodeId}
                  onChange={(e) => setScanBarcodeId(e.target.value)}
                  placeholder="바코드 번호 입력 (예: *M091063684*)"
                  className="form-input flex-1 text-xs"
                />
                <button
                  onClick={() => {
                    const res = onVerifyBarcode(scanBarcodeId);
                    setScanResult(res);
                  }}
                  className="gold-btn px-4 py-2 text-xs font-bold rounded-xl shrink-0"
                >
                  입장 확인
                </button>
              </div>

              {scanResult && (
                <div
                  className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
                    scanResult.success
                      ? 'bg-[#34c759]/10 border border-[#34c759]/30 text-[#34c759]'
                      : 'bg-[#ff3b30]/10 border border-[#ff3b30]/30 text-[#ff3b30]'
                  }`}
                >
                  {scanResult.success ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                  {scanResult.message}
                </div>
              )}
            </div>

            {/* 3. 예약건별 바코드 현황 및 개별 변경 */}
            <div className="bg-white border border-[#e5e5ea] p-5 rounded-xl shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <h3 className="text-sm font-bold text-[#1c1c1e]">전체 예약 바코드 현황 ({filteredBarcodes.length}건)</h3>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <div className="relative flex-1 sm:w-48">
                    <Search size={14} className="absolute left-2.5 top-2.5 text-[#8e8e93]" />
                    <input
                      type="text"
                      value={barcodeSearchTerm}
                      onChange={(e) => setBarcodeSearchTerm(e.target.value)}
                      placeholder="바코드/이름 검색"
                      className="form-input text-xs pl-8 py-1.5"
                    />
                  </div>

                  <select
                    value={barcodeFilterStatus}
                    onChange={(e) => setBarcodeFilterStatus(e.target.value as any)}
                    className="form-input text-xs py-1.5 w-28"
                  >
                    <option value="all">전체 상태</option>
                    <option value="valid">사용 가능</option>
                    <option value="used">입장 완료</option>
                    <option value="cancelled">취소됨</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {filteredBarcodes.map((res) => {
                  const room = rooms.find((r) => r.id === res.roomId);
                  const isEditing = editingBarcodeResId === res.id;
                  return (
                    <div key={res.id} className="border border-[#e5e5ea] rounded-xl p-3.5 bg-[#f8f9fa] space-y-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="text-xs font-bold text-[#1c1c1e]">{res.userName}님</span>
                          <span className="text-[10px] text-[#8e8e93] ml-2">({room?.name})</span>
                        </div>
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                            res.barcodeStatus === 'valid'
                              ? 'bg-[#34c759]/10 text-[#34c759]'
                              : res.barcodeStatus === 'used'
                              ? 'bg-[#8e8e93]/10 text-[#8e8e93]'
                              : 'bg-[#ff3b30]/10 text-[#ff3b30]'
                          }`}
                        >
                          {res.barcodeStatus === 'valid'
                            ? '사용 가능'
                            : res.barcodeStatus === 'used'
                            ? '입장 완료'
                            : '취소됨'}
                        </span>
                      </div>

                      {/* 바코드 시각화 패널 */}
                      <BarcodeView value={res.barcodeId} height={60} showText={true} />

                      {/* 바코드 수동 변경 폼 */}
                      {isEditing ? (
                        <div className="flex gap-1.5 pt-1">
                          <input
                            type="text"
                            value={customBarcodeResInput}
                            onChange={(e) => setCustomBarcodeResInput(e.target.value)}
                            placeholder="변경할 바코드 번호"
                            className="form-input text-xs flex-1 py-1 px-2"
                          />
                          <button
                            onClick={() => {
                              if (customBarcodeResInput.trim() && onUpdateReservationBarcode) {
                                onUpdateReservationBarcode(res.id, customBarcodeResInput.trim());
                                setEditingBarcodeResId(null);
                              }
                            }}
                            className="bg-[#b09168] text-white text-[10px] font-bold px-2 py-1 rounded"
                          >
                            저장
                          </button>
                          <button
                            onClick={() => setEditingBarcodeResId(null)}
                            className="bg-[#e5e5ea] text-[#1c1c1e] text-[10px] px-2 py-1 rounded"
                          >
                            취소
                          </button>
                        </div>
                      ) : (
                        <div className="text-[10px] text-[#8e8e93] flex justify-between items-center pt-1">
                          <span>
                            {res.date} {res.startTime}~{res.endTime}
                          </span>
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                setEditingBarcodeResId(res.id);
                                setCustomBarcodeResInput(res.barcodeId);
                              }}
                              className="text-[#8e8e93] hover:text-[#1c1c1e] font-medium"
                            >
                              바코드 변경
                            </button>
                            <button
                              onClick={() => {
                                setScanBarcodeId(res.barcodeId);
                                const result = onVerifyBarcode(res.barcodeId);
                                setScanResult(result);
                              }}
                              className="text-[#b09168] hover:underline font-semibold"
                            >
                              바로 입장 처리
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: 계좌 및 환경 설정 */}
        {activeTab === 'bank_settings' && (
          <div className="bg-white border border-[#e5e5ea] rounded-xl p-5 space-y-4 shadow-sm max-w-lg">
            <div>
              <h3 className="text-base font-bold text-[#1c1c1e] flex items-center gap-1.5">
                <Landmark className="text-[#b09168]" size={18} /> 무통장 입금 계좌 정보 설정
              </h3>
              <p className="text-xs text-[#8e8e93] mt-1">
                사용자가 예약 시 '무통장 입금' 선택 화면에 노출될 수납 계좌 정보를 입력하고 저장합니다.
              </p>
            </div>

            {bankSaveMsg && (
              <div className="p-3 bg-[#34c759]/10 border border-[#34c759]/30 rounded-xl text-xs text-[#34c759] font-bold flex items-center gap-2">
                <Check size={14} /> 입금 계좌 정보가 성공적으로 변경되었습니다.
              </div>
            )}

            <form onSubmit={handleBankSave} className="space-y-4">
              <div className="form-group">
                <label className="text-xs font-bold text-[#1c1c1e]">은행명</label>
                <input
                  type="text"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="예: 신한은행"
                  className="form-input text-xs"
                  required
                />
              </div>

              <div className="form-group">
                <label className="text-xs font-bold text-[#1c1c1e]">계좌 번호</label>
                <input
                  type="text"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  placeholder="예: 110-384-918234"
                  className="form-input text-xs"
                  required
                />
              </div>

              <div className="form-group">
                <label className="text-xs font-bold text-[#1c1c1e]">예금주명</label>
                <input
                  type="text"
                  value={accountHolder}
                  onChange={(e) => setAccountHolder(e.target.value)}
                  placeholder="예: (주)르하임 여의도점"
                  className="form-input text-xs"
                  required
                />
              </div>

              <button type="submit" className="gold-btn w-full py-3 text-xs font-bold rounded-xl">
                계좌 정보 저장하기
              </button>
            </form>
          </div>
        )}
      </div>

      {/* 새 공부방 추가 모달 */}
      {showAddRoomModal && (
        <div className="modal-overlay" onClick={() => setShowAddRoomModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-bold text-[#1c1c1e]">새 공부방 추가</h3>
              <button onClick={() => setShowAddRoomModal(false)} className="text-[#8e8e93] text-xl">&times;</button>
            </div>
            <form onSubmit={handleAddRoomSubmit} className="space-y-3">
              <div className="form-group">
                <label className="text-xs font-bold">공부방 이름</label>
                <input
                  type="text"
                  required
                  placeholder="예: 스터디 존 D (8인실)"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  className="form-input text-xs"
                />
              </div>
              <div className="form-group">
                <label className="text-xs font-bold">수용 인원 (명)</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={capacity}
                  onChange={(e) => setCapacity(Math.max(1, Number(e.target.value)))}
                  className="form-input text-xs"
                />
              </div>
              <div className="form-group">
                <label className="text-xs font-bold">공부방 설명</label>
                <textarea
                  placeholder="시설 및 특징 설명을 입력해 주세요."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="form-input text-xs h-20 resize-none"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddRoomModal(false)}
                  className="gold-btn-outline flex-1 py-2.5 text-xs"
                >
                  취소
                </button>
                <button type="submit" className="gold-btn flex-1 py-2.5 text-xs">
                  추가하기
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 예약 수정 모달 */}
      {editingRes && (
        <div className="modal-overlay" onClick={() => setEditingRes(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-bold text-[#1c1c1e]">예약 일정 / 룸 변경</h3>
              <button onClick={() => setEditingRes(null)} className="text-[#8e8e93] text-xl">&times;</button>
            </div>

            {editError && (
              <div className="p-3 bg-[#ff3b30]/10 border border-[#ff3b30]/30 rounded-xl text-xs text-[#ff3b30] mb-3 flex items-center gap-1.5">
                <AlertCircle size={14} /> {editError}
              </div>
            )}

            <form onSubmit={handleEditSubmit} className="space-y-3">
              <div className="form-group">
                <label className="text-xs font-bold">공부방 변경</label>
                <select
                  value={editRoomId}
                  onChange={(e) => setEditRoomId(e.target.value)}
                  className="form-input text-xs"
                >
                  {rooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="text-xs font-bold">예약 날짜</label>
                <input
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="form-input text-xs"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="form-group">
                  <label className="text-xs font-bold">시작 시간</label>
                  <select
                    value={editStartTime}
                    onChange={(e) => setEditStartTime(e.target.value)}
                    className="form-input text-xs"
                  >
                    {TIME_OPTIONS.slice(0, -1).map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="text-xs font-bold">종료 시간</label>
                  <select
                    value={editEndTime}
                    onChange={(e) => setEditEndTime(e.target.value)}
                    className="form-input text-xs"
                  >
                    {TIME_OPTIONS.slice(1).map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="text-xs font-bold">예약자 이름</label>
                <input
                  type="text"
                  value={editUserName}
                  onChange={(e) => setEditUserName(e.target.value)}
                  className="form-input text-xs"
                  required
                />
              </div>

              <div className="form-group">
                <label className="text-xs font-bold">연락처</label>
                <input
                  type="text"
                  value={editUserPhone}
                  onChange={(e) => setEditUserPhone(e.target.value)}
                  className="form-input text-xs"
                  required
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingRes(null)}
                  className="gold-btn-outline flex-1 py-2.5 text-xs"
                >
                  취소
                </button>
                <button type="submit" className="gold-btn flex-1 py-2.5 text-xs">
                  변경 저장
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* 🏢 스터디룸 정보 수정 모달 */}
      {editingRoom && (
        <div className="modal-overlay" onClick={() => setEditingRoom(null)}>
          <div className="modal-content max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center pb-3 border-b border-[#e5e8eb]">
              <h3 className="text-base font-bold text-[#191f28] flex items-center gap-1.5">
                <Edit2 size={18} className="text-[#a67c48]" /> 스터디룸 정보 수정
              </h3>
              <button onClick={() => setEditingRoom(null)} className="text-[#8b95a1] hover:text-[#191f28] text-2xl">&times;</button>
            </div>

            <form onSubmit={handleSaveEditRoom} className="space-y-4 pt-3">
              <div className="form-group space-y-1">
                <label className="text-xs font-semibold text-[#191f28]">룸 이름</label>
                <input
                  type="text"
                  required
                  value={editRoomName}
                  onChange={(e) => setEditRoomName(e.target.value)}
                  placeholder="예: 스터디 존 A (4인실)"
                  className="form-input text-xs py-2 px-3 rounded-xl w-full border border-[#e5e8eb] focus:border-[#a67c48] outline-none"
                />
              </div>

              <div className="form-group space-y-1">
                <label className="text-xs font-semibold text-[#191f28]">수용 정원 (명)</label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  required
                  value={editRoomCapacity}
                  onChange={(e) => setEditRoomCapacity(parseInt(e.target.value, 10) || 1)}
                  className="form-input text-xs py-2 px-3 rounded-xl w-full border border-[#e5e8eb] focus:border-[#a67c48] outline-none"
                />
              </div>

              <div className="form-group space-y-1">
                <label className="text-xs font-semibold text-[#191f28]">설명 및 편의시설</label>
                <textarea
                  rows={3}
                  value={editRoomDescription}
                  onChange={(e) => setEditRoomDescription(e.target.value)}
                  placeholder="예: 조명, 화이트보드, 콘센트 완비"
                  className="form-input text-xs py-2 px-3 rounded-xl w-full border border-[#e5e8eb] focus:border-[#a67c48] outline-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingRoom(null)}
                  className="gold-btn-outline flex-1 py-3 text-xs font-bold rounded-xl"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="gold-btn flex-1 py-3 text-xs font-bold rounded-xl shadow flex items-center justify-center gap-1"
                >
                  <Check size={14} /> 수정 완료
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
