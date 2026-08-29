import React, { useState } from 'react';
import type { Room, Reservation, BankInfo, MasterBarcode, UserAccount, Branch, PointTransferRequest, PointTransaction } from '../types';
import { 
  ChevronRight, QrCode, Calendar, CheckCircle2, AlertCircle, Sparkles, Clock, 
  Lock, User, Coins, FileText, Edit2, Check, ArrowLeftRight, X, AlertTriangle, 
  CreditCard, Send, ArrowRight
} from 'lucide-react';
import { BarcodeView } from './BarcodeView';
import { showAppAlert } from './AppDialog';

const alert = showAppAlert;

interface UserDashboardProps {
  currentUser?: UserAccount | null;
  rooms: Room[];
  reservations: Reservation[];
  bankInfo: BankInfo;
  branches?: Branch[];
  masterBarcode?: MasterBarcode;
  selectedBranchId?: string;
  selectedBranchName?: string;
  currentBranchPoints?: number;
  branchManagerContact?: string;
  getBranchPoints?: (user: UserAccount | null, bId: string) => number;
  pointTransferRequests?: PointTransferRequest[];
  pointTransactions?: PointTransaction[];
  onApplyPointTransfer?: (data: { fromBranchId: string; toBranchId: string; amount: number; reason?: string }) => boolean;
  onApplyPointRefundRequest?: (data: { amount: number; bankName: string; accountNumber: string; accountHolder: string; reason?: string }) => Promise<{ success: boolean; message?: string }>;
  onSelectRoom: (roomId: string) => void;
  onCancelAndRefundReservation?: (resId: string, reason?: string) => Promise<{ success: boolean; message?: string; refundAmount?: number; penaltyAmount?: number }>;
  onOpenPointModal?: () => void;
  onUpdateUserProfile?: (userId: string, data: { name: string; phone: string; password?: string }) => Promise<{ success: boolean; message?: string }>;
}

// ⏱️ 예약 시간 기준 바코드 활성화 상태 판정 헬퍼
export function getBarcodeTimingState(dateStr: string, startTimeStr: string, endTimeStr: string): 'ACTIVE' | 'UPCOMING' | 'EXPIRED' {
  try {
    const now = new Date();
    const start = new Date(`${dateStr}T${startTimeStr}:00`);
    const end = new Date(`${dateStr}T${endTimeStr}:00`);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return 'ACTIVE';
    }

    const fiveMinBefore = new Date(start.getTime() - 5 * 60 * 1000);

    if (now < fiveMinBefore) {
      return 'UPCOMING';
    } else if (now >= fiveMinBefore && now <= end) {
      return 'ACTIVE';
    } else {
      return 'EXPIRED';
    }
  } catch {
    return 'ACTIVE';
  }
}

// 5분 전 시간 계산 (HH:MM -> HH:MM)
export function getActivateTimeString(startTimeStr: string): string {
  try {
    const [h, m] = startTimeStr.split(':').map(Number);
    let totalMinutes = h * 60 + m - 5;
    if (totalMinutes < 0) totalMinutes += 24 * 60;
    const newH = Math.floor(totalMinutes / 60);
    const newM = totalMinutes % 60;
    return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
  } catch {
    return startTimeStr;
  }
}

// ⏱️ 취소 가능 여부 검사 (입실 30분 전까지 가능)
export function checkCancellationEligibility(dateStr: string, startTimeStr: string): { canCancel: boolean; minutesRemaining: number } {
  try {
    const now = new Date();
    const start = new Date(`${dateStr}T${startTimeStr}:00`);
    if (isNaN(start.getTime())) return { canCancel: false, minutesRemaining: 0 };

    const diffMinutes = Math.floor((start.getTime() - now.getTime()) / (1000 * 60));
    return {
      canCancel: diffMinutes >= 30,
      minutesRemaining: diffMinutes,
    };
  } catch {
    return { canCancel: false, minutesRemaining: 0 };
  }
}

