import React, { useState } from 'react';
import type { Room, Reservation, BankInfo, PaymentMethod } from '../types';
import { 
  Plus, Trash2, Calendar, Edit2, CheckCircle2, AlertCircle, 
  CreditCard, BarChart3, QrCode, Settings, Check, Search, Coins, Landmark, CalendarRange 
} from 'lucide-react';


interface AdminDashboardProps {
  rooms: Room[];
  reservations: Reservation[];
  bankInfo: BankInfo;
  onAddRoom: (room: Omit<Room, 'id'>) => void;
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
}

type TabType = 'rooms_reservations' | 'long_term_bulk' | 'revenue_analytics' | 'barcode_management' | 'bank_settings';

// 06:00 ~ 24:00 (30분 단위) 타임 옵션 생성
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
  onAddRoom,
  onDeleteRoom,
  onCancelReservation,
  onEditReservation,
  onAddBulkReservations,
  onTogglePaymentStatus,
  onVerifyBarcode,
  onUpdateBankInfo,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('rooms_reservations');

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

  // 바코드 검증 상태
  const [scanBarcodeId, setScanBarcodeId] = useState<string>('');
  const [scanResult, setScanResult] = useState<{ success: boolean; message: string } | null>(null);
  const [barcodeSearchTerm, setBarcodeSearchTerm] = useState<string>('');
  const [barcodeFilterStatus, setBarcodeFilterStatus] = useState<'all' | 'valid' | 'used' | 'cancelled'>('all');

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
      const startH = parseInt(r.startTime.split(':')[0], 10);
      return startH >= slot.range[0] && startH < slot.range[1];
    }).length;
    return { ...slot, count };
  });

  const maxSlotCount = Math.max(...timeSlotsBreakdown.map((s) => s.count), 1);

  // 바코드 관리 필터링
  const filteredBarcodes = reservations.filter((r) => {
    const matchText =
      r.barcodeId.toLowerCase().includes(barcodeSearchTerm.toLowerCase()) ||
      r.userName.toLowerCase().includes(barcodeSearchTerm.toLowerCase()) ||
      r.userPhone.includes(barcodeSearchTerm);

    if (barcodeFilterStatus === 'all') return matchText;
    return matchText && r.barcodeStatus === barcodeFilterStatus;
  });

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#fafafa]">
      {/* 관리자 탭 서브 네비게이션 */}
      <div className="bg-[#ffffff] border-b border-[#e5e5ea] px-4 pt-3 flex gap-1 overflow-x-auto shrink-0">
        <button
          onClick={() => setActiveTab('rooms_reservations')}
          className={`px-3 py-2.5 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-all whitespace-nowrap ${
            activeTab === 'rooms_reservations'
              ? 'border-[#b09168] text-[#b09168]'
              : 'border-transparent text-[#8e8e93] hover:text-[#1c1c1e]'
          }`}
        >
          <Calendar size={14} /> 룸 & 예약 관리
        </button>

        <button
          onClick={() => setActiveTab('long_term_bulk')}
          className={`px-3 py-2.5 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-all whitespace-nowrap ${
            activeTab === 'long_term_bulk'
              ? 'border-[#b09168] text-[#b09168]'
              : 'border-transparent text-[#8e8e93] hover:text-[#1c1c1e]'
          }`}
        >
          <CalendarRange size={14} /> 장기 일괄 예약
        </button>

        <button
          onClick={() => setActiveTab('revenue_analytics')}
          className={`px-3 py-2.5 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-all whitespace-nowrap ${
            activeTab === 'revenue_analytics'
              ? 'border-[#b09168] text-[#b09168]'
              : 'border-transparent text-[#8e8e93] hover:text-[#1c1c1e]'
          }`}
        >
          <BarChart3 size={14} /> 매출 & 시간대 통계
        </button>

        <button
          onClick={() => setActiveTab('barcode_management')}
          className={`px-3 py-2.5 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-all whitespace-nowrap ${
            activeTab === 'barcode_management'
              ? 'border-[#b09168] text-[#b09168]'
              : 'border-transparent text-[#8e8e93] hover:text-[#1c1c1e]'
          }`}
        >
          <QrCode size={14} /> 바코드 검증 / 발급
        </button>

        <button
          onClick={() => setActiveTab('bank_settings')}
          className={`px-3 py-2.5 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-all whitespace-nowrap ${
            activeTab === 'bank_settings'
              ? 'border-[#b09168] text-[#b09168]'
              : 'border-transparent text-[#8e8e93] hover:text-[#1c1c1e]'
          }`}
        >
          <Settings size={14} /> 통장 계좌 설정
        </button>
      </div>

      {/* 탭 콘텐츠 영역 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* TAB 1: 룸 및 예약 관리 */}
        {activeTab === 'rooms_reservations' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-base font-bold text-[#1c1c1e]">스터디룸 및 예약 목록</h2>
                <p className="text-xs text-[#8e8e93]">공부방을 추가/삭제하거나 실제 예약자의 예약을 변경/취소합니다.</p>
              </div>
              <button
                onClick={() => setShowAddRoomModal(true)}
                className="gold-btn flex items-center gap-1 text-xs py-2 px-3 rounded-lg"
              >
                <Plus size={14} /> 새 룸 추가
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

                  return (
                    <div key={room.id} className="bg-[#ffffff] border border-[#e5e5ea] rounded-xl overflow-hidden shadow-sm">
                      <div className="p-4 flex justify-between items-start border-b border-[#f0f0f2] bg-[#fdfdfd]">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <h3 className="text-base font-bold text-[#1c1c1e]">{room.name}</h3>
                            <span className="text-[10px] text-[#b09168] bg-[#b09168]/10 px-2 py-0.5 rounded font-semibold">
                              정원 {room.capacity}명
                            </span>
                          </div>
                          <p className="text-xs text-[#8e8e93]">{room.description}</p>
                        </div>

                        <button
                          onClick={() => {
                            if (confirm(`'${room.name}'을(를) 삭제하시겠습니까? 관련된 전체 예약 내역도 삭제됩니다.`)) {
                              onDeleteRoom(room.id);
                            }
                          }}
                          className="text-[#8e8e93] hover:text-[#ff3b30] p-1.5 rounded-lg hover:bg-[#ff3b30]/10 transition-all"
                          title="방 삭제"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>

                      {/* 예약 내역 리스트 */}
                      <div className="p-4 space-y-3">
                        <div className="flex justify-between items-center">
                          <h4 className="text-xs font-bold text-[#b09168] uppercase tracking-wider flex items-center gap-1">
                            <Calendar size={13} /> 예약 내역 ({roomResList.length}건)
                          </h4>
                        </div>

                        {roomResList.length === 0 ? (
                          <p className="text-xs text-[#8e8e93] py-2 italic">현재 등록된 예약이 없습니다.</p>
                        ) : (
                          <div className="space-y-2">
                            {roomResList.map((res) => (
                              <div
                                key={res.id}
                                className="flex flex-col sm:flex-row sm:items-center justify-between bg-[#f8f9fa] border border-[#e5e5ea] p-3 rounded-lg gap-2"
                              >
                                <div className="text-xs space-y-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-bold text-[#1c1c1e]">{res.userName}</span>
                                    <span className="text-[#8e8e93]">({res.userPhone})</span>
                                    {res.isLongTerm && (
                                      <span className="text-[9px] bg-[#34c759]/10 text-[#34c759] font-bold px-1.5 py-0.5 rounded">
                                        장기 과외
                                      </span>
                                    )}
                                    <span
                                      onClick={() => onTogglePaymentStatus(res.id)}
                                      className={`cursor-pointer text-[9px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5 transition-all ${
                                        res.paymentStatus === 'paid'
                                          ? 'bg-[#34c759]/10 text-[#34c759]'
                                          : 'bg-[#ff9500]/10 text-[#ff9500]'
                                      }`}
                                      title="클릭하여 입금 상태 토글"
                                    >
                                      {res.paymentStatus === 'paid' ? '결제/입금 완료' : '무통장 입금 대기'}
                                    </span>
                                  </div>

                                  <div className="text-[#8e8e93] flex items-center gap-2">
                                    <span>{res.date}</span>
                                    <span className="text-[#b09168] font-bold">{res.startTime} ~ {res.endTime}</span>
                                    <span className="text-[10px] text-[#8e8e93]">| 바코드: {res.barcodeId}</span>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                                  <button
                                    onClick={() => openEditModal(res)}
                                    className="text-xs font-semibold text-[#b09168] border border-[#b09168]/30 hover:bg-[#b09168]/10 px-2.5 py-1 rounded flex items-center gap-1"
                                  >
                                    <Edit2 size={12} /> 시간/룸 변경
                                  </button>

                                  <button
                                    onClick={() => {
                                      if (confirm(`'${res.userName}'님의 예약을 취소하시겠습니까?`)) {
                                        onCancelReservation(res.id);
                                      }
                                    }}
                                    className="text-xs font-semibold text-[#ff3b30] hover:bg-[#ff3b30]/10 px-2.5 py-1 rounded"
                                  >
                                    취소
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
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

        {/* TAB 4: 바코드 검증 & 발급 관리 */}
        {activeTab === 'barcode_management' && (
          <div className="space-y-6">
            {/* 바코드 스캐너 시뮬레이터 */}
            <div className="bg-white border border-[#e5e5ea] p-5 rounded-xl shadow-sm space-y-4">
              <div>
                <h3 className="text-sm font-bold text-[#1c1c1e] flex items-center gap-1.5">
                  <QrCode className="text-[#b09168]" size={18} /> 출입 바코드 실시간 검증 / 입장 처리 (Check-In)
                </h3>
                <p className="text-xs text-[#8e8e93]">이용자의 출입증 바코드 번호를 입력하여 입장을 승인/완료 처리합니다.</p>
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={scanBarcodeId}
                  onChange={(e) => setScanBarcodeId(e.target.value)}
                  placeholder="바코드 번호 입력 (예: LH-20260805-1029)"
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

            {/* 발급된 바코드 리스트 */}
            <div className="bg-white border border-[#e5e5ea] p-5 rounded-xl shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <h3 className="text-sm font-bold text-[#1c1c1e]">전체 발급 바코드 목록 ({filteredBarcodes.length}건)</h3>

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
                  return (
                    <div key={res.id} className="border border-[#e5e5ea] rounded-xl p-3.5 bg-[#f8f9fa] space-y-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="text-xs font-bold text-[#1c1c1e]">{res.userName}</span>
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
                      <div className="bg-white p-2.5 rounded-lg border border-[#e5e5ea] text-center space-y-1">
                        <div className="font-mono text-xs tracking-widest text-[#1c1c1e] font-bold">{res.barcodeId}</div>
                        {/* 바코드 세로 줄무늬 그래픽 */}
                        <div className="flex justify-center items-center gap-0.5 h-7 px-4 opacity-85">
                          {Array.from({ length: 28 }).map((_, i) => (
                            <div
                              key={i}
                              style={{ width: i % 3 === 0 ? '3px' : '1px' }}
                              className="bg-[#1c1c1e] h-full"
                            />
                          ))}
                        </div>
                      </div>

                      <div className="text-[10px] text-[#8e8e93] flex justify-between pt-1">
                        <span>
                          {res.date} {res.startTime}~{res.endTime}
                        </span>
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
    </div>
  );
};
