import React, { useState } from 'react';
import type { Room, Reservation, BankInfo, MasterBarcode, UserAccount } from '../types';
import { ChevronRight, QrCode, Calendar, CheckCircle2, AlertCircle, Sparkles, Clock, Lock, User, Coins, FileText, Edit2, Check } from 'lucide-react';
import { BarcodeView } from './BarcodeView';

interface UserDashboardProps {
  currentUser?: UserAccount | null;
  rooms: Room[];
  reservations: Reservation[];
  bankInfo: BankInfo;
  masterBarcode?: MasterBarcode;
  onSelectRoom: (roomId: string) => void;
  onCancelAndRefundReservation?: (resId: string) => void;
  onOpenPointModal?: () => void;
  onUpdateUserProfile?: (userId: string, data: { name: string; phone: string; password?: string }) => Promise<{ success: boolean; message?: string }>;
}

// ⏱️ 예약 시간 기준 바코드 활성화 상태 판정 헬퍼 (5분 전 발급 ~ 종료 시간까지 유지, 종료 후 자동 소멸)
export function getBarcodeTimingState(dateStr: string, startTimeStr: string, endTimeStr: string): 'ACTIVE' | 'UPCOMING' | 'EXPIRED' {
  try {
    const now = new Date();
    const start = new Date(`${dateStr}T${startTimeStr}:00`);
    const end = new Date(`${dateStr}T${endTimeStr}:00`);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return 'ACTIVE';
    }

    // 예약 시작 5분 전부터 활성화
    const fiveMinBefore = new Date(start.getTime() - 5 * 60 * 1000);

    if (now < fiveMinBefore) {
      return 'UPCOMING';
    } else if (now >= fiveMinBefore && now <= end) {
      return 'ACTIVE'; // 이용 시간 끝날 때까지 활성화 유지
    } else {
      return 'EXPIRED'; // 이용 시간 종료 시 만료/소멸
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

export const UserDashboard: React.FC<UserDashboardProps> = ({
  currentUser,
  rooms,
  reservations,
  bankInfo,
  masterBarcode,
  onSelectRoom,
  onCancelAndRefundReservation,
  onOpenPointModal,
  onUpdateUserProfile,
}) => {
  const [showMyReservationsModal, setShowMyReservationsModal] = useState(false);
  const [showMyProfileModal, setShowMyProfileModal] = useState(false);
  const [activeBarcodeReservation, setActiveBarcodeReservation] = useState<Reservation | null>(null);

  // 회원 정보 수정 폼 상태
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
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

  // 🎟️ 출입 바코드 목록: 결제 완료되었으며, 이용 시간이 아직 끝나지 않은 유효/예정 건만 유지 (시간 종료 시 바코드 자동 소멸!)
  const activeAndUpcomingPasses = myReservations.filter((r) => {
    if (r.paymentStatus !== 'paid' || r.barcodeStatus === 'cancelled') return false;
    const timing = getBarcodeTimingState(r.date, r.startTime, r.endTime);
    return timing !== 'EXPIRED'; // ⏱️ 이용 시간이 끝난 바코드는 목록에서 즉시 소멸!
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

  return (
    <div className="flex-1 flex flex-col overflow-y-auto p-4 space-y-4">
      {/* 🟢 이용 시작 5분 전 ~ 이용 종료 시간까지 상단 대표 바코드 하이라이트 배너 노출 */}
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

      {/* 공부방 선택 세션 헤더 */}
      <div className="flex justify-between items-center pt-1">
        <div>
          <h2 className="text-base font-bold text-[#a67c48]">공부방 선택 및 실시간 예약</h2>
          <p className="text-xs text-[#8b95a1]">원하시는 공부방을 선택하여 스케줄을 확인하고 예약을 진행하세요.</p>
        </div>

        <button
          onClick={() => setShowMyReservationsModal(true)}
          className="gold-btn-outline text-xs py-2 px-3 rounded-xl font-bold flex items-center gap-1.5 shrink-0"
        >
          <QrCode size={15} /> 내 바코드 목록
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
              className="bg-[#f8f9fc] hover:bg-[#ffffff] border border-[#e5e8eb] hover:border-[#a67c48]/50 rounded-2xl p-4 flex justify-between items-center cursor-pointer transition-all duration-200 hover:-translate-y-0.5 shadow-sm"
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

              <div className="text-[#8b95a1] hover:text-[#a67c48] transition-colors shrink-0 pl-2">
                <ChevronRight size={22} />
              </div>
            </div>
          ))
        )}
      </div>

      {/* 👤 하단 내 정보 & 포인트 요약 카드 */}
      <div className="bg-[#ffffff] border border-[#a67c48]/30 rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-full bg-[#a67c48]/10 text-[#a67c48] flex items-center justify-center font-bold shrink-0">
              <User size={20} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#191f28] flex items-center gap-1.5">
                {currentUser?.name || '회원'}님
                <span className="text-[10px] font-bold bg-[#a67c48]/15 text-[#a67c48] px-2 py-0.5 rounded-full">
                  정회원
                </span>
              </h3>
              <p className="text-xs text-[#8b95a1]">{currentUser?.phone || '010-0000-0000'}</p>
            </div>
          </div>

          <button
            onClick={() => {
              setProfileMsg('');
              setProfileSuccessMsg('');
              setIsEditingProfile(false);
              setShowMyProfileModal(true);
            }}
            className="gold-btn-outline text-xs py-1.5 px-3 rounded-xl font-bold flex items-center gap-1 shrink-0"
          >
            <FileText size={13} /> 내 정보 / 예약 내역
          </button>
        </div>

        <div className="flex justify-between items-center bg-[#f8f9fc] p-3 rounded-xl border border-[#e5e8eb]">
          <div className="flex items-center gap-2">
            <Coins size={18} className="text-[#a67c48]" />
            <div>
              <span className="text-[11px] text-[#8b95a1]">보유 포인트</span>
              <p className="text-sm font-extrabold text-[#191f28]">{(currentUser?.points || 0).toLocaleString()} P</p>
            </div>
          </div>
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

      {/* 르하임 스터디카페 이용 안내 배너 */}
      <div className="bg-[#f8f9fc] border border-[#e5e8eb] rounded-2xl p-4 space-y-2 text-xs text-[#4e5968] leading-relaxed">
        <h4 className="font-bold text-[#a67c48] text-xs flex items-center gap-1">
          📌 르하임 이용 안내
        </h4>
        <ul className="list-disc pl-4 space-y-1 text-xs text-[#4e5968]">
          <li>공부방 예약은 <strong>30분 단위</strong>로 원하는 시간만큼 자유롭게 신청할 수 있습니다.</li>
          <li>출입 바코드는 <strong>이용 시작 5분 전</strong>에 자동 활성화되며, <strong>이용 시간 종료 시 자동 소멸</strong>됩니다.</li>
          <li>무통장 입금 계좌: <strong>{bankInfo.bankName} {bankInfo.accountNumber} (예금주: {bankInfo.accountHolder})</strong></li>
        </ul>
      </div>

      {/* 📱 화면 중앙 출입 바코드 팝업 모달 */}
      {activeBarcodeReservation && (
        <div className="modal-overlay" onClick={() => setActiveBarcodeReservation(null)}>
          <div className="modal-content text-center space-y-4" onClick={(e) => e.stopPropagation()}>
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

            {/* 📊 대표 출입 바코드 렌더링 (사진 또는 막대 바코드) */}
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
              className="gold-btn w-full py-3.5 font-bold text-sm rounded-xl shadow"
            >
              닫기
            </button>
          </div>
        </div>
      )}

      {/* 내 바코드 목록 모달 */}
      {showMyReservationsModal && (
        <div className="modal-overlay" onClick={() => setShowMyReservationsModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-bold text-[#191f28] flex items-center gap-1.5">
                <QrCode size={18} className="text-[#a67c48]" /> 내 출입 바코드 목록
              </h3>
              <button onClick={() => setShowMyReservationsModal(false)} className="text-[#8b95a1] text-2xl">&times;</button>
            </div>

            <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
              {activeAndUpcomingPasses.length === 0 ? (
                <div className="text-center py-10 border border-dashed border-[#e5e8eb] rounded-2xl bg-[#f8f9fc] space-y-2">
                  <QrCode size={30} className="mx-auto text-[#b0b8c1]" />
                  <p className="text-xs font-bold text-[#191f28]">
                    {currentUser?.name ? `${currentUser.name}님의 유효한 출입 바코드가 없습니다.` : '유효한 출입 바코드가 없습니다.'}
                  </p>
                  <p className="text-[11px] text-[#8b95a1]">
                    이용 시작 5분 전에 자동 활성화되며, 이용 시간이 종료되면 바코드가 자동 소멸됩니다.
                  </p>
                </div>
              ) : (
                activeAndUpcomingPasses.map((res) => {
                  const room = rooms.find((r) => r.id === res.roomId);
                  const timingState = getBarcodeTimingState(res.date, res.startTime, res.endTime);
                  const isActive = timingState === 'ACTIVE';

                  return (
                    <div key={res.id} className="border border-[#a67c48]/30 rounded-2xl p-4 bg-[#ffffff] shadow-sm space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="text-sm font-bold text-[#191f28]">{res.userName}님</span>
                          <span className="text-xs font-semibold text-[#a67c48] ml-2">({room?.name || '공부방'})</span>
                        </div>
                        {isActive ? (
                          <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-[#28a745]/10 text-[#28a745] flex items-center gap-1 animate-pulse">
                            ● 출입 가능
                          </span>
                        ) : (
                          <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-[#f59e0b]/10 text-[#f59e0b] flex items-center gap-1">
                            <Clock size={11} /> 5분 전 발급 예정
                          </span>
                        )}
                      </div>

                      {isActive ? (
                        <div 
                          onClick={() => {
                            setShowMyReservationsModal(false);
                            handleOpenBarcodePass(res);
                          }}
                          className="bg-[#f8f9fc] p-3 rounded-xl border border-[#e5e8eb] hover:border-[#a67c48] cursor-pointer transition-all space-y-1.5 text-center group"
                        >
                          <BarcodeView value={res.barcodeId} height={60} showText={true} />
                          <p className="text-[11px] text-[#a67c48] font-bold pt-1 group-hover:underline flex items-center justify-center gap-1">
                            터치 시 대형 바코드 열기 🔍
                          </p>
                        </div>
                      ) : (
                        <div className="bg-[#f8f9fc] p-3.5 rounded-xl border border-dashed border-[#e5e8eb] text-center space-y-1.5">
                          <div className="flex items-center justify-center gap-1 text-xs font-bold text-[#4e5968]">
                            <Lock size={13} className="text-[#a67c48]" /> 이용 시작 5분 전 바코드가 활성화됩니다.
                          </div>
                          <p className="text-[11px] text-[#8b95a1]">
                            활성화 예정: <strong className="text-[#a67c48]">{res.date} {getActivateTimeString(res.startTime)}</strong>
                          </p>
                        </div>
                      )}

                      <div className="text-xs text-[#8b95a1] flex justify-between items-center pt-2 border-t border-[#e5e8eb]">
                        <span className="flex items-center gap-1 text-[#191f28] font-medium">
                          <Calendar size={13} className="text-[#a67c48]" /> {res.date} ({res.startTime} ~ {res.endTime})
                        </span>
                        {onCancelAndRefundReservation && !isActive && (
                          <button
                            onClick={() => {
                              if (confirm(`'${room?.name}' 예약을 취소하시겠습니까? 결제하신 금액(포인트)이 즉시 환불됩니다.`)) {
                                onCancelAndRefundReservation(res.id);
                              }
                            }}
                            className="text-xs text-[#e93d3d] font-bold border border-[#e93d3d]/30 bg-[#e93d3d]/5 px-2.5 py-1 rounded-lg hover:bg-[#e93d3d]/10 transition-colors"
                          >
                            예약 취소
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <button
              onClick={() => setShowMyReservationsModal(false)}
              className="gold-btn-outline w-full py-3 text-xs font-bold rounded-xl mt-4"
            >
              닫기
            </button>
          </div>
        </div>
      )}

      {/* 📋 내 정보 & 전체 예약/이용 내역 + 정보 수정 모달 */}
      {showMyProfileModal && (
        <div className="modal-overlay" onClick={() => setShowMyProfileModal(false)}>
          <div className="modal-content max-w-md space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center pb-2 border-b border-[#e5e8eb]">
              <h3 className="text-base font-bold text-[#191f28] flex items-center gap-1.5">
                <User size={18} className="text-[#a67c48]" /> 내 정보 및 예약 내역
              </h3>
              <button onClick={() => setShowMyProfileModal(false)} className="text-[#8b95a1] hover:text-[#191f28] text-2xl">&times;</button>
            </div>

            {/* 1. 회원 프로필 요약 및 수정 카드 */}
            <div className="bg-[#f8f9fc] border border-[#e5e8eb] rounded-2xl p-4 space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="text-sm font-bold text-[#191f28] flex items-center gap-1.5">
                    {currentUser?.name}님
                    <span className="text-[10px] font-bold bg-[#a67c48]/15 text-[#a67c48] px-2 py-0.5 rounded-full">
                      정회원
                    </span>
                  </h4>
                  <p className="text-xs text-[#8b95a1] pt-0.5">아이디: {currentUser?.userId}</p>
                </div>

                {!isEditingProfile ? (
                  <button
                    onClick={() => {
                      setEditName(currentUser?.name || '');
                      setEditPhone(currentUser?.phone || '');
                      setEditPassword('');
                      setProfileMsg('');
                      setProfileSuccessMsg('');
                      setIsEditingProfile(true);
                    }}
                    className="gold-btn-outline text-xs py-1 px-2.5 rounded-lg font-bold flex items-center gap-1 shrink-0"
                  >
                    <Edit2 size={12} /> 정보 수정
                  </button>
                ) : null}
              </div>

              {isEditingProfile ? (
                /* 정보 수정 폼 */
                <div className="bg-white p-3.5 rounded-xl border border-[#a67c48]/40 space-y-2.5">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-[#4e5968] block">이름 (성함)</label>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="이름 입력"
                      className="form-input text-xs py-2 px-3 rounded-lg w-full border border-[#e5e8eb] focus:border-[#a67c48] outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-[#4e5968] block">연락처 (휴대폰 번호)</label>
                    <input
                      type="tel"
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value)}
                      placeholder="010-0000-0000"
                      className="form-input text-xs py-2 px-3 rounded-lg w-full border border-[#e5e8eb] focus:border-[#a67c48] outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-[#4e5968] block">비밀번호 변경 (선택)</label>
                    <input
                      type="password"
                      value={editPassword}
                      onChange={(e) => setEditPassword(e.target.value)}
                      placeholder="변경할 때만 입력하세요"
                      className="form-input text-xs py-2 px-3 rounded-lg w-full border border-[#e5e8eb] focus:border-[#a67c48] outline-none"
                    />
                  </div>

                  {profileMsg && (
                    <div className="text-[11px] text-[#e93d3d] font-bold bg-[#e93d3d]/10 p-2 rounded-lg">
                      {profileMsg}
                    </div>
                  )}

                  {profileSuccessMsg && (
                    <div className="text-[11px] text-[#28a745] font-bold bg-[#28a745]/10 p-2 rounded-lg flex items-center gap-1">
                      <Check size={13} /> {profileSuccessMsg}
                    </div>
                  )}

                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setIsEditingProfile(false)}
                      className="gold-btn-outline flex-1 py-2 text-xs font-bold rounded-lg"
                    >
                      취소
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveProfile}
                      disabled={isSavingProfile}
                      className="gold-btn flex-1 py-2 text-xs font-bold rounded-lg shadow-sm flex items-center justify-center gap-1"
                    >
                      <Check size={13} /> {isSavingProfile ? '저장 중...' : '저장 완료'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex justify-between items-center bg-white p-2.5 rounded-xl border border-[#e5e8eb] text-xs">
                  <span className="text-[#8b95a1]">연락처</span>
                  <span className="font-bold text-[#191f28]">{currentUser?.phone || '미등록'}</span>
                </div>
              )}
            </div>

            {/* 2. 내 전체 예약 내역 리스트 */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-[#191f28] flex items-center justify-between">
                <span>전체 예약 / 이용 내역 ({myReservations.length}건)</span>
                <span className="text-[11px] text-[#8b95a1] font-normal">최신순 정렬</span>
              </h4>

              <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                {myReservations.length === 0 ? (
                  <div className="text-center py-8 border border-dashed border-[#e5e8eb] rounded-xl bg-[#f8f9fc] text-xs text-[#8b95a1]">
                    예약 내역이 없습니다.
                  </div>
                ) : (
                  myReservations.map((res) => {
                    const room = rooms.find(r => r.id === res.roomId);
                    const timing = getBarcodeTimingState(res.date, res.startTime, res.endTime);
                    const isCancelled = res.barcodeStatus === 'cancelled';
                    const isActive = !isCancelled && timing === 'ACTIVE';
                    const isUpcoming = !isCancelled && timing === 'UPCOMING';

                    return (
                      <div 
                        key={res.id}
                        className={`p-3 rounded-xl border text-xs space-y-2 transition-all ${
                          isActive 
                            ? 'bg-[#a67c48]/5 border-[#a67c48]' 
                            : isCancelled 
                            ? 'bg-[#fbf0f0] border-[#f5c6cb] opacity-70' 
                            : 'bg-white border-[#e5e8eb]'
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="font-bold text-[#191f28] text-sm">{room?.name || '공부방'}</span>
                            <p className="text-xs text-[#8b95a1] flex items-center gap-1 pt-0.5">
                              <Calendar size={12} className="text-[#a67c48]" />
                              {res.date} ({res.startTime} ~ {res.endTime})
                            </p>
                          </div>

                          <div>
                            {isCancelled ? (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#e93d3d]/10 text-[#e93d3d]">
                                취소됨
                              </span>
                            ) : isActive ? (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#28a745]/10 text-[#28a745] animate-pulse">
                                ● 이용 중
                              </span>
                            ) : isUpcoming ? (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#f59e0b]/10 text-[#f59e0b]">
                                이용 대기
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#8b95a1]/10 text-[#8b95a1]">
                                이용 완료
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex justify-between items-center pt-1.5 border-t border-[#f1f3f5]">
                          <span className="text-[11px] text-[#8b95a1]">
                            결제 포인트: <strong className="text-[#191f28]">{(res.costPoints || 4000).toLocaleString()} P</strong>
                          </span>

                          <div className="flex items-center gap-1.5">
                            {isActive && (
                              <button
                                onClick={() => {
                                  setShowMyProfileModal(false);
                                  handleOpenBarcodePass(res);
                                }}
                                className="text-[11px] font-bold bg-[#a67c48] text-white px-2 py-0.5 rounded-lg shadow-sm"
                              >
                                바코드 보기
                              </button>
                            )}

                            {onCancelAndRefundReservation && isUpcoming && (
                              <button
                                onClick={() => {
                                  if (confirm(`'${room?.name}' 예약을 취소하시겠습니까? 결제하신 포인트가 즉시 환불됩니다.`)) {
                                    onCancelAndRefundReservation(res.id);
                                  }
                                }}
                                className="text-[11px] font-bold text-[#e93d3d] bg-[#e93d3d]/10 px-2 py-0.5 rounded-lg hover:bg-[#e93d3d]/20 transition-colors"
                              >
                                취소/환불
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <button
              onClick={() => setShowMyProfileModal(false)}
              className="gold-btn-outline w-full py-3 text-xs font-bold rounded-xl"
            >
              닫기
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
