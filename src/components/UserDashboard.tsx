import React, { useState } from 'react';
import type { Room, Reservation, BankInfo, MasterBarcode, UserAccount } from '../types';
import { ChevronRight, QrCode, Calendar, CheckCircle2, AlertCircle, Sparkles, Clock } from 'lucide-react';
import { BarcodeView } from './BarcodeView';

interface UserDashboardProps {
  currentUser?: UserAccount | null;
  rooms: Room[];
  reservations: Reservation[];
  bankInfo: BankInfo;
  masterBarcode?: MasterBarcode;
  onSelectRoom: (roomId: string) => void;
  onCancelAndRefundReservation?: (resId: string) => void;
}

export const UserDashboard: React.FC<UserDashboardProps> = ({
  currentUser,
  rooms,
  reservations,
  bankInfo,
  masterBarcode,
  onSelectRoom,
  onCancelAndRefundReservation,
}) => {
  const [showMyReservationsModal, setShowMyReservationsModal] = useState(false);
  const [activeBarcodeReservation, setActiveBarcodeReservation] = useState<Reservation | null>(null);

  // 🔒 현재 접속자(currentUser)의 본인 예약 내역만 필터링
  const myReservations = currentUser
    ? reservations.filter((r) => 
        (r.userName && r.userName === currentUser.name) || 
        (r.userPhone && currentUser.phone && r.userPhone === currentUser.phone)
      )
    : reservations;

  // 결제 완료된 내 예약 건 필터링 (valid 상태 우선)
  const paidReservations = myReservations.filter((r) => r.paymentStatus === 'paid');
  const activeValidPass = paidReservations.find((r) => r.barcodeStatus === 'valid') || paidReservations[0];

  // 무통장 입금 대기 중인 내 예약 건
  const pendingReservations = myReservations.filter((r) => r.paymentStatus === 'deposit_pending');

  const handleOpenBarcodePass = (res: Reservation) => {
    setActiveBarcodeReservation(res);
  };

  return (
    <div className="flex-1 flex flex-col overflow-y-auto p-4 space-y-4">
      {/* 🟢 결제 완료된 활성 출입 바코드 하이라이트 카드 (존재하는 경우) */}
      {activeValidPass ? (
        <div 
          onClick={() => handleOpenBarcodePass(activeValidPass)}
          className="bg-gradient-to-r from-[#a67c48] to-[#c29d6d] text-white rounded-2xl p-4 shadow-md cursor-pointer transition-all transform hover:scale-[1.01] active:scale-[0.99] flex items-center justify-between border border-[#a67c48]/30"
        >
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-bold bg-white/20 px-2.5 py-0.5 rounded-full w-max backdrop-blur-sm">
              <Sparkles size={13} className="text-yellow-200" />
              <span>입장 가능 출입 바코드 발급 완료</span>
            </div>
            <h3 className="text-base font-bold flex items-center gap-1.5 text-white">
              <QrCode size={18} /> 출입 바코드 터치하여 열기
            </h3>
            <p className="text-xs opacity-95 flex items-center gap-1">
              <Clock size={13} />
              {rooms.find(r => r.id === activeValidPass.roomId)?.name || '공부방'} | {activeValidPass.date} ({activeValidPass.startTime}~{activeValidPass.endTime})
            </p>
          </div>
          <button className="bg-white text-[#a67c48] text-xs font-bold px-3.5 py-2.5 rounded-xl shadow shrink-0">
            바코드 보기
          </button>
        </div>
      ) : pendingReservations.length > 0 && (
        <div className="bg-[#f59e0b]/10 border border-[#f59e0b]/30 rounded-2xl p-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <AlertCircle size={20} className="text-[#f59e0b] shrink-0" />
            <div>
              <h4 className="text-sm font-bold text-[#191f28]">무통장 입금 확인 대기 중 ({pendingReservations.length}건)</h4>
              <p className="text-xs text-[#8b95a1]">관리자 입금 확인 후 출입 바코드가 자동 발급됩니다.</p>
            </div>
          </div>
          <button
            onClick={() => setShowMyReservationsModal(true)}
            className="text-xs font-bold text-[#f59e0b] border border-[#f59e0b]/40 px-3 py-1.5 rounded-lg hover:bg-[#f59e0b]/10 transition-colors"
          >
            내역 확인
          </button>
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

      {/* 르하임 스터디카페 이용 안내 배너 */}
      <div className="bg-[#f8f9fc] border border-[#e5e8eb] rounded-2xl p-4 space-y-2 text-xs text-[#4e5968] leading-relaxed">
        <h4 className="font-bold text-[#a67c48] text-xs flex items-center gap-1">
          📌 르하임 이용 안내
        </h4>
        <ul className="list-disc pl-4 space-y-1 text-xs text-[#4e5968]">
          <li>공부방 예약은 <strong>30분 단위</strong>로 원하는 시간만큼 자유롭게 신청할 수 있습니다.</li>
          <li>결제가 완료되면 <strong>출입 바코드</strong>가 자동 생성되어 키오스크에서 스캔 후 즉시 입장이 가능합니다.</li>
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

      {/* 내 예약 목록 및 바코드 모달 */}
      {showMyReservationsModal && (
        <div className="modal-overlay" onClick={() => setShowMyReservationsModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-bold text-[#191f28] flex items-center gap-1.5">
                <QrCode size={18} className="text-[#a67c48]" /> 내 예약 내역 및 출입 바코드
              </h3>
              <button onClick={() => setShowMyReservationsModal(false)} className="text-[#8b95a1] text-2xl">&times;</button>
            </div>

            <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
              {myReservations.length === 0 ? (
                <p className="text-xs text-[#8b95a1] text-center py-8 border border-dashed border-[#e5e8eb] rounded-xl">
                  {currentUser?.name ? `${currentUser.name}님의 등록된 예약 내역이 없습니다.` : '등록된 예약 내역이 없습니다.'}
                </p>
              ) : (
                myReservations.map((res) => {
                  const room = rooms.find((r) => r.id === res.roomId);
                  const isPaid = res.paymentStatus === 'paid';
                  return (
                    <div key={res.id} className="border border-[#e5e8eb] rounded-2xl p-4 bg-[#f8f9fc] space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="text-sm font-bold text-[#191f28]">{res.userName}님</span>
                          <span className="text-xs text-[#8b95a1] ml-2">({room?.name})</span>
                        </div>
                        <span
                          className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                            isPaid ? 'bg-[#28a745]/10 text-[#28a745]' : 'bg-[#f59e0b]/10 text-[#f59e0b]'
                          }`}
                        >
                          {isPaid ? '결제 완료 (출입가능)' : '무통장 입금 대기'}
                        </span>
                      </div>

                      {/* 바코드 비주얼 패널 */}
                      {isPaid ? (
                        <div 
                          onClick={() => {
                            setShowMyReservationsModal(false);
                            handleOpenBarcodePass(res);
                          }}
                          className="bg-white p-3 rounded-xl border border-[#a67c48]/30 hover:border-[#a67c48] cursor-pointer transition-all space-y-1.5 text-center group"
                        >
                          <BarcodeView value={res.barcodeId} height={60} showText={true} />
                          <p className="text-xs text-[#a67c48] font-bold pt-1 group-hover:underline">
                            터치 시 대형 출입 바코드 모달 열기 🔍
                          </p>
                        </div>
                      ) : (
                        <div className="bg-[#e5e8eb]/40 p-3.5 rounded-xl border border-dashed border-[#e5e8eb] text-center space-y-1">
                          <p className="text-xs font-bold text-[#4e5968]">입금 확인 후 출입 바코드가 활성화됩니다.</p>
                          <p className="text-xs text-[#8b95a1]">계좌: {bankInfo.bankName} {bankInfo.accountNumber}</p>
                        </div>
                      )}

                      <div className="text-xs text-[#8b95a1] flex justify-between items-center pt-2 border-t border-[#e5e8eb]">
                        <span className="flex items-center gap-1 text-[#191f28]">
                          <Calendar size={13} className="text-[#a67c48]" /> {res.date} ({res.startTime} ~ {res.endTime})
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-[#a67c48] font-bold">
                            {res.paymentMethod === 'points' ? '포인트 결제' : '무통장 입금'}
                          </span>
                          {onCancelAndRefundReservation && res.barcodeStatus === 'valid' && (
                            <button
                              onClick={() => {
                                if (confirm(`'${room?.name}' 예약을 취소하시겠습니까? 결제하신 금액(포인트)이 즉시 환불됩니다.`)) {
                                  onCancelAndRefundReservation(res.id);
                                }
                              }}
                              className="text-xs text-[#e93d3d] font-bold border border-[#e93d3d]/30 bg-[#e93d3d]/5 px-2.5 py-1 rounded-lg hover:bg-[#e93d3d]/10 transition-colors"
                            >
                              예약 취소/환불
                            </button>
                          )}
                        </div>
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
    </div>
  );
};