export const UserDashboard: React.FC<UserDashboardProps> = ({
  currentUser,
  rooms,
  reservations,
  bankInfo: _bankInfo,
  branches = [],
  masterBarcode,
  selectedBranchId = 'yeouido',
  selectedBranchName = '해당 지점',
  currentBranchPoints,
  branchManagerContact,
  getBranchPoints,
  pointTransferRequests: _pointTransferRequests = [],
  pointTransactions = [],
  onApplyPointTransfer,
  onApplyPointRefundRequest,
  onSelectRoom,
  onCancelAndRefundReservation,
  onOpenPointModal,
  onUpdateUserProfile,
}) => {
  const displayPoints = currentBranchPoints !== undefined ? currentBranchPoints : (currentUser?.points || 0);

  // 🧭 3개 메인 탭 네비게이션 상태 ('booking': 예약하기 | 'history': 내역확인 | 'mypage': 내정보)
  const [activeTab, setActiveTab] = useState<'booking' | 'history' | 'mypage'>('booking');

  // 내역확인 탭 서브 필터 ('all' | 'upcoming' | 'completed' | 'cancelled')
  const [historyFilter, setHistoryFilter] = useState<'all' | 'upcoming' | 'completed' | 'cancelled'>('all');

  // 🔄 지점 간 포인트 이전 신청 모달 상태
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferFromBranch, setTransferFromBranch] = useState(selectedBranchId);
  const [transferToBranch, setTransferToBranch] = useState(() => {
    const other = branches.find(b => b.id !== selectedBranchId);
    return other ? other.id : (branches[1]?.id || 'daebang');
  });
  const [transferAmount, setTransferAmount] = useState('10000');
  const [transferReason, setTransferReason] = useState('');

  // 💸 포인트 계좌 환불 요청 모달 상태
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [refundAmountInput, setRefundAmountInput] = useState('10000');
  const [refundBankName, setRefundBankName] = useState('신한은행');
  const [refundAccountNumber, setRefundAccountNumber] = useState('');
  const [refundAccountHolder, setRefundAccountHolder] = useState(currentUser?.name || '');
  const [refundReason, setRefundReason] = useState('');
  const [isSubmittingRefund, setIsSubmittingRefund] = useState(false);

  // 🎟️ 활성 바코드 팝업 모달 상태
  const [activeBarcodeReservation, setActiveBarcodeReservation] = useState<Reservation | null>(null);

  // ⏱️ 예약 취소 및 10% 위약금 확인 모달 상태
  const [cancelModalReservation, setCancelModalReservation] = useState<Reservation | null>(null);
  const [cancelReasonInput, setCancelReasonInput] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);

  // 👤 회원 정보 수정 폼 상태
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState(currentUser?.name || '');
  const [editPhone, setEditPhone] = useState(currentUser?.phone || '');
  const [editPassword, setEditPassword] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState('');
  const [profileSuccessMsg, setProfileSuccessMsg] = useState('');

  // 🔒 현재 접속자(currentUser)의 본인 예약 내역만 필터링
  const myReservations = currentUser
    ? reservations.filter((r) => 
        (r.userName && r.userName === currentUser.name) || 
        (r.userPhone && currentUser.phone && r.userPhone === currentUser.phone)
      )
    : reservations;

  // 🎟️ 출입 바코드 목록: 결제 완료되었으며 이용 시간이 끝나지 않은 유효 건
  const activeAndUpcomingPasses = myReservations.filter((r) => {
    if (r.paymentStatus !== 'paid' || r.barcodeStatus === 'cancelled') return false;
    const timing = getBarcodeTimingState(r.date, r.startTime, r.endTime);
    return timing !== 'EXPIRED';
  });
  
  // 🟢 현재 시간 기준 즉시 입장 가능한(5분 전 ~ 이용 종료 전) 활성 바코드 예약
  const activeValidPass = activeAndUpcomingPasses.find((r) => {
    const timing = getBarcodeTimingState(r.date, r.startTime, r.endTime);
    return timing === 'ACTIVE' && r.barcodeStatus === 'valid';
  });

  // 무통장 입금 대기 중인 내 예약 건
  const pendingReservations = myReservations.filter((r) => r.paymentStatus === 'deposit_pending');

  const handleOpenBarcodePass = (res: Reservation) => {
    const timing = getBarcodeTimingState(res.date, res.startTime, res.endTime);
    if (timing === 'UPCOMING') {
      alert(`이용 시작 5분 전(${getActivateTimeString(res.startTime)})부터 바코드가 발급되어 활성화됩니다.`);
      return;
    }
    if (timing === 'EXPIRED') {
      alert('이용 시간이 종료되어 바코드가 만료되었습니다.');
      return;
    }
    setActiveBarcodeReservation(res);
  };

  const handleSaveProfile = async () => {
    if (!currentUser || !onUpdateUserProfile) return;
    if (!editName.trim()) {
      setProfileMsg('이름을 입력해 주세요.');
      return;
    }
    if (!editPhone.trim()) {
      setProfileMsg('휴대폰 번호를 입력해 주세요.');
      return;
    }

    setIsSavingProfile(true);
    setProfileMsg('');
    setProfileSuccessMsg('');

    try {
      const res = await onUpdateUserProfile(currentUser.userId, {
        name: editName.trim(),
        phone: editPhone.trim(),
        password: editPassword.trim() || undefined,
      });

      if (res.success) {
        setProfileSuccessMsg('회원 정보가 성공적으로 수정되었습니다.');
        setTimeout(() => {
          setIsEditingProfile(false);
          setProfileSuccessMsg('');
        }, 1200);
      } else {
        setProfileMsg(res.message || '정보 수정 중 오류가 발생했습니다.');
      }
    } catch {
      setProfileMsg('정보 수정 중 오류가 발생했습니다.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  // ⏱️ 예약 취소 실행 처리
  const handleExecuteCancelReservation = async () => {
    if (!cancelModalReservation || !onCancelAndRefundReservation) return;
    setIsCancelling(true);
    try {
      const res = await onCancelAndRefundReservation(cancelModalReservation.id, cancelReasonInput.trim());
      if (res.success) {
        alert(res.message || '예약 취소가 성공적으로 처리되었습니다.');
        setCancelModalReservation(null);
        setCancelReasonInput('');
      } else {
        alert(res.message || '예약 취소 처리에 실패했습니다.');
      }
    } catch {
      alert('예약 취소 중 시스템 오류가 발생했습니다.');
    } finally {
      setIsCancelling(false);
    }
  };

  // 💸 포인트 계좌 환불 신청 제출 처리
  const handleSubmitRefundRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseInt(refundAmountInput, 10);
    if (isNaN(amt) || amt <= 0) {
      alert('올바른 환불 포인트를 입력해 주세요.');
      return;
    }
    if (amt > displayPoints) {
      alert(`보유 포인트(${displayPoints.toLocaleString()}P)를 초과하여 신청할 수 없습니다.`);
      return;
    }
    if (!refundAccountNumber.trim() || !refundAccountHolder.trim()) {
      alert('환불받으실 계좌번호와 예금주명을 정확히 입력해 주세요.');
      return;
    }

    if (!onApplyPointRefundRequest) {
      alert('포인트 환불 기능을 지원하지 않는 환경입니다.');
      return;
    }

    setIsSubmittingRefund(true);
    try {
      const res = await onApplyPointRefundRequest({
        amount: amt,
        bankName: refundBankName.trim(),
        accountNumber: refundAccountNumber.trim(),
        accountHolder: refundAccountHolder.trim(),
        reason: refundReason.trim(),
      });

      if (res.success) {
        alert(res.message || '포인트 환불 신청이 완료되었습니다.');
        setShowRefundModal(false);
        setRefundAccountNumber('');
        setRefundReason('');
      } else {
        alert(res.message || '환불 신청에 실패했습니다.');
      }
    } catch {
      alert('환불 신청 중 오류가 발생했습니다.');
    } finally {
      setIsSubmittingRefund(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-y-auto pb-20 sm:pb-6 space-y-4">
      {/* 🧭 상단 3개 메인 탭 네비게이션 바 */}
      <div className="bg-white border-b border-[#e5e8eb] sticky top-0 z-20 px-4 pt-2 shadow-xs">
        <div className="flex gap-2 max-w-lg mx-auto">
          <button
            type="button"
            onClick={() => setActiveTab('booking')}
            className={`flex-1 py-3 text-xs sm:text-sm font-extrabold flex items-center justify-center gap-1.5 border-b-2 transition-all cursor-pointer ${
              activeTab === 'booking'
                ? 'border-[#a67c48] text-[#a67c48]'
                : 'border-transparent text-[#8b95a1] hover:text-[#191f28]'
            }`}
          >
            <Calendar size={16} />
            <span>예약하기</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`flex-1 py-3 text-xs sm:text-sm font-extrabold flex items-center justify-center gap-1.5 border-b-2 transition-all cursor-pointer relative ${
              activeTab === 'history'
                ? 'border-[#a67c48] text-[#a67c48]'
                : 'border-transparent text-[#8b95a1] hover:text-[#191f28]'
            }`}
          >
            <Clock size={16} />
            <span>내역확인</span>
            {activeAndUpcomingPasses.length > 0 && (
              <span className="w-2 h-2 rounded-full bg-[#28a745] absolute top-2 right-4 animate-ping" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('mypage')}
            className={`flex-1 py-3 text-xs sm:text-sm font-extrabold flex items-center justify-center gap-1.5 border-b-2 transition-all cursor-pointer ${
              activeTab === 'mypage'
                ? 'border-[#a67c48] text-[#a67c48]'
                : 'border-transparent text-[#8b95a1] hover:text-[#191f28]'
            }`}
          >
            <User size={16} />
            <span>내 정보 & 포인트</span>
          </button>
        </div>
      </div>

      {/* 탭 본문 영역 */}
      <div className="p-4 space-y-4 max-w-4xl mx-auto w-full">
        {/* ======================================================== */}
        {/* TAB 1: 📅 예약하기 (룸 목록 및 실시간 예약) */}
        {/* ======================================================== */}
        {activeTab === 'booking' && (
          <div className="space-y-4">
            {/* 🟢 이용 시작 5분 전 ~ 이용 종료 시간까지 상단 대표 바코드 하이라이트 배너 */}
            {activeValidPass ? (
              <div 
                onClick={() => handleOpenBarcodePass(activeValidPass)}
                className="rounded-2xl p-4 shadow-md cursor-pointer transition-all transform hover:scale-[1.01] active:scale-[0.99] flex items-center justify-between border border-[#8a6230]"
                style={{
                  background: 'linear-gradient(135deg, #a67c48 0%, #8a6230 100%)',
                  backgroundColor: '#a67c48',
                  color: '#ffffff',
                }}
              >
                <div className="space-y-1.5" style={{ color: '#ffffff' }}>
                  <div 
                    className="flex items-center gap-1.5 text-xs font-bold px-2.5 py-0.5 rounded-full w-max backdrop-blur-sm"
                    style={{ backgroundColor: 'rgba(255, 255, 255, 0.25)', color: '#ffffff' }}
                  >
                    <Sparkles size={13} style={{ color: '#fde047' }} />
                    <span>입장 가능 출입 바코드 활성화됨</span>
                  </div>
                  <h3 className="text-base font-extrabold flex items-center gap-1.5" style={{ color: '#ffffff' }}>
                    <QrCode size={18} style={{ color: '#ffffff' }} /> 출입 바코드 터치하여 열기
                  </h3>
                  <p className="text-xs font-medium flex items-center gap-1" style={{ color: '#f8fafc' }}>
                    <Clock size={13} style={{ color: '#ffffff' }} />
                    {rooms.find(r => r.id === activeValidPass.roomId)?.name || '공부방'} | {activeValidPass.date} ({activeValidPass.startTime}~{activeValidPass.endTime})
                  </p>
                </div>
                <button 
                  className="text-xs font-bold px-3.5 py-2.5 rounded-xl shadow shrink-0"
                  style={{
                    backgroundColor: '#ffffff',
                    color: '#8a6230',
                    fontWeight: 800,
                  }}
                >
                  바코드 보기
                </button>
              </div>
            ) : pendingReservations.length > 0 && (
              <div className="bg-[#f59e0b]/10 border border-[#f59e0b]/30 rounded-2xl p-3.5 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <AlertCircle size={20} className="text-[#f59e0b] shrink-0" />
                  <div>
                    <h4 className="text-sm font-bold text-[#191f28]">무통장 입금 확인 대기 중 ({pendingReservations.length}건)</h4>
                    <p className="text-xs text-[#8b95a1]">관리자 입금 확인 후 이용 5분 전에 바코드가 자동 발급됩니다.</p>
                  </div>
                </div>
              </div>
            )}

            {/* 👤 포인트 요약 카드 */}
            <div className="bg-[#ffffff] border border-[#a67c48]/30 rounded-2xl p-4 shadow-sm space-y-3">
              <div className="flex justify-between items-center bg-[#f8f9fc] p-3 rounded-xl border border-[#e5e8eb]">
                <div className="flex items-center gap-2">
                  <Coins size={20} className="text-[#a67c48]" />
                  <div>
                    <span className="text-[11px] text-[#8b95a1] flex items-center gap-1">
                      <strong className="text-[#a67c48] font-bold">[{selectedBranchName}]</strong> 보유 포인트
                    </span>
                    <p className="text-base font-extrabold text-[#191f28]">{displayPoints.toLocaleString()} P</p>
                  </div>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <button
                    onClick={() => {
                      setTransferFromBranch(selectedBranchId);
                      const other = branches.find(b => b.id !== selectedBranchId);
                      if (other) setTransferToBranch(other.id);
                      setShowTransferModal(true);
                    }}
                    className="gold-btn-outline text-xs py-1.5 px-2.5 rounded-lg font-bold shadow-sm flex items-center gap-1"
                    title="다른 지점으로 포인트 이전 신청"
                  >
                    <ArrowLeftRight size={13} /> 이전
                  </button>
                  {onOpenPointModal && (
                    <button
                      onClick={onOpenPointModal}
                      className="gold-btn text-xs py-1.5 px-3.5 rounded-lg font-bold shadow-sm"
                    >
                      충전
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* 공부방 선택 세션 헤더 */}
            <div className="flex justify-between items-center pt-1">
              <div>
                <h2 className="text-base font-bold text-[#a67c48]">공부방 선택 및 실시간 예약</h2>
                <p className="text-xs text-[#8b95a1]">원하시는 공부방을 선택하여 스케줄을 확인하고 예약을 진행하세요.</p>
              </div>

              <button
                onClick={() => setActiveTab('history')}
                className="gold-btn-outline text-xs py-2 px-3 rounded-xl font-bold flex items-center gap-1.5 shrink-0"
              >
                <QrCode size={15} /> 내 바코드 확인
              </button>
            </div>

            {/* 공부방 카드 목록 */}
            <div className="space-y-3">
              {rooms.length === 0 ? (
                <div className="text-center py-12 text-[#8b95a1] border border-dashed border-[#e5e8eb] rounded-xl bg-white text-sm">
                  현재 이용 가능한 공부방이 없습니다.
                </div>
              ) : (
                rooms.map((room, index) => (
                  <div
                    key={room.id}
                    onClick={() => onSelectRoom(room.id)}
                    className="group bg-[#f8f9fc] hover:bg-[#ffffff] border border-[#e5e8eb] hover:border-[#a67c48]/50 rounded-2xl p-4 flex justify-between items-center cursor-pointer transition-all duration-200 hover:-translate-y-0.5 shadow-sm"
                  >
                    <div className="flex items-center gap-3.5">
                      <span className="text-sm font-extrabold text-[#a67c48] tracking-wider shrink-0 bg-[#a67c48]/10 px-2.5 py-1 rounded-lg">
                        ROOM {index + 1}
                      </span>
                      <div>
                        <h3 className="text-sm font-bold text-[#191f28]">{room.name}</h3>
                        <p className="text-xs text-[#8b95a1] pt-0.5">{room.description}</p>
                      </div>
                    </div>

                    <div className="shrink-0 pl-2">
                      <div 
                        className="text-[11px] font-bold py-1.5 px-3 rounded-lg shadow-sm flex items-center gap-1 transition-all group-hover:shadow-md"
                        style={{ backgroundColor: '#a67c48', color: '#ffffff' }}
                      >
                        예약하기 <ChevronRight size={14} strokeWidth={3} />
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* 르하임 스터디카페 이용 안내 */}
            <div className="bg-[#ffffff] border border-[#e5e8eb] rounded-2xl p-5 space-y-3.5 shadow-sm">
              <div className="border-b border-[#e5e8eb] pb-3 mb-1">
                <h4 className="font-bold text-[#a67c48] text-sm flex items-center gap-2">
                  <span>📌</span>
                  <span>르하임 이용 & 취소 규정</span>
                </h4>
              </div>

              <div className="space-y-2.5 text-xs text-[#4e5968] leading-relaxed">
                <div className="flex items-start gap-2">
                  <span className="text-[#a67c48] font-black text-base leading-none select-none shrink-0">•</span>
                  <p>공부방 예약은 <strong className="text-[#191f28]">30분 단위</strong>로 원하는 시간만큼 자유롭게 신청할 수 있습니다.</p>
                </div>

                <div className="flex items-start gap-2">
                  <span className="text-[#a67c48] font-black text-base leading-none select-none shrink-0">•</span>
                  <p>출입 바코드는 <strong className="text-[#191f28]">이용 시작 5분 전</strong>에 자동 활성화되며, <strong className="text-[#191f28]">이용 시간 종료 시 자동 소멸</strong>됩니다.</p>
                </div>

                <div className="flex items-start gap-2">
                  <span className="text-[#a67c48] font-black text-base leading-none select-none shrink-0">•</span>
                  <p className="text-[#e93d3d] font-semibold">
                    예약 취소는 <strong className="underline">입실 30분 전까지만 가능</strong>하며, 취소 시 <strong className="underline">10% 위약금을 제외한 90% 포인트가 반환</strong>됩니다.
                  </p>
                </div>

                {branchManagerContact && (
                  <div className="flex items-start gap-2">
                    <span className="text-[#a67c48] font-black text-base leading-none select-none shrink-0">•</span>
                    <p>
                      지점 담당자 문의: <a href={`tel:${branchManagerContact.split(' / ')[0]}`} className="text-[#191f28] font-bold hover:underline hover:text-[#a67c48] transition-colors">{branchManagerContact}</a>
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 2: 📋 내역확인 (내 예약 내역 & 실시간 바코드 & 예약 취소) */}
        {/* ======================================================== */}
        {activeTab === 'history' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-base font-bold text-[#191f28] flex items-center gap-1.5">
                  <Clock size={18} className="text-[#a67c48]" /> 내 예약 / 이용 내역
                </h3>
                <p className="text-xs text-[#8b95a1]">예약 일정 및 출입 바코드를 확인하고 취소를 진행할 수 있습니다.</p>
              </div>

              {/* 내역 필터 */}
              <div className="flex bg-[#f1f3f5] p-1 rounded-xl text-[11px] font-bold">
                <button
                  type="button"
                  onClick={() => setHistoryFilter('all')}
                  className={`px-2.5 py-1 rounded-lg transition-all ${historyFilter === 'all' ? 'bg-white text-[#191f28] shadow-xs' : 'text-[#8b95a1]'}`}
                >
                  전체
                </button>
                <button
                  type="button"
                  onClick={() => setHistoryFilter('upcoming')}
                  className={`px-2.5 py-1 rounded-lg transition-all ${historyFilter === 'upcoming' ? 'bg-white text-[#191f28] shadow-xs' : 'text-[#8b95a1]'}`}
                >
                  이용 예정
                </button>
                <button
                  type="button"
                  onClick={() => setHistoryFilter('completed')}
                  className={`px-2.5 py-1 rounded-lg transition-all ${historyFilter === 'completed' ? 'bg-white text-[#191f28] shadow-xs' : 'text-[#8b95a1]'}`}
                >
                  완료
                </button>
                <button
                  type="button"
                  onClick={() => setHistoryFilter('cancelled')}
                  className={`px-2.5 py-1 rounded-lg transition-all ${historyFilter === 'cancelled' ? 'bg-white text-[#191f28] shadow-xs' : 'text-[#8b95a1]'}`}
                >
                  취소됨
                </button>
              </div>
            </div>

            {/* 취소 규정 안내 박스 */}
            <div className="bg-[#fff9f2] border border-[#f5d0a9] rounded-2xl p-3.5 text-xs text-[#8a5314] space-y-1">
              <p className="font-bold flex items-center gap-1.5">
                <AlertTriangle size={14} className="text-[#d97706]" /> 르하임 스터디카페 취소 & 환불 규정
              </p>
              <ul className="list-disc pl-4 space-y-0.5 text-[11px]">
                <li><b>입실 30분 전까지</b>만 취소가 가능합니다. (30분 이내이거나 이용 시간이 시작되면 취소 불가)</li>
                <li>예약 취소 시 <b>시간 단위 10% 위약금을 제외한 90% 포인트가 즉시 환불</b> 지급됩니다.</li>
              </ul>
            </div>

            {/* 예약 내역 리스트 */}
            <div className="space-y-3">
              {(() => {
                const filtered = myReservations.filter((r) => {
                  if (historyFilter === 'cancelled') return r.barcodeStatus === 'cancelled';
                  if (historyFilter === 'completed') return r.barcodeStatus === 'used' || getBarcodeTimingState(r.date, r.startTime, r.endTime) === 'EXPIRED';
                  if (historyFilter === 'upcoming') return r.barcodeStatus !== 'cancelled' && r.barcodeStatus !== 'used' && getBarcodeTimingState(r.date, r.startTime, r.endTime) !== 'EXPIRED';
                  return true;
                });

                if (filtered.length === 0) {
                  return (
                    <div className="text-center py-12 border border-dashed border-[#e5e8eb] rounded-2xl bg-white space-y-2">
                      <Calendar size={32} className="mx-auto text-[#b0b8c1]" />
                      <p className="text-sm font-bold text-[#191f28]">해당하는 예약 내역이 없습니다.</p>
                      <button
                        onClick={() => setActiveTab('booking')}
                        className="gold-btn text-xs py-2 px-4 rounded-xl font-bold shadow-xs mt-2"
                      >
                        공부방 예약하러 가기
                      </button>
                    </div>
                  );
                }

                return filtered.map((res) => {
                  const room = rooms.find((r) => r.id === res.roomId);
                  const timingState = getBarcodeTimingState(res.date, res.startTime, res.endTime);
                  const isActive = timingState === 'ACTIVE' && res.barcodeStatus === 'valid';
                  const isCancelled = res.barcodeStatus === 'cancelled';
                  const isUsed = res.barcodeStatus === 'used';
                  const { canCancel, minutesRemaining } = checkCancellationEligibility(res.date, res.startTime);

                  return (
                    <div 
                      key={res.id}
                      className={`border rounded-2xl p-4 transition-all space-y-3 ${
                        isCancelled 
                          ? 'bg-[#fcfcfd] border-[#e5e8eb] opacity-70'
                          : isActive
                          ? 'bg-white border-[#a67c48] shadow-md ring-2 ring-[#a67c48]/20'
                          : 'bg-white border-[#e5e8eb] shadow-sm'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-extrabold text-[#191f28]">
                              {room?.name || '공부방'}
                            </span>
                            <span className="text-xs text-[#8b95a1]">({res.userName}님)</span>
                          </div>
                          <p className="text-xs text-[#4e5968] flex items-center gap-1.5 pt-1">
                            <Calendar size={13} className="text-[#a67c48]" />
                            <strong className="text-[#191f28]">{res.date}</strong> ({res.startTime} ~ {res.endTime})
                          </p>
                        </div>

                        {/* 상태 뱃지 */}
                        <div>
                          {isCancelled ? (
                            <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-[#e93d3d]/10 text-[#e93d3d] border border-[#e93d3d]/20">
                              취소 및 환불 완료
                            </span>
                          ) : isUsed ? (
                            <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-[#f1f3f5] text-[#8b95a1]">
                              이용 완료
                            </span>
                          ) : isActive ? (
                            <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-[#28a745]/15 text-[#28a745] border border-[#28a745]/30 flex items-center gap-1 animate-pulse">
                              ● 입장 가능 (출입 바코드 활성)
                            </span>
                          ) : timingState === 'UPCOMING' ? (
                            <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-[#f59e0b]/15 text-[#d97706] border border-[#f59e0b]/30 flex items-center gap-1">
                              <Clock size={11} /> 5분 전 발급 예정
                            </span>
                          ) : (
                            <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-[#f1f3f5] text-[#8b95a1]">
                              시간 만료
                            </span>
                          )}
                        </div>
                      </div>

                      {/* 바코드 미리보기 / 클릭 박스 */}
                      {!isCancelled && (
                        <div>
                          {isActive ? (
                            <div
                              onClick={() => handleOpenBarcodePass(res)}
                              className="bg-[#f8f9fc] hover:bg-[#f0f4f9] p-3 rounded-xl border border-[#e5e8eb] hover:border-[#a67c48] cursor-pointer transition-all text-center space-y-1 group"
                            >
                              <BarcodeView value={res.barcodeId} height={60} showText={true} />
                              <p className="text-[11px] text-[#a67c48] font-bold group-hover:underline flex items-center justify-center gap-1">
                                터치하여 대형 출입 바코드 열기 🔍
                              </p>
                            </div>
                          ) : timingState === 'UPCOMING' ? (
                            <div className="bg-[#f8f9fc] p-3 rounded-xl border border-dashed border-[#e5e8eb] text-center space-y-1">
                              <p className="text-xs font-bold text-[#4e5968] flex items-center justify-center gap-1">
                                <Lock size={13} className="text-[#a67c48]" /> 이용 시작 5분 전 바코드가 활성화됩니다.
                              </p>
                              <p className="text-[11px] text-[#8b95a1]">
                                발급 예정 시각: <strong className="text-[#a67c48]">{res.date} {getActivateTimeString(res.startTime)}</strong>
                              </p>
                            </div>
                          ) : null}
                        </div>
                      )}

                      {/* 하단 금액 & 취소 액션 버튼 */}
                      <div className="flex justify-between items-center pt-2 border-t border-[#e5e8eb] text-xs">
                        <div className="flex items-center gap-2">
                          <span className="text-[#8b95a1]">결제 금액:</span>
                          <strong className="text-[#191f28]">{(res.costPoints || 4000).toLocaleString()} P</strong>
                        </div>

                        {!isCancelled && !isUsed && timingState !== 'EXPIRED' && (
                          <div className="flex items-center gap-2">
                            {canCancel ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setCancelModalReservation(res);
                                  setCancelReasonInput('');
                                }}
                                className="text-xs text-[#e93d3d] font-bold border border-[#e93d3d]/30 bg-[#e93d3d]/5 hover:bg-[#e93d3d]/15 px-3 py-1.5 rounded-xl transition-all flex items-center gap-1 cursor-pointer"
                              >
                                <X size={13} /> 예약 취소 (10% 공제)
                              </button>
                            ) : (
                              <span 
                                className="text-[11px] text-[#8b95a1] bg-[#f1f3f5] px-2.5 py-1 rounded-lg font-medium cursor-not-allowed"
                                title="입실 30분 전까지만 취소할 수 있습니다."
                              >
                                ⏱️ 취소 불가 (시작 {minutesRemaining > 0 ? `${minutesRemaining}분 전` : '경과'})
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 3: 👤 내 정보 & 포인트 관리 */}
        {/* ======================================================== */}
        {activeTab === 'mypage' && (
          <div className="space-y-4">
            {/* 1. 회원 프로필 요약 및 수정 카드 */}
            <div className="bg-white border border-[#e5e8eb] rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-[#a67c48]/10 text-[#a67c48] flex items-center justify-center font-bold text-lg shrink-0">
                    <User size={24} />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-[#191f28] flex items-center gap-1.5">
                      {currentUser?.name}님
                      <span className="text-[10px] font-bold bg-[#a67c48]/15 text-[#a67c48] px-2 py-0.5 rounded-full">
                        정회원
                      </span>
                    </h4>
                    <p className="text-xs text-[#8b95a1] pt-0.5">아이디: {currentUser?.userId} | 연락처: {currentUser?.phone || '-'}</p>
                  </div>
                </div>

                {!isEditingProfile && (
                  <button
                    onClick={() => {
                      setEditName(currentUser?.name || '');
                      setEditPhone(currentUser?.phone || '');
                      setEditPassword('');
                      setProfileMsg('');
                      setProfileSuccessMsg('');
                      setIsEditingProfile(true);
                    }}
                    className="gold-btn-outline text-xs py-1.5 px-3 rounded-xl font-bold flex items-center gap-1 shrink-0"
                  >
                    <Edit2 size={13} /> 정보 수정
                  </button>
                )}
              </div>

              {/* 프로필 수정 폼 */}
              {isEditingProfile && (
                <div className="bg-[#f8f9fc] p-4 rounded-xl border border-[#e5e8eb] space-y-3 text-xs">
                  <h5 className="font-bold text-[#191f28]">👤 회원 정보 수정</h5>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[#4e5968] font-bold">이름</label>
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        placeholder="이름 입력"
                        className="form-input text-xs py-2 px-3 rounded-xl w-full border border-[#e5e8eb] bg-white focus:border-[#a67c48]"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[#4e5968] font-bold">휴대폰 번호</label>
                      <input
                        type="text"
                        value={editPhone}
                        onChange={(e) => setEditPhone(e.target.value)}
                        placeholder="010-0000-0000"
                        className="form-input text-xs py-2 px-3 rounded-xl w-full border border-[#e5e8eb] bg-white focus:border-[#a67c48]"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[#4e5968] font-bold">새 비밀번호 (변경 시에만 입력)</label>
                    <input
                      type="password"
                      value={editPassword}
                      onChange={(e) => setEditPassword(e.target.value)}
                      placeholder="변경할 비밀번호 입력 (미입력 시 기존 유지)"
                      className="form-input text-xs py-2 px-3 rounded-xl w-full border border-[#e5e8eb] bg-white focus:border-[#a67c48]"
                    />
                  </div>

                  {profileMsg && <p className="text-[#e93d3d] text-[11px]">{profileMsg}</p>}
                  {profileSuccessMsg && <p className="text-[#28a745] text-[11px] font-bold">{profileSuccessMsg}</p>}

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsEditingProfile(false)}
                      className="gold-btn-outline flex-1 py-2 rounded-xl text-xs font-bold"
                    >
                      취소
                    </button>
                    <button
                      type="button"
                      disabled={isSavingProfile}
                      onClick={handleSaveProfile}
                      className="gold-btn flex-1 py-2 rounded-xl text-xs font-bold shadow flex items-center justify-center gap-1"
                    >
                      <Check size={14} /> {isSavingProfile ? '저장 중...' : '저장 완료'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* 2. 지점별 포인트 잔액 및 관리 액션 카드 */}
            <div className="bg-white border border-[#e5e8eb] rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex justify-between items-center border-b border-[#e5e8eb] pb-3">
                <h4 className="text-base font-bold text-[#191f28] flex items-center gap-1.5">
                  <Coins size={18} className="text-[#a67c48]" /> 포인트 잔액 및 환불 / 이전 관리
                </h4>
              </div>

              {/* 현재 지점 보유 포인트 */}
              <div className="bg-[#fcf8f2] border border-[#a67c48]/30 rounded-2xl p-4 flex justify-between items-center">
                <div>
                  <span className="text-xs text-[#8a6230] font-semibold">
                    [{selectedBranchName}] 전용 보유 포인트
                  </span>
                  <p className="text-2xl font-black text-[#a67c48] pt-0.5">
                    {displayPoints.toLocaleString()} P
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[11px] text-[#8b95a1] block">포인트 1P = 1원</span>
                </div>
              </div>

              {/* 포인트 액션 3종 버튼 */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {/* 충전 신청 */}
                <button
                  type="button"
                  onClick={onOpenPointModal}
                  className="gold-btn py-3 px-3 rounded-xl font-bold text-xs shadow flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Coins size={15} /> 포인트 충전 신청
                </button>

                {/* 계좌 환불 요청 */}
                <button
                  type="button"
                  onClick={() => {
                    setRefundAmountInput('10000');
                    setShowRefundModal(true);
                  }}
                  className="bg-white hover:bg-[#f8f9fa] text-[#191f28] border border-[#e5e8eb] py-3 px-3 rounded-xl font-bold text-xs shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <CreditCard size={15} className="text-[#e93d3d]" /> 포인트 계좌 환불 요청
                </button>

                {/* 지점 간 이전 신청 */}
                <button
                  type="button"
                  onClick={() => {
                    setTransferFromBranch(selectedBranchId);
                    const other = branches.find(b => b.id !== selectedBranchId);
                    if (other) setTransferToBranch(other.id);
                    setShowTransferModal(true);
                  }}
                  className="gold-btn-outline py-3 px-3 rounded-xl font-bold text-xs shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <ArrowLeftRight size={15} /> 타 지점 이전 신청
                </button>
              </div>
            </div>

            {/* 3. 최근 포인트 사용 / 충전 / 환불 내역 리스트 */}
            <div className="bg-white border border-[#e5e8eb] rounded-2xl p-5 shadow-sm space-y-3">
              <h4 className="text-sm font-bold text-[#191f28] flex items-center gap-1.5">
                <FileText size={16} className="text-[#a67c48]" /> 최근 포인트 거래 및 환불 내역
              </h4>

              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {pointTransactions.length === 0 ? (
                  <p className="text-xs text-[#8b95a1] text-center py-6">최근 포인트 거래 내역이 없습니다.</p>
                ) : (
                  pointTransactions.slice(0, 10).map((tx) => (
                    <div key={tx.id} className="flex justify-between items-center p-3 rounded-xl bg-[#f8f9fc] border border-[#e5e8eb] text-xs">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className={`font-bold text-[10px] px-2 py-0.5 rounded-full ${
                            tx.type === 'charge_request' || tx.type === 'charge_approved'
                              ? 'bg-[#28a745]/15 text-[#28a745]'
                              : tx.type === 'refund'
                              ? 'bg-[#0088cc]/15 text-[#0088cc]'
                              : 'bg-[#e93d3d]/15 text-[#e93d3d]'
                          }`}>
                            {tx.type === 'charge_request' ? '충전 신청' : tx.type === 'charge_approved' ? '충전 완료' : tx.type === 'refund' ? '환불' : '사용'}
                          </span>
                          <span className="font-semibold text-[#191f28]">{tx.description}</span>
                        </div>
                        <p className="text-[10px] text-[#8b95a1] pt-0.5">{tx.createdAt?.slice(0, 16).replace('T', ' ')}</p>
                      </div>

                      <div className="text-right">
                        <strong className={`font-extrabold ${tx.type === 'use' ? 'text-[#e93d3d]' : 'text-[#28a745]'}`}>
                          {tx.type === 'use' ? '-' : '+'}{(tx.amount || 0).toLocaleString()} P
                        </strong>
                        <span className={`text-[10px] block ${tx.status === 'completed' ? 'text-[#28a745]' : 'text-[#f59e0b]'}`}>
                          {tx.status === 'completed' ? '완료' : '대기중'}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* 모바일 전용 하단 고정 탭바 (Bottom Navigation Bar) */}
      {/* ======================================================== */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-[#e5e8eb] px-4 py-2 flex justify-around items-center shadow-lg">
        <button
          type="button"
          onClick={() => setActiveTab('booking')}
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-all cursor-pointer ${
            activeTab === 'booking' ? 'text-[#a67c48] font-bold' : 'text-[#8b95a1]'
          }`}
        >
          <Calendar size={20} />
          <span className="text-[10px]">예약하기</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('history')}
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-all cursor-pointer relative ${
            activeTab === 'history' ? 'text-[#a67c48] font-bold' : 'text-[#8b95a1]'
          }`}
        >
          <Clock size={20} />
          <span className="text-[10px]">내역확인</span>
          {activeAndUpcomingPasses.length > 0 && (
            <span className="w-2 h-2 rounded-full bg-[#28a745] absolute top-1 right-2 animate-ping" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('mypage')}
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-all cursor-pointer ${
            activeTab === 'mypage' ? 'text-[#a67c48] font-bold' : 'text-[#8b95a1]'
          }`}
        >
          <User size={20} />
          <span className="text-[10px]">내정보</span>
        </button>
      </div>

      {/* ======================================================== */}
      {/* ⏱️ 예약 취소 및 10% 위약금 확인 모달 */}
      {/* ======================================================== */}
      {cancelModalReservation && (() => {
        const originalCost = cancelModalReservation.costPoints || 4000;
        const penalty = Math.round(originalCost * 0.1);
        const refund = originalCost - penalty;
        const room = rooms.find(r => r.id === cancelModalReservation.roomId);

        return (
          <div className="modal-overlay" onClick={() => !isCancelling && setCancelModalReservation(null)}>
            <div className="modal-content max-w-sm space-y-4" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center pb-2.5 border-b border-[#e5e8eb]">
                <h3 className="text-base font-bold text-[#e93d3d] flex items-center gap-1.5">
                  <AlertTriangle size={18} /> 예약 취소 및 포인트 환불
                </h3>
                <button 
                  onClick={() => !isCancelling && setCancelModalReservation(null)}
                  className="text-[#8b95a1] hover:text-[#191f28] text-2xl"
                >
                  &times;
                </button>
              </div>

              {/* 예약 요약 */}
              <div className="bg-[#f8f9fc] p-3.5 rounded-xl border border-[#e5e8eb] space-y-1 text-xs">
                <p className="font-bold text-[#191f28]">{room?.name || '공부방'}</p>
                <p className="text-[#4e5968]">{cancelModalReservation.date} ({cancelModalReservation.startTime} ~ {cancelModalReservation.endTime})</p>
                <p className="text-[11px] text-[#8b95a1]">예약자: {cancelModalReservation.userName}님</p>
              </div>

              {/* 10% 위약금 계산 프리뷰 카드 */}
              <div className="bg-[#fff9f2] border border-[#f5d0a9] rounded-xl p-3.5 space-y-2 text-xs">
                <div className="flex justify-between items-center text-[#4e5968]">
                  <span>결제 포인트:</span>
                  <strong className="text-[#191f28]">{originalCost.toLocaleString()} P</strong>
                </div>
                <div className="flex justify-between items-center text-[#e93d3d]">
                  <span>취소 위약금 (10% 공제):</span>
                  <strong>-{penalty.toLocaleString()} P</strong>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-[#f5d0a9] text-sm font-extrabold text-[#28a745]">
                  <span>실제 환불 포인트 (90%):</span>
                  <span>+{refund.toLocaleString()} P</span>
                </div>
              </div>

              {/* 취소 사유 입력 */}
              <div className="space-y-1 text-xs">
                <label className="font-bold text-[#191f28]">취소 사유 (선택)</label>
                <input
                  type="text"
                  value={cancelReasonInput}
                  onChange={(e) => setCancelReasonInput(e.target.value)}
                  placeholder="예: 일정 변경, 개인 사정"
                  className="form-input text-xs py-2 px-3 rounded-xl w-full border border-[#e5e8eb] bg-white focus:border-[#a67c48]"
                />
                <p className="text-[10px] text-[#8b95a1]">
                  💡 입실 30분 전 취소 규정에 따라 10% 위약금을 제외한 포인트가 즉시 회원님의 보유 포인트로 환불됩니다.
                </p>
              </div>

              {/* 액션 버튼 */}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  disabled={isCancelling}
                  onClick={() => setCancelModalReservation(null)}
                  className="gold-btn-outline flex-1 py-2.5 text-xs font-bold rounded-xl"
                >
                  돌아가기
                </button>
                <button
                  type="button"
                  disabled={isCancelling}
                  onClick={handleExecuteCancelReservation}
                  className="bg-[#e93d3d] hover:bg-[#d02c2c] text-white flex-1 py-2.5 text-xs font-bold rounded-xl shadow flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                >
                  {isCancelling ? '취소 처리 중...' : '동의하고 취소 확정'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ======================================================== */}
      {/* 💸 포인트 계좌 환불 요청 모달 (10% 수수료 제외 정책) */}
      {/* ======================================================== */}
      {showRefundModal && (
        <div className="modal-overlay" onClick={() => !isSubmittingRefund && setShowRefundModal(false)}>
          <div className="modal-content max-w-md space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center pb-2.5 border-b border-[#e5e8eb]">
              <h3 className="text-base font-bold text-[#191f28] flex items-center gap-1.5">
                <CreditCard size={18} className="text-[#e93d3d]" /> 포인트 계좌 환불 요청
              </h3>
              <button 
                onClick={() => !isSubmittingRefund && setShowRefundModal(false)}
                className="text-[#8b95a1] hover:text-[#191f28] text-2xl"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSubmitRefundRequest} className="space-y-3.5 text-xs">
              {/* 보유 포인트 및 환불 정책 안내 */}
              <div className="bg-[#f8f9fc] p-3.5 rounded-xl border border-[#e5e8eb] space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-[#8b95a1]">[{selectedBranchName}] 보유 포인트:</span>
                  <strong className="text-[#a67c48] font-bold">{displayPoints.toLocaleString()} P</strong>
                </div>
                <div className="text-[11px] text-[#e93d3d] bg-[#fff0f0] p-2.5 rounded-lg border border-[#ffd0d0] leading-relaxed">
                  ⚠️ <b>포인트 환불 규정</b>: 환불 신청 시 <b>10% 환불 수수료(원천징수/결제수수료)가 공제된 90% 금액이 입력하신 계좌로 입금</b>됩니다.
                </div>
              </div>

              {/* 환불 신청 포인트 입력 */}
              <div className="space-y-1">
                <label className="font-bold text-[#191f28]">환불 신청 포인트 (P) *</label>
                <div className="relative">
                  <input
                    type="number"
                    step="1000"
                    min="1000"
                    max={displayPoints}
                    required
                    value={refundAmountInput}
                    onChange={(e) => setRefundAmountInput(e.target.value)}
                    placeholder="환불할 포인트 금액"
                    className="form-input text-xs py-2 px-3 rounded-xl w-full border border-[#e5e8eb] bg-white font-bold text-[#191f28] focus:border-[#a67c48]"
                  />
                  <button
                    type="button"
                    onClick={() => setRefundAmountInput(String(displayPoints))}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold bg-[#a67c48]/10 text-[#a67c48] px-2 py-0.5 rounded-md hover:bg-[#a67c48]/20"
                  >
                    전액 신청
                  </button>
                </div>
                {/* 실지급액 프리뷰 */}
                {(() => {
                  const reqAmt = parseInt(refundAmountInput, 10) || 0;
                  const fee = Math.round(reqAmt * 0.1);
                  const payout = reqAmt - fee;
                  return (
                    <div className="flex justify-between text-[11px] pt-1 text-[#4e5968]">
                      <span>10% 수수료: -{fee.toLocaleString()}원</span>
                      <strong className="text-[#28a745]">실입금 예정액: {payout > 0 ? payout.toLocaleString() : 0}원</strong>
                    </div>
                  );
                })()}
              </div>

              {/* 환불 계좌 정보 입력 */}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="font-bold text-[#191f28]">입금 은행 *</label>
                  <select
                    value={refundBankName}
                    onChange={(e) => setRefundBankName(e.target.value)}
                    className="form-input text-xs py-2 px-3 rounded-xl w-full border border-[#e5e8eb] bg-white font-bold text-[#191f28] focus:border-[#a67c48]"
                  >
                    <option value="신한은행">신한은행</option>
                    <option value="국민은행">국민은행</option>
                    <option value="우리은행">우리은행</option>
                    <option value="하나은행">하나은행</option>
                    <option value="카카오뱅크">카카오뱅크</option>
                    <option value="토스뱅크">토스뱅크</option>
                    <option value="농협은행">농협은행</option>
                    <option value="기업은행">기업은행</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-[#191f28]">예금주명 *</label>
                  <input
                    type="text"
                    required
                    value={refundAccountHolder}
                    onChange={(e) => setRefundAccountHolder(e.target.value)}
                    placeholder="예금주 성함"
                    className="form-input text-xs py-2 px-3 rounded-xl w-full border border-[#e5e8eb] bg-white focus:border-[#a67c48]"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-[#191f28]">계좌번호 *</label>
                <input
                  type="text"
                  required
                  value={refundAccountNumber}
                  onChange={(e) => setRefundAccountNumber(e.target.value)}
                  placeholder="'-' 없이 숫자만 입력"
                  className="form-input text-xs py-2 px-3 rounded-xl w-full border border-[#e5e8eb] bg-white focus:border-[#a67c48]"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-[#191f28]">환불 신청 사유</label>
                <input
                  type="text"
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  placeholder="예: 이용 종료, 지점 변경 등"
                  className="form-input text-xs py-2 px-3 rounded-xl w-full border border-[#e5e8eb] bg-white focus:border-[#a67c48]"
                />
              </div>

              {/* 액션 버튼 */}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  disabled={isSubmittingRefund}
                  onClick={() => setShowRefundModal(false)}
                  className="gold-btn-outline flex-1 py-3 text-xs font-bold rounded-xl"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingRefund}
                  className="gold-btn flex-1 py-3 text-xs font-bold rounded-xl shadow flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                >
                  <Send size={13} /> {isSubmittingRefund ? '신청 중...' : '환불 신청 완료'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 🔄 지점 간 포인트 이전 신청 모달 */}
      {/* ======================================================== */}
      {showTransferModal && (
        <div className="modal-overlay" onClick={() => setShowTransferModal(false)}>
          <div className="modal-content max-w-sm space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center pb-2.5 border-b border-[#e5e8eb]">
              <h3 className="text-base font-bold text-[#191f28] flex items-center gap-1.5">
                <ArrowLeftRight size={18} className="text-[#a67c48]" /> 지점 간 포인트 이전 신청
              </h3>
              <button onClick={() => setShowTransferModal(false)} className="text-[#8b95a1] text-2xl">&times;</button>
            </div>

            <form 
              onSubmit={(e) => {
                e.preventDefault();
                const amt = parseInt(transferAmount, 10);
                if (isNaN(amt) || amt <= 0) {
                  alert('올바른 이전 금액을 입력해 주세요.');
                  return;
                }
                if (transferFromBranch === transferToBranch) {
                  alert('출발 지점과 도착 지점이 동일할 수 없습니다.');
                  return;
                }
                const fromPts = getBranchPoints ? getBranchPoints(currentUser || null, transferFromBranch) : (currentUser?.points || 0);
                if (fromPts < amt) {
                  alert(`출발 지점의 보유 포인트(${fromPts.toLocaleString()}P)가 부족합니다.`);
                  return;
                }
                if (onApplyPointTransfer) {
                  const ok = onApplyPointTransfer({
                    fromBranchId: transferFromBranch,
                    toBranchId: transferToBranch,
                    amount: amt,
                    reason: transferReason.trim(),
                  });
                  if (ok) {
                    setShowTransferModal(false);
                    setTransferAmount('10000');
                    setTransferReason('');
                  }
                }
              }}
              className="space-y-3 text-xs"
            >
              <div className="space-y-1">
                <label className="font-bold text-[#191f28]">출발 지점 (포인트 차감)</label>
                <select
                  value={transferFromBranch}
                  onChange={(e) => setTransferFromBranch(e.target.value)}
                  className="form-input text-xs py-2 px-3 rounded-xl w-full border border-[#e5e8eb] bg-white font-bold"
                >
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.name} (보유: {(getBranchPoints ? getBranchPoints(currentUser || null, b.id) : 0).toLocaleString()}P)
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-[#191f28]">도착 지점 (포인트 충전)</label>
                <select
                  value={transferToBranch}
                  onChange={(e) => setTransferToBranch(e.target.value)}
                  className="form-input text-xs py-2 px-3 rounded-xl w-full border border-[#e5e8eb] bg-white font-bold"
                >
                  {branches.filter(b => b.id !== transferFromBranch).map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-[#191f28]">이전 신청 포인트 (P)</label>
                <input
                  type="number"
                  step="1000"
                  min="1000"
                  required
                  value={transferAmount}
                  onChange={(e) => setTransferAmount(e.target.value)}
                  className="form-input text-xs py-2 px-3 rounded-xl w-full border border-[#e5e8eb] bg-white font-bold text-[#191f28]"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-[#191f28]">이전 사유 (선택)</label>
                <input
                  type="text"
                  value={transferReason}
                  onChange={(e) => setTransferReason(e.target.value)}
                  placeholder="예: 이사, 타 지점 스터디 이용"
                  className="form-input text-xs py-2 px-3 rounded-xl w-full border border-[#e5e8eb] bg-white"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowTransferModal(false)}
                  className="gold-btn-outline flex-1 py-3 text-xs font-bold rounded-xl"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="gold-btn flex-1 py-3 text-xs font-bold rounded-xl shadow flex items-center justify-center gap-1"
                >
                  <ArrowRight size={13} /> 이전 신청 완료
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 📱 대형 출입 바코드 팝업 모달 */}
      {/* ======================================================== */}
      {activeBarcodeReservation && (
        <div className="modal-overlay" onClick={() => setActiveBarcodeReservation(null)}>
          <div className="modal-content text-center space-y-4 max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center pb-2.5 border-b border-[#e5e8eb]">
              <div className="flex items-center gap-1.5">
                <QrCode size={20} className="text-[#a67c48]" />
                <h3 className="text-base font-bold text-[#191f28]">입장 전용 출입 바코드</h3>
              </div>
              <button 
                onClick={() => setActiveBarcodeReservation(null)}
                className="text-[#8b95a1] hover:text-[#191f28] text-2xl"
              >
                &times;
              </button>
            </div>

            <div className="space-y-1 pt-1">
              <span className="inline-block bg-[#a67c48]/10 text-[#a67c48] text-xs font-bold px-3 py-1 rounded-full">
                {rooms.find(r => r.id === activeBarcodeReservation.roomId)?.name || '공부방'}
              </span>
              <h4 className="text-base font-bold text-[#191f28]">
                {activeBarcodeReservation.date} ({activeBarcodeReservation.startTime} ~ {activeBarcodeReservation.endTime})
              </h4>
              <p className="text-xs text-[#8b95a1]">이용자: {activeBarcodeReservation.userName}님 ({activeBarcodeReservation.userPhone})</p>
            </div>

            {/* 대표 출입 바코드 */}
            <div className="py-2 flex justify-center">
              {masterBarcode?.type === 'image' ? (
                <div className="space-y-2">
                  <img
                    src={masterBarcode.value}
                    alt="등록된 출입 바코드"
                    className="max-h-64 object-contain mx-auto rounded-xl border border-[#e5e8eb] shadow-sm"
                  />
                  <p className="text-xs text-[#8b95a1]">관리자 등록 바코드 이미지</p>
                </div>
              ) : (
                <BarcodeView
                  value={masterBarcode?.value || activeBarcodeReservation.barcodeId}
                  height={90}
                />
              )}
            </div>

            <div className="bg-[#f8f9fc] p-3.5 rounded-xl text-xs text-[#4e5968] space-y-1">
              <p className="flex items-center justify-center gap-1 text-[#28a745] font-bold">
                <CheckCircle2 size={15} /> 키오스크 리더기에 막대 바코드를 태그해 주세요.
              </p>
              <p>바코드 상태: <strong className="text-[#191f28]">{activeBarcodeReservation.barcodeStatus === 'valid' ? '사용 가능' : '사용 완료'}</strong></p>
            </div>

            <button
              onClick={() => setActiveBarcodeReservation(null)}
              className="gold-btn w-full py-3.5 font-bold text-sm rounded-xl shadow cursor-pointer"
            >
              닫기
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
