import React, { useState } from 'react';
import type { Room, Reservation, BankInfo, MasterBarcode, PointTransaction } from '../types';
import { ChevronRight, QrCode, Calendar, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';
import { BarcodeView } from './BarcodeView';

interface UserDashboardProps {
  rooms: Room[];
  reservations: Reservation[];
  bankInfo: BankInfo;
  masterBarcode?: MasterBarcode;
  pointTransactions?: PointTransaction[];
  onSelectRoom: (roomId: string) => void;
  onApplyPointCharge?: (amount: number) => void;
  onCancelAndRefundReservation?: (resId: string) => void;
}

export const UserDashboard: React.FC<UserDashboardProps> = ({
  rooms,
  reservations,
  bankInfo,
  masterBarcode,
  pointTransactions = [],
  onSelectRoom,
  onApplyPointCharge,
  onCancelAndRefundReservation,
}) => {
  const [showMyReservationsModal, setShowMyReservationsModal] = useState(false);
  const [activeBarcodeReservation, setActiveBarcodeReservation] = useState<Reservation | null>(null);

  // 결제 완료된 예약 건 필터링 (valid 상태 우선)
  const paidReservations = reservations.filter((r) => r.paymentStatus === 'paid');
  const activeValidPass = paidReservations.find((r) => r.barcodeStatus === 'valid') || paidReservations[0];

  const handleOpenBarcodePass = (res: Reservation) => {
    setActiveBarcodeReservation(res);
  };

  return (
    <div className="flex-1 flex flex-col overflow-y-auto p-4 space-y-5">
      {/* 🟢 결제 완료된 활성 출입 바코드 하이라이트 카드 (존재하는 경우) */}
      {activeValidPass ? (
        <div 
          onClick={() => handleOpenBarcodePass(activeValidPass)}
          className="bg-gradient-to-r from-[#b09168] to-[#c5a880] text-white rounded-2xl p-4 shadow-lg cursor-pointer transition-all transform hover:scale-[1.01] active:scale-[0.99] flex items-center justify-between border border-[#b09168]/30"
        >
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-bold bg-white/20 px-2 py-0.5 rounded-full w-max backdrop-blur-sm">
              <Sparkles size={12} className="text-yellow-200" />
              <span>입장 가능 출입 바코드 발급 완료</span>
            </div>
            <h3 className="text-sm font-extrabold flex items-center gap-1 text-white">
              <QrCode size={18} /> 출입 바코드 터치하여 열기
            </h3>
            <p className="text-[11px] opacity-90">
              {rooms.find(r => r.id === activeValidPass.roomId)?.name || '공부방'} | {activeValidPass.date} ({activeValidPass.startTime}~{activeValidPass.endTime})
            </p>
          </div>
          <button className="bg-white text-[#b09168] text-xs font-bold px-3 py-2 rounded-xl shadow shrink-0">
            바코드 표시
          </button>
        </div>
      ) : reservations.length > 0 && (
        <div className="bg-[#ff9500]/10 border border-[#ff9500]/30 rounded-2xl p-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <AlertCircle size={20} className="text-[#ff9500] shrink-0" />
            <div>
              <h4 className="text-xs font-bold text-[#1c1c1e]">무통장 입금 대기 중</h4>
              <p className="text-[10px] text-[#8e8e93]">관리자 입금 확인 후 출입 바코드가 자동 활성화됩니다.</p>
            </div>
          </div>
          <button
            onClick={() => setShowMyReservationsModal(true)}
            className="text-[11px] font-bold text-[#ff9500] border border-[#ff9500]/40 px-2.5 py-1 rounded-lg hover:bg-[#ff9500]/10"
          >
            내역 확인
          </button>
        </div>
      )}

      {/* 공부방 선택 세션 헤더 */}
      <div className="flex justify-between items-center pt-1">
        <div>
          <h2 className="text-base font-bold text-[#b09168]">공부방 선택 및 실시간 예약</h2>
          <p className="text-xs text-[#8e8e93]">원하시는 공부방을 선택하여 스케줄을 확인하고 예약을 진행하세요.</p>
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
          <div className="text-center py-12 text-[#8e8e93] border border-dashed border-[#e5e5ea] rounded-xl bg-white">
            현재 이용 가능한 공부방이 없습니다.
          </div>
        ) : (
          rooms.map((room, index) => (
            <div
              key={room.id}
              onClick={() => onSelectRoom(room.id)}
              className="bg-[#f8f9fa] hover:bg-[#ffffff] border border-[#e5e5ea] hover:border-[#b09168]/50 rounded-xl p-4 flex justify-between items-center cursor-pointer transition-all duration-200 hover:-translate-y-0.5 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <span className="text-sm font-extrabold text-[#b09168] tracking-wider shrink-0">
                  ROOM {index + 1}
                </span>
                <span className="text-[#e5e5ea]">|</span>
                <div>
                  <h3 className="text-sm font-bold text-[#1c1c1e]">{room.name}</h3>
                  <p className="text-[11px] text-[#8e8e93]">{room.description}</p>
                </div>
              </div>

              <div className="text-[#8e8e93] hover:text-[#b09168] transition-colors shrink-0">
                <ChevronRight size={20} />
              </div>
            </div>
          ))
        )}
      </div>

      {/* 르하임 스터디카페 이용 안내 배너 */}
      <div className="bg-[#f8f9fa] border border-[#e5e5ea] rounded-xl p-4 space-y-2 text-xs text-[#8e8e93] leading-relaxed">
        <h4 className="font-bold text-[#b09168] text-xs">르하임 이용 안내</h4>
        <ul className="list-disc pl-4 space-y-1 text-[11px]">
          <li>공부방 예약은 **30분 단위**로 신청할 수 있습니다.</li>
          <li>결제가 완료되면 **출입 바코드**가 자동 생성되어 키오스크에서 스캔 후 입장이 가능합니다.</li>
          <li>무통장 입금 계좌: <strong>{bankInfo.bankName} {bankInfo.accountNumber} (예금주: {bankInfo.accountHolder})</strong></li>
        </ul>
      </div>

      {/* 📱 화면 중앙 출입 바코드 팝업 모달 */}
      {activeBarcodeReservation && (
        <div className="modal-overlay" onClick={() => setActiveBarcodeReservation(null)}>
          <div className="modal-content text-center space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center pb-2 border-b border-[#e5e5ea]">
              <div className="flex items-center gap-1.5">
                <QrCode size={20} className="text-[#b09168]" />
                <h3 className="text-base font-bold text-[#1c1c1e]">입장 전용 출입 바코드</h3>
              </div>
              <button 
                onClick={() => setActiveBarcodeReservation(null)}
                className="text-[#8e8e93] hover:text-[#1c1c1e] text-2xl"
              >
                &times;
              </button>
            </div>

            <div className="space-y-1 pt-1">
              <span className="inline-block bg-[#b09168]/10 text-[#b09168] text-[11px] font-bold px-2.5 py-0.5 rounded-full">
                {rooms.find(r => r.id === activeBarcodeReservation.roomId)?.name || '공부방'}
              </span>
              <h4 className="text-sm font-extrabold text-[#1c1c1e]">
                {activeBarcodeReservation.date} ({activeBarcodeReservation.startTime} ~ {activeBarcodeReservation.endTime})
              </h4>
              <p className="text-xs text-[#8e8e93]">이용자: {activeBarcodeReservation.userName}님 ({activeBarcodeReservation.userPhone})</p>
            </div>

            {/* 📊 대표 출입 바코드 렌더링 (사진 또는 막대 그래프) */}
            <div className="py-2 flex justify-center">
              {masterBarcode?.type === 'image' ? (
                <div className="space-y-2">
                  <img
                    src={masterBarcode.value}
                    alt="등록된 출입 바코드"
                    className="max-h-64 object-contain mx-auto rounded-xl border border-[#e5e5ea] shadow-sm"
                  />
                  <p className="text-[10px] text-[#8e8e93]">관리자 등록 바코드 이미지</p>
                </div>
              ) : (
                <BarcodeView
                  value={masterBarcode?.value || activeBarcodeReservation.barcodeId}
                  height={90}
                />
              )}
            </div>

            <div className="bg-[#f8f9fa] p-3 rounded-xl text-[11px] text-[#8e8e93] space-y-1">
              <p className="flex items-center justify-center gap-1 text-[#34c759] font-bold">
                <CheckCircle2 size={13} /> 키오스크 리더기에 막대 바코드를 태그해 주세요.
              </p>
              <p>바코드 상태: <strong className="text-[#1c1c1e]">{activeBarcodeReservation.barcodeStatus === 'valid' ? '사용 가능' : '사용 완료'}</strong></p>
            </div>

            <button
              onClick={() => setActiveBarcodeReservation(null)}
              className="gold-btn w-full py-3 font-bold text-sm rounded-xl shadow"
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
              <h3 className="text-base font-bold text-[#1c1c1e] flex items-center gap-1.5">
                <QrCode size={18} className="text-[#b09168]" /> 내 예약 내역 및 출입 바코드
              </h3>
              <button onClick={() => setShowMyReservationsModal(false)} className="text-[#8e8e93] text-xl">&times;</button>
            </div>

            <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
              {reservations.length === 0 ? (
                <p className="text-xs text-[#8e8e93] text-center py-8 border border-dashed border-[#e5e5ea] rounded-xl">
                  등록된 예약 내역이 없습니다.
                </p>
              ) : (
                reservations.map((res) => {
                  const room = rooms.find((r) => r.id === res.roomId);
                  const isPaid = res.paymentStatus === 'paid';
                  return (
                    <div key={res.id} className="border border-[#e5e5ea] rounded-xl p-3.5 bg-[#f8f9fa] space-y-2.5">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="text-xs font-bold text-[#1c1c1e]">{res.userName}님</span>
                          <span className="text-[10px] text-[#8e8e93] ml-2">({room?.name})</span>
                        </div>
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                            isPaid ? 'bg-[#34c759]/10 text-[#34c759]' : 'bg-[#ff9500]/10 text-[#ff9500]'
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
                          className="bg-white p-2.5 rounded-lg border border-[#b09168]/40 hover:border-[#b09168] cursor-pointer transition-all space-y-1 text-center group"
                        >
                          <BarcodeView value={res.barcodeId} height={60} showText={true} />
                          <p className="text-[10px] text-[#b09168] font-bold pt-1 group-hover:underline">
                            터치 시 대형 출입 바코드 모달 열기 🔍
                          </p>
                        </div>
                      ) : (
                        <div className="bg-[#e5e5ea]/40 p-3 rounded-lg border border-dashed border-[#e5e5ea] text-center space-y-1">
                          <p className="text-xs font-bold text-[#8e8e93]">입금 확인 후 출입 바코드가 활성화됩니다.</p>
                          <p className="text-[10px] text-[#8e8e93]">계좌: {bankInfo.bankName} {bankInfo.accountNumber}</p>
                        </div>
                      )}

                      <div className="text-[10px] text-[#8e8e93] flex justify-between items-center pt-1 border-t border-[#e5e5ea]/60">
                        <span className="flex items-center gap-1">
                          <Calendar size={11} /> {res.date} ({res.startTime} ~ {res.endTime})
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-[#b09168] font-bold">
                            {res.paymentMethod === 'points' ? '포인트 결제' : '무통장 입금'}
                          </span>
                          {onCancelAndRefundReservation && res.barcodeStatus === 'valid' && (
                            <button
                              onClick={() => {
                                if (confirm(`'${room?.name}' 예약을 취소하시겠습니까? 결제하신 포인트(4,000P)가 즉시 환불됩니다.`)) {
                                  onCancelAndRefundReservation(res.id);
                                }
                              }}
                              className="text-[10px] text-[#ff3b30] font-bold border border-[#ff3b30]/30 bg-[#ff3b30]/5 px-2 py-0.5 rounded hover:bg-[#ff3b30]/10"
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
              className="gold-btn-outline w-full py-2.5 text-xs font-bold rounded-xl mt-4"
            >
              닫기
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
