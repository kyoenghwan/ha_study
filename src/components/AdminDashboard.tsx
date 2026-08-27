import type { RoleCode, RoleGrant } from '../atoms/auth/DA_auth';
import React, { useState } from 'react';
import type { Room, Reservation, BankInfo, PaymentMethod, AdminBarcodeItem, MasterBarcode, UserAccount, PointTransaction, Branch, PointTransferRequest } from '../types';
import { 
  Plus, Trash2, Calendar, Edit2, CheckCircle2, AlertCircle, 
  CreditCard, BarChart3, QrCode, Settings, Check, Search, Coins, Landmark, CalendarRange, Camera, Upload, Users, ArrowLeftRight, ReceiptText, RotateCcw, Bell, Send, Volume2, MessageSquare, CheckCheck 
} from 'lucide-react';
import type { NotificationSettings } from '../lib/notificationService';
import { DEFAULT_NOTIFICATION_SETTINGS, OFFICIAL_TELEGRAM_BOT_TOKEN, playNotificationSound, sendTelegramMessage, requestNotificationPermission } from '../lib/notificationService';
import { BarcodeView } from './BarcodeView';

interface AdminDashboardProps {
  currentUser?: UserAccount | null;
  rooms: Room[];
  reservations: Reservation[];
  bankInfo: BankInfo;
  notificationSettings?: NotificationSettings;
  onUpdateNotificationSettings?: (settings: NotificationSettings) => void;
  onUpdateUserProfile?: (userId: string, data: { name: string; phone: string; password?: string }) => Promise<{ success: boolean; message?: string }>;
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
  branches?: Branch[];
  onCreateBranch?: (newBranch: Branch) => boolean;
  onEditBranch?: (branchId: string, updated: Omit<Branch, 'id'>) => void;
  onDeleteBranch?: (branchId: string) => void;
  isSuperAdmin?: boolean;
  selectedBranchId?: string;
  getBranchPoints?: (user: UserAccount | null, bId: string) => number;
  pointTransferRequests?: PointTransferRequest[];
  onApprovePointTransfer?: (reqId: string) => void;
  onRejectPointTransfer?: (reqId: string) => void;
  onCreateBranchAdmin?: (data: {
    branchIds: string[];
    roleCode: RoleCode;
    userId: string;
    name: string;
    phone: string;
    password?: string;
  }) => boolean;
}

type TabType = 'rooms_reservations' | 'long_term_bulk' | 'point_management' | 'point_usage_history' | 'user_management' | 'branches_management' | 'revenue_analytics' | 'barcode_management' | 'bank_settings';

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
  currentUser,
  rooms,
  reservations,
  bankInfo,
  notificationSettings = DEFAULT_NOTIFICATION_SETTINGS,
  onUpdateNotificationSettings,
  onUpdateUserProfile,
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
  userGrants: _userGrants = {},
  canManageRole: _canManageRole,
  onGrantRole: _onGrantRole,
  onRevokeRole: _onRevokeRole,
  onCreateBranchAdmin,
  branches = [],
  onCreateBranch,
  onEditBranch,
  onDeleteBranch,
  isSuperAdmin = true,
  selectedBranchId = 'yeouido',
  getBranchPoints,
  pointTransferRequests = [],
  onApprovePointTransfer,
  onRejectPointTransfer,
}) => {
  const [pointTabSubMode, setPointTabSubMode] = useState<'charge' | 'transfer'>('charge');
  // 📋 포인트 사용 내역 독립 탭 검색 & 필터 상태
  const [usageSearchQuery, setUsageSearchQuery] = useState('');
  const [usageTypeFilter, setUsageTypeFilter] = useState<'all' | 'use' | 'refund'>('all');
  const [usageBranchFilter, setUsageBranchFilter] = useState<string>('all');
  const [usageDateFilter, setUsageDateFilter] = useState<string>('');
  // 🏢 지점 등록 / 수정 모달 상태
  const [showCreateBranchModal, setShowCreateBranchModal] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [branchInputId, setBranchInputId] = useState('');
  const [branchInputName, setBranchInputName] = useState('');
  const [branchInputFullName, setBranchInputFullName] = useState('');
  const [branchInputAddress, setBranchInputAddress] = useState('');
  // 🏢 지점 관리자 등록 모달 상태 (기존 회원 선택 / 신규 생성 듀얼 모드)
  const [showCreateAdminModal, setShowCreateAdminModal] = useState(false);
  const [adminRegMode, setAdminRegMode] = useState<'existing' | 'new'>('existing');
  const [selectedExistingUserId, setSelectedExistingUserId] = useState('');
  const [adminUserSearchQuery, setAdminUserSearchQuery] = useState('');
  const [newAdminBranchIds, setNewAdminBranchIds] = useState<string[]>(() => branches.length > 0 ? [branches[0].id] : ['yeouido']);
  const [newAdminRoleCode, setNewAdminRoleCode] = useState<RoleCode>('BRANCH_ADMIN');
  const [newAdminUserId, setNewAdminUserId] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('1234');
  const [newAdminName, setNewAdminName] = useState('');
  const [newAdminPhone, setNewAdminPhone] = useState('');

  // 특정 회원을 지점 관리자로 지정하는 헬퍼
  const handleOpenAssignAdminModal = (user?: UserAccount) => {
    setAdminUserSearchQuery('');
    if (user) {
      setAdminRegMode('existing');
      setSelectedExistingUserId(user.id);
      setNewAdminUserId(user.userId);
      setNewAdminName(user.name);
      setNewAdminPhone(user.phone);
      setNewAdminPassword(user.password || '1234');
      if (user.userId === 'admin' || user.isSuperAdmin) {
        setNewAdminRoleCode('PLATFORM_ADMIN');
      } else if (user.branchIds && user.branchIds.length > 0) {
        setNewAdminRoleCode('BRANCH_ADMIN');
      } else {
        setNewAdminRoleCode('BRANCH_ADMIN');
      }
      setNewAdminBranchIds(user.branchIds && user.branchIds.length > 0 ? user.branchIds : (branches.length > 0 ? [branches[0].id] : ['yeouido']));
    } else {
      setAdminRegMode('existing');
      if (users.length > 0) {
        const firstUser = users[0];
        setSelectedExistingUserId(firstUser.id);
        setNewAdminUserId(firstUser.userId);
        setNewAdminName(firstUser.name);
        setNewAdminPhone(firstUser.phone);
        setNewAdminPassword(firstUser.password || '1234');
        setNewAdminBranchIds(firstUser.branchIds && firstUser.branchIds.length > 0 ? firstUser.branchIds : (branches.length > 0 ? [branches[0].id] : ['yeouido']));
      }
    }
    setShowCreateAdminModal(true);
  };
  const [activeTab, setActiveTab] = useState<TabType>('rooms_reservations');
  // 👑 현재 로그인 관리자의 권한 등급 분석
  const currentAdminRole: 'PLATFORM_ADMIN' | 'BRANCH_OWNER' | 'BRANCH_ADMIN' | 'STAFF' = React.useMemo(() => {
    if (isSuperAdmin || currentUser?.userId === 'admin' || currentUser?.isSuperAdmin) {
      return 'PLATFORM_ADMIN';
    }
    if (currentUser?.adminRoleCode) {
      return currentUser.adminRoleCode as any;
    }
    return 'BRANCH_ADMIN';
  }, [isSuperAdmin, currentUser]);

  // 탭별 접근 권한 매트릭스 검사 함수 (모든 관리자에게 지점 운영 및 관리자 설정 탭 접근 허용)
  const canAccessTab = (tab: TabType): boolean => {
    // 1. 최고 관리자 (PLATFORM_ADMIN): 모든 탭 접근 가능
    if (currentAdminRole === 'PLATFORM_ADMIN') return true;

    // 2. 지점 관리자 / 점주: 본사 전용인 지점(점포) 관리 탭만 제외하고 모두 접근 가능
    if (currentAdminRole === 'BRANCH_ADMIN' || currentAdminRole === 'BRANCH_OWNER') {
      return tab !== 'branches_management';
    }

    // 3. 지점 직원 / 매니저 (STAFF): 실무 관련 탭 + 관리자 설정 접근 가능
    if (currentAdminRole === 'STAFF') {
      return tab === 'rooms_reservations' || tab === 'point_management' || tab === 'point_usage_history' || tab === 'barcode_management' || tab === 'bank_settings';
    }

    return true;
  };

  // 현재 활성화된 탭이 권한이 없는 탭이면 자동으로 첫 번째 허용 탭으로 이동
  React.useEffect(() => {
    if (!canAccessTab(activeTab)) {
      setActiveTab('rooms_reservations');
    }
  }, [activeTab, currentAdminRole]);

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

  // 3단계 직관적 권한 체계 (Super Admin, Branch Admin, Regular User)
  const [_pendingRoleUserId] = useState<string | null>(null);

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
  // 👤 관리자 본인 정보 수정 상태
  const [adminProfileName, setAdminProfileName] = useState(currentUser?.name || '');
  const [adminProfilePhone, setAdminProfilePhone] = useState(currentUser?.phone || '');
  const [adminProfilePassword, setAdminProfilePassword] = useState('');
  const [adminProfileSaveMsg, setAdminProfileSaveMsg] = useState(false);
  const [adminProfileErrorMsg, setAdminProfileErrorMsg] = useState('');
  // 🔔 알림 설정 로컬 상태
  const [notifSoundEnabled, setNotifSoundEnabled] = useState(notificationSettings.soundEnabled);
  const [notifTelegramEnabled, setNotifTelegramEnabled] = useState(notificationSettings.telegramEnabled);

  const [notifChatId, setNotifChatId] = useState(notificationSettings.telegramChatId);
  const [notifSaveMsg, setNotifSaveMsg] = useState(false);
  const [notifTesting, setNotifTesting] = useState(false);
  const [notifTestResult, setNotifTestResult] = useState<{ success: boolean; message: string } | null>(null);

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
            {/* 관리자 탭 서브 네비게이션 (권한 등급별 접근 권한에 따라 동적 필터링) */}
      <div className="bg-[#ffffff] border-b border-[#e5e8eb] px-4 pt-2.5 flex gap-1 overflow-x-auto shrink-0 shadow-sm">
        {canAccessTab('rooms_reservations') && (
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
        )}

        {canAccessTab('long_term_bulk') && (
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
        )}

        {canAccessTab('point_management') && (
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
        )}

        {canAccessTab('point_usage_history') && (
          <button
            onClick={() => setActiveTab('point_usage_history')}
            className={`px-3.5 py-3 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-all whitespace-nowrap ${
              activeTab === 'point_usage_history'
                ? 'border-[#a67c48] text-[#a67c48]'
                : 'border-transparent text-[#8b95a1] hover:text-[#191f28]'
            }`}
          >
            <ReceiptText size={15} /> 포인트 사용/차감 내역
          </button>
        )}

        {canAccessTab('user_management') && (
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
        )}

        {canAccessTab('branches_management') && (
          <button
            onClick={() => setActiveTab('branches_management')}
            className={`px-3.5 py-3 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-all whitespace-nowrap ${
              activeTab === 'branches_management'
                ? 'border-[#a67c48] text-[#a67c48]'
                : 'border-transparent text-[#8b95a1] hover:text-[#191f28]'
            }`}
          >
            <Landmark size={15} /> 지점(점포) 관리
          </button>
        )}

        {canAccessTab('revenue_analytics') && (
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
        )}

        {canAccessTab('barcode_management') && (
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
        )}

        {canAccessTab('bank_settings') && (
          <button
            onClick={() => setActiveTab('bank_settings')}
            className={`px-3.5 py-3 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-all whitespace-nowrap ${
              activeTab === 'bank_settings'
                ? 'border-[#a67c48] text-[#a67c48]'
                : 'border-transparent text-[#8b95a1] hover:text-[#191f28]'
            }`}
          >
            <Settings size={15} /> 지점 운영 및 관리자 설정
          </button>
        )}
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

                {/* TAB 3: 포인트 충전 승인 & 지점 간 이전 관제 */}
        {activeTab === 'point_management' && (
          <div className="space-y-6">
            {/* 1. 최상단: 포인트 충전 승인 & 지점 간 이전 관제 (가장 중요한 핵심 승인 업무) */}
            <div className="bg-white border border-[#e5e8eb] p-5 rounded-2xl shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                  <h3 className="text-base font-bold text-[#191f28] flex items-center gap-2">
                    <Coins className="text-[#a67c48]" size={20} /> 포인트 충전 승인 & 지점 간 이전 관제
                  </h3>
                  <p className="text-xs text-[#8b95a1] mt-1 leading-relaxed">
                    회원들의 무통장 입금 충전 승인 및 지점 간 포인트 이전 요청을 관리자가 검토하고 최종 승인합니다.
                  </p>
                </div>

                {/* 충전 승인 vs 이전 승인 서브 탭 토글 */}
                <div className="flex bg-[#f1f3f5] p-1 rounded-xl shrink-0 text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setPointTabSubMode('charge')}
                    className={`px-3 py-1.5 rounded-lg transition-all ${
                      pointTabSubMode === 'charge' ? 'bg-white text-[#a67c48] shadow-sm' : 'text-[#8b95a1] hover:text-[#191f28]'
                    }`}
                  >
                    무통장 충전 승인 ({pointTransactions.filter(t => (t.type === 'charge_request' || !t.type) && t.status === 'pending').length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setPointTabSubMode('transfer')}
                    className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 ${
                      pointTabSubMode === 'transfer' ? 'bg-white text-[#a67c48] shadow-sm' : 'text-[#8b95a1] hover:text-[#191f28]'
                    }`}
                  >
                    <ArrowLeftRight size={13} /> 지점 간 이전 승인 ({pointTransferRequests.filter(r => r.status === 'pending').length})
                  </button>
                </div>
              </div>

              {/* 🔄 지점 간 포인트 이전 승인 관제 섹션 */}
              {pointTabSubMode === 'transfer' ? (
                <div className="space-y-4">
                  <div className="bg-[#f8f9fc] p-3.5 rounded-2xl border border-[#e5e8eb] text-xs text-[#4e5968] flex items-center justify-between">
                    <span className="font-semibold text-[#191f28]">
                      🔄 이전 대기 중: <strong className="text-[#a67c48] font-bold">{pointTransferRequests.filter(r => r.status === 'pending').length}건</strong>
                    </span>
                    <span className="text-[11px] text-[#8b95a1]">승인 시 출발 지점 포인트가 차감되고 도착 지점으로 즉시 적립됩니다.</span>
                  </div>

                  <div className="overflow-x-auto border border-[#e5e8eb] rounded-xl">
                    <table className="w-full text-left text-xs min-w-[650px]">
                      <thead className="bg-[#f8f9fc] border-b border-[#e5e8eb] text-[#191f28]">
                        <tr>
                          <th className="p-3">신청 일시</th>
                          <th className="p-3">신청 회원</th>
                          <th className="p-3">이전 경로 (출발 ➔ 도착)</th>
                          <th className="p-3">이전 금액</th>
                          <th className="p-3">이전 사유</th>
                          <th className="p-3">상태</th>
                          <th className="p-3 text-center">관리 조치</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#e5e8eb]">
                        {pointTransferRequests.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="p-8 text-center text-[#8b95a1]">
                              지점 간 포인트 이전 신청 내역이 없습니다.
                            </td>
                          </tr>
                        ) : (
                          pointTransferRequests.map((req) => {
                            const fromBranchName = branches.find((b) => b.id === req.fromBranchId)?.fullName || req.fromBranchId;
                            const toBranchName = branches.find((b) => b.id === req.toBranchId)?.fullName || req.toBranchId;

                            return (
                              <tr key={req.id} className="hover:bg-[#f8f9fc]">
                                <td className="p-3 text-[#8b95a1] font-mono">{(req.createdAt || '').split('T')[0] || '-'}</td>
                                <td className="p-3 font-bold text-[#191f28]">
                                  {req.userName} <span className="text-[10px] text-[#8b95a1] font-normal">({req.userId})</span>
                                </td>
                                <td className="p-3 font-semibold text-[#191f28]">
                                  <span className="text-[#a67c48] font-bold">[{fromBranchName}]</span>
                                  <span className="mx-1 text-[#8b95a1]">➔</span>
                                  <span className="text-[#007aff] font-bold">[{toBranchName}]</span>
                                </td>
                                <td className="p-3 font-extrabold text-sm text-[#191f28]">
                                  {req.amount.toLocaleString()} P
                                </td>
                                <td className="p-3 text-[#4e5968] max-w-[180px] truncate">{req.reason || '-'}</td>
                                <td className="p-3 font-bold">
                                  {req.status === 'pending' && <span className="text-[#f59e0b] bg-[#f59e0b]/10 px-2 py-0.5 rounded">승인대기</span>}
                                  {req.status === 'approved' && <span className="text-[#28a745] bg-[#28a745]/10 px-2 py-0.5 rounded">이전완료</span>}
                                  {req.status === 'rejected' && <span className="text-[#e93d3d] bg-[#e93d3d]/10 px-2 py-0.5 rounded">반려됨</span>}
                                </td>
                                <td className="p-3 text-center">
                                  {req.status === 'pending' ? (
                                    <div className="flex justify-center gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() => onApprovePointTransfer && onApprovePointTransfer(req.id)}
                                        className="gold-btn py-1 px-2.5 text-[11px] font-bold rounded-lg shadow-sm"
                                      >
                                        이전 승인
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => onRejectPointTransfer && onRejectPointTransfer(req.id)}
                                        className="bg-[#e93d3d]/10 text-[#e93d3d] hover:bg-[#e93d3d]/20 border border-[#e93d3d]/30 py-1 px-2.5 text-[11px] font-bold rounded-lg"
                                      >
                                        반려
                                      </button>
                                    </div>
                                  ) : (
                                    <span className="text-[10px] text-[#8b95a1]">처리 완료</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                /* 💳 무통장 입금 충전 승인 섹션 (충전 신청 및 승인 건만 집중 표시) */
                <div className="space-y-4">
                  {(() => {
                    const chargeTransactions = pointTransactions.filter(
                      (t) => t.type === 'charge_request' || t.type === 'charge_approved' || !t.type
                    );

                    return (
                      <>
                        <div className="bg-[#f8f9fc] p-3.5 rounded-2xl border border-[#e5e8eb] text-xs text-[#4e5968] flex items-center justify-between">
                          <span className="font-semibold text-[#191f28]">
                            💳 충전 승인 대기: <strong className="text-[#a67c48] font-bold">{chargeTransactions.filter(t => t.status === 'pending').length}건</strong>
                          </span>
                          <span className="text-[11px] text-[#8b95a1]">회원이 입금 후 충전 신청한 내역을 확인하고 승인합니다.</span>
                        </div>

                        {/* 모바일 뷰 */}
                        <div className="block md:hidden space-y-3">
                          {chargeTransactions.length === 0 ? (
                            <div className="p-8 text-center text-xs text-[#8b95a1] bg-[#f8f9fc] rounded-2xl border border-dashed border-[#e5e8eb]">
                              포인트 충전 신청 내역이 없습니다.
                            </div>
                          ) : (
                            chargeTransactions.map((tx) => (
                              <div key={tx.id} className="border border-[#e5e8eb] rounded-2xl p-4 bg-[#ffffff] shadow-sm space-y-3">
                                <div className="flex justify-between items-start">
                                  <div>
                                    <span className="text-sm font-bold text-[#191f28]">{tx.userName}</span>
                                    <span className="text-xs text-[#8b95a1] ml-1.5">({tx.userId})</span>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    {tx.status === 'pending' && (
                                      <span className="text-[10px] font-bold bg-[#f59e0b]/10 text-[#f59e0b] px-2 py-0.5 rounded-full animate-pulse">
                                        ● 입금 대기
                                      </span>
                                    )}
                                    {tx.status === 'completed' && (
                                      <span className="text-[10px] font-bold bg-[#28a745]/10 text-[#28a745] px-2 py-0.5 rounded-full">
                                        충전 완료
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <div className="flex justify-between items-center bg-[#f8f9fc] p-3 rounded-xl border border-[#e5e8eb]">
                                  <p className="text-xs font-medium text-[#4e5968]">{tx.description}</p>
                                  <span className="text-base font-extrabold text-[#191f28] shrink-0 pl-2">
                                    {tx.amount.toLocaleString()} P
                                  </span>
                                </div>

                                <div className="flex justify-between items-center pt-2 border-t border-[#f1f3f5] text-xs">
                                  <span className="text-[#8b95a1] font-mono text-[11px]">
                                    {(tx.createdAt || '').split('T')[0] || '-'}
                                  </span>
                                  {tx.status === 'pending' && onApprovePointCharge && (
                                    <button
                                      onClick={() => onApprovePointCharge(tx.id)}
                                      className="gold-btn py-1.5 px-3 text-xs font-bold rounded-lg shadow-sm"
                                    >
                                      입금 확인 & 즉시 승인
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))
                          )}
                        </div>

                        {/* 데스크톱 테이블 */}
                        <div className="hidden md:block overflow-x-auto border border-[#e5e8eb] rounded-xl">
                          <table className="w-full text-left text-xs min-w-[650px]">
                            <thead className="bg-[#f8f9fc] border-b border-[#e5e8eb] text-[#191f28]">
                              <tr>
                                <th className="p-3">신청 일시</th>
                                <th className="p-3">회원명 (아이디)</th>
                                <th className="p-3">신청 금액</th>
                                <th className="p-3">입금 확인 메모</th>
                                <th className="p-3">상태</th>
                                <th className="p-3 text-center">관리 조치</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#e5e8eb]">
                              {chargeTransactions.length === 0 ? (
                                <tr>
                                  <td colSpan={6} className="p-8 text-center text-[#8b95a1]">
                                    포인트 충전 신청 내역이 없습니다.
                                  </td>
                                </tr>
                              ) : (
                                chargeTransactions.map((tx) => (
                                  <tr key={tx.id} className="hover:bg-[#f8f9fc]">
                                    <td className="p-3 text-[#8b95a1] font-mono">{(tx.createdAt || '').split('T')[0] || '-'}</td>
                                    <td className="p-3 font-bold text-[#191f28]">
                                      {tx.userName} <span className="text-[10px] text-[#8b95a1] font-normal">({tx.userId})</span>
                                    </td>
                                    <td className="p-3 font-extrabold text-sm text-[#191f28]">
                                      {tx.amount.toLocaleString()} P
                                    </td>
                                    <td className="p-3 text-[#4e5968] max-w-[240px] truncate">{tx.description}</td>
                                    <td className="p-3 font-bold">
                                      {tx.status === 'pending' && <span className="text-[#f59e0b] bg-[#f59e0b]/10 px-2 py-0.5 rounded">입금대기</span>}
                                      {tx.status === 'completed' && <span className="text-[#28a745] bg-[#28a745]/10 px-2 py-0.5 rounded">충전완료</span>}
                                    </td>
                                    <td className="p-3 text-center">
                                      {tx.status === 'pending' && onApprovePointCharge ? (
                                        <button
                                          onClick={() => onApprovePointCharge(tx.id)}
                                          className="gold-btn py-1.5 px-3 text-[11px] font-bold rounded-lg shadow-sm"
                                        >
                                          입금확인 & 승인
                                        </button>
                                      ) : (
                                        <span className="text-[10px] text-[#8b95a1]">완료됨</span>
                                      )}
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}
            </div>

          </div>
        )}

        {/* TAB 4: 📋 포인트 사용/차감 내역 (독립 검색 & 상세 필터 지원 메뉴) */}
        {activeTab === 'point_usage_history' && (
          <div className="space-y-6">
            <div className="bg-white border border-[#e5e8eb] p-5 rounded-2xl shadow-sm space-y-5">
              {/* 헤더 타이틀 */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-[#e5e8eb]">
                <div>
                  <h3 className="text-base font-bold text-[#191f28] flex items-center gap-2">
                    <ReceiptText className="text-[#a67c48]" size={20} /> 회원 포인트 사용 및 차감 내역 관제
                  </h3>
                  <p className="text-xs text-[#8b95a1] mt-1 leading-relaxed">
                    회원들이 스터디룸 예약 시 자동으로 결제/차감되거나 취소 환불된 전체 포인트 이용 이력을 실시간으로 검색하고 조회합니다.
                  </p>
                </div>
              </div>

              {/* 🔍 실시간 검색 및 다각도 필터 바 */}
              <div className="bg-[#f8f9fc] p-4 rounded-2xl border border-[#e5e8eb] space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {/* 1. 회원명 / 아이디 / 메모 검색 */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-[#4e5968] flex items-center gap-1">
                      <Search size={12} className="text-[#a67c48]" /> 회원 및 내역 검색
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={usageSearchQuery}
                        onChange={(e) => setUsageSearchQuery(e.target.value)}
                        placeholder="회원명, 아이디, 방이름, 사유 검색..."
                        className="form-input text-xs py-2 px-3 rounded-xl w-full border border-[#e5e8eb] bg-white focus:border-[#a67c48]"
                      />
                      {usageSearchQuery && (
                        <button
                          type="button"
                          onClick={() => setUsageSearchQuery('')}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8b95a1] hover:text-[#191f28] text-xs font-bold"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>

                  {/* 2. 구분 필터 (전체 / 차감 / 환불) */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-[#4e5968]">이용 구분</label>
                    <select
                      value={usageTypeFilter}
                      onChange={(e) => setUsageTypeFilter(e.target.value as any)}
                      className="form-input text-xs py-2 px-3 rounded-xl w-full border border-[#e5e8eb] bg-white focus:border-[#a67c48] font-medium"
                    >
                      <option value="all">전체 (차감 및 환불)</option>
                      <option value="use">💸 포인트 사용 차감</option>
                      <option value="refund">🔄 포인트 환불</option>
                    </select>
                  </div>

                  {/* 3. 지점 필터 */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-[#4e5968]">대상 지점</label>
                    <select
                      value={usageBranchFilter}
                      onChange={(e) => setUsageBranchFilter(e.target.value)}
                      className="form-input text-xs py-2 px-3 rounded-xl w-full border border-[#e5e8eb] bg-white focus:border-[#a67c48] font-medium"
                    >
                      <option value="all">전체 지점</option>
                      {branches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.fullName || b.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* 4. 날짜 필터 & 초기화 */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <label className="text-[11px] font-bold text-[#4e5968]">이용 일자</label>
                      {(usageSearchQuery || usageTypeFilter !== 'all' || usageBranchFilter !== 'all' || usageDateFilter) && (
                        <button
                          type="button"
                          onClick={() => {
                            setUsageSearchQuery('');
                            setUsageTypeFilter('all');
                            setUsageBranchFilter('all');
                            setUsageDateFilter('');
                          }}
                          className="text-[10px] text-[#e93d3d] hover:underline flex items-center gap-0.5 font-bold"
                        >
                          <RotateCcw size={10} /> 필터 초기화
                        </button>
                      )}
                    </div>
                    <input
                      type="date"
                      value={usageDateFilter}
                      onChange={(e) => setUsageDateFilter(e.target.value)}
                      className="form-input text-xs py-1.5 px-3 rounded-xl w-full border border-[#e5e8eb] bg-white focus:border-[#a67c48]"
                    />
                  </div>
                </div>
              </div>

              {/* 📊 검색 결과 KPI 통계 요약 카드 */}
              {(() => {
                const filteredUsage = pointTransactions
                  .filter((t) => t.type === 'use' || t.type === 'refund')
                  .filter((t) => {
                    // 1. 텍스트 검색 (회원명, 아이디, 설명)
                    if (usageSearchQuery.trim()) {
                      const q = usageSearchQuery.toLowerCase();
                      const matchName = t.userName?.toLowerCase().includes(q);
                      const matchId = t.userId?.toLowerCase().includes(q);
                      const matchDesc = t.description?.toLowerCase().includes(q);
                      if (!matchName && !matchId && !matchDesc) return false;
                    }
                    // 2. 구분 필터
                    if (usageTypeFilter !== 'all' && t.type !== usageTypeFilter) {
                      return false;
                    }
                    // 3. 지점 필터
                    if (usageBranchFilter !== 'all' && t.branchId && t.branchId !== usageBranchFilter) {
                      return false;
                    }
                    // 4. 날짜 필터
                    if (usageDateFilter) {
                      const txDate = (t.createdAt || '').split('T')[0];
                      if (txDate !== usageDateFilter) return false;
                    }
                    return true;
                  });

                const totalUsedPoints = filteredUsage
                  .filter((t) => t.type === 'use')
                  .reduce((acc, cur) => acc + cur.amount, 0);

                const totalRefundPoints = filteredUsage
                  .filter((t) => t.type === 'refund')
                  .reduce((acc, cur) => acc + cur.amount, 0);

                return (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="bg-[#ffffff] p-3.5 rounded-xl border border-[#e5e8eb] flex justify-between items-center shadow-xs">
                        <div>
                          <p className="text-[11px] font-bold text-[#8b95a1]">검색된 내역 수</p>
                          <p className="text-lg font-black text-[#191f28] mt-0.5">{filteredUsage.length}건</p>
                        </div>
                        <span className="p-2 rounded-xl bg-[#f1f3f5] text-[#191f28]">
                          <ReceiptText size={18} />
                        </span>
                      </div>

                      <div className="bg-[#ffffff] p-3.5 rounded-xl border border-[#e5e8eb] flex justify-between items-center shadow-xs">
                        <div>
                          <p className="text-[11px] font-bold text-[#8b95a1]">총 차감(사용) 금액</p>
                          <p className="text-lg font-black text-[#e93d3d] mt-0.5">-{totalUsedPoints.toLocaleString()} P</p>
                        </div>
                        <span className="p-2 rounded-xl bg-[#e93d3d]/10 text-[#e93d3d]">
                          <Coins size={18} />
                        </span>
                      </div>

                      <div className="bg-[#ffffff] p-3.5 rounded-xl border border-[#e5e8eb] flex justify-between items-center shadow-xs">
                        <div>
                          <p className="text-[11px] font-bold text-[#8b95a1]">총 환불 금액</p>
                          <p className="text-lg font-black text-[#28a745] mt-0.5">+{totalRefundPoints.toLocaleString()} P</p>
                        </div>
                        <span className="p-2 rounded-xl bg-[#28a745]/10 text-[#28a745]">
                          <RotateCcw size={18} />
                        </span>
                      </div>
                    </div>

                    {/* 모바일 전용 카드 뷰 */}
                    <div className="block md:hidden space-y-3">
                      {filteredUsage.length === 0 ? (
                        <div className="p-10 text-center text-xs text-[#8b95a1] bg-[#f8f9fc] rounded-2xl border border-dashed border-[#e5e8eb]">
                          검색 조건과 일치하는 포인트 사용/차감 내역이 없습니다.
                        </div>
                      ) : (
                        filteredUsage.map((tx) => (
                          <div key={tx.id} className="border border-[#e5e8eb] rounded-2xl p-4 bg-[#ffffff] shadow-sm space-y-2.5">
                            <div className="flex justify-between items-start">
                              <div>
                                <span className="text-sm font-bold text-[#191f28]">{tx.userName}</span>
                                <span className="text-xs text-[#8b95a1] ml-1.5 font-mono">({tx.userId})</span>
                              </div>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                tx.type === 'refund' ? 'bg-[#28a745]/10 text-[#28a745]' : 'bg-[#f59e0b]/10 text-[#f59e0b]'
                              }`}>
                                {tx.type === 'refund' ? '포인트 환불' : '포인트 차감'}
                              </span>
                            </div>

                            <div className="flex justify-between items-center bg-[#f8f9fc] p-3 rounded-xl border border-[#e5e8eb]">
                              <p className="text-xs font-medium text-[#4e5968] pr-2">{tx.description}</p>
                              <span className={`text-base font-extrabold shrink-0 ${
                                tx.type === 'refund' ? 'text-[#28a745]' : 'text-[#191f28]'
                              }`}>
                                {tx.type === 'refund' ? `+${tx.amount.toLocaleString()}` : `-${tx.amount.toLocaleString()}`} P
                              </span>
                            </div>

                            <div className="flex justify-between items-center pt-1.5 text-xs text-[#8b95a1]">
                              <span className="font-mono text-[11px]">{(tx.createdAt || '').split('T')[0] || '-'}</span>
                              <span className="text-[10px] font-semibold text-[#a67c48]">
                                {tx.branchId ? (branches.find(b => b.id === tx.branchId)?.name || tx.branchId) : '공통'}
                              </span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    {/* 데스크톱 전용 테이블 */}
                    <div className="hidden md:block overflow-x-auto border border-[#e5e8eb] rounded-2xl">
                      <table className="w-full text-left text-xs min-w-[700px]">
                        <thead className="bg-[#f8f9fc] border-b border-[#e5e8eb] text-[#191f28]">
                          <tr>
                            <th className="p-3.5">일시</th>
                            <th className="p-3.5">회원명 (아이디)</th>
                            <th className="p-3.5">구분</th>
                            <th className="p-3.5">이용 지점</th>
                            <th className="p-3.5">차감/환불 금액</th>
                            <th className="p-3.5">상세 내용 / 사유</th>
                            <th className="p-3.5">상태</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#e5e8eb]">
                          {filteredUsage.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="p-12 text-center text-xs text-[#8b95a1]">
                                검색 조건과 일치하는 포인트 사용/차감 내역이 없습니다.
                              </td>
                            </tr>
                          ) : (
                            filteredUsage.map((tx) => {
                              const branchName = tx.branchId ? (branches.find(b => b.id === tx.branchId)?.fullName || tx.branchId) : '-';
                              return (
                                <tr key={tx.id} className="hover:bg-[#f8f9fc] transition-colors">
                                  <td className="p-3.5 text-[#8b95a1] font-mono whitespace-nowrap">
                                    {(tx.createdAt || '').split('T')[0] || '-'}
                                  </td>
                                  <td className="p-3.5 font-bold text-[#191f28] whitespace-nowrap">
                                    {tx.userName} <span className="text-[10px] text-[#8b95a1] font-normal font-mono">({tx.userId})</span>
                                  </td>
                                  <td className="p-3.5 font-bold whitespace-nowrap">
                                    {tx.type === 'use' && (
                                      <span className="text-[#8a6230] bg-[#faecd8] px-2 py-0.5 rounded-lg border border-[#a67c48]/30">
                                        차감
                                      </span>
                                    )}
                                    {tx.type === 'refund' && (
                                      <span className="text-[#28a745] bg-[#28a745]/10 px-2 py-0.5 rounded-lg border border-[#28a745]/30">
                                        환불
                                      </span>
                                    )}
                                  </td>
                                  <td className="p-3.5 text-[#4e5968] font-semibold whitespace-nowrap">
                                    {branchName}
                                  </td>
                                  <td className={`p-3.5 font-extrabold whitespace-nowrap ${
                                    tx.type === 'refund' ? 'text-[#28a745]' : 'text-[#191f28]'
                                  }`}>
                                    {tx.type === 'refund' ? `+${tx.amount.toLocaleString()}` : `-${tx.amount.toLocaleString()}`} P
                                  </td>
                                  <td className="p-3.5 text-[#4e5968] max-w-[280px] truncate" title={tx.description}>
                                    {tx.description}
                                  </td>
                                  <td className="p-3.5 whitespace-nowrap">
                                    <span className="text-[10px] text-[#28a745] bg-[#28a745]/10 px-2 py-0.5 rounded font-bold">
                                      처리완료
                                    </span>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        )}

        {/* TAB: 슈퍼마스터 전용 지점(점포) 관리 */}
        {activeTab === 'branches_management' && (
          <div className="space-y-6">
            <div className="bg-white border border-[#e5e8eb] p-5 rounded-2xl shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                  <h3 className="text-base font-bold text-[#191f28] flex items-center gap-2">
                    <Landmark className="text-[#a67c48]" size={20} /> 르하임 스터디카페 지점(점포) 통합 관리
                  </h3>
                  <p className="text-xs text-[#8b95a1] mt-1 leading-relaxed">
                    최고 관리자 권한으로 전국의 스터디카페 지점을 신규 개점/추가하거나, 정보를 수정 및 삭제합니다.
                  </p>
                </div>

                <button
                  onClick={() => {
                    setEditingBranch(null);
                    setBranchInputId('');
                    setBranchInputName('');
                    setBranchInputFullName('');
                    setBranchInputAddress('');
                    setShowCreateBranchModal(true);
                  }}
                  className="gold-btn text-xs font-bold py-2.5 px-4 rounded-xl shadow flex items-center gap-1.5 shrink-0"
                >
                  <Plus size={15} /> 새 지점 등록
                </button>
              </div>

              {/* 지점 목록 카드 그리드 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                {branches.map((branch) => {
                  const branchRoomCount = rooms.filter((r) => r.branchId === branch.id).length;

                  return (
                    <div
                      key={branch.id}
                      className="border border-[#e5e8eb] hover:border-[#a67c48]/50 rounded-2xl p-5 bg-[#ffffff] shadow-sm space-y-3 transition-all"
                    >
                      <div className="flex justify-between items-start">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <h4 className="text-base font-extrabold text-[#191f28]">{branch.fullName}</h4>
                            <span className="text-[10px] font-mono font-bold bg-[#a67c48]/10 text-[#a67c48] px-2 py-0.5 rounded-full">
                              ID: {branch.id}
                            </span>
                          </div>
                          <p className="text-xs text-[#8b95a1] flex items-center gap-1">
                            <span>📍 {branch.address}</span>
                          </p>
                        </div>

                        {/* 수정 / 삭제 버튼 */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => {
                              setEditingBranch(branch);
                              setBranchInputId(branch.id);
                              setBranchInputName(branch.name);
                              setBranchInputFullName(branch.fullName);
                              setBranchInputAddress(branch.address);
                              setShowCreateBranchModal(true);
                            }}
                            className="text-xs font-bold text-[#a67c48] bg-[#a67c48]/10 hover:bg-[#a67c48]/20 border border-[#a67c48]/30 px-2.5 py-1.5 rounded-xl flex items-center gap-1"
                            title="지점 정보 수정"
                          >
                            <Edit2 size={13} />
                            <span>수정</span>
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`'${branch.fullName}' 지점을 삭제하시겠습니까?`)) {
                                if (onDeleteBranch) onDeleteBranch(branch.id);
                              }
                            }}
                            className="text-xs font-bold text-[#e93d3d] bg-[#e93d3d]/10 hover:bg-[#e93d3d]/20 border border-[#e93d3d]/30 px-2.5 py-1.5 rounded-xl flex items-center gap-1"
                            title="지점 삭제"
                          >
                            <Trash2 size={13} />
                            <span>삭제</span>
                          </button>
                        </div>
                      </div>



                      {/* 등록 룸 및 담당 관리자 현황 */}
                      <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-[#8b95a1]">
                        <span className="font-semibold">
                          🏢 등록 룸: <strong className="text-[#191f28]">{branchRoomCount}개</strong>
                        </span>
                        <span>•</span>
                        <span className="font-semibold">
                          👤 담당 지점 관리자: <strong className="text-[#a67c48] font-bold">
                            {users.filter(u => u.userId !== 'admin' && u.branchIds?.includes(branch.id)).length}명
                          </strong>
                          {users.filter(u => u.userId !== 'admin' && u.branchIds?.includes(branch.id)).length > 0 && (
                            <span className="text-[#4e5968] font-normal ml-1">
                              ({users.filter(u => u.userId !== 'admin' && u.branchIds?.includes(branch.id)).map(u => `${u.name}(${u.userId})`).join(', ')})
                            </span>
                          )}
                        </span>
                        <span>•</span>
                        <span className="text-[11px] text-[#8b95a1] bg-[#f1f3f5] px-2 py-0.5 rounded">
                          전 지점 총괄: 최고관리자(admin)
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: 회원 통합 관제 & 포인트 수동 지급/차감 */}
        {activeTab === 'user_management' && (
          <div className="space-y-6">
            <div className="bg-white border border-[#e5e5ea] p-5 rounded-2xl shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                  <h3 className="text-base font-bold text-[#191f28] flex items-center gap-2">
                    <Users className="text-[#a67c48]" size={20} /> 회원 통합 관제 & 지점 관리자 발급
                  </h3>
                  <p className="text-xs text-[#8b95a1] mt-1 leading-relaxed">
                    회원 목록 및 포인트 잔액 관리와 함께, 지점별 담당자(관리자) 아이디를 생성하고 권한을 발급할 수 있습니다.
                  </p>
                </div>
                
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleOpenAssignAdminModal()}
                    className="gold-btn text-xs font-bold py-2.5 px-3.5 rounded-xl shadow flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <Plus size={15} /> 지점 관리자 등록
                  </button>
                  <span className="text-xs font-bold bg-[#a67c48]/10 text-[#a67c48] px-3 py-2 rounded-xl border border-[#a67c48]/30 shrink-0">
                    총 {users.length}명
                  </span>
                </div>
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
                          <div className="flex items-center gap-2">
                            {/* 3단계 명확하고 선명한 권한 뱃지 (엄격한 기준 적용) */}
                            {u.userId === 'admin' || u.isSuperAdmin === true ? (
                              <span 
                                className="inline-flex items-center gap-1.5 font-extrabold px-3 py-1.5 rounded-xl text-xs shadow-sm"
                                style={{ backgroundColor: '#191f28', color: '#ffffff' }}
                              >
                                👑 최고 관리자 (전 지점 총괄)
                              </span>
                            ) : u.branchIds && u.branchIds.length > 0 ? (
                              <span 
                                className="inline-flex items-center gap-1.5 font-extrabold px-2.5 py-1.5 rounded-xl text-xs shadow-sm"
                                style={{ backgroundColor: '#faecd8', color: '#8a6230', border: '1px solid rgba(166,124,72,0.4)' }}
                              >
                                🏢 [{u.branchIds.map(bId => branches.find(b => b.id === bId)?.name || bId).join(', ')}] 지점 관리자
                              </span>
                            ) : (
                              <span 
                                className="inline-flex items-center gap-1.5 font-semibold px-2.5 py-1.5 rounded-xl text-xs"
                                style={{ backgroundColor: '#f1f3f5', color: '#8b95a1' }}
                              >
                                👤 일반 회원
                              </span>
                            )}

                            {/* 권한 관리 버튼 (모든 계정에 노출되어 자유로운 승격/수정 가능) */}
                            <button
                              type="button"
                              onClick={() => handleOpenAssignAdminModal(u)}
                              className="text-[11px] font-bold text-[#a67c48] bg-[#a67c48]/10 hover:bg-[#a67c48]/20 border border-[#a67c48]/30 px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap"
                              title="관리 권한 및 담당 지점 설정"
                            >
                              ⚙️ 권한 설정
                            </button>
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="space-y-0.5">
                            <p className="font-extrabold text-sm text-[#191f28]">
                              {(getBranchPoints ? getBranchPoints(u, selectedBranchId) : (u.points || 0)).toLocaleString()} P
                            </p>
                            <p className="text-[10px] text-[#a67c48] font-semibold">
                              [{branches.find(b => b.id === selectedBranchId)?.name || selectedBranchId} 전용]
                            </p>
                          </div>
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
            <div className="bg-[#ffffff] border-2 border-[#a67c48]/30 p-4 sm:p-5 rounded-2xl shadow-sm space-y-4 overflow-hidden">
              <div className="flex flex-col sm:flex-row justify-between items-start gap-2">
                <div>
                  <h3 className="text-sm font-extrabold text-[#191f28] flex items-center gap-1.5">
                    <Camera className="text-[#a67c48]" size={18} /> 대표 출입 바코드 등록 (사진 / 번호)
                  </h3>
                  <p className="text-xs text-[#8b95a1] pt-0.5 leading-relaxed">
                    바코드 사진을 등록하거나 번호를 입력하면 이용자 출입 바코드로 즉시 활성화됩니다.
                  </p>
                </div>
                <span className="text-[10px] font-bold text-[#a67c48] border border-[#a67c48]/30 px-2.5 py-0.5 rounded-full bg-[#a67c48]/10 shrink-0 self-start">
                  {masterBarcode?.type === 'image' ? '🖼️ 사진 바코드' : '🔢 번호 바코드'}
                </span>
              </div>

              {/* 등록 방법 탭 및 입력 폼 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-1">
                {/* 방법 A: 사진 촬영 / 이미지 파일 업로드 */}
                <div className="border border-[#e5e8eb] rounded-2xl p-4 bg-[#f8f9fc] space-y-2.5 overflow-hidden">
                  <h4 className="text-xs font-bold text-[#191f28] flex items-center gap-1">
                    <Upload size={14} className="text-[#a67c48]" /> 1. 바코드 사진 촬영 / 파일 업로드
                  </h4>
                  <p className="text-[11px] text-[#8b95a1] leading-relaxed">
                    실물 바코드 사진(JPG, PNG)을 올리시면 이용자 팝업에 선명한 사진으로 노출됩니다.
                  </p>
                  
                  <label className="gold-btn w-full py-3 px-3 text-xs font-bold rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-sm text-center">
                    <Camera size={16} />
                    <span className="whitespace-nowrap">사진 촬영 / 파일 선택</span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      style={{ display: 'none' }}
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
                <div className="border border-[#e5e8eb] rounded-2xl p-4 bg-[#f8f9fc] space-y-2.5 overflow-hidden">
                  <h4 className="text-xs font-bold text-[#191f28] flex items-center gap-1">
                    <QrCode size={14} className="text-[#a67c48]" /> 2. 바코드 번호 직접 입력
                  </h4>
                  <p className="text-[11px] text-[#8b95a1] leading-relaxed">
                    예: *M091063684* 번호를 입력하시면 표준 막대 바코드로 자동 렌더링됩니다.
                  </p>
                  
                  <div className="flex items-center gap-2 w-full">
                    <input
                      type="text"
                      defaultValue={masterBarcode?.type === 'number' ? masterBarcode.value : '*M091063684*'}
                      id="master-barcode-num-input"
                      placeholder="예: *M091063684*"
                      className="form-input text-xs flex-1 min-w-0 py-2.5 px-3 rounded-xl border border-[#e5e8eb] focus:border-[#a67c48] outline-none"
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
                          alert(`대표 바코드 번호가 '${formatted}'(으)로 저장되었습니다!`);
                        }
                      }}
                      className="gold-btn px-4 py-2.5 text-xs font-bold rounded-xl shrink-0 whitespace-nowrap shadow-sm"
                    >
                      저장
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
                {filteredBarcodes.length === 0 ? (
                  <div className="col-span-2 text-center py-8 text-xs text-[#8b95a1] bg-[#f8f9fc] rounded-xl border border-dashed border-[#e5e8eb]">
                    검색 조건에 일치하는 바코드 예약 내역이 없습니다.
                  </div>
                ) : (
                  filteredBarcodes.map((res) => {
                    const room = rooms.find((r) => r.id === res.roomId);
                    const isEditing = editingBarcodeResId === res.id;
                    const safeBarcode = res.barcodeId || '*M091063684*';
                    return (
                      <div key={res.id} className="border border-[#e5e8eb] rounded-2xl p-4 bg-[#ffffff] shadow-sm space-y-2.5">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="text-xs font-bold text-[#191f28]">{res.userName || '회원'}님</span>
                            <span className="text-[10px] text-[#a67c48] font-bold ml-1.5 bg-[#a67c48]/10 px-2 py-0.5 rounded-full">
                              {room?.name || '공부방'}
                            </span>
                          </div>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              res.barcodeStatus === 'valid'
                                ? 'bg-[#28a745]/10 text-[#28a745]'
                                : res.barcodeStatus === 'used'
                                ? 'bg-[#8b95a1]/10 text-[#8b95a1]'
                                : 'bg-[#e93d3d]/10 text-[#e93d3d]'
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
                        <BarcodeView value={safeBarcode} height={60} showText={true} />

                        {/* 바코드 수동 변경 폼 */}
                        {isEditing ? (
                          <div className="flex gap-1.5 pt-1">
                            <input
                              type="text"
                              value={customBarcodeResInput}
                              onChange={(e) => setCustomBarcodeResInput(e.target.value)}
                              placeholder="변경할 바코드 번호"
                              className="form-input text-xs flex-1 py-1.5 px-2.5 rounded-lg border border-[#e5e8eb]"
                            />
                            <button
                              onClick={() => {
                                if (customBarcodeResInput.trim() && onUpdateReservationBarcode) {
                                  onUpdateReservationBarcode(res.id, customBarcodeResInput.trim());
                                  setEditingBarcodeResId(null);
                                }
                              }}
                              className="gold-btn text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm"
                            >
                              저장
                            </button>
                            <button
                              onClick={() => setEditingBarcodeResId(null)}
                              className="gold-btn-outline text-xs px-2.5 py-1.5 rounded-lg"
                            >
                              취소
                            </button>
                          </div>
                        ) : (
                          <div className="text-[11px] text-[#8b95a1] flex justify-between items-center pt-1.5 border-t border-[#f1f3f5]">
                            <span>
                              {res.date} ({res.startTime || '00:00'}~{res.endTime || '00:00'})
                            </span>
                            <div className="flex gap-2">
                              <button
                                onClick={() => {
                                  setEditingBarcodeResId(res.id);
                                  setCustomBarcodeResInput(safeBarcode);
                                }}
                                className="text-[#a67c48] hover:underline font-bold"
                              >
                                바코드 변경
                              </button>
                              <button
                                onClick={() => {
                                  setScanBarcodeId(safeBarcode);
                                  if (onVerifyBarcode) {
                                    const result = onVerifyBarcode(safeBarcode);
                                    setScanResult(result);
                                  }
                                }}
                                className="text-[#28a745] hover:underline font-bold"
                              >
                                바로 입장
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: 계좌 및 환경 설정 */}
        {activeTab === 'bank_settings' && (
          <div className="space-y-6 max-w-5xl mx-auto">
            {/* 상단 안내 헤더 */}
            <div className="bg-white border border-[#e5e8eb] p-5 rounded-2xl shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <h3 className="text-base font-bold text-[#191f28] flex items-center gap-2">
                  <Settings className="text-[#a67c48]" size={20} /> 지점 운영 & 관리자 환경 설정
                </h3>
                <p className="text-xs text-[#8b95a1] mt-1 leading-relaxed">
                  담당 관리자 정보(성함, 고객 문의용 연락처, 비밀번호)와 무통장 입금 계좌 및 스마트폰 텔레그램 알림을 설정합니다.
                </p>
              </div>
              <span className="text-xs font-bold text-[#a67c48] bg-[#a67c48]/10 px-3 py-1.5 rounded-xl border border-[#a67c48]/30 shrink-0">
                🏢 현재 지점: {branches.find(b => b.id === selectedBranchId)?.fullName || selectedBranchId}
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* 1. 👤 담당 관리자 정보 설정 (강제 수평 라벨/인풋 그리드) */}
              <div className="bg-white border border-[#e5e8eb] p-6 rounded-2xl shadow-sm space-y-5">
                <div className="flex items-center gap-2 border-b border-[#e5e8eb] pb-3">
                  <Users className="text-[#a67c48]" size={20} />
                  <div>
                    <h4 className="text-base font-bold text-[#191f28]">담당 관리자 정보 설정</h4>
                    <p className="text-[11px] text-[#8b95a1] pt-0.5">
                      이용 안내 화면에 노출되는 지점 담당자 연락처와 관리자 계정 정보를 수정합니다.
                    </p>
                  </div>
                </div>

                {adminProfileSaveMsg && (
                  <div className="p-3 text-xs font-semibold text-[#28a745] bg-[#28a745]/10 border border-[#28a745]/30 rounded-xl flex items-center gap-2">
                    <CheckCircle2 size={16} /> 관리자 정보가 성공적으로 변경되었습니다.
                  </div>
                )}

                {adminProfileErrorMsg && (
                  <div className="p-3 text-xs font-semibold text-[#e93d3d] bg-[#e93d3d]/10 border border-[#e93d3d]/30 rounded-xl flex items-center gap-2">
                    <AlertCircle size={16} /> {adminProfileErrorMsg}
                  </div>
                )}

                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!adminProfileName.trim() || !adminProfilePhone.trim()) {
                      alert('담당자 성함과 연락처를 입력해 주세요.');
                      return;
                    }
                    if (onUpdateUserProfile && currentUser) {
                      const res = await onUpdateUserProfile(currentUser.id, {
                        name: adminProfileName.trim(),
                        phone: adminProfilePhone.trim(),
                        ...(adminProfilePassword.trim() ? { password: adminProfilePassword.trim() } : {}),
                      });
                      if (res.success) {
                        setAdminProfileSaveMsg(true);
                        setAdminProfileErrorMsg('');
                        setAdminProfilePassword('');
                        setTimeout(() => setAdminProfileSaveMsg(false), 3000);
                      } else {
                        setAdminProfileErrorMsg(res.message || '저장 실패');
                      }
                    }
                  }}
                  className="space-y-3"
                >
                  {/* 관리자 아이디 / 인풋필드 */}
                  <div 
                    className="py-2.5 border-b border-[#f1f3f5]"
                    style={{ display: 'grid', gridTemplateColumns: '130px 1fr', alignItems: 'center', gap: '12px' }}
                  >
                    <label className="text-xs font-bold text-[#191f28]">
                      관리자 아이디
                    </label>
                    <div>
                      <input
                        type="text"
                        disabled
                        value={currentUser?.userId || ''}
                        className="form-input text-xs py-2.5 px-3 rounded-xl border border-[#e5e8eb] bg-[#f8f9fc] text-[#8b95a1] font-mono cursor-not-allowed w-full"
                      />
                      <p className="text-[10px] text-[#8b95a1] mt-0.5">아이디는 변경할 수 없습니다.</p>
                    </div>
                  </div>

                  {/* 담당자 성함 / 인풋필드 */}
                  <div 
                    className="py-2.5 border-b border-[#f1f3f5]"
                    style={{ display: 'grid', gridTemplateColumns: '130px 1fr', alignItems: 'center', gap: '12px' }}
                  >
                    <label className="text-xs font-bold text-[#191f28]">
                      담당자 성함 (이름)
                    </label>
                    <div>
                      <input
                        type="text"
                        required
                        value={adminProfileName}
                        onChange={(e) => setAdminProfileName(e.target.value)}
                        placeholder="예: 김하윤"
                        className="form-input text-xs py-2.5 px-3 rounded-xl border border-[#e5e8eb] focus:border-[#a67c48] w-full"
                      />
                    </div>
                  </div>

                  {/* 지점 문의 연락처 / 인풋필드 */}
                  <div 
                    className="py-2.5 border-b border-[#f1f3f5]"
                    style={{ display: 'grid', gridTemplateColumns: '130px 1fr', alignItems: 'center', gap: '12px' }}
                  >
                    <label className="text-xs font-bold text-[#191f28]">
                      지점 문의 연락처
                    </label>
                    <div>
                      <input
                        type="text"
                        required
                        value={adminProfilePhone}
                        onChange={(e) => setAdminProfilePhone(e.target.value)}
                        placeholder="예: 010-3957-3425"
                        className="form-input text-xs py-2.5 px-3 rounded-xl border border-[#e5e8eb] focus:border-[#a67c48] font-mono w-full"
                      />
                      <p className="text-[10px] text-[#a67c48] font-medium mt-1 leading-snug">
                        ★ 메인 화면 노출 (이용자 예약 화면 상단 '지점 담당자 문의' 번호로 자동 연동됩니다.)
                      </p>
                    </div>
                  </div>

                  {/* 새 로그인 비밀번호 / 인풋필드 */}
                  <div 
                    className="py-2.5 border-b border-[#f1f3f5]"
                    style={{ display: 'grid', gridTemplateColumns: '130px 1fr', alignItems: 'center', gap: '12px' }}
                  >
                    <label className="text-xs font-bold text-[#191f28]">
                      새 로그인 비밀번호
                    </label>
                    <div>
                      <input
                        type="password"
                        value={adminProfilePassword}
                        onChange={(e) => setAdminProfilePassword(e.target.value)}
                        placeholder="변경할 비밀번호 입력 (미입력 시 기존 유지)"
                        className="form-input text-xs py-2.5 px-3 rounded-xl border border-[#e5e8eb] focus:border-[#a67c48] w-full"
                      />
                    </div>
                  </div>

                  <div className="pt-2">
                    <button type="submit" className="gold-btn w-full py-3 text-xs font-bold rounded-xl shadow flex items-center justify-center gap-1.5">
                      <Check size={14} /> 담당자 정보 저장하기
                    </button>
                  </div>
                </form>
              </div>

              {/* 2. 💳 지점 무통장 입금 계좌 설정 (강제 수평 라벨/인풋 그리드) */}
              <div className="bg-white border border-[#e5e8eb] p-6 rounded-2xl shadow-sm space-y-5">
                <div className="flex items-center gap-2 border-b border-[#e5e8eb] pb-3">
                  <CreditCard className="text-[#a67c48]" size={20} />
                  <div>
                    <h4 className="text-base font-bold text-[#191f28]">무통장 입금 계좌 설정</h4>
                    <p className="text-[11px] text-[#8b95a1] pt-0.5">
                      회원들이 포인트 충전 시 안내받을 지점 대표 입금 계좌 정보입니다.
                    </p>
                  </div>
                </div>

                {bankSaveMsg && (
                  <div className="p-3 text-xs font-semibold text-[#28a745] bg-[#28a745]/10 border border-[#28a745]/30 rounded-xl flex items-center gap-2">
                    <CheckCircle2 size={16} /> 계좌 정보가 안전하게 저장되었습니다.
                  </div>
                )}

                <form onSubmit={handleBankSave} className="space-y-3">
                  {/* 은행명 / 인풋필드 */}
                  <div 
                    className="py-2.5 border-b border-[#f1f3f5]"
                    style={{ display: 'grid', gridTemplateColumns: '130px 1fr', alignItems: 'center', gap: '12px' }}
                  >
                    <label className="text-xs font-bold text-[#191f28]">
                      은행명
                    </label>
                    <div>
                      <input
                        type="text"
                        value={bankName}
                        onChange={(e) => setBankName(e.target.value)}
                        placeholder="예: 신한은행, 카카오뱅크, 국민은행"
                        className="form-input text-xs py-2.5 px-3 rounded-xl border border-[#e5e8eb] focus:border-[#a67c48] w-full"
                        required
                      />
                    </div>
                  </div>

                  {/* 계좌 번호 / 인풋필드 */}
                  <div 
                    className="py-2.5 border-b border-[#f1f3f5]"
                    style={{ display: 'grid', gridTemplateColumns: '130px 1fr', alignItems: 'center', gap: '12px' }}
                  >
                    <label className="text-xs font-bold text-[#191f28]">
                      계좌 번호
                    </label>
                    <div>
                      <input
                        type="text"
                        value={accountNumber}
                        onChange={(e) => setAccountNumber(e.target.value)}
                        placeholder="예: 110-384-918234"
                        className="form-input text-xs py-2.5 px-3 rounded-xl border border-[#e5e8eb] focus:border-[#a67c48] font-mono w-full"
                        required
                      />
                    </div>
                  </div>

                  {/* 예금주명 / 인풋필드 */}
                  <div 
                    className="py-2.5 border-b border-[#f1f3f5]"
                    style={{ display: 'grid', gridTemplateColumns: '130px 1fr', alignItems: 'center', gap: '12px' }}
                  >
                    <label className="text-xs font-bold text-[#191f28]">
                      예금주명
                    </label>
                    <div>
                      <input
                        type="text"
                        value={accountHolder}
                        onChange={(e) => setAccountHolder(e.target.value)}
                        placeholder="예: (주)르하임 스터디카페"
                        className="form-input text-xs py-2.5 px-3 rounded-xl border border-[#e5e8eb] focus:border-[#a67c48] w-full"
                        required
                      />
                    </div>
                  </div>

                  <div className="pt-2">
                    <button type="submit" className="gold-btn w-full py-3 text-xs font-bold rounded-xl shadow flex items-center justify-center gap-1.5">
                      <Check size={14} /> 계좌 정보 저장하기
                    </button>
                  </div>
                </form>
              </div>
            </div>

            {/* 3. 🔔 실시간 알림 설정 (스마트폰 텔레그램 & 딩동 사운드) */}
            <div className="bg-white border border-[#e5e8eb] p-6 rounded-2xl shadow-sm space-y-5">
              <div className="flex items-center gap-2 border-b border-[#e5e8eb] pb-3">
                <Bell className="text-[#a67c48]" size={20} />
                <div>
                  <h4 className="text-base font-bold text-[#191f28]">실시간 충전 알림 설정 (스마트폰 텔레그램 & 딩동 소리)</h4>
                  <p className="text-[11px] text-[#8b95a1] pt-0.5">
                    회원이 포인트 충전/이전 신청 시 관리자 폰(텔레그램) 및 브라우저로 실시간 알림을 보냅니다.
                  </p>
                </div>
              </div>

              {notifSaveMsg && (
                <div className="p-3 text-xs font-semibold text-[#28a745] bg-[#28a745]/10 border border-[#28a745]/30 rounded-xl flex items-center gap-2">
                  <CheckCircle2 size={16} /> 알림 설정이 성공적으로 저장되었습니다.
                </div>
              )}

              {notifTestResult && (
                <div className={`p-3 text-xs font-semibold rounded-xl flex items-center gap-2 border ${
                  notifTestResult.success
                    ? 'text-[#28a745] bg-[#28a745]/10 border-[#28a745]/30'
                    : 'text-[#e93d3d] bg-[#e93d3d]/10 border-[#e93d3d]/30'
                }`}>
                  {notifTestResult.success ? <CheckCheck size={16} /> : <AlertCircle size={16} />}
                  <span>{notifTestResult.message}</span>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* 🔊 사운드 & 브라우저 푸시 */}
                <div className="p-4 bg-[#f8f9fc] rounded-2xl border border-[#e5e8eb] space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-[#e5e8eb]">
                    <div className="flex items-center gap-2">
                      <Volume2 size={16} className="text-[#a67c48]" />
                      <span className="text-xs font-bold text-[#191f28]">브라우저 딩동(Ding-Dong) 소리 알림</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={notifSoundEnabled}
                        onChange={(e) => setNotifSoundEnabled(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#a67c48]"></div>
                    </label>
                  </div>

                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => playNotificationSound()}
                      className="text-[11px] font-bold text-[#a67c48] bg-white hover:bg-[#a67c48]/10 border border-[#a67c48]/30 px-3 py-2 rounded-xl transition-all flex items-center gap-1 shadow-xs"
                    >
                      <Volume2 size={13} /> 🔊 알림음 미리듣기
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        const granted = await requestNotificationPermission();
                        alert(granted ? '브라우저 시스템 푸시 알림 권한이 허용되었습니다.' : '브라우저 알림 권한이 거부되었거나 지원되지 않습니다.');
                      }}
                      className="text-[11px] font-bold text-[#4e5968] bg-white hover:bg-[#f1f3f5] border border-[#e5e8eb] px-3 py-2 rounded-xl transition-all"
                    >
                      📱 푸시 권한 요청
                    </button>
                  </div>
                </div>

                {/* 📲 텔레그램 스마트폰 봇 알림 연동 (강제 수평 라벨/인풋 그리드) */}
                <div className="p-4 bg-[#f8f9fc] rounded-2xl border border-[#e5e8eb] space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-[#e5e8eb]">
                    <div className="flex items-center gap-2">
                      <MessageSquare size={16} className="text-[#0088cc]" />
                      <span className="text-xs font-bold text-[#191f28]">텔레그램(Telegram) 스마트폰 알림</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={notifTelegramEnabled}
                        onChange={(e) => setNotifTelegramEnabled(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#0088cc]"></div>
                    </label>
                  </div>

                  <div className="space-y-3">
                    {/* 채팅 ID / 인풋필드 (토큰은 내장되어 숨김 처리됨) */}
                    <div 
                      className="py-1"
                      style={{ display: 'grid', gridTemplateColumns: '130px 1fr', alignItems: 'center', gap: '12px' }}
                    >
                      <label className="text-xs font-bold text-[#191f28]">
                        내 텔레그램 Chat ID
                      </label>
                      <div>
                        <input
                          type="text"
                          value={notifChatId}
                          onChange={(e) => setNotifChatId(e.target.value)}
                          placeholder="예: 123456789 (숫자 ID 입력)"
                          className="form-input text-xs py-2.5 px-3 rounded-xl border border-[#e5e8eb] bg-white font-mono w-full focus:border-[#0088cc]"
                        />
                        <p className="text-[10px] text-[#8b95a1] mt-0.5">
                          🔒 르하임 공식 텔레그램 봇 시스템이 안전하게 연동되어 있습니다.
                        </p>
                      </div>
                    </div>

                    <div className="pt-1 flex justify-end">
                      <button
                        type="button"
                        disabled={notifTesting || !notifChatId.trim()}
                        onClick={async () => {
                          setNotifTesting(true);
                          setNotifTestResult(null);
                          const res = await sendTelegramMessage(
                            OFFICIAL_TELEGRAM_BOT_TOKEN,
                            notifChatId.trim(),
                            `🔔 <b>[르하임 스터디카페] 텔레그램 알림 연동 성공!</b>\n\n관리자님의 스마트폰으로 포인트 충전 및 이전 신청 알림이 정상 수신됩니다. 🚀`
                          );
                          setNotifTesting(false);
                          if (res.success) {
                            setNotifTestResult({ success: true, message: '스마트폰 텔레그램으로 테스트 알림이 성공적으로 전송되었습니다!' });
                          } else {
                            setNotifTestResult({ success: false, message: res.error || '텔레그램 전송 실패 (Chat ID를 확인해 주세요)' });
                          }
                        }}
                        className="text-xs font-bold text-[#0088cc] bg-white hover:bg-[#0088cc]/10 border border-[#0088cc]/30 px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 shadow-xs disabled:opacity-50"
                      >
                        <Send size={13} /> {notifTesting ? '발송 중...' : '🔔 텔레그램 테스트 메시지 발송'}
                      </button>
                    </div>
                  </div>

                  {/* 텔레그램 봇 만들기 1분 안내 */}
                  <div className="bg-[#eef8ff] p-3 rounded-xl border border-[#bce3ff] text-[10px] text-[#005580] space-y-1">
                    <p className="font-bold text-[11px] flex items-center gap-1">
                      💡 텔레그램 봇 토큰 & Chat ID 무료 발급 방법 (1분):
                    </p>
                    <ol className="list-decimal pl-3.5 space-y-0.5 text-[10px]">
                      <li>텔레그램 검색창에 <b>@BotFather</b> 검색 ➔ <code>/newbot</code> 입력하여 새 봇 생성 후 <b>Bot Token</b> 복사</li>
                      <li>생성된 내 봇에 들어가서 <b>[시작(Start)]</b> 버튼 누르기</li>
                      <li>검색창에 <b>@userinfobot</b> 검색 ➔ 내 <b>Id (Chat ID 숫자)</b> 확인 후 위 입력창에 붙여넣기</li>
                    </ol>
                  </div>
                </div>
              </div>

              {/* 알림 설정 최종 저장 버튼 */}
              <button
                type="button"
                onClick={() => {
                  const newSettings: NotificationSettings = {
                    soundEnabled: notifSoundEnabled,
                    telegramEnabled: notifTelegramEnabled,
                    telegramBotToken: OFFICIAL_TELEGRAM_BOT_TOKEN,
                    telegramChatId: notifChatId.trim(),
                    notifyOnChargeRequest: true,
                    notifyOnTransferRequest: true,
                  };
                  if (onUpdateNotificationSettings) {
                    onUpdateNotificationSettings(newSettings);
                    setNotifSaveMsg(true);
                    setTimeout(() => setNotifSaveMsg(false), 3000);
                  }
                }}
                className="gold-btn w-full py-3 text-xs font-bold rounded-xl shadow flex items-center justify-center gap-1.5"
              >
                <Bell size={14} /> 알림 설정 저장하기
              </button>
            </div>
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
      {/* 🏢 지점 관리자 등록 & 기존 회원 권한 부여 모달 (2-in-1 듀얼 모드) */}
      {showCreateAdminModal && (
        <div className="modal-overlay" onClick={() => setShowCreateAdminModal(false)}>
          <div className="modal-content max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center pb-3 border-b border-[#e5e8eb]">
              <h3 className="text-base font-bold text-[#191f28] flex items-center gap-2">
                <Users className="text-[#a67c48]" size={18} /> 지점 관리자(담당자) 등록 및 권한 부여
              </h3>
              <button
                onClick={() => setShowCreateAdminModal(false)}
                className="text-[#8b95a1] hover:text-[#191f28] text-2xl leading-none"
              >
                &times;
              </button>
            </div>

            {/* 탭 전환: 기존 회원 선택 vs 신규 계정 발급 */}
            <div className="flex border-b border-[#e5e8eb] mt-3">
              <button
                type="button"
                onClick={() => {
                  setAdminRegMode('existing');
                  if (users.length > 0) {
                    const u = users.find(x => x.id === selectedExistingUserId) || users[0];
                    setSelectedExistingUserId(u.id);
                    setNewAdminUserId(u.userId);
                    setNewAdminName(u.name);
                    setNewAdminPhone(u.phone);
                    setNewAdminBranchIds(u.branchIds && u.branchIds.length > 0 ? u.branchIds : (branches.length > 0 ? [branches[0].id] : ['yeouido']));
                  }
                }}
                className={`flex-1 py-2 text-xs font-bold border-b-2 transition-all ${
                  adminRegMode === 'existing'
                    ? 'border-[#a67c48] text-[#a67c48]'
                    : 'border-transparent text-[#8b95a1] hover:text-[#191f28]'
                }`}
              >
                👤 기존 회원에게 지점 권한 부여
              </button>
              <button
                type="button"
                onClick={() => {
                  setAdminRegMode('new');
                  setNewAdminUserId('');
                  setNewAdminName('');
                  setNewAdminPhone('');
                  setNewAdminPassword('1234');
                  setNewAdminBranchIds(branches.length > 0 ? [branches[0].id] : ['yeouido']);
                }}
                className={`flex-1 py-2 text-xs font-bold border-b-2 transition-all ${
                  adminRegMode === 'new'
                    ? 'border-[#a67c48] text-[#a67c48]'
                    : 'border-transparent text-[#8b95a1] hover:text-[#191f28]'
                }`}
              >
                ✨ 신규 관리자 계정 생성
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!newAdminUserId.trim() || !newAdminName.trim() || !newAdminPhone.trim()) {
                  alert('모든 필수 항목을 입력해 주세요.');
                  return;
                }
                if (newAdminBranchIds.length === 0) {
                  alert('담당할 지점을 최소 1개 이상 선택해 주세요.');
                  return;
                }
                if (onCreateBranchAdmin) {
                  const success = onCreateBranchAdmin({
                    branchIds: newAdminBranchIds,
                    roleCode: newAdminRoleCode,
                    userId: newAdminUserId.trim(),
                    password: newAdminPassword.trim() || '1234',
                    name: newAdminName.trim(),
                    phone: newAdminPhone.trim(),
                  });
                  if (success) {
                    setShowCreateAdminModal(false);
                    setNewAdminUserId('');
                    setNewAdminName('');
                    setNewAdminPhone('');
                    setNewAdminBranchIds(branches.length > 0 ? [branches[0].id] : ['yeouido']);
                  }
                }
              }}
              className="space-y-4 pt-3 text-xs"
            >
              {/* 기존 회원 검색 & 선택 */}
              {adminRegMode === 'existing' && (
                <div className="form-group space-y-2.5 bg-[#f8f9fc] p-3.5 rounded-2xl border border-[#e5e8eb]">
                  <div className="flex justify-between items-center">
                    <label className="font-bold text-xs text-[#191f28] flex items-center gap-1.5">
                      <Users size={14} className="text-[#a67c48]" /> 권한을 부여할 기존 회원 검색 및 선택
                    </label>
                    <span className="text-[10px] font-semibold text-[#8b95a1]">
                      {adminUserSearchQuery ? (
                        <>검색: <strong className="text-[#a67c48]">
                          {users.filter(u => 
                            u.userId.toLowerCase().includes(adminUserSearchQuery.toLowerCase()) || 
                            u.name.toLowerCase().includes(adminUserSearchQuery.toLowerCase()) || 
                            u.phone.includes(adminUserSearchQuery)
                          ).length}명
                        </strong> / 전체 {users.length}명</>
                      ) : (
                        `전체 회원: ${users.length}명`
                      )}
                    </span>
                  </div>

                  {/* 🔍 회원 아이디 / 이름 / 연락처 실시간 검색창 (돋보기 제거 & 깔끔한 심플 인풋) */}
                  <div className="relative flex items-center">
                    <input
                      type="text"
                      value={adminUserSearchQuery}
                      onChange={(e) => {
                        const q = e.target.value;
                        setAdminUserSearchQuery(q);
                        const matched = users.filter((u) =>
                          u.userId.toLowerCase().includes(q.toLowerCase()) ||
                          u.name.toLowerCase().includes(q.toLowerCase()) ||
                          u.phone.includes(q)
                        );
                        if (matched.length > 0 && !matched.some((u) => u.id === selectedExistingUserId)) {
                          const firstMatched = matched[0];
                          setSelectedExistingUserId(firstMatched.id);
                          setNewAdminUserId(firstMatched.userId);
                          setNewAdminName(firstMatched.name);
                          setNewAdminPhone(firstMatched.phone);
                          setNewAdminBranchIds(firstMatched.branchIds && firstMatched.branchIds.length > 0 ? firstMatched.branchIds : (branches.length > 0 ? [branches[0].id] : ['yeouido']));
                        }
                      }}
                      placeholder="회원 아이디, 성함, 연락처를 입력하여 빠른 검색..."
                      className="form-input text-xs py-2.5 px-3.5 rounded-xl w-full border border-[#e5e8eb] bg-white focus:border-[#a67c48] shadow-xs"
                    />
                    {adminUserSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setAdminUserSearchQuery('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8b95a1] hover:text-[#191f28] text-xs font-bold p-1 bg-white"
                        title="검색어 지우기"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {/* 필터링된 회원 드롭다운 목록 */}
                  {(() => {
                    const filtered = users.filter((u) =>
                      u.userId.toLowerCase().includes(adminUserSearchQuery.toLowerCase()) ||
                      u.name.toLowerCase().includes(adminUserSearchQuery.toLowerCase()) ||
                      u.phone.includes(adminUserSearchQuery)
                    );

                    if (filtered.length === 0) {
                      return (
                        <div className="p-3 text-center text-xs text-[#8b95a1] bg-white rounded-xl border border-dashed border-[#e5e8eb]">
                          '{adminUserSearchQuery}' 검색어와 일치하는 회원이 없습니다.
                        </div>
                      );
                    }

                    return (
                      <select
                        value={selectedExistingUserId}
                        onChange={(e) => {
                          const uId = e.target.value;
                          setSelectedExistingUserId(uId);
                          const targetU = users.find((u) => u.id === uId);
                          if (targetU) {
                            setNewAdminUserId(targetU.userId);
                            setNewAdminName(targetU.name);
                            setNewAdminPhone(targetU.phone);
                            setNewAdminBranchIds(targetU.branchIds && targetU.branchIds.length > 0 ? targetU.branchIds : (branches.length > 0 ? [branches[0].id] : ['yeouido']));
                          }
                        }}
                        className="form-input text-xs py-2.5 px-3 rounded-xl w-full border border-[#e5e8eb] bg-white font-medium focus:border-[#a67c48]"
                      >
                        {filtered.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name} ({u.userId}) - {u.phone} {u.branchIds && u.branchIds.length > 0 ? `[🏢 ${u.branchIds.map(bId => branches.find(b => b.id === bId)?.name || bId).join(', ')} 담당중]` : '[일반회원]'}
                          </option>
                        ))}
                      </select>
                    );
                  })()}

                  <p className="text-[11px] text-[#8b95a1] pt-0.5 leading-relaxed">
                    💡 위에서 회원을 선택하면 해당 회원의 기존 계정에 지점 관리 권한과 담당 점포가 즉시 할당됩니다.
                  </p>
                </div>
              )}

              {/* 🏢 담당 지점 다중 선택 (복수 체크박스) */}
              <div className="form-group space-y-2">
                <div className="flex justify-between items-center">
                  <label className="font-bold text-[#191f28] flex items-center gap-1">
                    <span>담당 지점 선택</span>
                    <strong className="text-[#a67c48]">({newAdminBranchIds.length}개 선택됨)</strong>
                  </label>
                  <div className="flex gap-1.5 text-[10px]">
                    <button
                      type="button"
                      onClick={() => setNewAdminBranchIds(branches.map((b) => b.id))}
                      className="text-[#a67c48] hover:underline font-semibold"
                    >
                      전체 선택
                    </button>
                    <span className="text-[#8b95a1]">|</span>
                    <button
                      type="button"
                      onClick={() => setNewAdminBranchIds([])}
                      className="text-[#8b95a1] hover:underline"
                    >
                      선택 해제
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-[#f8f9fc] p-3 rounded-2xl border border-[#e5e8eb] max-h-40 overflow-y-auto">
                  {branches.map((branch) => {
                    const isChecked = newAdminBranchIds.includes(branch.id);
                    return (
                      <label
                        key={branch.id}
                        className={`flex items-start gap-2.5 p-2.5 rounded-xl border transition-all cursor-pointer ${
                          isChecked
                            ? 'bg-[#ffffff] border-[#a67c48] shadow-sm'
                            : 'bg-transparent border-transparent hover:bg-[#ffffff]/60'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setNewAdminBranchIds([...newAdminBranchIds, branch.id]);
                            } else {
                              setNewAdminBranchIds(newAdminBranchIds.filter((id) => id !== branch.id));
                            }
                          }}
                          className="mt-0.5 rounded text-[#a67c48] focus:ring-[#a67c48]"
                        />
                        <div className="min-w-0">
                          <p className={`text-xs font-bold ${isChecked ? 'text-[#191f28]' : 'text-[#4e5968]'}`}>
                            {branch.fullName || branch.name}
                          </p>
                          <p className="text-[10px] text-[#8b95a1] truncate">{branch.address}</p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* 직급 및 관리 권한 선택 (최고 관리자 / 지점 관리자 / 일반 회원) */}
              <div className="form-group space-y-1 bg-[#ffffff] p-3 rounded-2xl border border-[#e5e8eb]">
                <label className="font-bold text-[#191f28] flex items-center gap-1.5">
                  <span>👑 부여할 관리 권한 등급</span>
                </label>
                <select
                  value={newAdminRoleCode}
                  onChange={(e) => {
                    const code = e.target.value as RoleCode;
                    setNewAdminRoleCode(code);
                    if (code === 'PLATFORM_ADMIN' || code === 'BRAND_ADMIN') {
                      setNewAdminBranchIds(branches.map(b => b.id));
                    }
                  }}
                  className="form-input text-xs py-2.5 px-3 rounded-xl w-full border border-[#e5e8eb] bg-white font-bold text-[#191f28] focus:border-[#a67c48]"
                >
                  <option value="PLATFORM_ADMIN">👑 최고 관리자 (전 지점 총괄 슈퍼 관리자)</option>
                  <option value="BRANCH_ADMIN">🏢 지점 총괄 관리자 (선택한 지점 관리)</option>
                  <option value="BRANCH_OWNER">🏢 지점 오너 / 점주 (선택한 지점 관리)</option>
                  <option value="STAFF">🏢 지점 직원 / 매니저 (선택한 지점 관리)</option>
                  <option value="CUSTOMER">👤 일반 회원으로 권한 회수</option>
                </select>
                <p className="text-[10px] text-[#8b95a1] pt-0.5">
                  {newAdminRoleCode === 'PLATFORM_ADMIN'
                    ? '💡 최고 관리자는 전국의 모든 지점 추가/삭제 및 전 지점 관제 권한을 가집니다.'
                    : newAdminRoleCode === 'CUSTOMER'
                    ? '💡 관리자 권한을 해제하고 일반 회원으로 변경합니다.'
                    : '💡 아래에서 체크한 담당 지점에 대해서만 관리 권한이 부여됩니다.'}
                </p>
              </div>

              {/* 아이디 & 비밀번호 */}
              <div className="grid grid-cols-2 gap-3">
                <div className="form-group space-y-1">
                  <label className="font-bold text-[#191f28]">아이디</label>
                  <input
                    type="text"
                    required
                    readOnly={adminRegMode === 'existing'}
                    value={newAdminUserId}
                    onChange={(e) => setNewAdminUserId(e.target.value)}
                    placeholder="예: kyoenghwan"
                    className={`form-input text-xs py-2 px-3 rounded-xl w-full border border-[#e5e8eb] ${adminRegMode === 'existing' ? 'bg-[#f0f0f2] text-[#4e5968]' : 'focus:border-[#a67c48]'}`}
                  />
                </div>

                <div className="form-group space-y-1">
                  <label className="font-bold text-[#191f28]">비밀번호</label>
                  <input
                    type="text"
                    required
                    value={newAdminPassword}
                    onChange={(e) => setNewAdminPassword(e.target.value)}
                    placeholder="예: 1234"
                    className="form-input text-xs py-2 px-3 rounded-xl w-full border border-[#e5e8eb] focus:border-[#a67c48]"
                  />
                </div>
              </div>

              {/* 성함 & 연락처 */}
              <div className="grid grid-cols-2 gap-3">
                <div className="form-group space-y-1">
                  <label className="font-bold text-[#191f28]">성함</label>
                  <input
                    type="text"
                    required
                    value={newAdminName}
                    onChange={(e) => setNewAdminName(e.target.value)}
                    placeholder="예: 김하윤"
                    className="form-input text-xs py-2 px-3 rounded-xl w-full border border-[#e5e8eb] focus:border-[#a67c48]"
                  />
                </div>

                <div className="form-group space-y-1">
                  <label className="font-bold text-[#191f28]">휴대폰 번호</label>
                  <input
                    type="text"
                    required
                    value={newAdminPhone}
                    onChange={(e) => setNewAdminPhone(e.target.value)}
                    placeholder="예: 010-1234-1234"
                    className="form-input text-xs py-2 px-3 rounded-xl w-full border border-[#e5e8eb] focus:border-[#a67c48]"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowCreateAdminModal(false)}
                  className="gold-btn-outline flex-1 py-3 text-xs font-bold rounded-xl"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="gold-btn flex-1 py-3 text-xs font-bold rounded-xl shadow flex items-center justify-center gap-1"
                >
                  <Check size={14} /> {adminRegMode === 'existing' ? '지점 관리 권한 부여' : '신규 관리자 발급'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 🏢 지점(점포) 신규 등록 및 정보 수정 모달 */}
      {showCreateBranchModal && (
        <div className="modal-overlay" onClick={() => setShowCreateBranchModal(false)}>
          <div className="modal-content max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center pb-3 border-b border-[#e5e8eb]">
              <h3 className="text-base font-bold text-[#191f28] flex items-center gap-2">
                <Landmark className="text-[#a67c48]" size={18} />
                <span>{editingBranch ? '지점 정보 수정' : '새 지점(점포) 신규 등록'}</span>
              </h3>
              <button
                onClick={() => setShowCreateBranchModal(false)}
                className="text-[#8b95a1] hover:text-[#191f28] text-2xl leading-none"
              >
                &times;
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!branchInputId.trim() || !branchInputName.trim() || !branchInputFullName.trim() || !branchInputAddress.trim()) {
                  alert('모든 필수 항목을 입력해 주세요.');
                  return;
                }

                if (editingBranch) {
                  if (onEditBranch) {
                    onEditBranch(editingBranch.id, {
                      name: branchInputName.trim(),
                      fullName: branchInputFullName.trim(),
                      address: branchInputAddress.trim(),
                      });
                  }
                  setShowCreateBranchModal(false);
                } else {
                  if (onCreateBranch) {
                    const ok = onCreateBranch({
                      id: branchInputId.trim().toLowerCase(),
                      name: branchInputName.trim(),
                      fullName: branchInputFullName.trim(),
                      address: branchInputAddress.trim(),
                      });
                    if (ok) {
                      setShowCreateBranchModal(false);
                    }
                  }
                }
              }}
              className="space-y-4 pt-3 text-xs"
            >
              <div className="bg-[#f8f9fc] p-3 rounded-xl border border-[#e5e8eb] space-y-1">
                <p className="text-[11px] font-bold text-[#a67c48]">👑 최고 관리자 지점 등록</p>
                <p className="text-[11px] text-[#8b95a1] leading-relaxed">
                  새로운 지점을 추가하면 전체 앱의 지점 선택 목록 및 지점 관리자 배정 메뉴에 즉시 반영됩니다.
                </p>
              </div>

              {/* 지점 코드 ID */}
              <div className="form-group space-y-1">
                <label className="font-bold text-[#191f28]">지점 식별 코드 (영문 소문자 ID)</label>
                <input
                  type="text"
                  required
                  readOnly={!!editingBranch}
                  value={branchInputId}
                  onChange={(e) => setBranchInputId(e.target.value)}
                  placeholder="예: songpa, suwon, incheon"
                  className={`form-input text-xs py-2 px-3 rounded-xl w-full border border-[#e5e8eb] ${editingBranch ? 'bg-[#f0f0f2] text-[#8b95a1]' : 'focus:border-[#a67c48]'}`}
                />
              </div>

              {/* 지점명 & 풀네임 */}
              <div className="grid grid-cols-2 gap-3">
                <div className="form-group space-y-1">
                  <label className="font-bold text-[#191f28]">지점명 (약칭)</label>
                  <input
                    type="text"
                    required
                    value={branchInputName}
                    onChange={(e) => {
                      const val = e.target.value;
                      setBranchInputName(val);
                      if (!branchInputFullName || branchInputFullName.startsWith('르하임 스터디카페')) {
                        setBranchInputFullName(`르하임 스터디카페 ${val}`);
                      }
                    }}
                    placeholder="예: 송파점"
                    className="form-input text-xs py-2 px-3 rounded-xl w-full border border-[#e5e8eb] focus:border-[#a67c48]"
                  />
                </div>

                <div className="form-group space-y-1">
                  <label className="font-bold text-[#191f28]">지점 전체 명칭</label>
                  <input
                    type="text"
                    required
                    value={branchInputFullName}
                    onChange={(e) => setBranchInputFullName(e.target.value)}
                    placeholder="예: 르하임 스터디카페 송파점"
                    className="form-input text-xs py-2 px-3 rounded-xl w-full border border-[#e5e8eb] focus:border-[#a67c48]"
                  />
                </div>
              </div>

              {/* 매장 주소 */}
              <div className="form-group space-y-1">
                <label className="font-bold text-[#191f28]">매장 주소</label>
                <input
                  type="text"
                  required
                  value={branchInputAddress}
                  onChange={(e) => setBranchInputAddress(e.target.value)}
                  placeholder="예: 서울특별시 송파구 송파대로 123"
                  className="form-input text-xs py-2 px-3 rounded-xl w-full border border-[#e5e8eb] focus:border-[#a67c48]"
                />
              </div>



              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateBranchModal(false)}
                  className="gold-btn-outline flex-1 py-3 text-xs font-bold rounded-xl"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="gold-btn flex-1 py-3 text-xs font-bold rounded-xl shadow flex items-center justify-center gap-1"
                >
                  <Check size={14} />
                  <span>{editingBranch ? '수정 저장' : '지점 등록 완료'}</span>
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
